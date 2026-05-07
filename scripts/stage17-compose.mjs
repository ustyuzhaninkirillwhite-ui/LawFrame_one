import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { assertStage17HostPortsAvailable } from "./stage17-port-preflight.mjs";

const root = process.cwd();
const docker = process.env.DOCKER_CLI_PATH ?? (process.platform === "win32" ? "docker.exe" : "docker");
const composeFile = path.join("infra", "docker", "docker-compose.stage17.local-integrated.yml");
const envFile = ".env.stage17.local";
const command = process.argv[2] ?? "config";
const extraArgs = process.argv.slice(3);

if (!existsSync(path.join(root, envFile)) && command !== "config:example") {
  console.error("[stage17:compose] .env.stage17.local is missing. Run pnpm stage17:init-local-secrets first.");
  process.exit(1);
}

if (command === "up") {
  try {
    await assertStage17HostPortsAvailable({ docker, root });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const commandArgs = resolveCommand(command, extraArgs);
const args = [
  "compose",
  "--env-file",
  command === "config:example" ? ".env.stage17.local.example" : envFile,
  "-f",
  composeFile,
  "--profile",
  "local-integrated",
  ...commandArgs,
];
const capture = command.startsWith("config");
const result = spawnSync(docker, args, {
  cwd: root,
  stdio: capture ? "pipe" : "inherit",
  encoding: capture ? "utf8" : undefined,
  shell: false,
  env: process.env,
});

if (capture) {
  const redactions = loadRedactions(command === "config:example" ? ".env.stage17.local.example" : envFile);
  if (result.stdout) {
    process.stdout.write(redact(String(result.stdout), redactions));
  }
  if (result.stderr) {
    process.stderr.write(redact(String(result.stderr), redactions));
  }
}

if (!capture && command === "up" && result.status === 0) {
  const patch = spawnSync(
    process.execPath,
    [path.join("scripts", "stage17", "patch-activepieces-runtime.mjs")],
    {
      cwd: root,
      stdio: "inherit",
      shell: false,
      env: process.env,
    },
  );
  if (patch.status !== 0) {
    process.exit(patch.status ?? 1);
  }
}

process.exit(result.status ?? 1);

function resolveCommand(value, rest) {
  switch (value) {
    case "config":
    case "config:example":
      return ["config", ...rest];
    case "up":
      return ["up", "-d", "--build", ...rest];
    case "down":
      return ["down", ...rest];
    case "logs":
      return ["logs", "-f", ...rest];
    case "ps":
      return ["ps", ...rest];
    default:
      return [value, ...rest];
  }
}

function loadRedactions(relativeEnvPath) {
  const values = new Set();
  const envText = readMaybe(path.join(root, relativeEnvPath));
  for (const line of envText.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (
      value &&
      value.length >= 8 &&
      !key.startsWith("NEXT_PUBLIC_") &&
      /(SECRET|PASSWORD|TOKEN|KEY|DB_URL|API_KEY|DSN)/i.test(key)
    ) {
      values.add(value);
    }
  }

  const secretDir = path.join(root, ".local", "secrets", "stage17");
  for (const file of [
    "lexframe_product_postgres_password.txt",
    "ap_postgres_password.txt",
    "ap_redis_password.txt",
    "ap_jwt_secret.txt",
    "ap_encryption_key.txt",
    "ap_worker_token.txt",
    "activepieces_api_key.txt",
    "activepieces_signing_private_key.pem",
    "lexframe_runtime_master_secret.txt",
    "supabase_secret_key.txt",
  ]) {
    const value = readMaybe(path.join(secretDir, file)).trim();
    if (value.length >= 8) {
      values.add(value);
    }
  }
  return [...values].sort((left, right) => right.length - left.length);
}

function readMaybe(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function redact(text, values) {
  let output = text;
  for (const value of values) {
    output = output.split(value).join("[redacted]");
  }
  return output;
}
