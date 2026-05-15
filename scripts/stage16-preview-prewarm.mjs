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
        status: results.every((item) => item.status !== "FETCH_FAILED")
          ? "READY"
          : "DEGRADED",
        webBaseUrl,
        results,
      },
      null,
      2,
    ),
  );
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

await main();
