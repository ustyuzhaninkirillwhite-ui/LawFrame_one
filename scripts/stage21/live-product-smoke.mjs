#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const artifactsDir = path.join(repoRoot, "artifacts", "stage21");
const smokeArtifactPath = path.join(artifactsDir, "live-product-smoke.json");
const dbEvidencePath = path.join(artifactsDir, "live-product-smoke-db-evidence.json");
const providerProbePath = path.join(artifactsDir, "live-product-smoke-provider-probe.json");
const safeConfigPath = path.join(artifactsDir, "live-product-smoke-ai-config-safe.json");
const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/stage16_runtime";
const DEFAULT_BASE_URL = "https://api.cometapi.com/v1";
const DEFAULT_MODEL = "deepseek-v4-pro";
const chatMarker = "LEXFRAME_CHAT_SMOKE_OK";
const secretPattern =
  /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|BEGIN PRIVATE KEY)/i;
const allowedPartialStatuses = new Set([
  "PARTIAL_EXTERNAL_PROVIDER_BLOCKER",
  "PARTIAL_RUNTIME_BLOCKER",
]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  mkdirSync(artifactsDir, { recursive: true });
  const aiConfig = await readAiConfig(args.aiConfig);
  const safeConfig = {
    provider: "cometapi",
    sourceClass: aiConfig.keyDiagnostics.sourceClass,
    baseUrl: aiConfig.baseUrl,
    model: aiConfig.model,
    keyFingerprint: fingerprintSecret(aiConfig.apiKey),
    rawLength: aiConfig.keyDiagnostics.rawLength,
    sanitizedLength: aiConfig.keyDiagnostics.sanitizedLength,
    expectedLengthMatched: aiConfig.keyDiagnostics.expectedLengthMatched,
    previousFingerprintUsed: aiConfig.keyDiagnostics.previousFingerprintUsed,
    hasBom: aiConfig.keyDiagnostics.hasBom,
    hasLeadingWhitespace: aiConfig.keyDiagnostics.hasLeadingWhitespace,
    hasTrailingWhitespace: aiConfig.keyDiagnostics.hasTrailingWhitespace,
    hasWrappingQuotes: aiConfig.keyDiagnostics.hasWrappingQuotes,
    hasEmbeddedNewline: aiConfig.keyDiagnostics.hasEmbeddedNewline,
    hasControlCharacters: aiConfig.keyDiagnostics.hasControlCharacters,
    hasCometPrefixInsideToken: aiConfig.keyDiagnostics.hasCometPrefixInsideToken,
  };
  writeSafeJson(safeConfigPath, safeConfig, aiConfig.apiKey);

  const providerProbe = await probeProvider(aiConfig);
  writeSafeJson(providerProbePath, providerProbe, aiConfig.apiKey);

  const dockerRuntime = await shouldUseDockerRuntime(args);
  if (dockerRuntime && !args.skipDockerRebuild) {
    rebuildDockerBackend(aiConfig);
  }

  let playwrightResult = { status: 0, error: null };
  if (!args.skipPlaywright) {
    playwrightResult = await runPlaywrightSmoke(aiConfig, args, dockerRuntime);
  }

  if (!existsSync(smokeArtifactPath)) {
    throw new Error(
      `Live product smoke artifact was not created: ${smokeArtifactPath}`,
    );
  }

  const artifact = JSON.parse(readFileSync(smokeArtifactPath, "utf8"));
  assertNoSecretMaterial("playwright artifact", artifact, aiConfig.apiKey);
  assertDomainArtifactShape(artifact);
  const normalizedDomainResults = normalizeDomainResults(
    artifact.domainResults,
    providerProbe,
    playwrightResult,
  );
  artifact.domainResults = normalizedDomainResults;
  writeSafeJson(smokeArtifactPath, artifact, aiConfig.apiKey);

  let dbEvidence = null;
  if (!args.skipDb) {
    dbEvidence = await assertDatabasePersistence(artifact, aiConfig);
    assertNoSecretMaterial("DB evidence", dbEvidence, aiConfig.apiKey);
    writeSafeJson(dbEvidencePath, dbEvidence, aiConfig.apiKey);
  }

  const artifactScan = scanGeneratedArtifacts(aiConfig.apiKey);
  const secretSafety = {
    ...(normalizedDomainResults.secretSafety ?? failResult("NOT_RUN", "Secret safety missing.")),
  };
  if (artifactScan.rawSecretHits > 0 || artifactScan.patternHits.length > 0) {
    normalizedDomainResults.secretSafety = failResult(
      "SECRET_MATERIAL_IN_STAGE21_ARTIFACTS",
      "Stage21 generated artifacts contain secret-like material.",
      artifactScan,
    );
  } else if (secretSafety.status !== "FAIL") {
    normalizedDomainResults.secretSafety = passResult({
      ...(secretSafety.evidence ?? {}),
      artifactScan,
    });
  }
  artifact.domainResults = normalizedDomainResults;
  writeSafeJson(smokeArtifactPath, artifact, aiConfig.apiKey);

  const overall = computeOverallStatus(normalizedDomainResults);
  const summary = {
    overallStatus: overall.status,
    partialReasons: overall.partialReasons,
    domainStatuses: Object.fromEntries(
      Object.entries(normalizedDomainResults).map(([domain, result]) => [
        domain,
        result.status,
      ]),
    ),
    artifact: path.relative(repoRoot, smokeArtifactPath),
    dbEvidence: args.skipDb ? "skipped" : path.relative(repoRoot, dbEvidencePath),
    providerProbe: path.relative(repoRoot, providerProbePath),
    provider: safeConfig.provider,
    baseUrl: safeConfig.baseUrl,
    model: safeConfig.model,
    keyFingerprint: safeConfig.keyFingerprint,
    strict: args.strict,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (
    overall.status === "FAIL" ||
    (args.strict && overall.status !== "PASS")
  ) {
    process.exitCode = 1;
  }
}

async function runPlaywrightSmoke(aiConfig, args, dockerRuntime) {
  const ports = {
    web: dockerRuntime ? 3100 : args.webPort ?? (await findAvailablePort(3001)),
    api: dockerRuntime ? 3100 : args.apiPort ?? (await findAvailablePort(3101)),
  };
  const env = {
    ...process.env,
    AI_PROVIDER_MODE: "controlled-real",
    COMETAPI_KEY: aiConfig.apiKey,
    COMETAPI_API_KEY: aiConfig.apiKey,
    COMETAPI_API_KEYS: "",
    LEXFRAME_AI_SECRET_BACKEND: "dev_mock",
    LEXFRAME_AI_DEFAULT_MODEL: aiConfig.model,
    LEXFRAME_AI_SETTINGS_LIVE_TESTS: "1",
    LEXFRAME_COMETAPI_BASE_URL: aiConfig.baseUrl,
    LEXFRAME_CONTRACTS_VERSION: "stage21",
    LEXFRAME_E2E_SKIP_SEARCH_INDEX: "1",
    LEXFRAME_STAGE21_AI_API_KEY: aiConfig.apiKey,
    LEXFRAME_STAGE21_AI_BASE_URL: aiConfig.baseUrl,
    LEXFRAME_STAGE21_AI_MODEL: aiConfig.model,
    LEXFRAME_STAGE21_AI_PROVIDER_CODE: "cometapi",
    LEXFRAME_STAGE21_LIVE_PRODUCT_SMOKE: "1",
    LEXFRAME_API_BASE_URL: `http://127.0.0.1:${ports.api}`,
    LEXFRAME_API_PORT: String(ports.api),
    LEXFRAME_E2E_PORT: String(ports.web),
    NEXT_PUBLIC_CONTRACTS_VERSION: "stage21",
  };

  if (dockerRuntime) {
    env.LEXFRAME_API_BASE_URL = "http://127.0.0.1:3100/api";
    env.LEXFRAME_E2E_REUSE_EXISTING_SERVER = "1";
    env.LEXFRAME_STAGE17_17_10_LIVE = "1";
  }

  if (args.apiBase) {
    env.LEXFRAME_API_BASE_URL = args.apiBase;
  }

  const result = spawnSync(
    "corepack",
    [
      "pnpm",
      "--dir",
      "tests/e2e",
      "exec",
      "playwright",
      "test",
      "stage21-live-product-smoke.spec.ts",
    ],
    {
      cwd: repoRoot,
      env,
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );

  return {
    status: result.status ?? 1,
    error: result.error ? result.error.message : null,
  };
}

async function shouldUseDockerRuntime(args) {
  if (args.localRuntime) {
    return false;
  }

  if (args.dockerRuntime) {
    return true;
  }

  const result = spawnSync(
    "docker",
    ["ps", "--format", "{{.Names}}"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
    },
  );
  return (
    result.status === 0 &&
    result.stdout
      .split(/\r?\n/)
      .some((name) => name.trim() === "lexframe-stage17-reverse-proxy-1")
  );
}

function rebuildDockerBackend(aiConfig) {
  const result = spawnSync(
    process.execPath,
    [path.join("scripts", "stage21-up.mjs"), "rebuild-backend"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        AI_PROVIDER_MODE: "controlled-real",
        COMETAPI_KEY: aiConfig.apiKey,
        COMETAPI_API_KEY: aiConfig.apiKey,
        COMETAPI_API_KEYS: "",
        LEXFRAME_AI_SECRET_BACKEND: "dev_mock",
        LEXFRAME_AI_DEFAULT_MODEL: aiConfig.model,
        LEXFRAME_AI_SETTINGS_LIVE_TESTS: "1",
        LEXFRAME_COMETAPI_BASE_URL: aiConfig.baseUrl,
        LEXFRAME_CONTRACTS_VERSION: "stage21",
      },
      shell: false,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(`Docker backend rebuild failed with exit ${result.status}.`);
  }
}

function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        findAvailablePort(preferredPort + 1).then(resolve, reject);
        return;
      }
      reject(error);
    });
    server.listen(preferredPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
  });
}

