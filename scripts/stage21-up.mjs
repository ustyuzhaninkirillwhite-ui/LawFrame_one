import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertStage17HostPortsAvailable } from "./stage17-port-preflight.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docker =
  process.env.DOCKER_CLI_PATH ??
  (process.platform === "win32" ? "docker.exe" : "docker");
const envFile = ".env.stage17.local";
const composeFile = path.join(
  "infra",
  "docker",
  "docker-compose.stage17.local-integrated.yml",
);

export function buildStage21RuntimeEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    LEXFRAME_CONTRACTS_VERSION: "stage21",
    LEXFRAME_RELEASE_SHA: "local-stage21",
    LEXFRAME_RUNTIME_IMAGE_TAG: "stage21-local",
    NEXT_PUBLIC_CONTRACTS_VERSION: "stage21",
    ACTIVEPIECES_IMAGE_TAG: baseEnv.ACTIVEPIECES_IMAGE_TAG ?? "0.82.0",
    ACTIVEPIECES_EMBED_SDK_VERSION:
      baseEnv.ACTIVEPIECES_EMBED_SDK_VERSION ?? "0.9.0",
  };
}

export function buildStage21ComposeArgs(command = "up", extraArgs = []) {
  return [
    "compose",
    "--env-file",
    envFile,
    "-f",
    composeFile,
    "--profile",
    "local-integrated",
    ...resolveCommand(command, extraArgs),
  ];
}

async function main() {
  const command = process.argv[2] ?? "up";
  const extraArgs = process.argv.slice(3);

  if (!existsSync(path.join(repoRoot, envFile))) {
    console.error(
      "[stage21-up] .env.stage17.local is missing. Run corepack pnpm stage17:init-local-secrets first; stage21-up reuses the existing local secret layout.",
    );
    process.exit(1);
  }

  if (command === "up") {
    try {
      await assertStage17HostPortsAvailable({ docker, root: repoRoot });
    } catch (error) {
      console.error(
        `[stage21-up] ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }
  }

  const env = buildStage21RuntimeEnv(process.env);
  const args = buildStage21ComposeArgs(command, extraArgs);
  console.log("[stage21-up] starting current LexFrame runtime through Stage 21");
  const result = spawnSync(docker, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (command === "up") {
    const patch = spawnSync(
      process.execPath,
      [path.join("scripts", "stage17", "patch-activepieces-runtime.mjs")],
      {
        cwd: repoRoot,
        stdio: "inherit",
        shell: false,
        env,
      },
    );
    if (patch.status !== 0) {
      process.exit(patch.status ?? 1);
    }
    console.log("[stage21-up] runtime is exposed at http://127.0.0.1:3100");
  }
}

function resolveCommand(value, rest) {
  switch (value) {
    case "up":
      return ["up", "-d", ...rest];
    case "rebuild-web":
      return [
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        "--build",
        "lexframe-web",
        "reverse-proxy",
        ...rest,
      ];
    case "rebuild-backend":
      return [
        "up",
        "-d",
        "--no-deps",
        "--force-recreate",
        "--build",
        "lexframe-backend",
        "reverse-proxy",
        ...rest,
      ];
    case "restart-proxy":
      return ["up", "-d", "--no-deps", "--force-recreate", "reverse-proxy", ...rest];
    case "reset-automation-runtime":
      return [
        "up",
        "-d",
        "--force-recreate",
        "activepieces-app",
        "activepieces-worker",
        ...rest,
      ];
    case "smoke-automation-runtime":
      return [
        "exec",
        "-T",
        "lexframe-backend",
        "node",
        "-e",
        "require('http').get('http://activepieces-app:80/api/v1/health', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))",
        ...rest,
      ];
    case "config":
      return ["config", ...rest];
    case "ps":
      return ["ps", ...rest];
    case "logs":
      return ["logs", "-f", ...rest];
    default:
      return [value, ...rest];
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
