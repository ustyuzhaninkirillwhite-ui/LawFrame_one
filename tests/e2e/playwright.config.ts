import { defineConfig } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";

const isStage17LiveRun = process.env.LEXFRAME_STAGE17_17_10_LIVE === "1";
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
const apiPort = Number(process.env.LEXFRAME_API_PORT ?? "3100");
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;
const apiBaseURL = `http://${host}:${apiPort}`;
const useMsw = process.env.LEXFRAME_E2E_USE_MSW === "1";
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
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: playwrightArtifactDir
    ? `${playwrightArtifactDir}/test-results`
    : "test-results",
  webServer: [
    {
      command: `corepack pnpm --dir ../.. stage16:build:backend-runtime && node ../../scripts/prepare-stage14-search-index.mjs && node ../../scripts/stage16-start-backend-runtime.mjs`,
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
    {
      command: `corepack pnpm --dir ../.. stage16:build:web-runtime && corepack pnpm --dir ../../apps/web exec next dev --hostname ${host} --port ${port}`,
      url: baseURL,
      timeout: 180_000,
      reuseExistingServer,
      env: {
        ...process.env,
        NEXT_PUBLIC_ENABLE_MSW: useMsw ? "1" : "0",
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
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