async function probeProvider(aiConfig) {
  const models = await probeModels(aiConfig);
  const chatCompletion = await probeChatCompletion(aiConfig);
  const result = {
    generatedAt: new Date().toISOString(),
    provider: "cometapi",
    routeGroup: "chat_ai",
    compatibility: "openai_chat_completions",
    baseUrl: aiConfig.baseUrl,
    model: aiConfig.model,
    keyFingerprint: fingerprintSecret(aiConfig.apiKey),
    models,
    chatCompletion,
  };
  assertNoSecretMaterial("provider probe", result, aiConfig.apiKey);
  return result;
}

async function probeModels(aiConfig) {
  const url = `${aiConfig.baseUrl.replace(/\/+$/, "")}/models`;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${aiConfig.apiKey}`,
      },
    });
    const body = await readSafeResponseBody(response);
    return {
      endpoint: "/models",
      used: true,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      errorClass: classifyProviderError(response.status, body),
      bodyPreview: redactProviderBody(body, aiConfig.apiKey).slice(0, 500),
    };
  } catch (error) {
    return {
      endpoint: "/models",
      used: true,
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      errorClass: "PROVIDER_NETWORK_ERROR",
      bodyPreview: sanitizeErrorMessage(error, aiConfig.apiKey),
    };
  }
}

async function probeChatCompletion(aiConfig) {
  const url = `${aiConfig.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const startedAt = Date.now();
  const body = {
    model: aiConfig.model,
    stream: true,
    max_tokens: 256,
    reasoning_effort: "high",
    thinking: { type: "enabled" },
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant.",
      },
      {
        role: "user",
        content:
          "Which number is greater, 9.11 or 9.8? Answer with one sentence.",
      },
    ],
  };
  const requestDescriptor = buildProviderRequestDescriptor({
    aiConfig,
    endpointPath: "/chat/completions",
    bodyKeys: Object.keys(body),
    hasAuthorizationHeader: true,
    stream: true,
    maxTokens: 256,
    reasoningEffort: "high",
    thinkingEnabled: true,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${aiConfig.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const responseBody = await readSafeResponseBody(response);
    const redactedBody = redactProviderBody(responseBody, aiConfig.apiKey);
    const parsedStream = parseProviderSse(redactedBody);
    const answerVerified =
      response.ok &&
      /9\.8/.test(parsedStream.text) &&
      /greater|larger|больше/i.test(parsedStream.text);
    return {
      endpoint: "/chat/completions",
      used: true,
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      markerFound: answerVerified,
      answerVerified,
      visiblePreview: parsedStream.text.slice(0, 500),
      contentChunkCount: parsedStream.contentChunkCount,
      reasoningChunkCount: parsedStream.reasoningChunkCount,
      errorClass: classifyProviderError(response.status, responseBody),
      bodyPreview: response.ok ? null : redactedBody.slice(0, 500),
      requestDescriptor,
    };
  } catch (error) {
    return {
      endpoint: "/chat/completions",
      used: true,
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      markerFound: false,
      answerVerified: false,
      visiblePreview: "",
      contentChunkCount: 0,
      reasoningChunkCount: 0,
      errorClass: "PROVIDER_NETWORK_ERROR",
      bodyPreview: sanitizeErrorMessage(error, aiConfig.apiKey),
      requestDescriptor,
    };
  }
}

async function readSafeResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json().catch(() => null));
  }
  return await response.text().catch(() => "");
}

