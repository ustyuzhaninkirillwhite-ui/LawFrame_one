import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const backendBuildManifest = ".codex-runtime/stage16-backend-runtime-build.json";
const frontendPort = Number(
  process.env.LEXFRAME_E2E_PORT ?? process.env.STAGE16_WEB_PORT ?? "3000",
);
const backendPort = Number(
  process.env.LEXFRAME_API_PORT ?? process.env.STAGE16_BACKEND_PORT ?? "3104",
);
const appPorts = uniqueNumbers([
  frontendPort,
  backendPort,
  ...parsePortList(process.env.STAGE16_E2E_ADDITIONAL_APP_PORTS ?? ""),
]);
const backendArtifacts = [
  "apps/backend/dist/main.js",
  "packages/logger/dist/index.js",
  "packages/workflow-dsl/dist/index.js",
  "packages/contracts/dist/index.js",
  "packages/config/dist/index.js",
  "packages/workflow/dist/index.js",
  "packages/ai-gateway/dist/index.js",
  "packages/activepieces-legal-pieces/dist/index.js",
];

const composeServices = [
  "postgres",
  "redis",
  "activepieces-postgres",
  "activepieces-redis",
  "activepieces-app",
  "activepieces-worker",
  "storage-sandbox",
  "delivery-sandbox",
  "opensearch",
  "redpanda",
  "clickhouse",
  "mining-worker",
];

const servicePorts = new Map([
  ["postgres", 54322],
  ["redis", 6379],
  ["activepieces-postgres", 54323],
  ["activepieces-redis", 6380],
  ["activepieces-app", 8080],
  ["storage-sandbox", 54321],
  ["delivery-sandbox", 8091],
  ["opensearch", 9200],
  ["redpanda", 19092],
  ["clickhouse", 8123],
  ["mining-worker", 8090],
]);

const databaseName = process.env.STAGE16_TARGET_DB ?? "stage16_runtime";

const schemaRequirements = {
  shell: ["app.projects"],
  chat: ["app.projects", "app.chat_messages.client_message_id"],
  "project-workspace": [
    "app.projects",
    "app.project_knowledge_items",
    "app.installed_automations",
  ],
  settings: ["app.workspaces", "app.ai_route_preferences"],
  security: ["app.workspaces", "audit.audit_events"],
  automation: [
    "app.projects",
    "app.chat_messages.client_message_id",
    "app.installed_automations",
    "app.automation_runtime_bindings",
    "app.activepieces_project_bindings",
  ],
  documents: ["app.documents", "app.document_versions"],
  search: ["app.projects", "app.project_knowledge_items", "app.legal_sources"],
  full: [
    "app.projects",
    "app.chat_messages.client_message_id",
    "app.installed_automations",
    "app.automation_runtime_bindings",
    "app.activepieces_project_bindings",
    "app.documents",
    "app.project_knowledge_items",
    "audit.audit_events",
  ],
};

const scopeDefinitions = {
  shell: {
    requiredServices: ["postgres"],
    optionalServices: ["activepieces-app", "opensearch", "storage-sandbox"],
  },
  chat: {
    requiredServices: ["postgres"],
    optionalServices: [
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
      "storage-sandbox",
      "delivery-sandbox",
      "opensearch",
    ],
  },
  "project-workspace": {
    requiredServices: ["postgres"],
    optionalServices: [
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
      "storage-sandbox",
      "delivery-sandbox",
      "opensearch",
    ],
  },
  settings: {
    requiredServices: ["postgres"],
    optionalServices: [
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
      "storage-sandbox",
      "delivery-sandbox",
      "opensearch",
    ],
  },
  security: {
    requiredServices: ["postgres"],
    optionalServices: [
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
      "storage-sandbox",
      "delivery-sandbox",
      "opensearch",
    ],
  },
  automation: {
    requiredServices: [
      "postgres",
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
    ],
    optionalServices: ["storage-sandbox", "delivery-sandbox", "opensearch"],
  },
  documents: {
    requiredServices: ["postgres", "storage-sandbox", "delivery-sandbox"],
    optionalServices: ["activepieces-app", "opensearch"],
  },
  search: {
    requiredServices: ["postgres", "opensearch"],
    optionalServices: ["activepieces-app", "storage-sandbox"],
  },
  full: {
    requiredServices: composeServices,
    optionalServices: [],
  },
};

const directRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (directRun) {
  await runCli();
}

export { repoRoot };

export function getScopePlan(scope, options = {}) {
  const normalizedScope = normalizeScope(scope);
  const definition = scopeDefinitions[normalizedScope];
  if (!definition) {
    throw new Error(`unknown preflight scope: ${scope}`);
  }

  const requiredServices = new Set(
    options.msw ? [] : definition.requiredServices,
  );
  const explicitOptional = new Set(options.msw ? [] : definition.optionalServices);
  const notRequiredServices = new Set(
    composeServices.filter((service) => !requiredServices.has(service)),
  );
  const requiredPorts = new Set();
  const optionalPorts = new Set();
  const notRequiredPorts = new Set();

  for (const service of requiredServices) {
    const port = servicePorts.get(service);
    if (port) {
      requiredPorts.add(port);
    }
  }

  for (const service of explicitOptional) {
    const port = servicePorts.get(service);
    if (port && !requiredPorts.has(port)) {
      optionalPorts.add(port);
    }
  }

  for (const service of notRequiredServices) {
    const port = servicePorts.get(service);
    if (port && !requiredPorts.has(port)) {
      notRequiredPorts.add(port);
    }
  }

  return {
    scope: normalizedScope,
    requiredServices,
    optionalServices: explicitOptional,
    notRequiredServices,
    requiredPorts,
    optionalPorts,
    notRequiredPorts,
    requiresDocker: requiredServices.size > 0,
  };
}

export function classifyComposeService(name, row) {
  if (!row) {
    return {
      name,
      status: "COMPOSE_SERVICE_STOPPED",
      blocksRequired: true,
      details: { state: "missing" },
    };
  }

  const state = serviceStateText(row);
  if (
    state.includes("exited") ||
    state.includes("dead") ||
    state.includes("unhealthy") ||
    (!state.includes("running") && !state.includes("healthy"))
  ) {
    return {
      name,
      status: "COMPOSE_SERVICE_STOPPED",
      blocksRequired: true,
      details: {
        state: state || "unknown",
        exitCode: row.ExitCode ?? null,
      },
    };
  }

  return {
    name,
    status: "READY",
    blocksRequired: false,
    details: { state },
  };
}

export function buildPreflightReport(input) {
  const required = input.required ?? [];
  const optional = input.optional ?? [];
  const blockers = required.filter((item) => item.blocksRequired);
  const degradedOptional = optional.filter(
    (item) =>
      item.status !== "READY" && item.status !== "NOT_REQUIRED_FOR_SCOPE",
  );
  const status =
    blockers.length > 0
      ? "BLOCKED_REQUIRED"
      : degradedOptional.length > 0
        ? "DEGRADED_OPTIONAL"
        : "READY";

  return {
    scope: input.scope,
    phase: input.phase,
    status,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    required,
    optional,
    blockers,
    recommendations: input.recommendations ?? [],
  };
}

export function classifyDatabaseSchemaProbe(scope, probe) {
  if (!probe.ok) {
    return {
      name: "database-schema",
      status: "STALE_SCHEMA",
      blocksRequired: true,
      details: {
        database: databaseName,
        error: sanitize(probe.error ?? "schema probe failed"),
      },
    };
  }

  const missing = [];
  let automationFixtureCount = null;
  for (const line of probe.rows) {
    const [name, status] = String(line).split("|");
    if (!name) {
      continue;
    }
    if (name === "automation_fixture_count") {
      automationFixtureCount = Number(status);
      continue;
    }
    if (status === "missing" || status === "f" || status === "") {
      missing.push(name);
    }
  }

  if (
    (scope === "automation" || scope === "full") &&
    automationFixtureCount !== null &&
    automationFixtureCount < 1
  ) {
    missing.push("NO_AUTOMATION_FIXTURE");
  }

  return {
    name: "database-schema",
    status: missing.length > 0 ? "STALE_SCHEMA" : "READY",
    blocksRequired: missing.length > 0,
    details: {
      database: databaseName,
      missing,
      automationFixtureCount,
    },
  };
}

