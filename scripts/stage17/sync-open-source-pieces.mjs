import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const activepiecesRoot =
  process.env.ACTIVEPIECES_SOURCE_DIR ?? process.env.ACTIVEPIECES_REPO_ROOT ?? "E:/activepieces-main";
const artifactsDir = path.join(root, "artifacts", "stage17");
const reportPath = path.join(artifactsDir, "pieces-sync-report.json");
const docsPath = path.join(root, "docs", "stage17", "pieces-sync-report.md");
const syncEnabled = process.env.STAGE17_ACTIVEPIECES_SYNC === "1";
const apiUrl = process.env.STAGE17_ACTIVEPIECES_API_URL ?? "";
const apiKeyPresent = Boolean(process.env.STAGE17_ACTIVEPIECES_API_KEY?.trim());

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(path.dirname(docsPath), { recursive: true });

let result = null;
if (syncEnabled && apiUrl && apiKeyPresent) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const run = spawnSync(command, ["run", "sync-pieces"], {
    cwd: activepiecesRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: Number(process.env.STAGE17_PIECES_SYNC_TIMEOUT_MS ?? 300000),
    env: {
      ...process.env,
      AP_API_URL: apiUrl,
      AP_API_KEY: process.env.STAGE17_ACTIVEPIECES_API_KEY,
    },
  });
  result = {
    attempted: true,
    status: run.status === 0 ? "synced" : "failed",
    command: "npm run sync-pieces",
    apiUrl,
    apiKeyPresent: true,
    exitCode: run.status ?? 1,
    stdoutTail: tail(run.stdout ?? ""),
    stderrTail: tail(run.stderr ?? ""),
  };
} else {
  result = {
    attempted: false,
    status: "not_attempted",
    reason:
      "Sync requires STAGE17_ACTIVEPIECES_SYNC=1, STAGE17_ACTIVEPIECES_API_URL and STAGE17_ACTIVEPIECES_API_KEY. Stage 17.12 records local installable cache evidence without committing secrets.",
    syncEnabled,
    apiUrlConfigured: Boolean(apiUrl),
    apiKeyPresent,
  };
}

const report = {
  stage: "17.12",
  generatedAt: new Date().toISOString(),
  activepiecesRoot,
  status: result.status === "failed" ? "FAIL" : "DOCUMENTED",
  result,
  safety: {
    credentialsCommitted: false,
    browserSecretsAllowed: false,
    realAccountsConnected: false,
  },
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(docsPath, renderMarkdown(report), "utf8");
console.log(JSON.stringify({ status: report.status, sync: result.status, artifact: path.relative(root, reportPath) }, null, 2));

if (report.status === "FAIL") {
  process.exit(1);
}

function tail(value) {
  return value.split(/\r?\n/).slice(-40).join("\n");
}

function renderMarkdown(report) {
  return [
    "# Stage 17.12 Pieces Sync Report",
    "",
    `Status: ${report.status}`,
    `Generated: ${report.generatedAt}`,
    "",
    `- Attempted: ${report.result.attempted}`,
    `- Result: ${report.result.status}`,
    `- Reason: ${report.result.reason ?? "see command output in JSON"}`,
    "",
    "No real accounts, OAuth credentials or provider tokens are committed or exposed to the browser.",
    "",
  ].join("\n");
}
