import { defineConfig } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";

const isStage17LiveRun = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
const isStage21LiveSmokeRun =
  process.env.LEXFRAME_STAGE21_LIVE_PRODUCT_SMOKE === "1";
const isStage1820AuditRun =
  process.env.LEXFRAME_STAGE18_20_AUDIT === "1" ||
  process.argv.some((arg) => /stage18|stage19|stage20|stage18-20/i.test(arg));
const isStage1820RemediationRun =
  process.env.LEXFRAME_STAGE18_20_REMEDIATION === "1";
const auditPlaywrightDir = "../../artifacts/stage18-20/audit/playwright";
const remediationPlaywrightDir =
  "../../artifacts/stage18-20/remediation/e2e/playwright";
const playwrightArtifactDir = isStage1820RemediationRun
  ? remediationPlaywrightDir
  : isStage1820AuditRun
    ? auditPlaywrightDir
    : null;
const port = Number(
  process.env.LEXFRAME_E2E_PORT ?? (isStage17LiveRun ? "3100" : "3000"),
);
const apiPort = Number(process.env.LEXFRAME_API_PORT ?? "3104");
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;
const apiBaseURL = `http://${host}:${apiPort}`;
const useMsw = process.env.LEXFRAME_E2E_USE_MSW === "1";
const externalRuntime = process.env.LEXFRAME_E2E_EXTERNAL_RUNTIME === "1";
const frontendApiBaseURL = useMsw ? baseURL : apiBaseURL;
const readinessProfile =
  process.env.LEXFRAME_READINESS_PROFILE ??
  (useMsw ? "local-basic" : "local-integrated");
process.env.LEXFRAME_READINESS_PROFILE ??= readinessProfile;
const reuseExistingServer =
  process.env.LEXFRAME_E2E_REUSE_EXISTING_SERVER === "1"
    ? true
    : process.env.LEXFRAME_E2E_REUSE_EXISTING_SERVER === "0"
      ? false
      : false;
const simulateRuns =
  process.env.ACTIVEPIECES_SIMULATE_RUNS ??
  (readinessProfile === "local-integrated" ? "0" : "1");
const activepiecesEmbedSdkUrl =
  readinessProfile === "local-integrated"
    ? (process.env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL ??
      `${baseURL}/activepieces-embed.mock.js`)
    : `${baseURL}/activepieces-embed.mock.js`;
const deliveryTransport =
  process.env.LEXFRAME_DELIVERY_TRANSPORT ??
  (readinessProfile === "local-integrated" ? "webhook" : "disabled");
const deliveryWebhookUrl =
  process.env.LEXFRAME_DELIVERY_WEBHOOK_URL ??
  "http://127.0.0.1:8091/hooks/delivery";
const deliveryWebhookToken =
  process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN ?? "local_delivery_token";
const activepiecesSigningPrivateKey = resolveActivepiecesSigningPrivateKey();
const frontendServerEnv = stripServerOnlySecrets(process.env);
const prepareSearchIndexCommand =
  process.env.LEXFRAME_E2E_SKIP_SEARCH_INDEX === "1"
    ? ""
    : "node ../../scripts/prepare-stage14-search-index.mjs && ";
const runtimePreflightEnabled = process.env.LEXFRAME_E2E_PREFLIGHT !== "0";
const runtimePreflightMode = useMsw ? "msw-shell" : "backend-shell";
const runtimePreflightScope =
  process.env.LEXFRAME_E2E_SCOPE ?? inferRuntimePreflightScope(process.argv);
const beforeBuildPreflightCommand = runtimePreflightEnabled
  ? `node ../../scripts/stage16-e2e-preflight.mjs --mode=${runtimePreflightMode} --scope=${runtimePreflightScope} --phase=before-build && `
  : "";
const afterBuildPreflightCommand = runtimePreflightEnabled
  ? `node ../../scripts/stage16-e2e-preflight.mjs --mode=${runtimePreflightMode} --scope=${runtimePreflightScope} --phase=after-build && `
  : "";
const beforeWebDevPreflightCommand = runtimePreflightEnabled
  ? `node ../../scripts/stage16-e2e-preflight.mjs --mode=${runtimePreflightMode} --scope=${runtimePreflightScope} --phase=before-web-dev && `
  : "";
