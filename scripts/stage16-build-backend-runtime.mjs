import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const backendFilter = "@lexframe/backend...";

const expectedPackages = [
  "@lexframe/activepieces-legal-pieces",
  "@lexframe/ai-gateway",
  "@lexframe/config",
  "@lexframe/contracts",
  "@lexframe/logger",
  "@lexframe/workflow",
  "@lexframe/workflow-dsl",
  "@lexframe/backend",
];

const requiredArtifacts = [
  ["@lexframe/logger", "packages/logger/dist/index.js"],
  ["@lexframe/workflow-dsl", "packages/workflow-dsl/dist/index.js"],
  ["@lexframe/contracts", "packages/contracts/dist/index.js"],
  ["@lexframe/config", "packages/config/dist/index.js"],
  ["@lexframe/workflow", "packages/workflow/dist/index.js"],
  ["@lexframe/ai-gateway", "packages/ai-gateway/dist/index.js"],
  [
    "@lexframe/activepieces-legal-pieces",
    "packages/activepieces-legal-pieces/dist/index.js",
  ],
  ["@lexframe/backend", "apps/backend/dist/main.js"],
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.stdio ?? "pipe",
    env: process.env,
  });

  if (result.status !== 0) {
    const stdout = result.stdout ? `\n${result.stdout}` : "";
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(`${command} ${args.join(" ")} failed${stdout}${stderr}`);
  }

  return result.stdout ?? "";
}

function readBackendClosure() {
  const output = run("corepack", [
    "pnpm",
    "--filter",
    backendFilter,
    "list",
    "--depth",
    "-1",
    "--json",
  ]);
  const packages = JSON.parse(output);
  return packages.map((item) => item.name).filter(Boolean).sort();
}

function assertExpectedClosure(packages) {
  const missing = expectedPackages.filter((name) => !packages.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `backend runtime dependency closure is incomplete. Missing: ${missing.join(", ")}`,
    );
  }
}

function buildBackendRuntime() {
  run(
    "corepack",
    [
      "pnpm",
      "--filter",
      backendFilter,
      "--workspace-concurrency=1",
      "run",
      "build",
    ],
    { stdio: "inherit" },
  );
}

function verifyArtifacts() {
  const missing = [];
  for (const [packageName, relativePath] of requiredArtifacts) {
    const absolutePath = join(root, relativePath);
    if (!existsSync(absolutePath)) {
      missing.push(`${packageName}: ${relativePath}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `backend runtime build artifacts are missing:\n${missing.join("\n")}`,
    );
  }
}

const closure = readBackendClosure();
assertExpectedClosure(closure);
console.log(`[stage16-build] backend runtime closure: ${closure.join(", ")}`);

buildBackendRuntime();
verifyArtifacts();

console.log("[stage16-build] verified backend runtime artifacts:");
for (const [packageName, relativePath] of requiredArtifacts) {
  console.log(`[stage16-build] ${packageName} -> ${relativePath}`);
}
