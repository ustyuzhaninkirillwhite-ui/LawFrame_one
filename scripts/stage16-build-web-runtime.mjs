import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

const filters = [
  "@lexframe/api-client...",
  "@lexframe/config",
  "@lexframe/workflow",
];

const expectedPackages = [
  "@lexframe/api-client",
  "@lexframe/config",
  "@lexframe/contracts",
  "@lexframe/workflow",
  "@lexframe/workflow-dsl",
];

const requiredArtifacts = [
  ["@lexframe/api-client", "packages/api-client/dist/index.js"],
  ["@lexframe/config", "packages/config/dist/index.js"],
  ["@lexframe/contracts", "packages/contracts/dist/index.js"],
  ["@lexframe/workflow", "packages/workflow/dist/index.js"],
  ["@lexframe/workflow-dsl", "packages/workflow-dsl/dist/index.js"],
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

function filterArgs() {
  return filters.flatMap((filter) => ["--filter", filter]);
}

function readWebClosure() {
  const output = run("corepack", [
    "pnpm",
    ...filterArgs(),
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
      `web runtime dependency closure is incomplete. Missing: ${missing.join(", ")}`,
    );
  }
}

function buildWebRuntime() {
  run(
    "corepack",
    [
      "pnpm",
      ...filterArgs(),
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
    throw new Error(`web runtime build artifacts are missing:\n${missing.join("\n")}`);
  }
}

const closure = readWebClosure();
assertExpectedClosure(closure);
console.log(`[stage16-build] web runtime closure: ${closure.join(", ")}`);

buildWebRuntime();
verifyArtifacts();

console.log("[stage16-build] verified web runtime artifacts:");
for (const [packageName, relativePath] of requiredArtifacts) {
  console.log(`[stage16-build] ${packageName} -> ${relativePath}`);
}
