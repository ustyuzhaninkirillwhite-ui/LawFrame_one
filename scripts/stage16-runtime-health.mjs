import {
  compose,
  parseComposePsJson,
  repoRoot,
} from "./stage16-compose-utils.mjs";

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

const dependencyEndpoints = [
  ["storage-sandbox", process.env.STORAGE_SANDBOX_HEALTH_URL ?? "http://127.0.0.1:54321/health"],
  ["delivery-sandbox", process.env.DELIVERY_SANDBOX_HEALTH_URL ?? "http://127.0.0.1:8091/health"],
  ["activepieces-app", process.env.ACTIVEPIECES_HEALTH_URL ?? "http://127.0.0.1:8080"],
];

const stage16BackendPort = process.env.STAGE16_BACKEND_PORT ?? "3104";
const appEndpoints = [
  [
    "backend",
    process.env.LEXFRAME_API_HEALTH_URL ??
      `http://127.0.0.1:${stage16BackendPort}/health/live`,
  ],
  ["frontend", process.env.LEXFRAME_WEB_HEALTH_URL ?? "http://127.0.0.1:3000"],
];

const requireAppHealth = process.env.STAGE16_REQUIRE_APP_HEALTH === "1";
const optionalEndpointResults = [];

async function main() {
  const services = parseComposePsJson(null, { all: true });
  assertRequiredServices(services);

  for (const [name, url] of dependencyEndpoints) {
    await checkUrl(name, url, true);
  }

  for (const [name, url] of appEndpoints) {
    await checkUrl(name, url, requireAppHealth);
  }

  await retry(activepiecesAuthPreflight, "activepieces API preflight");
  assertWorkerEvidence();

  const unavailableOptional = optionalEndpointResults.filter((item) => !item.available);
  if (unavailableOptional.length > 0 && !requireAppHealth) {
    console.log(
      `[stage16-runtime] Docker/runtime dependency probe passed; application servers are not required unless STAGE16_REQUIRE_APP_HEALTH=1. Optional endpoints unavailable: ${unavailableOptional
        .map((item) => item.name)
        .join(", ")}.`,
    );
  } else if (requireAppHealth) {
    console.log("[stage16-runtime] backend/frontend application health is required and available");
  }

  console.log("[stage16-runtime] local-integrated Docker/runtime dependencies are healthy");
}

function assertRequiredServices(services) {
  const byService = new Map(services.map((service) => [service.Service, service]));
  const failures = [];

  for (const serviceName of requiredServices) {
    const service = byService.get(serviceName);
    if (!service) {
      failures.push(`${serviceName}: missing`);
      continue;
    }
    const state = serviceStateText(service);
    if (state.includes("exited") || state.includes("dead") || state.includes("unhealthy")) {
      failures.push(`${serviceName}: ${state}`);
    }
    if (!state.includes("running") && !state.includes("healthy")) {
      failures.push(`${serviceName}: not running (${state})`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`local-integrated required service failure:\n${failures.join("\n")}`);
  }
}

async function checkUrl(name, url, required = true) {
  try {
    await retry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.status >= 500) {
          throw new Error(`${name} returned ${response.status}`);
        }
        console.log(`[stage16-runtime] ${name} ${url} -> ${response.status}`);
        if (!required) {
          optionalEndpointResults.push({ name, url, available: true });
        }
      } finally {
        clearTimeout(timeout);
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

function assertWorkerEvidence() {
  const workerLogs = compose(
    ["logs", "--no-color", "--tail", "200", "activepieces-worker"],
    { label: "activepieces-worker logs" },
  ).stdout ?? "";
  if (
    /unable to reach the server/i.test(workerLogs) &&
    !/(Started|Starting) polling queue/i.test(workerLogs)
  ) {
    throw new Error("activepieces-worker reported inability to reach the server and has no later polling evidence");
  }
  console.log("[stage16-runtime] activepieces-worker log probe passed");
}

function serviceStateText(service) {
  return [
    service.State,
    service.Status,
    service.Health,
    service.ExitCode === 0 ? null : service.ExitCode ? `exit-${service.ExitCode}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function dumpDiagnostics(error) {
  console.error(`[stage16-runtime] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  try {
    const ps = compose(["ps", "--all"], { allowFailure: true });
    if (ps.stdout) {
      console.error(`[stage16-runtime] compose ps --all\n${ps.stdout}`);
    }
  } catch {
    // Diagnostic best effort.
  }
  for (const service of ["backend", "web", "postgres"]) {
    try {
      const logs = compose(
        ["logs", "--no-color", "--tail", "120", service],
        { allowFailure: true },
      );
      if (logs.stdout || logs.stderr) {
        console.error(`[stage16-runtime] ${service} logs\n${logs.stdout ?? ""}${logs.stderr ?? ""}`);
      }
    } catch {
      // Diagnostic best effort.
    }
  }
  console.error(`[stage16-runtime] cwd=${repoRoot} COMPOSE_PROJECT_NAME=${process.env.COMPOSE_PROJECT_NAME ?? ""}`);
}

try {
  await main();
} catch (error) {
  await dumpDiagnostics(error);
  process.exit(1);
}