const nextDevBundlerFlag =
  process.env.LEXFRAME_E2E_NEXT_DEV_BUNDLER === "turbo" ||
  process.env.LEXFRAME_E2E_NEXT_DEV_BUNDLER === "turbopack"
    ? "--turbopack"
    : "--webpack";
process.env.LEXFRAME_DELIVERY_TRANSPORT ??= deliveryTransport;
process.env.LEXFRAME_DELIVERY_WEBHOOK_URL ??= deliveryWebhookUrl;
process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN ??= deliveryWebhookToken;

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  projects: [
    {
      name: "default",
      testIgnore: /stage16-live-audit\/.*\.spec\.ts/,
    },
    {
      name: "stage16-live-audit",
      testMatch: /stage16-live-audit\/.*\.spec\.ts/,
    },
  ],
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: playwrightArtifactDir
          ? `${playwrightArtifactDir}/html-report`
          : "playwright-report",
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile: playwrightArtifactDir
          ? `${playwrightArtifactDir}/results.json`
          : "playwright-report/results.json",
      },
    ],
  ],
  use: {
    baseURL,
    trace: isStage21LiveSmokeRun ? "off" : "retain-on-failure",
    video: isStage21LiveSmokeRun ? "off" : "retain-on-failure",
    screenshot: isStage21LiveSmokeRun ? "off" : "only-on-failure",
  },
  outputDir: playwrightArtifactDir
    ? `${playwrightArtifactDir}/test-results`
    : "test-results",
  webServer: externalRuntime
    ? []
    : [
    ...(
      useMsw
        ? []
        : [
            {
      command: `${beforeBuildPreflightCommand}corepack pnpm --dir ../.. stage16:build:backend-runtime && ${afterBuildPreflightCommand}${prepareSearchIndexCommand}node ../../scripts/stage16-start-backend-runtime.mjs`,
      url: `${apiBaseURL}/health/live`,
      timeout: 240_000,
      reuseExistingServer,
      env: {
        ...process.env,
        PORT: String(apiPort),
        LEXFRAME_APP_BASE_URL: baseURL,
        LEXFRAME_ENV_PROFILE: process.env.LEXFRAME_ENV_PROFILE ?? "local",
        LEXFRAME_READINESS_PROFILE: readinessProfile,
        LEXFRAME_DEPLOY_ENV: process.env.LEXFRAME_DEPLOY_ENV ?? "local",
        AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE ?? "controlled-real",
        LEXFRAME_AI_SECRET_BACKEND:
          process.env.LEXFRAME_AI_SECRET_BACKEND ?? "supabase_vault",
        LEXFRAME_CONTRACTS_VERSION:
          process.env.LEXFRAME_CONTRACTS_VERSION ?? "stage20",
        LEXFRAME_RELEASE_SHA:
          process.env.LEXFRAME_RELEASE_SHA ?? "local-e2e",
        LEXFRAME_LOCAL_KEYS_DISABLED:
          process.env.LEXFRAME_LOCAL_KEYS_DISABLED ?? "true",
        ACTIVEPIECES_SIMULATE_RUNS: simulateRuns,
        ACTIVEPIECES_BASE_URL:
          process.env.ACTIVEPIECES_BASE_URL ?? "http://127.0.0.1:8080",
        ACTIVEPIECES_API_KEY:
          process.env.ACTIVEPIECES_API_KEY ??
          "local_activepieces_access_token",
        ACTIVEPIECES_SIGNING_PRIVATE_KEY:
          activepiecesSigningPrivateKey,
        ACTIVEPIECES_SIGNING_KEY_ID:
          process.env.ACTIVEPIECES_SIGNING_KEY_ID ?? "lexframe-stage4",
        ACTIVEPIECES_PROJECT_PREFIX:
          process.env.ACTIVEPIECES_PROJECT_PREFIX ?? "lf",
        ACTIVEPIECES_POSTGRES_PASSWORD:
          process.env.ACTIVEPIECES_POSTGRES_PASSWORD ?? "postgres",
        LEXFRAME_DELIVERY_TRANSPORT: deliveryTransport,
        LEXFRAME_DELIVERY_WEBHOOK_URL: deliveryWebhookUrl,
        LEXFRAME_DELIVERY_WEBHOOK_TOKEN: deliveryWebhookToken,
        LEXFRAME_DELIVERY_FROM_EMAIL:
          process.env.LEXFRAME_DELIVERY_FROM_EMAIL ?? "noreply@lexframe.local",
        SUPABASE_URL:
          process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
        SUPABASE_SECRET_KEY:
          process.env.SUPABASE_SECRET_KEY ?? "stage14_supabase_secret_key",
        SUPABASE_DB_URL:
          process.env.SUPABASE_DB_URL ??
          "postgresql://postgres:postgres@127.0.0.1:54322/stage16_runtime",
        LEXFRAME_RUNTIME_MASTER_SECRET:
          process.env.LEXFRAME_RUNTIME_MASTER_SECRET ??
          "local_stage16_runtime_master_secret",
        OPENSEARCH_URL:
          process.env.OPENSEARCH_URL ?? "http://127.0.0.1:9200",
        OPENSEARCH_INDEX_ALIAS:
          process.env.OPENSEARCH_INDEX_ALIAS ?? "legal_chunks_current",
        OPENSEARCH_SEARCH_PIPELINE:
          process.env.OPENSEARCH_SEARCH_PIPELINE ?? "legal-hybrid-pipeline",
      },
            },
          ]
    ),
    {
      command: `${useMsw ? beforeBuildPreflightCommand : ""}corepack pnpm --dir ../.. stage16:build:web-runtime && ${beforeWebDevPreflightCommand}corepack pnpm --dir ../../apps/web exec next dev ${nextDevBundlerFlag} --hostname ${host} --port ${port}`,
      url: baseURL,
      timeout: 180_000,
      reuseExistingServer,
      env: {
        ...frontendServerEnv,
        NEXT_PUBLIC_ENABLE_MSW: useMsw ? "1" : "0",
        NEXT_PUBLIC_API_BASE_URL: frontendApiBaseURL,
        NEXT_PUBLIC_SUPABASE_URL:
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          "demo_publishable_key",
        NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL:
          process.env.NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL ??
          "http://127.0.0.1:8080",
        NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL: activepiecesEmbedSdkUrl,
        NEXT_PUBLIC_CONTRACTS_VERSION:
          process.env.NEXT_PUBLIC_CONTRACTS_VERSION ?? "stage14-integrated",
        LEXFRAME_READINESS_PROFILE: readinessProfile,
      },
    },
  ],
});

