import { spawnSync } from "node:child_process";
import { resolveDockerCli } from "./stage16-compose-utils.mjs";

const docker = resolveDockerCli();

const commands = [
  ["corepack", ["pnpm", "stage16:validate:compose-helpers"]],
  ["corepack", ["pnpm", "stage16:validate:release-gate-integrity"]],
  ["corepack", ["pnpm", "validate:json-schemas"]],
  ["corepack", ["pnpm", "validate:openapi"]],
  ["corepack", ["pnpm", "validate:canvas-fixtures"]],
  ["corepack", ["pnpm", "stage16:build:backend-runtime"]],
  ["corepack", ["pnpm", "stage16:build:web-runtime"]],
  ["corepack", ["pnpm", "--dir", "packages/config", "build"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "build"]],
  ["corepack", ["pnpm", "validate:canvas-security"]],
  ["corepack", ["pnpm", "validate:web-bundle-secrets"]],
  ["corepack", ["pnpm", "secret-scan"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/workflow-dsl", "test"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/backend", "test", "--", "canvas"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/backend", "test", "--", "workflow-compiler"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:unit"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:components"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:contracts"]],
  [docker, ["compose", "--profile", "local-integrated", "down", "-v", "--remove-orphans"]],
  ["corepack", ["pnpm", "stage16:db:bootstrap"]],
  [docker, ["compose", "--profile", "local-integrated", "down", "-v", "--remove-orphans"]],
  [
    docker,
    [
      "compose",
      "--profile",
      "local-integrated",
      "up",
      "-d",
      "postgres",
      "redis",
      "activepieces-postgres",
      "activepieces-redis",
      "activepieces-app",
      "activepieces-worker",
      "opensearch",
      "storage-sandbox",
      "delivery-sandbox",
    ],
  ],
  ["corepack", ["pnpm", "stage16:db:apply-local"]],
  [
    "corepack",
    ["pnpm", "stage16:runtime:health"],
    { STAGE16_REQUIRE_APP_HEALTH: "1" },
  ],
  ["corepack", ["pnpm", "stage16:run-live-audit"]],
  ["corepack", ["pnpm", "stage16:activepieces:evidence"]],
  ["corepack", ["pnpm", "validate:release-manifest"]],
];

for (const [command, args, envOverrides] of commands) {
  const useShell = process.platform === "win32";
  console.log(`[stage16-release-gate] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: useShell,
    env: {
      ...process.env,
      LEXFRAME_READINESS_PROFILE:
        process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
      ACTIVEPIECES_SIMULATE_RUNS:
        process.env.ACTIVEPIECES_SIMULATE_RUNS ?? "0",
      NEXT_PUBLIC_ENABLE_MSW: process.env.NEXT_PUBLIC_ENABLE_MSW ?? "0",
      ...(envOverrides ?? {}),
    },
  });
  if (result.error) {
    console.error(
      `[stage16-release-gate] failed to start ${command}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
