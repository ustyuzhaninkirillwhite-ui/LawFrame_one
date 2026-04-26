import { spawnSync } from "node:child_process";

const commands = [
  ["corepack", ["pnpm", "validate:json-schemas"]],
  ["corepack", ["pnpm", "validate:openapi"]],
  ["corepack", ["pnpm", "validate:canvas-fixtures"]],
  ["corepack", ["pnpm", "validate:canvas-security"]],
  ["corepack", ["pnpm", "validate:web-bundle-secrets"]],
  ["corepack", ["pnpm", "secret-scan"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/workflow-dsl", "test"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/backend", "test", "--", "canvas"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/backend", "test", "--", "workflow-compiler"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:unit"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:components"]],
  ["corepack", ["pnpm", "--filter", "@lexframe/web", "test:canvas:contracts"]],
  ["corepack", ["pnpm", "stage16:db:bootstrap"]],
  ["docker", ["compose", "--profile", "local-integrated", "up", "-d"]],
  ["corepack", ["pnpm", "stage16:db:apply-local"]],
  ["corepack", ["pnpm", "stage16:runtime:health"]],
  [
    "corepack",
    [
      "pnpm",
      "--filter",
      "@lexframe/e2e",
      "exec",
      "playwright",
      "test",
      "stage16-live-audit",
    ],
  ],
  ["corepack", ["pnpm", "stage16:activepieces:evidence"]],
  ["corepack", ["pnpm", "validate:release-manifest"]],
];

for (const [command, args] of commands) {
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