function buildProviderRequestDescriptor(input) {
  const url = new URL(
    `${input.aiConfig.baseUrl.replace(/\/+$/, "")}${input.endpointPath}`,
  );
  const baseUrlPath =
    url.pathname.replace(new RegExp(`${input.endpointPath.replace(/\//g, "\\/")}$`), "") ||
    "/";

  return {
    provider: "cometapi",
    routeGroup: "chat_ai",
    compatibility: "openai_chat_completions",
    model: input.aiConfig.model,
    normalizedBaseUrlHost: url.host,
    normalizedBaseUrlPath: baseUrlPath,
    endpointPath: input.endpointPath,
    method: "POST",
    bodyKeys: input.bodyKeys,
    hasAuthorizationHeader: input.hasAuthorizationHeader,
    authorizationScheme: "Bearer",
    secretFingerprint: fingerprintSecret(input.aiConfig.apiKey),
    sourceTokenFingerprint: fingerprintSecret(input.aiConfig.apiKey),
    outgoingHeaderTokenFingerprint: fingerprintSecret(input.aiConfig.apiKey),
    fingerprintsMatch: true,
    outgoingHeaderLength: input.aiConfig.apiKey.length,
    stream: input.stream,
    maxTokens: input.maxTokens,
    reasoningEffort: input.reasoningEffort,
    thinkingEnabled: input.thinkingEnabled,
  };
}

function parseProviderSse(value) {
  let text = "";
  let contentChunkCount = 0;
  let reasoningChunkCount = 0;

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") {
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }

    for (const choice of payload?.choices ?? []) {
      const delta = choice?.delta ?? {};
      const content = typeof delta.content === "string" ? delta.content : "";
      if (content) {
        text += content;
        contentChunkCount += 1;
      }
      const modelExtra =
        delta.model_extra && typeof delta.model_extra === "object"
          ? delta.model_extra
          : {};
      const additionalKwargs =
        delta.additional_kwargs && typeof delta.additional_kwargs === "object"
          ? delta.additional_kwargs
          : {};
      if (
        [delta.reasoning_content, delta.reasoning, modelExtra.reasoning_content, additionalKwargs.reasoning_content]
          .some((entry) => typeof entry === "string" && entry.length > 0)
      ) {
        reasoningChunkCount += 1;
      }
    }
  }

  return { text: text.trim(), contentChunkCount, reasoningChunkCount };
}

function classifyProviderError(status, body) {
  if (status >= 200 && status < 300) {
    return null;
  }
  const text = String(body ?? "").toLowerCase();
  if (status === 401 || text.includes("invalid token") || text.includes("unauthorized")) {
    return "PROVIDER_AUTH_INVALID_TOKEN";
  }
  if (status === 403) {
    return "PROVIDER_AUTH_FORBIDDEN";
  }
  if (status === 404) {
    return "PROVIDER_ENDPOINT_OR_MODEL_NOT_FOUND";
  }
  if (status === 429) {
    return "PROVIDER_RATE_LIMITED";
  }
  if (status >= 500) {
    return "PROVIDER_SERVER_ERROR";
  }
  return "PROVIDER_ERROR";
}

function redactProviderBody(body, apiKey) {
  return String(body ?? "")
    .replaceAll(apiKey, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]");
}

