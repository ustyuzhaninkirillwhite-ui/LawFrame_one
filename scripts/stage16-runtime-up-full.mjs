import { spawnSync } from "node:child_process";
import { resolveDockerCli } from "./stage16-compose-utils.mjs";

const docker = resolveDockerCli();
const shell = process.platform === "win32";
const fullRuntimeEnv = {
  ...process.env,
  AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE ?? "controlled-real",
  LEXFRAME_MINING_WORKER_HEALTH_URL:
    process.env.LEXFRAME_MINING_WORKER_HEALTH_URL ??
    "http://mining-worker:8090/health/ready",
  LEXFRAME_READINESS_PROFILE:
    process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
  ACTIVEPIECES_SIMULATE_RUNS: process.env.ACTIVEPIECES_SIMULATE_RUNS ?? "0",
  NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW ?? "0",
};

const composeProfiles = [
  "compose",
  "--profile",
  "local-integrated",
  "--profile",
  "full-runtime",
];

const fullRuntimeServices = [
  "postgres",
  "redis",
  "activepieces-postgres",
  "activepieces-redis",
  "activepieces-app",
  "activepieces-worker",
  "opensearch",
  "storage-sandbox",
  "delivery-sandbox",
  "redpanda",
  "clickhouse",
  "mining-worker",
  "backend",
  "web",
];

async function main() {
  run(docker, [...composeProfiles, "up", "-d", ...fullRuntimeServices]);
  run("corepack", ["pnpm", "stage16:db:apply-local"]);
  await waitForMiningWorkerReady();
  run("corepack", ["pnpm", "stage16:runtime:health"], {
    STAGE16_REQUIRE_APP_HEALTH: "1",
  });
  await waitForHealthySystemStatus();
  console.log("[stage16-runtime-full] full-services runtime is healthy");
}

function run(command, args, envOverrides = {}) {
  console.log(`[stage16-runtime-full] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell,
    env: {
      ...fullRuntimeEnv,
      ...envOverrides,
    },
  });

  if (result.error) {
    throw new Error(
      `${command} ${args.join(" ")} failed to start: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status ?? 1}`,
    );
  }
}

async function waitForMiningWorkerReady() {
  const url =
    process.env.STAGE16_MINING_WORKER_READY_URL ??
    "http://127.0.0.1:8090/health/ready";
  await waitForJson(
    "mining-worker readiness",
    url,
    (payload) => payload.status === "ok",
    (payload) =>
      `status=${String(payload.status ?? "missing")} summary=${String(
        payload.summary ?? "",
      )}`,
  );
}

async function waitForHealthySystemStatus() {
  const url =
    process.env.STAGE16_SYSTEM_STATUS_URL ??
    "http://127.0.0.1:3100/system/status";
  await waitForJson(
    "backend /system/status",
    url,
    (payload) =>
      payload.overall === "healthy" &&
      Array.isArray(payload.components) &&
      payload.components.every(
        (component) =>
          typeof component === "object" &&
          component !== null &&
          component.status === "healthy",
      ),
    (payload) => {
      const components = Array.isArray(payload.components)
        ? payload.components
            .map((component) =>
              typeof component === "object" && component !== null
                ? `${String(component.code)}=${String(component.status)}`
                : "invalid-component",
            )
            .join(", ")
        : "no-components";
      return `overall=${String(payload.overall ?? "missing")} ${components}`;
    },
  );
}

async function waitForJson(label, url, isReady, describe, timeoutMs = 300_000) {
  const started = Date.now();
  let lastState = "not attempted";

  while (Date.now() - started <= timeoutMs) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5_000),
      });
      const payload = await response.json();
      lastState = describe(payload);
      console.log(`[stage16-runtime-full] ${label}: ${lastState}`);
      if (response.ok && isReady(payload)) {
        return;
      }
    } catch (error) {
      lastState = error instanceof Error ? error.message : String(error);
      console.log(`[stage16-runtime-full] ${label}: ${lastState}`);
    }

    await sleep(5_000);
  }

  throw new Error(`${label} did not become healthy: ${lastState}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dumpDiagnostics(error) {
  console.error(
    `[stage16-runtime-full] FAIL: ${error instanceof Error ? error.message : String(error)}`,
  );
  for (const args of [
    [...composeProfiles, "ps", "--all"],
    [
      ...composeProfiles,
      "logs",
      "--no-color",
      "--tail",
      "120",
      "mining-worker",
    ],
    [...composeProfiles, "logs", "--no-color", "--tail", "120", "backend"],
  ]) {
    const result = spawnSync(docker, args, {
      encoding: "utf8",
      shell,
      env: fullRuntimeEnv,
    });
    if (result.stdout || result.stderr) {
      console.error(
        `[stage16-runtime-full] ${docker} ${args.join(" ")}\n${result.stdout ?? ""}${result.stderr ?? ""}`,
      );
    }
  }
}

try {
  await main();
} catch (error) {
  await dumpDiagnostics(error);
  process.exit(1);
}
