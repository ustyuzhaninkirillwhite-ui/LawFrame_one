import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "stage17");
const logsDir = path.join(artifactsDir, "logs");
const docsDir = path.join(root, "docs", "stage17");
const jsonReportPath = path.join(artifactsDir, "release-gate.json");
const markdownReportPath = path.join(docsDir, "stage17-release-gate-report.md");
const continueOnP0 = process.env.STAGE17_RELEASE_GATE_CONTINUE_ON_P0 === "1";
const corepackBin = "corepack";

const gatePlan = [
  {
    gate: "G0",
    name: "Readiness inputs",
    severity: "P0",
    commands: [pnpm("stage17:readiness:evidence")],
  },
  {
    gate: "G1",
    name: "Static/unit/contract",
    severity: "P0",
    commands: [pnpm("stage17:test:unit"), pnpm("stage17:pieces:inventory")],
  },
  {
    gate: "G2",
    name: "Integration",
    severity: "P0",
    commands: [
      pnpm("stage17:test:integration"),
      pnpm("stage17:pieces:build"),
      pnpm("stage17:pieces:sync"),
      pnpm("stage17:pieces:verify"),
    ],
  },
  {
    gate: "G3",
    name: "Playwright live E2E",
    severity: "P0",
    commands: [
      pnpm("stage17:e2e:activepieces-canvas", {
        env: liveE2eEnv(),
      }),
    ],
  },
  {
    gate: "G4",
    name: "Security and secret scan",
    severity: "P0",
    commands: [
      pnpm("stage17:security:scan-secrets"),
      pnpm("stage17:security:scan-frontend-bundle"),
      pnpm("stage17:security:scan-browser-evidence"),
    ],
  },
  {
    gate: "G5",
    name: "Localization and debranding",
    severity: "P1",
    commands: [
      pnpm("stage17:localization:check"),
      pnpm("stage17:debranding:check"),
    ],
  },
  {
    gate: "G6",
    name: "Visual regression",
    severity: "P0",
    commands: [
      pnpm("stage17:visual:regression", {
        env: liveE2eEnv(),
      }),
    ],
  },
  {
    gate: "G7",
    name: "Runtime evidence",
    severity: "P0",
    commands: [pnpm("stage17:runtime:evidence")],
  },
  {
    gate: "G8",
    name: "Artifacts completeness",
    severity: "P1",
    commands: [pnpm("stage17:artifacts:verify")],
  },
  {
    gate: "G9",
    name: "Stop-list compliance",
    severity: "P0",
    commands: [pnpm("stage17:stop-list:verify")],
  },
  {
    gate: "G10",
    name: "Stage 17.12 closure",
    severity: "P0",
    commands: [pnpm("stage17:closure:verify")],
  },
];

fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

const report = {
  stage: "17.12",
  status: "RUNNING",
  acceptance: "PENDING",
  started_at: new Date().toISOString(),
  finished_at: null,
  continue_on_p0: continueOnP0,
  environment: {
    cwd: root,
    platform: `${process.platform} ${process.arch}`,
    hostname: os.hostname(),
    node: process.version,
    pnpm: readCommandText(corepackBin, ["pnpm", "--version"]),
    lexframe_commit: gitSha(root),
    activepieces_commit: gitSha(resolveActivepiecesRoot()),
  },
  results: [],
};

writeReports();

let blockedByP0 = false;
for (const gate of gatePlan) {
  if (blockedByP0) {
    report.results.push(skippedGate(gate, "Skipped after P0 failure."));
    writeReports();
    continue;
  }

  const result = runGate(gate);
  report.results.push(result);
  writeReports();

  if (result.status === "fail" && gate.severity === "P0" && !continueOnP0) {
    blockedByP0 = true;
  }
}

report.finished_at = new Date().toISOString();
const failedP0 = report.results.some(
  (result) => result.status === "fail" && result.severity === "P0",
);
const failedAny = report.results.some((result) => result.status === "fail");
const skippedAny = report.results.some((result) => result.status === "skipped");

report.status = failedAny || skippedAny ? "FAIL" : "PASS";
report.acceptance = failedP0
  ? "REJECT"
  : failedAny || skippedAny
    ? "CONDITIONAL"
    : "ACCEPT";
writeReports();

if (report.status !== "PASS") {
  process.exit(1);
}

function pnpm(script, options = {}) {
  return {
    label: `pnpm ${script}`,
    command: corepackBin,
    args: ["pnpm", script],
    env: options.env ?? {},
  };
}

