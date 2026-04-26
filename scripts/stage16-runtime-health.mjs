import { spawnSync } from "node:child_process";

const requiredServices = [
  "postgres",
  "redis",
  "activepieces-postgres",
  "activepieces-redis",
  "activepieces-app",
  "activepieces-worker",
  "storage-sandbox",
  "delivery-sandbox",
];

const endpoints = [
  ["storage-sandbox", process.env.STORAGE_SANDBOX_HEALTH_URL ?? "http://127.0.0.1:54321/health"],
  ["delivery-sandbox", process.env.DELIVERY_SANDBOX_HEALTH_URL ?? "http://127.0.0.1:8091/health"],
  ["activepieces-app", process.env.ACTIVEPIECES_HEALTH_URL ?? "http://127.0.0.1:8080"],
];

const optionalEndpoints = [
  ["backend", process.env.LEXFRAME_API_HEALTH_URL ?? "http://127.0.0.1:3100/health/live"],
  ["frontend", process.env.LEXFRAME_WEB_HEALTH_URL ?? "http://127.0.0.1:3000"],
];
const optionalEndpointResults = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

async function checkUrl(name, url, required = true) {
  try {
    await retry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.status >= 500) {
      throw new Error(`${name} returned ${response.status}`);
    }
    console.log(`[stage16-runtime] ${name} ${url} -> ${response.status}`);
    if (!required) {
      optionalEndpointResults.push({ name, url, available: true });
    }
    }, `${name} health`);
  } catch (error) {
    if (required) {
      throw error;
    }
    optionalEndpointResults.push({
      name,
      url,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`[stage16-runtime] optional ${name} ${url} unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function retry(fn, label, attempts = 12) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const waitMs = Math.min(1000 * attempt, 5000);
      console.log(
        `[stage16-runtime] ${label} attempt ${attempt}/${attempts} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function activepiecesAuthPreflight() {
  const baseUrl = process.env.ACTIVEPIECES_BASE_URL ?? "http://127.0.0.1:8080";
  const email = process.env.ACTIVEPIECES_SERVICE_EMAIL ?? "lexframe-stage16@lexframe.test";
  const password = process.env.ACTIVEPIECES_SERVICE_PASSWORD ?? "Stage16Activepieces!123";
  const signInBody = JSON.stringify({ email, password });
  let response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/authentication/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: signInBody,
  });
  if (!response.ok) {
    await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/authentication/sign-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        firstName: "LexFrame",
        lastName: "Stage16",
        trackEvents: false,
        newsLetter: false,
      }),
    });
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/authentication/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: signInBody,
    });
  }
  if (!response.ok) {
    throw new Error(`Activepieces service sign-in failed with ${response.status}`);
  }
  const auth = await response.json();
  const projectResponse = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/v1/users/projects/${encodeURIComponent(auth.projectId)}`,
    {
      headers: { authorization: `Bearer ${auth.token}` },
    },
  );
  if (!projectResponse.ok) {
    throw new Error(`Activepieces project read-back failed with ${projectResponse.status}`);
  }
  console.log(`[stage16-runtime] activepieces API auth/project preflight -> ${projectResponse.status}`);
}

function parseComposePs() {
  const json = run("docker", ["compose", "--profile", "local-integrated", "ps", "--all", "--format", "json"]);
  return json
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const services = parseComposePs();
const byService = new Map(services.map((service) => [service.Service, service]));
const failures = [];

for (const serviceName of requiredServices) {
  const service = byService.get(serviceName);
  if (!service) {
    failures.push(`${serviceName}: missing`);
    continue;
  }
  const state = `${service.State ?? ""} ${service.Status ?? ""}`.toLowerCase();
  if (state.includes("exited") || state.includes("dead") || state.includes("unhealthy")) {
    failures.push(`${serviceName}: ${service.State} ${service.Status}`);
  }
}

if (failures.length > 0) {
  throw new Error(`local-integrated required service failure:\n${failures.join("\n")}`);
}

for (const [name, url] of endpoints) {
  await checkUrl(name, url, true);
}

for (const [name, url] of optionalEndpoints) {
  await checkUrl(name, url, process.env.STAGE16_REQUIRE_APP_HEALTH === "1");
}

await retry(activepiecesAuthPreflight, "activepieces API preflight");

const workerLogs = run("docker", [
  "compose",
  "--profile",
  "local-integrated",
  "logs",
  "--no-color",
  "--tail",
  "200",
  "activepieces-worker",
]);
if (
  /unable to reach the server/i.test(workerLogs) &&
  !/(Started|Starting) polling queue/i.test(workerLogs)
) {
  throw new Error("activepieces-worker reported inability to reach the server and has no later polling evidence");
}

const unavailableOptional = optionalEndpointResults.filter((item) => !item.available);
if (unavailableOptional.length > 0 && process.env.STAGE16_REQUIRE_APP_HEALTH !== "1") {
  console.log(
    `[stage16-runtime] app servers not required in this probe: ${unavailableOptional
      .map((item) => item.name)
      .join(", ")} unavailable. Playwright webServer is the acceptance proof for backend/frontend readiness.`,
  );
}

console.log("[stage16-runtime] local-integrated Docker/runtime dependencies are healthy");
