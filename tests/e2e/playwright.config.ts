import { defineConfig } from "@playwright/test";

const port = Number(process.env.LEXFRAME_E2E_PORT ?? "3000");
const apiPort = Number(process.env.LEXFRAME_API_PORT ?? "3100");
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;
const apiBaseURL = `http://${host}:${apiPort}`;
const useMsw = process.env.LEXFRAME_E2E_USE_MSW === "1";
const isStage16LiveAuditRun = process.argv.some((arg) =>
  /stage16-live-audit/i.test(arg),
);
const readinessProfile =
  process.env.LEXFRAME_READINESS_PROFILE ??
  (isStage16LiveAuditRun ? "local-integrated" : "local-basic");
const reuseExistingServer =
  process.env.LEXFRAME_E2E_REUSE_EXISTING_SERVER === "1" ||
  (!process.env.CI &&
    (!isStage16LiveAuditRun || readinessProfile === "local-integrated"));
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
  process.env.LEXFRAME_DELIVERY_WEBHOOK_TOKEN ?? "local_delivery_sandbox_token";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  outputDir: "test-results",
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
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `corepack pnpm --dir ../.. stage16:build:backend-runtime && corepack pnpm --dir ../../apps/backend start:prod`,
      url: `${apiBaseURL}/health/live`,
      timeout: 240_000,
      reuseExistingServer,
      env: {
        ...process.env,
        PORT: String(apiPort),
        LEXFRAME_READINESS_PROFILE: readinessProfile,
        ACTIVEPIECES_SIMULATE_RUNS: simulateRuns,
        LEXFRAME_DELIVERY_TRANSPORT: deliveryTransport,
        LEXFRAME_DELIVERY_WEBHOOK_URL: deliveryWebhookUrl,
        LEXFRAME_DELIVERY_WEBHOOK_TOKEN: deliveryWebhookToken,
        LEXFRAME_DELIVERY_FROM_EMAIL:
          process.env.LEXFRAME_DELIVERY_FROM_EMAIL ?? "noreply@lexframe.local",
        SUPABASE_DB_URL:
          process.env.SUPABASE_DB_URL ??
          "postgresql://postgres:postgres@127.0.0.1:54322/stage16_runtime",
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
