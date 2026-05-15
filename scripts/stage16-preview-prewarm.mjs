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
  const preflight = runSchemaPreflight();
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
        status: preflight.status === "READY" && results.every((item) => item.status !== "FETCH_FAILED")
          ? "READY"
          : "DEGRADED",
        webBaseUrl,
        preflight,
        results,
      },
      null,
      2,
    ),
  );
}

function runSchemaPreflight() {
  if (process.env.STAGE16_PREWARM_SKIP_PREFLIGHT === "1") {
    return {
      status: "SKIPPED",
      reason: "STAGE16_PREWARM_SKIP_PREFLIGHT=1",
    };
  }

  const result = spawnSync(
    process.execPath,
    [
      "scripts/stage16-e2e-preflight.mjs",
      "--scope=automation",
      "--json",
      "--fail-on-required",
      "--allow-reuse-runtime",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  try {
    const report = JSON.parse(result.stdout || "{}");
    return {
      status: report.status ?? "UNKNOWN",
      blockers: Array.isArray(report.blockers)
        ? report.blockers.map((item) => ({
            name: item.name,
            status: item.status,
            details: item.details,
          }))
        : [],
    };
  } catch {
    return {
      status: "PREFLIGHT_FAILED",
      exitStatus: result.status,
      stderr: sanitize(result.stderr ?? ""),
    };
  }
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
