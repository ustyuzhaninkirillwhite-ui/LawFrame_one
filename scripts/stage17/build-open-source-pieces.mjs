import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? process.env.ACTIVEPIECES_REPO_ROOT ?? "E:/activepieces-main";
const artifactsDir = path.join(root, "artifacts", "stage17");
const reportPath = path.join(artifactsDir, "pieces-build-report.json");
const docsPath = path.join(root, "docs", "stage17", "pieces-build-report.md");
const inventoryPath = path.join(artifactsDir, "pieces-inventory.json");
const requestedSlugs = (process.env.STAGE17_PIECES_BUILD_TARGETS ?? "gmail,cometapi")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(path.dirname(docsPath), { recursive: true });

const inventory = readInventory();
const prerequisites = {
  activepiecesRootExists: fs.existsSync(activepiecesRoot),
  gitMetadataAvailable: run("git", ["-C", activepiecesRoot, "rev-parse", "HEAD"]).status === 0,
  bunAvailable: run("bun", ["--version"], { cwd: activepiecesRoot }).status === 0,
  nodeModulesPresent: fs.existsSync(path.join(activepiecesRoot, "node_modules")),
  packageJsonPresent: fs.existsSync(path.join(activepiecesRoot, "package.json")),
};
const canBuild =
  prerequisites.activepiecesRootExists &&
  prerequisites.bunAvailable &&
  prerequisites.nodeModulesPresent;
const results = [];

for (const slug of requestedSlugs) {
  const piece = inventory?.pieces?.find((candidate) => candidate.slug === slug) ?? null;
  if (!piece) {
    results.push({
      slug,
      packageName: `@activepieces/piece-${slug}`,
      status: "missing",
      reason: "Piece is absent from local inventory.",
    });
    continue;
  }

  if (!canBuild) {
    results.push({
      slug,
      packageName: piece.packageName,
      path: piece.path,
      status: "documented_blocker",
      reason: "Activepieces build prerequisites are unavailable in this workspace.",
      blockers: missingPrerequisites(prerequisites),
      officialCommand: `npm run build-piece -- ${slug}`,
      distPresent: piece.distPresent,
    });
    continue;
  }

  const startedAt = new Date().toISOString();
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", "build-piece", "--", slug], {
    cwd: activepiecesRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: Number(process.env.STAGE17_PIECES_BUILD_TIMEOUT_MS ?? 300000),
  });
  results.push({
    slug,
    packageName: piece.packageName,
    path: piece.path,
    status: result.status === 0 ? "built" : "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    command: `npm run build-piece -- ${slug}`,
    exitCode: result.status ?? 1,
    stdoutTail: tail(result.stdout ?? ""),
    stderrTail: tail(result.stderr ?? ""),
    distPresent: fs.existsSync(path.join(activepiecesRoot, piece.path, "dist")),
  });
}

const report = {
  stage: "17.12",
  generatedAt: new Date().toISOString(),
  activepiecesRoot,
  status: results.some((result) => result.status === "failed")
    ? "FAIL"
    : results.some((result) => result.status === "built")
      ? "PASS"
      : "DOCUMENTED_BLOCKER",
  prerequisites,
  requestedSlugs,
  summary: {
    built: results.filter((result) => result.status === "built").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "documented_blocker").length,
    missing: results.filter((result) => result.status === "missing").length,
  },
  results,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(docsPath, renderMarkdown(report), "utf8");
console.log(JSON.stringify({ status: report.status, summary: report.summary, artifact: path.relative(root, reportPath) }, null, 2));

if (report.status === "FAIL") {
  process.exit(1);
}

function readInventory() {
  if (!fs.existsSync(inventoryPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
}

function missingPrerequisites(prerequisites) {
  return Object.entries(prerequisites)
    .filter(([, available]) => !available)
    .map(([name]) => name);
}

function run(command, args, options = {}) {
  try {
    const result = spawnSync(command, args, {
      cwd: options.cwd ?? root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
    });
    return { status: result.status ?? 1 };
  } catch {
    return { status: 1 };
  }
}

function tail(value) {
  return value.split(/\r?\n/).slice(-40).join("\n");
}

function renderMarkdown(report) {
  const rows = report.results.map((result) =>
    `| ${result.slug} | ${result.packageName} | ${result.status} | ${result.reason ?? result.exitCode ?? "-"} |`,
  );
  return [
    "# Stage 17.12 Pieces Build Report",
    "",
    `Status: ${report.status}`,
    `Generated: ${report.generatedAt}`,
    "",
    "## Prerequisites",
    "",
    ...Object.entries(report.prerequisites).map(([name, value]) => `- ${name}: ${value}`),
    "",
    "| Piece | Package | Status | Reason / Exit |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "Build blockers are explicit evidence, not proof of runtime execution. No credentials or accounts are used.",
    "",
  ].join("\n");
}
