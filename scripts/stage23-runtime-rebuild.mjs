import { spawnSync } from "node:child_process";

const docker =
  process.env.DOCKER_CLI_PATH ??
  (process.platform === "win32" ? "docker.exe" : "docker");
const node = process.execPath;
const env = {
  ...process.env,
  STAGE16_BACKEND_PORT: process.env.STAGE16_BACKEND_PORT ?? "3104",
  STAGE16_DB_BOOTSTRAP_MODE: process.argv.includes("--reset-db")
    ? "reset"
    : (process.env.STAGE16_DB_BOOTSTRAP_MODE ?? "preserve"),
  AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE ?? "controlled-real",
  LEXFRAME_AI_TEST_FORCE_COMETAPI:
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI ?? "0",
  LEXFRAME_READINESS_PROFILE:
    process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
  NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW ?? "0",
};
const composeProfiles = [
  "compose",
  "--profile",
  "local-integrated",
  "--profile",
  "full-runtime",
];
const rebuildServices = [
  "stage16-db-bootstrap",
  "stage16-activepieces-catalog-sync",
  "backend",
  "web",
];
const composePullPolicy = process.env.STAGE23_RUNTIME_PULL ?? "never";

async function main() {
  console.log(
    "[stage23-runtime-rebuild] rebuilding runtime containers without removing Docker volumes",
  );
  stopWorkspaceLocalDevServers();
  run(docker, ["version", "--format", "{{.Server.Version}}"], {
    label: "docker daemon",
  });
  run(docker, [...composeProfiles, "ps", "--all"], {
    label: "compose inventory before rebuild",
    allowFailure: true,
  });
  run(docker, [...composeProfiles, "rm", "-f", "-s", ...rebuildServices], {
    label: "remove stale runtime containers",
  });
  run(
    docker,
    [
      ...composeProfiles,
      "up",
      "-d",
      "--build",
      "--pull",
      composePullPolicy,
      "--force-recreate",
      ...rebuildServices,
    ],
    { label: "rebuild runtime containers" },
  );
  await waitForUrl(
    "backend health",
    `http://127.0.0.1:${env.STAGE16_BACKEND_PORT}/health/live`,
  );
  await waitForUrl("web preview", "http://127.0.0.1:3000/chat");
  run(node, [
    "scripts/stage16-e2e-preflight.mjs",
    "--scope=chat",
    "--json",
    "--fail-on-required",
    "--allow-reuse-runtime",
  ], { label: "chat schema preflight" });
  run(node, [
    "scripts/stage16-e2e-preflight.mjs",
    "--scope=automation",
    "--json",
    "--fail-on-required",
    "--allow-reuse-runtime",
  ], { label: "automation schema preflight" });
  run(node, ["scripts/stage16-preview-prewarm.mjs"], {
    label: "preview prewarm",
  });
}

function stopWorkspaceLocalDevServers() {
  if (process.platform !== "win32") {
    return;
  }

  const root = process.cwd().replace(/'/g, "''");
  const script = `
$root = '${root}'
$own = $PID
$targets = Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $own -and
  $_.CommandLine -and
  $_.CommandLine.Contains($root) -and
  ($_.CommandLine -match '@lexframe/(backend|web) (start:dev|dev)|apps\\\\backend\\\\dist\\\\main|apps/backend/dist/main|next dev')
}
foreach ($target in $targets) {
  Write-Output ("stopping " + $target.ProcessId + " " + $target.Name)
  Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
}
`;
  run("powershell.exe", ["-NoProfile", "-Command", script], {
    label: "stop workspace-local dev servers",
    allowFailure: true,
  });
}

function run(command, args, options = {}) {
  console.log(`[stage23-runtime-rebuild] ${options.label ?? command}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    env,
    maxBuffer: 30 * 1024 * 1024,
  });
  const stdout = sanitize(result.stdout ?? "").trim();
  const stderr = sanitize(result.stderr ?? "").trim();
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      `${options.label ?? command} failed with exit ${result.status ?? 1}`,
    );
  }
  return result;
}

function sanitize(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, "$1=<redacted>")
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://<redacted>@");
}

async function waitForUrl(label, url, timeoutMs = 180_000) {
  const startedAt = Date.now();
  let lastError = "not attempted";

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      lastError = `status=${response.status}`;
      console.log(`[stage23-runtime-rebuild] ${label}: ${lastError}`);
      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.log(`[stage23-runtime-rebuild] ${label}: ${lastError}`);
    }

    await sleep(2_000);
  }

  throw new Error(`${label} did not become ready: ${lastError}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  await main();
} catch (error) {
  console.error(
    `[stage23-runtime-rebuild] FAIL: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