function normalizeDomainResults(domainResults, providerProbe, playwrightResult) {
  const normalized = {
    settings: normalizeDomainResult(domainResults.settings),
    projects: normalizeDomainResult(domainResults.projects),
    chat: normalizeDomainResult(domainResults.chat),
    automations: normalizeDomainResult(domainResults.automations),
    secretSafety: normalizeDomainResult(domainResults.secretSafety),
  };

  if (playwrightResult.status !== 0) {
    for (const [domain, result] of Object.entries(normalized)) {
      if (result.status !== "PASS" && !allowedPartialStatuses.has(result.status) && result.code === "NOT_RUN") {
        normalized[domain] = failResult(
          "PLAYWRIGHT_DOMAIN_GATE_FAILED",
          playwrightResult.error ?? `Playwright exited with ${playwrightResult.status}.`,
          result.evidence,
        );
      }
    }
  }

  if (
    normalized.chat.status === "PARTIAL_EXTERNAL_PROVIDER_BLOCKER" &&
    providerProbe.chatCompletion.ok
  ) {
    normalized.chat = failResult(
      "APP_CHAT_FAILED_DESPITE_PROVIDER_COMPLETION_PASS",
      "Backend-only provider chat completion probe passed, but app chat remained in provider blocker state.",
      {
        ...normalized.chat.evidence,
        providerProbeStatus: providerProbe.chatCompletion.status,
        providerMarkerFound: providerProbe.chatCompletion.markerFound,
      },
    );
  }

  return normalized;
}

function normalizeDomainResult(value) {
  if (!value || typeof value !== "object") {
    return failResult("MISSING_DOMAIN_RESULT", "Domain result is missing.");
  }
  const status = String(value.status ?? "");
  if (
    status !== "PASS" &&
    status !== "PARTIAL_EXTERNAL_PROVIDER_BLOCKER" &&
    status !== "PARTIAL_RUNTIME_BLOCKER" &&
    status !== "FAIL"
  ) {
    return failResult("INVALID_DOMAIN_STATUS", `Invalid domain status: ${status}.`);
  }
  return {
    status,
    code: value.code ?? null,
    message: value.message ?? null,
    evidence: value.evidence && typeof value.evidence === "object" ? value.evidence : {},
  };
}

async function assertDatabasePersistence(artifact, aiConfig) {
  const client = await createDatabaseClient();

  try {
    const settings = await readSettingsDbEvidence(client, artifact, aiConfig);
    const projects = await readProjectDbEvidence(client, artifact);
    const chat = await readChatDbEvidence(client, artifact);
    const automations = await readAutomationDbEvidence(client, artifact);
    const audits = await readAuditEvidence(client, artifact);
    const secretSafety = await readDbSecretSafetyEvidence(client, artifact, aiConfig, {
      settings,
      projects,
      chat,
      automations,
      audits,
    });

    return {
      generatedAt: new Date().toISOString(),
      domainEvidence: {
        settings,
        projects,
        chat,
        automations,
        secretSafety,
      },
      audit: audits,
    };
  } finally {
    await client.end();
  }
}

async function readSettingsDbEvidence(client, artifact, aiConfig) {
  requireArtifactField(artifact, "actorUserId");
  requireArtifactField(artifact, "workspaceId");
  requireArtifactField(artifact, "connectionId");
  const profile = await one(
    client,
    `
      select id::text, email, display_name, updated_at::text
      from app.profiles
      where id = $1::uuid
      limit 1
    `,
    [artifact.actorUserId],
    "profile",
  );
  assertEqual(profile.display_name, "Stage21 Live Smoke Updated", "profile display name");

  const workspace = await one(
    client,
    `
      select id::text, organization_display_name, organization_legal_name, updated_at::text
      from app.workspaces
      where id = $1::uuid
      limit 1
    `,
    [artifact.workspaceId],
    "workspace",
  );
  assertEqual(
    workspace.organization_display_name,
    artifact.organizationDisplayName,
    "workspace organization display name",
  );

  const connection = await one(
    client,
    `
      select to_jsonb(c.*) as value
      from app.ai_provider_connections c
      where c.id::text = $1
      limit 1
    `,
    [artifact.connectionId],
    "AI provider connection",
  );
  const secretRefId = connection.value.secret_ref_id;
  if (!secretRefId) {
    throw new Error("AI provider connection has no secret_ref_id.");
  }

  const secretRef = await one(
    client,
    `
      select to_jsonb(s.*) as value
      from app.ai_secret_refs s
      where s.id::text = $1
      limit 1
    `,
    [secretRefId],
    "AI secret ref",
  );
  assertEqual(secretRef.value.fingerprint, fingerprintSecret(aiConfig.apiKey), "AI secret fingerprint");

  const preference = await one(
    client,
    `
      select route_group, provider_connection_id::text, model_id, capabilities_confirmed
      from app.ai_route_group_preferences
      where workspace_id = $1::uuid
        and route_group = 'chat_ai'
        and provider_connection_id::text = $2
      order by updated_at desc
      limit 1
    `,
    [artifact.workspaceId, artifact.connectionId],
    "chat AI route preference",
  );
  assertEqual(preference.model_id, aiConfig.model, "chat route model");

  return {
    status: artifact.domainResults.settings.status,
    profile: {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      updatedAt: profile.updated_at,
    },
    workspace: {
      id: workspace.id,
      organizationDisplayName: workspace.organization_display_name,
      updatedAt: workspace.updated_at,
    },
    aiSettings: {
      connectionId: artifact.connectionId,
      provider: connection.value.provider_code,
      baseUrl: connection.value.base_url,
      modelId: connection.value.default_model,
      secretRefId,
      secretBackend: secretRef.value.backend,
      secretFingerprint: secretRef.value.fingerprint,
      rawSecretInProductDb: false,
    },
    routePreference: {
      routeGroup: preference.route_group,
      providerConnectionId: preference.provider_connection_id,
      modelId: preference.model_id,
      capabilitiesConfirmed: preference.capabilities_confirmed,
    },
  };
}