export function classifyAutomationEnsureProbe(probe) {
  let parsed = null;
  try {
    parsed = probe.body ? JSON.parse(probe.body) : null;
  } catch {
    parsed = null;
  }

  const code =
    parsed?.readiness_code ??
    parsed?.readinessCode ??
    parsed?.error?.code ??
    parsed?.error?.details?.reasonCode ??
    null;
  const ready =
    probe.ok &&
    probe.status >= 200 &&
    probe.status < 300 &&
    (parsed?.status === "ready" || parsed?.status === "repaired");

  if (ready) {
    return {
      name: "automation-ensure",
      status: "READY",
      blocksRequired: false,
      details: { httpStatus: probe.status, code: code ?? "READY" },
    };
  }

  return {
    name: "automation-ensure",
    status: "AP_RUNTIME_BLOCKED",
    blocksRequired: true,
    details: {
      httpStatus: probe.status,
      code: code ?? "AUTOMATION_ENSURE_FAILED",
      error: probe.error ? sanitize(probe.error) : undefined,
    },
  };
}

async function runCli() {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.help) {
    console.log(
      [
        "Usage: node scripts/stage16-e2e-preflight.mjs [--scope=shell|chat|project-workspace|settings|automation|documents|search|full]",
        "       [--mode=backend-shell|msw-shell] [--phase=before-build|after-build|before-web-dev|after-runtime]",
        "       [--json] [--fail-on-required] [--allow-reuse-runtime] [--clean-stale-next-cache]",
      ].join("\n"),
    );
    return;
  }

  const report = await collectPreflightReport(options);
  const output = options.json ? JSON.stringify(report, null, 2) : formatReport(report);

  if (report.status === "BLOCKED_REQUIRED") {
    if (options.json) {
      console.log(output);
    } else {
      console.error(output);
    }
    if (options.failOnRequired) {
      process.exit(2);
    }
    return;
  }

  console.log(output);
}

async function collectPreflightReport(options) {
  const plan = getScopePlan(options.scope, { msw: options.msw });
  const required = [];
  const optional = [];
  const recommendations = [];

  required.push(checkCommand("node", [process.execPath, ["--version"]]));
  required.push(checkCommand("corepack", ["corepack", ["--version"]]));
  required.push(checkCommand("pnpm", ["corepack", ["pnpm", "--version"]]));

  if (options.phase === "before-build") {
    await checkApplicationPorts(required, options);
    if (!options.msw && plan.requiresDocker) {
      const docker = checkDocker();
      required.push(docker);
      if (docker.status === "READY") {
        const services = readComposeServices();
        checkComposeServices(plan, services, required, optional);
      } else {
        recommendations.push("Start Docker Desktop and wait for the Linux engine to become available.");
      }
    }
    await checkScopePorts(plan, required, optional);
    if (!options.msw && plan.requiredServices.has("postgres")) {
      required.push(checkDatabaseSchema(plan.scope));
    }
    if (
      options.allowReuseRuntime &&
      !options.msw &&
      (plan.scope === "automation" || plan.scope === "full")
    ) {
      required.push(await checkAutomationEnsureEndpoint());
    }
  }

  if (options.phase === "after-build") {
    required.push(checkBackendDistArtifacts(options.msw));
  }

  if (options.phase === "before-web-dev" || options.cleanStaleNextCache) {
    required.push(cleanStaleWebDevCache());
  }

  if (options.phase === "after-runtime") {
    await checkBackendHealth(required);
    await checkAuthBootstrap(required);
  }

  addScopeRecommendations(plan, required, recommendations);

  return buildPreflightReport({
    scope: plan.scope,
    phase: options.phase,
    required,
    optional,
    recommendations,
  });
}

