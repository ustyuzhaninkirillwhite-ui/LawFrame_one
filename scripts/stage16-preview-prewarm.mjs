import { spawnSync } from "node:child_process";

const webBaseUrl = trimTrailingSlash(
  process.env.LEXFRAME_WEB_BASE_URL ?? "http://127.0.0.1:3000",
);
const projectId = process.env.STAGE16_PREWARM_PROJECT_ID ?? "project_claim_001";
const routes = [
  "/chat",
  "/app/projects",
  `/app/projects/${projectId}/automations`,
];

if (process.env.STAGE16_PREWARM_CANVAS_ROUTE) {
  routes.push(process.env.STAGE16_PREWARM_CANVAS_ROUTE);
} else if (process.env.STAGE16_PREWARM_AUTOMATION_ID) {
  routes.push(
    `/app/projects/${projectId}/automations/${process.env.STAGE16_PREWARM_AUTOMATION_ID}/automation`,
  );
}

async function main() {
  const runtimeHealth = runRuntimeHealth();
  const results = [];
  for (const route of routes) {
    const url = `${webBaseUrl}${route}`;
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { redirect: "manual" });
      results.push({
        route,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        route,
        status: "FETCH_FAILED",
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        status: runtimeHealth.status === "READY" && results.every((item) => item.status !== "FETCH_FAILED")
          ? "READY"
          : "DEGRADED",
        webBaseUrl,
        runtimeHealth,
        results,
      },
      null,
      2,
    ),
  );
}

function runRuntimeHealth() {
  if (process.env.STAGE16_PREWARM_SKIP_RUNTIME_HEALTH === "1") {
    return {
      status: "SKIPPED",
      reason: "STAGE16_PREWARM_SKIP_RUNTIME_HEALTH=1",
    };
  }

  const result = spawnSync(
    process.execPath,
    ["scripts/stage16-runtime-health.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      env: {
        ...process.env,
        STAGE16_REQUIRE_APP_HEALTH: "1",
      },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  return {
    status: result.status === 0 ? "READY" : "RUNTIME_HEALTH_FAILED",
    exitStatus: result.status,
    stdout: sanitize(result.stdout ?? "").slice(-4000),
    stderr: sanitize(result.stderr ?? "").slice(-4000),
  };
}

function sanitize(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, "$1=<redacted>");
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

await main();