async function readProjectDbEvidence(client, artifact) {
  requireArtifactField(artifact, "workspaceId");
  requireArtifactField(artifact, "projectId");
  const project = await one(
    client,
    `
      select id, workspace_id::text, name, status, updated_at::text
      from app.projects
      where workspace_id = $1::uuid
        and id = $2
      limit 1
    `,
    [artifact.workspaceId, artifact.projectId],
    "project",
  );
  assertEqual(project.name, artifact.projectName, "project name");

  return {
    status: artifact.domainResults.projects.status,
    projectId: project.id,
    workspaceId: project.workspace_id,
    name: project.name,
    projectStatus: project.status,
    updatedAt: project.updated_at,
  };
}

async function readChatDbEvidence(client, artifact) {
  requireArtifactField(artifact, "workspaceId");
  requireArtifactField(artifact, "projectId");
  requireArtifactField(artifact, "chatThreadId");
  const chatDomain = artifact.domainResults.chat;
  const chatThread = await one(
    client,
    `
      select id::text, workspace_id::text, project_id, status
      from app.chat_threads
      where id = $1::uuid
      limit 1
    `,
    [artifact.chatThreadId],
    "chat thread",
  );
  assertEqual(chatThread.workspace_id, artifact.workspaceId, "chat thread workspace");
  assertEqual(chatThread.project_id, artifact.projectId, "chat thread project");

  const messages = await many(
    client,
    `
      select
        m.id::text,
        m.role,
        m.workspace_id::text,
        m.project_id,
        p.text
      from app.chat_messages m
      left join app.chat_message_parts p on p.message_id = m.id
      where m.thread_id = $1::uuid
      order by m.created_at asc, p.sequence asc
    `,
    [artifact.chatThreadId],
  );
  const userMessage = messages.find(
    (message) =>
      message.role === "user" &&
      typeof message.text === "string" &&
      message.text.includes(chatMarker),
  );
  if (!userMessage) {
    throw new Error("Chat DB assertions failed: user smoke message missing.");
  }

  const assistantMessage = messages.find(
    (message) =>
      message.role === "assistant" &&
      typeof message.text === "string" &&
      message.text.includes(chatMarker),
  );
  const cannedAssistant = messages.find(
    (message) =>
      message.role === "assistant" &&
      typeof message.text === "string" &&
      message.text.includes("LexFrame AI Gateway processed"),
  );
  if (cannedAssistant) {
    throw new Error("Assistant message still contains the old canned gateway text.");
  }

  let streamJob = null;
  const streamJobs = await many(
    client,
    `
      select id::text, status, message_id::text, gateway_evidence_hash
      from app.chat_stream_jobs
      where thread_id = $1::uuid
      order by coalesce(completed_at, created_at) desc
      limit 5
    `,
    [artifact.chatThreadId],
  ).catch(() => []);
  streamJob = streamJobs[0] ?? null;

  if (chatDomain.status === "PASS") {
    if (!assistantMessage) {
      throw new Error("Chat PASS DB assertions failed: assistant marker missing.");
    }
    if (streamJob) {
      assertEqual(streamJob.status, "completed", "stream job status");
    }
  }

  if (chatDomain.status === "PARTIAL_EXTERNAL_PROVIDER_BLOCKER" && assistantMessage) {
    throw new Error("Chat provider blocker artifact has an assistant marker in DB.");
  }

  return {
    status: chatDomain.status,
    threadId: artifact.chatThreadId,
    projectId: artifact.projectId,
    userMessageId: userMessage.id,
    assistantMessageId: assistantMessage?.id ?? null,
    markerPersisted: Boolean(assistantMessage),
    controlledFailurePersisted:
      chatDomain.status === "PARTIAL_EXTERNAL_PROVIDER_BLOCKER",
    streamJobId: streamJob?.id ?? null,
    streamJobStatus: streamJob?.status ?? null,
  };
}

async function readAutomationDbEvidence(client, artifact) {
  const automationId =
    artifact.automation?.automationId ??
    artifact.domainResults.automations?.evidence?.automationId ??
    null;
  if (!automationId) {
    return {
      status: artifact.domainResults.automations.status,
      automationId: null,
      controlledDiagnostic: artifact.domainResults.automations.code ?? "not_created",
      bindingRows: 0,
      sessionRows: 0,
    };
  }

  const installedAutomation = await one(
    client,
    `
      select id::text, workspace_id::text, title, builder_state, sync_state, runtime_project_id, runtime_flow_id
      from app.installed_automations
      where workspace_id = $1::uuid
        and id = $2::uuid
      limit 1
    `,
    [artifact.workspaceId, automationId],
    "installed automation",
  );

  const projectBindings = await many(
    client,
    `
      select id::text, workspace_id::text, external_project_id, status
      from app.activepieces_project_bindings
      where workspace_id = $1::uuid
      order by updated_at desc
      limit 10
    `,
    [artifact.workspaceId],
  ).catch(() => []);
  const userBindings = await many(
    client,
    `
      select id::text, workspace_id::text, role, status
      from app.activepieces_user_bindings
      where workspace_id = $1::uuid
      order by updated_at desc
      limit 10
    `,
    [artifact.workspaceId],
  ).catch(() => []);
  const flowBindings = await many(
    client,
    `
      select id::text, workspace_id::text, automation_id::text, sync_status, ap_flow_id
      from app.activepieces_flow_bindings
      where workspace_id = $1::uuid
        and automation_id = $2::uuid
      order by updated_at desc
      limit 10
    `,
    [artifact.workspaceId, automationId],
  ).catch(() => []);
  const embedSessions = await many(
    client,
    `
      select id::text, session_id, installed_automation_id::text, status, mode, token_hash, jti_hash
      from app.activepieces_embed_sessions
      where workspace_id = $1::uuid
        and installed_automation_id = $2::uuid
      order by created_at desc
      limit 10
    `,
    [artifact.workspaceId, automationId],
  ).catch(() => []);

  return {
    status: artifact.domainResults.automations.status,
    automationId,
    readinessStatus: artifact.automation?.readinessStatus ?? null,
    readinessCode: artifact.automation?.readinessCode ?? null,
    installedAutomation: {
      id: installedAutomation.id,
      builderState: installedAutomation.builder_state,
      syncState: installedAutomation.sync_state,
      runtimeProjectId: installedAutomation.runtime_project_id,
      runtimeFlowId: installedAutomation.runtime_flow_id,
    },
    projectBindingRows: projectBindings.length,
    userBindingRows: userBindings.length,
    flowBindingRows: flowBindings.length,
    sessionRows: embedSessions.length,
    sessions: embedSessions.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      status: row.status,
      mode: row.mode,
      hasTokenHash: Boolean(row.token_hash),
      hasJtiHash: Boolean(row.jti_hash),
    })),
  };
}