function parseCliOptions(argv) {
  const args = new Set(argv);
  const mode = readArg(argv, "--mode") ?? null;
  const msw =
    mode === "msw-shell" ||
    process.env.LEXFRAME_E2E_USE_MSW === "1" ||
    readArg(argv, "--scope") === "msw";
  const scope =
    readArg(argv, "--scope") ??
    (mode === "msw-shell" || mode === "backend-shell" ? "shell" : "chat");
  const json = args.has("--json");
  const phase = readArg(argv, "--phase") ?? "before-build";

  return {
    help: args.has("--help"),
    mode,
    msw,
    scope,
    phase,
    json,
    failOnRequired: args.has("--fail-on-required") || !json,
    allowReuseRuntime:
      args.has("--allow-reuse-runtime") ||
      process.env.LEXFRAME_E2E_REUSE_EXISTING_SERVER === "1",
    cleanStaleNextCache: args.has("--clean-stale-next-cache"),
  };
}

function checkCommand(name, [command, args]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: command === process.execPath ? false : process.platform === "win32",
    env: process.env,
  });

  return {
    name,
    status: result.status === 0 ? "READY" : "BLOCKED_REQUIRED",
    blocksRequired: result.status !== 0,
    details: {
      command: command === process.execPath ? "node" : command,
      stdout: sanitize(result.stdout ?? "").trim(),
      stderr: sanitize(result.stderr ?? "").trim(),
    },
  };
}

function checkDocker() {
  const docker = resolveDockerCli();
  const result = spawnSync(
    docker,
    ["version", "--format", "{{.Server.Version}}"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      env: process.env,
    },
  );
  const available = result.status === 0 && Boolean(result.stdout.trim());

  return {
    name: "docker",
    status: available ? "READY" : "DOCKER_UNAVAILABLE",
    blocksRequired: !available,
    details: {
      cli: docker,
      version: sanitize(result.stdout ?? "").trim(),
      stderr: sanitize(result.stderr ?? "").trim(),
    },
  };
}