function liveE2eEnv() {
  return {
    LEXFRAME_STAGE17_17_10_LIVE:
      process.env.LEXFRAME_STAGE17_17_10_LIVE ?? "1",
    LEXFRAME_READINESS_PROFILE:
      process.env.LEXFRAME_READINESS_PROFILE ?? "local-integrated",
    ACTIVEPIECES_SIMULATE_RUNS:
      process.env.ACTIVEPIECES_SIMULATE_RUNS ?? "0",
  };
}

function runGate(gate) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const commandResults = gate.commands.map((command, index) =>
    runCommand(gate, command, index),
  );
  const failedCommands = commandResults.filter((command) => command.status !== 0);
  const status = failedCommands.length === 0 ? "pass" : "fail";

  return {
    gate: gate.gate,
    name: gate.name,
    status,
    severity: gate.severity,
    command: gate.commands.map((command) => command.label).join(" && "),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    artifacts: commandResults.flatMap((command) => command.artifacts),
    findings: failedCommands.map((command) => ({
      code: "COMMAND_FAILED",
      message: `${command.label} exited with ${command.status}`,
      evidence_path: command.log_path,
    })),
    commands: commandResults,
  };
}

function runCommand(gate, command, index) {
  const started = Date.now();
  const logPath = path.join(
    logsDir,
    `${gate.gate}-${slug(gate.name)}-${index + 1}-${slug(command.label)}.log`,
  );
  const result = spawnSync(command.command, command.args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ...command.env,
    },
    shell: process.platform === "win32",
    windowsHide: true,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  fs.writeFileSync(
    logPath,
    [
      `$ ${command.label}`,
      `cwd=${root}`,
      `exit=${result.status ?? 1}`,
      "",
      "## stdout",
      stdout,
      "",
      "## stderr",
      stderr,
      "",
      result.error ? `## spawn error\n${String(result.error.stack ?? result.error)}` : "",
    ].join("\n"),
    "utf8",
  );

  return {
    label: command.label,
    status: result.status ?? 1,
    duration_ms: Date.now() - started,
    log_path: path.relative(root, logPath),
    artifacts: [path.relative(root, logPath)],
  };
}

function skippedGate(gate, message) {
  return {
    gate: gate.gate,
    name: gate.name,
    status: "skipped",
    severity: gate.severity,
    command: gate.commands.map((command) => command.label).join(" && "),
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 0,
    artifacts: [],
    findings: [{ code: "P0_FAIL_FAST", message }],
    commands: [],
  };
}

function writeReports() {
  fs.mkdirSync(path.dirname(jsonReportPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownReportPath), { recursive: true });
  fs.writeFileSync(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownReportPath, renderMarkdown(), "utf8");
}

function renderMarkdown() {
  const rows = report.results.map((result) =>
    [
      result.gate,
      result.name,
      result.status.toUpperCase(),
      result.severity,
      `${Math.round(result.duration_ms / 1000)}s`,
      result.findings.length > 0
        ? result.findings.map((finding) => finding.code).join(", ")
        : "-",
    ].join(" | "),
  );

  return [
    "# Stage 17.12 Release Gate Report",
    "",
    `Status: ${report.status}`,
    `Acceptance: ${report.acceptance}`,
    `Started: ${report.started_at}`,
    `Finished: ${report.finished_at ?? "running"}`,
    `LexFrame commit: ${report.environment.lexframe_commit ?? "unknown"}`,
    `Activepieces commit: ${report.environment.activepieces_commit ?? "unknown"}`,
    `Node: ${report.environment.node}`,
    `pnpm: ${report.environment.pnpm ?? "unknown"}`,
    "",
    "| Gate | Name | Status | Severity | Duration | Findings |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...rows,
    "",
    "## Evidence",
    "",
    "- Machine-readable report: `artifacts/stage17/release-gate.json`",
    "- Command logs: `artifacts/stage17/logs/`",
    "- Runtime evidence: `artifacts/stage17/runtime-evidence.json`",
    "- Browser secret scan: `artifacts/stage17/browser-secret-scan.json`",
    "- Localization flicker evidence: `artifacts/stage17/localization-flicker-evidence.json`",
    "- Debranding icon evidence: `artifacts/stage17/debranding-icon-evidence.json`",
    "- Pieces inventory/build/sync: `artifacts/stage17/pieces-*.json`",
    "- Stop-list result: `artifacts/stage17/stop-list-compliance.json`",
    "",
  ].join("\n");
}

function gitSha(cwd) {
  if (!cwd || !fs.existsSync(cwd)) {
    return null;
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function readCommandText(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function resolveActivepiecesRoot() {
  if (process.env.ACTIVEPIECES_SOURCE_DIR) {
    return process.env.ACTIVEPIECES_SOURCE_DIR;
  }

  const inRepo = path.join(root, "activepieces");
  if (fs.existsSync(inRepo)) {
    return inRepo;
  }

  return path.join(path.dirname(root), "activepieces-main");
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