async function readAuditEvidence(client, artifact) {
  requireArtifactField(artifact, "workspaceId");
  const expectedActions = [
    "settings.profile.updated",
    "settings.organization.updated",
    "settings.ai.route_group.preference.updated",
  ];
  if (artifact.domainResults.chat.status === "PASS") {
    expectedActions.push("chat.message.stream_completed");
  } else if (artifact.domainResults.chat.status === "PARTIAL_EXTERNAL_PROVIDER_BLOCKER") {
    expectedActions.push("chat.message.stream_failed");
  }

  const auditRows = await many(
    client,
    `
      select action, result, metadata
      from audit.audit_events
      where workspace_id = $1::uuid
        and occurred_at > timezone('utc', now()) - interval '4 hours'
      order by occurred_at desc
      limit 250
    `,
    [artifact.workspaceId],
  );
  for (const action of expectedActions) {
    if (!auditRows.some((row) => row.action === action)) {
      throw new Error(`Missing audit event: ${action}`);
    }
  }

  return {
    actions: [...new Set(auditRows.map((row) => row.action))].sort(),
    expectedActions,
    activepiecesActions: auditRows
      .filter((row) => String(row.action).includes("activepieces"))
      .map((row) => row.action),
    rawSecretInAudit: false,
  };
}

async function readDbSecretSafetyEvidence(client, artifact, aiConfig, dbRows) {
  const dbText = JSON.stringify(dbRows);
  assertNoSecretMaterial("product database rows", dbText, aiConfig.apiKey);

  const dbTextRows = await many(
    client,
    `
      select 'ai_provider_connections' as table_name, to_jsonb(ai_provider_connections)::text as row_text
      from app.ai_provider_connections
      union all
      select 'ai_secret_refs' as table_name, to_jsonb(ai_secret_refs)::text as row_text
      from app.ai_secret_refs
      union all
      select 'chat_messages' as table_name, to_jsonb(chat_messages)::text as row_text
      from app.chat_messages
      where workspace_id = $1::uuid
      union all
      select 'chat_message_parts' as table_name, to_jsonb(p)::text as row_text
      from app.chat_message_parts p
      join app.chat_messages m on m.id = p.message_id
      where m.workspace_id = $1::uuid
      union all
      select 'activepieces_embed_sessions' as table_name, to_jsonb(activepieces_embed_sessions)::text as row_text
      from app.activepieces_embed_sessions
      where workspace_id = $1::uuid
      union all
      select 'audit_events' as table_name, to_jsonb(audit_events)::text as row_text
      from audit.audit_events
      where workspace_id = $1::uuid
        and occurred_at > timezone('utc', now()) - interval '4 hours'
    `,
    [artifact.workspaceId],
  ).catch(() => []);
  const rawSecretHits = dbTextRows.filter((row) =>
    String(row.row_text ?? "").includes(aiConfig.apiKey),
  ).length;
  if (rawSecretHits > 0) {
    throw new Error("Raw provider key found in product DB text fields.");
  }

  return {
    status: artifact.domainResults.secretSafety.status,
    searchedTables: [...new Set(dbTextRows.map((row) => row.table_name))],
    scannedRows: dbTextRows.length,
    rawSecretHits,
    rawSecretInProductDb: false,
  };
}

async function createDatabaseClient() {
  const pgRequire = createRequire(path.join(repoRoot, "apps", "backend", "package.json"));
  const { Client } = pgRequire("pg");
  const pgClient = new Client({
    connectionString: process.env.SUPABASE_DB_URL ?? DEFAULT_DB_URL,
  });

  try {
    await pgClient.connect();
    return {
      query: (sql, params) => pgClient.query(sql, params),
      end: () => pgClient.end(),
    };
  } catch (error) {
    await pgClient.end().catch(() => undefined);
    if (!dockerContainerExists("lexframe-stage17-lexframe-product-postgres-1")) {
      throw error;
    }
    return createDockerPsqlClient();
  }
}

function createDockerPsqlClient() {
  return {
    async query(sql, params = []) {
      const interpolated = interpolateSql(sql, params);
      const wrapped = `select coalesce(json_agg(row_to_json(q)), '[]'::json) from (${interpolated}) q`;
      const result = spawnSync(
        "docker",
        [
          "exec",
          "lexframe-stage17-lexframe-product-postgres-1",
          "psql",
          "-U",
          "postgres",
          "-d",
          "stage17_runtime",
          "-AtX",
          "-c",
          wrapped,
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          shell: false,
        },
      );
      if (result.status !== 0) {
        throw new Error(result.stderr || "docker psql query failed");
      }
      return { rows: JSON.parse(result.stdout.trim() || "[]") };
    },
    async end() {
      return undefined;
    },
  };
}