function readComposeServices() {
  const docker = resolveDockerCli();
  const result = spawnSync(
    docker,
    [
      "compose",
      "--profile",
      "local-integrated",
      "--profile",
      "full-runtime",
      "ps",
      "--all",
      "--format",
      "json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    return new Map();
  }

  return new Map(
    parseJsonLines(result.stdout ?? "").map((row) => [row.Service, row]),
  );
}

function checkComposeServices(plan, services, required, optional) {
  for (const service of plan.requiredServices) {
    const item = classifyComposeService(service, services.get(service));
    if (service === "opensearch" && item.status !== "READY") {
      required.push({ ...item, status: "SEARCH_BLOCKED" });
    } else if (service.startsWith("activepieces-") && item.status !== "READY") {
      required.push({ ...item, status: "AP_RUNTIME_BLOCKED" });
    } else {
      required.push(item);
    }
  }

  for (const service of plan.notRequiredServices) {
    if (!plan.optionalServices.has(service)) {
      continue;
    }
    optional.push({
      name: service,
      status: "NOT_REQUIRED_FOR_SCOPE",
      blocksRequired: false,
      details: {
        state: serviceStateText(services.get(service)) || "missing",
      },
    });
  }
}

function checkDatabaseSchema(scope) {
  const requirements = schemaRequirements[scope] ?? [];
  if (requirements.length === 0) {
    return {
      name: "database-schema",
      status: "READY",
      blocksRequired: false,
      details: { database: databaseName, action: "not-required-for-scope" },
    };
  }

  const relationChecks = requirements
    .filter((name) => !isColumnRequirement(name))
    .map(
      (name) =>
        `select ${sqlLiteral(name)} || '|' || coalesce((select c.relkind::text from pg_class c where c.oid = to_regclass(${sqlLiteral(name)})), 'missing')`,
    );
  const columnChecks = requirements
    .filter(isColumnRequirement)
    .map((name) => {
      const { schema, table, column } = parseColumnRequirement(name);
      return `select ${sqlLiteral(name)} || '|' || case when exists (select 1 from information_schema.columns where table_schema = ${sqlLiteral(schema)} and table_name = ${sqlLiteral(table)} and column_name = ${sqlLiteral(column)}) then 'column' else 'missing' end`;
    });
  const fixtureCheck =
    scope === "automation" || scope === "full"
      ? [
          "select 'automation_fixture_count|' || coalesce((select count(*)::text from app.installed_automations), '0')",
        ]
      : [];

  const sql = [...relationChecks, ...columnChecks, ...fixtureCheck].join(
    " union all ",
  );
  const docker = resolveDockerCli();
  const result = spawnSync(
    docker,
    [
      "compose",
      "--profile",
      "local-integrated",
      "--profile",
      "full-runtime",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "postgres",
      "-d",
      databaseName,
      "-Atc",
      sql,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  return classifyDatabaseSchemaProbe(scope, {
    ok: result.status === 0,
    rows: (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean),
    error: result.stderr || result.stdout,
  });
}

function isColumnRequirement(name) {
  return name.split(".").length === 3;
}

function parseColumnRequirement(name) {
  const [schema, table, column] = name.split(".");
  return { schema, table, column };
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function checkApplicationPorts(required, options) {
  if (options.allowReuseRuntime) {
    required.push({
      name: "application-ports",
      status: "READY",
      blocksRequired: false,
      details: {
        ports: appPorts,
        action: "reuse-existing-runtime-allowed",
      },
    });
    return;
  }

  const blocked = [];
  for (const port of appPorts) {
    if (!(await canBindPort(port))) {
      blocked.push(port);
    }
  }

  required.push({
    name: "application-ports",
    status: blocked.length === 0 ? "READY" : "STALE_PROCESS",
    blocksRequired: blocked.length > 0,
    details: { ports: appPorts, blocked },
  });
}

async function checkScopePorts(plan, required, optional) {
  for (const port of plan.requiredPorts) {
    required.push(await checkConnectPort(port, true));
  }

  for (const port of plan.notRequiredPorts) {
    if (!plan.optionalPorts.has(port)) {
      continue;
    }
    optional.push({
      name: portName(port),
      host: "127.0.0.1",
      port,
      status: "NOT_REQUIRED_FOR_SCOPE",
      blocksRequired: false,
    });
  }
}

async function checkConnectPort(port, required) {
  const available = await canConnectPort(port);
  return {
    name: portName(port),
    host: "127.0.0.1",
    port,
    status: available ? "READY" : "PORT_UNREACHABLE",
    blocksRequired: required && !available,
  };
}

function cleanStaleWebDevCache() {
  const cachePath = path.join(
    repoRoot,
    "apps",
    "web",
    ".next",
    "dev",
    "cache",
    "turbopack",
  );

  if (!existsSync(cachePath)) {
    return {
      name: "web-dev-cache",
      status: "READY",
      blocksRequired: false,
      details: { action: "not-present" },
    };
  }

  if (process.env.LEXFRAME_E2E_CLEAN_WEB_CACHE === "0") {
    return {
      name: "web-dev-cache",
      status: "STALE_BUILD",
      blocksRequired: true,
      details: { action: "clean-disabled" },
    };
  }

  rmSync(cachePath, { force: true, recursive: true });
  return {
    name: "web-dev-cache",
    status: "READY",
    blocksRequired: false,
    details: { action: "removed-generated-cache" },
  };
}

function checkBackendDistArtifacts(msw) {
  if (msw) {
    return {
      name: "backend-dist",
      status: "READY",
      blocksRequired: false,
      details: { action: "not-required-for-msw" },
    };
  }

  const missing = [];
  const stale = [];
  const manifestPath = path.join(repoRoot, backendBuildManifest);
  const manifest = readBackendBuildManifest(manifestPath);

  for (const relativePath of backendArtifacts) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      missing.push(relativePath);
      continue;
    }

    if (manifest && statSync(absolutePath).mtimeMs + 10 * 60_000 < manifest.generatedAtMs) {
      stale.push(relativePath);
    }
  }

  const manifestFresh =
    manifest !== null && Date.now() - manifest.generatedAtMs < 10 * 60_000;
  const blocked = !manifestFresh || missing.length > 0 || stale.length > 0;

  return {
    name: "backend-dist",
    status: blocked ? "STALE_BUILD" : "READY",
    blocksRequired: blocked,
    details: {
      manifest: backendBuildManifest,
      manifestFresh,
      missing,
      stale,
    },
  };
}

async function checkBackendHealth(required) {
  const url =
    process.env.LEXFRAME_API_HEALTH_URL ??
    `http://127.0.0.1:${backendPort}/health/live`;
  const result = await checkUrl("backend-health", url);
  required.push({
    ...result,
    status: result.status === "READY" ? "READY" : "PORT_UNREACHABLE",
  });
}

async function checkAuthBootstrap(required) {
  const url =
    process.env.LEXFRAME_AUTH_BOOTSTRAP_URL ??
    `http://127.0.0.1:${backendPort}/auth/bootstrap`;
  const token = process.env.LEXFRAME_E2E_AUTH_BOOTSTRAP_TOKEN;

  if (!token) {
    required.push({
      name: "auth-bootstrap",
      status: "READY",
      blocksRequired: false,
      details: {
        action: "not-probed-without-token",
        reason: "browser sign-in owns auth bootstrap coverage",
      },
    });
    return;
  }

  const result = await checkUrl("auth-bootstrap", url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  required.push({
    ...result,
    status: result.status === "READY" ? "READY" : "AUTH_BOOTSTRAP_BLOCKED",
  });
}

async function checkAutomationEnsureEndpoint() {
  const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
  const token = buildDevAccessToken({
    id:
      process.env.LEXFRAME_E2E_DEV_USER_ID ??
      "16000000-0000-4000-8000-000000000001",
    email: process.env.LEXFRAME_E2E_DEV_EMAIL ?? "stage16.owner@lexframe.test",
    fullName: process.env.LEXFRAME_E2E_DEV_FULL_NAME ?? "Stage16 Owner",
  });

  try {
    await fetch(`http://127.0.0.1:${backendPort}/auth/bootstrap`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
    const contextResponse = await fetch(
      `http://127.0.0.1:${backendPort}/session/context`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      },
    );
    const contextText = await contextResponse.text();
    const context = JSON.parse(contextText);
    const workspaceId = context?.activeWorkspace?.id;

    if (!contextResponse.ok || !workspaceId) {
      return classifyAutomationEnsureProbe({
        ok: false,
        status: contextResponse.status,
        error: "active workspace unavailable for automation ensure preflight",
      });
    }

    const response = await fetch(
      `http://127.0.0.1:${backendPort}/projects/${encodeURIComponent(projectId)}/automations/stage17-canvas/ensure`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-workspace-id": workspaceId,
        },
        body: "{}",
        signal: AbortSignal.timeout(10_000),
      },
    );
    return classifyAutomationEnsureProbe({
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    });
  } catch (error) {
    return classifyAutomationEnsureProbe({
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function checkUrl(name, url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(5_000),
    });
    return {
      name,
      url,
      status: response.status < 500 ? "READY" : "BLOCKED_REQUIRED",
      blocksRequired: response.status >= 500,
      details: { httpStatus: response.status },
    };
  } catch (error) {
    return {
      name,
      url,
      status: "BLOCKED_REQUIRED",
      blocksRequired: true,
      details: { error: sanitize(error instanceof Error ? error.message : String(error)) },
    };
  }
}

function buildDevAccessToken(input) {
  const payload = {
    id: input.id,
    email: input.email,
    fullName: input.fullName,
    emailConfirmedAt: new Date().toISOString(),
    assuranceLevel: "aal1",
  };
  return `dev.${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
}

function addScopeRecommendations(plan, required, recommendations) {
  const blockedStatuses = new Set(required.filter((item) => item.blocksRequired).map((item) => item.status));
  if (blockedStatuses.has("COMPOSE_SERVICE_STOPPED")) {
    recommendations.push("Run corepack pnpm stage16:db:apply-local for DB-backed shell/chat scopes.");
  }
  if (blockedStatuses.has("AP_RUNTIME_BLOCKED")) {
    recommendations.push("Run corepack pnpm stage16:runtime:up-full for automation or full runtime scopes.");
  }
  const mainPostgresBlocked = required.some(
    (item) => item.port === 54322 && item.blocksRequired,
  );
  if (mainPostgresBlocked) {
    recommendations.push("Ensure local-integrated postgres is listening on 127.0.0.1:54322.");
  }
  if (blockedStatuses.has("STALE_BUILD")) {
    recommendations.push("Run corepack pnpm stage16:build:backend-runtime before backend-backed Playwright.");
  }
  if (blockedStatuses.has("STALE_SCHEMA")) {
    recommendations.push("Rebuild the DB bootstrap/runtime images and re-apply local runtime schema, for example: corepack pnpm stage23:runtime:rebuild.");
  }
  if (plan.scope !== "search") {
    recommendations.push("OpenSearch is not required for this scope unless search/RAG specs are selected.");
  }
}

function formatReport(report) {
  const lines = [
    `[stage16:e2e-preflight] ${report.status} scope=${report.scope} phase=${report.phase}`,
  ];

  for (const item of report.required) {
    lines.push(`required ${item.name}: ${item.status}`);
  }
  for (const item of report.optional) {
    lines.push(`optional ${item.name}: ${item.status}`);
  }
  for (const recommendation of report.recommendations) {
    lines.push(`recommendation: ${recommendation}`);
  }
  if (report.status === "BLOCKED_REQUIRED") {
    lines.push("BLOCKED_INFRASTRUCTURE required runtime checks failed");
    lines.push(JSON.stringify(report, null, 2));
  }

  return lines.join("\n");
}

function readBackendBuildManifest(manifestPath) {
  try {
    const payload = JSON.parse(readFileSync(manifestPath, "utf8"));
    const generatedAtMs = Date.parse(payload.generatedAt);
    if (!Number.isFinite(generatedAtMs)) {
      return null;
    }
    return { generatedAtMs };
  } catch {
    return null;
  }
}

function resolveDockerCli() {
  return (
    process.env.DOCKER_CLI_PATH ??
    (process.platform === "win32" ? "docker.exe" : "docker")
  );
}

function normalizeScope(scope) {
  if (scope === "backend-shell" || scope === "msw-shell") {
    return "shell";
  }
  if (scope === "msw") {
    return "shell";
  }
  return scope;
}

function parsePortList(value) {
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((port) => Number.isInteger(port) && port > 0);
}

function uniqueNumbers(values) {
  return [
    ...new Set(values.filter((value) => Number.isInteger(value) && value > 0)),
  ];
}

function readArg(argv, name) {
  const prefix = `${name}=`;
  const value = argv.find((arg) => arg.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function canConnectPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function parseJsonLines(output) {
  const text = output.trim();
  if (!text) {
    return [];
  }
  if (text.startsWith("[")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

function serviceStateText(row) {
  if (!row) {
    return "";
  }
  return [
    row.State,
    row.Status,
    row.Health,
    row.health,
    row.ExitCode === 0 ? null : row.ExitCode ? `exit-${row.ExitCode}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function portName(port) {
  if (port === 54322) {
    return "postgres-main";
  }
  if (port === 54323) {
    return "activepieces-postgres";
  }
  const service = [...servicePorts.entries()].find(([, value]) => value === port)?.[0];
  return service ?? `port-${port}`;
}

function sanitize(value) {
  return String(value).replace(
    /(Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._~+/=-]+|BEGIN PRIVATE KEY[\s\S]*?END PRIVATE KEY|postgresql:\/\/[^@\s]+@)/g,
    (match) => (match.startsWith("postgresql://") ? "postgresql://[redacted]@" : "[redacted]"),
  );
}