function resolveActivepiecesSigningPrivateKey() {
  const configured = process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY?.trim();
  if (configured?.includes("BEGIN PRIVATE KEY")) {
    return configured;
  }

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8",
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki",
    },
  });
  return privateKey;
}

function stripServerOnlySecrets(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const result = { ...source };
  const forbidden = new Set([
    "ACTIVEPIECES_API_KEY",
    "ACTIVEPIECES_API_KEY_SECRET_REF",
    "ACTIVEPIECES_SIGNING_PRIVATE_KEY",
    "ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF",
    "COMETAPI_API_KEY",
    "COMETAPI_API_KEYS",
    "COMETAPI_KEY",
    "LEXFRAME_STAGE21_AI_API_KEY",
    "LEXFRAME_DELIVERY_WEBHOOK_TOKEN",
    "LEXFRAME_RUNTIME_MASTER_SECRET",
    "OPENAI_API_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_SECRET_KEY",
    "XAI_API_KEY",
  ]);

  for (const key of forbidden) {
    delete result[key];
  }

  return result;
}

function inferRuntimePreflightScope(argv: readonly string[]) {
  const selected = argv.join(" ").toLowerCase();

  if (/automation|activepieces|canvas/.test(selected)) {
    return "automation";
  }
  if (/document|upload-download|storage/.test(selected)) {
    return "documents";
  }
  if (/search|rag/.test(selected)) {
    return "search";
  }
  if (/chat/.test(selected)) {
    return "chat";
  }
  if (/project-workspace|project-home|project-sidebar-route-cache/.test(selected)) {
    return "project-workspace";
  }
  if (/settings|profile|organization|route-preferences|secret-write-only|ssrf/.test(selected)) {
    return "settings";
  }
  if (/security|rbac|audit|forced-route|cross-workspace|permission/.test(selected)) {
    return "security";
  }

  return "shell";
}