function dockerContainerExists(name) {
  const result = spawnSync(
    "docker",
    ["ps", "--format", "{{.Names}}"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  return (
    result.status === 0 &&
    result.stdout.split(/\r?\n/).some((item) => item.trim() === name)
  );
}

function interpolateSql(sql, params) {
  let result = sql.trim().replace(/;$/, "");
  params.forEach((param, index) => {
    const pattern = new RegExp(`\\$${index + 1}(?=\\D|$)`, "g");
    result = result.replace(pattern, sqlLiteral(param));
  });
  return result;
}

function sqlLiteral(value) {
  if (Array.isArray(value)) {
    return `array[${value.map(sqlLiteral).join(",")}]`;
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function scanGeneratedArtifacts(apiKey) {
  const files = [
    smokeArtifactPath,
    dbEvidencePath,
    providerProbePath,
    safeConfigPath,
  ].filter((file) => existsSync(file));
  const patternHits = [];
  let rawSecretHits = 0;

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (content.includes(apiKey)) {
      rawSecretHits += 1;
    }
    if (secretPattern.test(content)) {
      patternHits.push(path.relative(repoRoot, file));
    }
  }

  return {
    files: files.map((file) => path.relative(repoRoot, file)),
    patterns: [
      "raw provider key",
      "Authorization Bearer",
      "JWT shape",
      "service/runtime/admin secret names",
      "private key blocks",
    ],
    rawSecretHits,
    patternHits,
    result: rawSecretHits === 0 && patternHits.length === 0 ? "PASS" : "FAIL",
  };
}

async function one(client, sql, params, label) {
  const rows = await many(client, sql, params);
  if (rows.length === 0) {
    throw new Error(`Missing DB row for ${label}.`);
  }
  return rows[0];
}

async function many(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

function requireArtifactField(artifact, key) {
  if (!artifact[key]) {
    throw new Error(`Live smoke artifact is missing ${key}.`);
  }
}

function assertDomainArtifactShape(artifact) {
  if (!artifact.domainResults || typeof artifact.domainResults !== "object") {
    throw new Error("Live smoke artifact has no domainResults object.");
  }
  for (const domain of ["settings", "projects", "chat", "automations", "secretSafety"]) {
    if (!artifact.domainResults[domain]) {
      throw new Error(`Live smoke artifact has no ${domain} domain result.`);
    }
  }
}

function assertNoSecretMaterial(label, value, apiKey) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.includes(apiKey)) {
    throw new Error(`${label} contains the raw AI provider key.`);
  }
  if (secretPattern.test(text)) {
    throw new Error(`${label} contains secret-like material.`);
  }
}

async function readAiConfig(filePath) {
  if (!filePath) {
    throw new Error('Provide --ai-config "C:\\path\\Api.txt".');
  }
  const content = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = content
    .split(/\r?\n/)
    .map((line) => normalizeConfigLine(line))
    .filter((line) => line && !line.startsWith("#"));
  const apiKey =
    keyedValue(lines, ["COMETAPI_KEY", "COMETAPI_API_KEY", "API_KEY", "KEY"]) ??
    lines.find(
      (line) =>
        line.length >= 20 &&
        !line.includes("://") &&
        !/model|base|provider|cometapi/i.test(line),
    );
  const envApiKey = firstRuntimeEnvValue([
    "COMETAPI_KEY",
    "COMETAPI_API_KEY",
    "AI_CHAT_API_KEY",
    "LEXFRAME_STAGE21_AI_API_KEY",
  ]);
  const baseUrl =
    firstRuntimeEnvValue([
      "AI_CHAT_BASE_URL",
      "COMETAPI_BASE_URL",
      "LEXFRAME_COMETAPI_BASE_URL",
      "LEXFRAME_STAGE21_AI_BASE_URL",
    ])?.value ??
    keyedValue(lines, ["BASE_URL", "COMETAPI_BASE_URL", "AI_CHAT_BASE_URL"]) ??
    lines.find((line) => /^https?:\/\/\S+/i.test(line)) ??
    DEFAULT_BASE_URL;
  const configuredModel =
    firstRuntimeEnvValue([
      "AI_CHAT_MODEL",
      "AI_CHAT_MODEL_ID",
      "COMETAPI_MODEL",
      "LEXFRAME_AI_DEFAULT_MODEL",
      "LEXFRAME_STAGE21_AI_MODEL",
    ])?.value ??
    keyedValue(lines, [
      "MODEL",
      "MODEL_ID",
      "COMETAPI_MODEL",
      "AI_CHAT_MODEL",
      "AI_CHAT_MODEL_ID",
    ]) ?? null;
  const model = normalizeStage21ChatModel(configuredModel);
  const selectedApiKey = envApiKey ?? {
    sourceClass: "local_config_file",
    value: apiKey,
  };

  if (!selectedApiKey.value) {
    throw new Error("No COMETAPI key was found in the provided AI config file.");
  }
  const normalizedApiKey = normalizeConfigValue(selectedApiKey.value, "api key");

  return {
    apiKey: normalizedApiKey,
    baseUrl: normalizeConfigValue(baseUrl, "base URL").replace(/\/+$/, ""),
    model: normalizeConfigValue(model, "model"),
    keyDiagnostics: buildKeyDiagnostics({
      sourceClass: selectedApiKey.sourceClass,
      rawValue: selectedApiKey.value,
      sanitizedValue: normalizedApiKey,
    }),
  };
}

function firstRuntimeEnvValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() && !isPlaceholderCredential(name, value)) {
      return {
        sourceClass: `process_env:${name}`,
        value,
      };
    }
  }
  return null;
}

function isPlaceholderCredential(name, value) {
  if (!/KEY|TOKEN|SECRET/i.test(name)) {
    return false;
  }
  const normalized = stripQuotes(String(value));
  return (
    normalized === "stage0_comet_api_key" ||
    /^test[_-]/i.test(normalized) ||
    /^mock[_-]/i.test(normalized) ||
    /^placeholder/i.test(normalized)
  );
}

function buildKeyDiagnostics(input) {
  const raw = String(input.rawValue ?? "");
  const sanitized = String(input.sanitizedValue ?? "");
  const hasControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(
    sanitized,
  );
  return {
    sourceClass: input.sourceClass,
    rawLength: raw.length,
    sanitizedLength: sanitized.length,
    expectedLengthMatched: sanitized.length === 51,
    previousFingerprintUsed:
      fingerprintSecret(sanitized) === "sha256:248197196ac16fec",
    hasBom: raw.charCodeAt(0) === 0xfeff,
    hasLeadingWhitespace: /^\s/.test(raw),
    hasTrailingWhitespace: /\s$/.test(raw),
    hasWrappingQuotes: /^['"].*['"]$/.test(raw.trim()),
    hasEmbeddedNewline: /[\r\n]/.test(sanitized),
    hasControlCharacters,
    hasCometPrefixInsideToken: /^COMETAPI_(API_)?KEY\s*=/.test(sanitized),
  };
}

function normalizeStage21ChatModel(value) {
  const normalized = value ? normalizeConfigValue(value, "model") : DEFAULT_MODEL;
  if (normalized === "grok-4-1-fast-non-reasoning") {
    return DEFAULT_MODEL;
  }
  return normalized;
}

function normalizeConfigLine(line) {
  return line.replace(/^\uFEFF/, "").trim();
}

function normalizeConfigValue(value, label) {
  const normalized = stripQuotes(String(value).replace(/^\uFEFF/, ""));
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    throw new Error(`AI config ${label} contains hidden control characters.`);
  }
  return normalized;
}

function keyedValue(lines, keys) {
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_ -]+)\s*[:=]\s*(.+)$/i);
    if (!match) {
      continue;
    }
    const key = match[1].trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (keys.includes(key)) {
      return match[2].trim();
    }
  }
  return null;
}

function stripQuotes(value) {
  return value
    .replace(/,+$/g, "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/,+$/g, "")
    .trim();
}

function fingerprintSecret(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function writeSafeJson(filePath, value, apiKey) {
  assertNoSecretMaterial(path.relative(repoRoot, filePath), value, apiKey);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function passResult(evidence = {}) {
  return {
    status: "PASS",
    code: null,
    message: null,
    evidence,
  };
}

function failResult(code, message, evidence = {}) {
  return {
    status: "FAIL",
    code,
    message,
    evidence,
  };
}

function computeOverallStatus(domainResults) {
  const statuses = Object.values(domainResults).map((result) => result.status);
  if (statuses.includes("FAIL")) {
    return { status: "FAIL", partialReasons: [] };
  }
  const partialReasons = statuses.filter((status) => status.startsWith("PARTIAL"));
  if (partialReasons.length > 0) {
    return {
      status: "PARTIAL",
      partialReasons: [...new Set(partialReasons)],
    };
  }
  return { status: "PASS", partialReasons: [] };
}

function sanitizeErrorMessage(error, apiKey) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(apiKey, "[redacted]")
    .slice(0, 500);
}

function parseArgs(argv) {
  const result = {
    aiConfig: null,
    apiBase: null,
    apiPort: null,
    dockerRuntime: false,
    localRuntime: false,
    skipDockerRebuild: false,
    skipDb: false,
    skipPlaywright: false,
    strict: false,
    webPort: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--ai-config" && next) {
      result.aiConfig = next;
      index += 1;
    } else if (arg === "--api-base" && next) {
      result.apiBase = next;
      index += 1;
    } else if (arg === "--api-port" && next) {
      result.apiPort = Number(next);
      index += 1;
    } else if (arg === "--docker-runtime") {
      result.dockerRuntime = true;
    } else if (arg === "--local-runtime") {
      result.localRuntime = true;
    } else if (arg === "--skip-docker-rebuild") {
      result.skipDockerRebuild = true;
    } else if (arg === "--web-port" && next) {
      result.webPort = Number(next);
      index += 1;
    } else if (arg === "--skip-db") {
      result.skipDb = true;
    } else if (arg === "--skip-playwright") {
      result.skipPlaywright = true;
    } else if (arg === "--strict") {
      result.strict = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return result;
}

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/stage21/live-product-smoke.mjs --ai-config "C:\\Users\\ustyu\\OneDrive\\Desktop\\Api.txt"

Options:
  --api-base <url>       Override backend API base for Playwright helpers.
  --api-port <port>      Backend runtime port. Default: first free port from 3101.
  --docker-runtime       Force reuse of the Stage 17/21 Docker runtime on 3100.
  --local-runtime        Force Playwright-managed local backend/web processes.
  --skip-docker-rebuild  Do not recreate the Docker backend before smoke.
  --web-port <port>      Web runtime port. Default: first free port from 3001.
  --skip-playwright      Reuse an existing artifacts/stage21/live-product-smoke.json.
  --skip-db              Skip direct product DB assertions.
  --strict               Exit 1 on any PARTIAL status, not only FAIL.
`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
