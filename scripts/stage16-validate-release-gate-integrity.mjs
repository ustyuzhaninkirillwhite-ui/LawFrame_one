import fs from "node:fs";

const releaseGate = fs.readFileSync("scripts/stage16-release-gate.mjs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const requiredScripts = [
  "stage16:validate:compose-helpers",
  "stage16:validate:release-gate-integrity",
  "stage16:run-live-audit",
  "stage16:activepieces:evidence",
  "stage16:db:bootstrap",
  "stage16:db:apply-local",
  "stage16:runtime:health",
  "stage16:build:backend-runtime",
  "stage16:build:web-runtime",
  "validate:web-bundle-secrets",
  "validate:canvas-security",
  "secret-scan",
  "validate:release-manifest",
];

const requiredReleaseGateTokens = [
  "stage16:validate:compose-helpers",
  "stage16:validate:release-gate-integrity",
  "stage16:build:backend-runtime",
  "stage16:build:web-runtime",
  "@lexframe/web",
  "build",
  "validate:web-bundle-secrets",
  "stage16:db:bootstrap",
  "stage16:db:apply-local",
  "stage16:runtime:health",
  "stage16:run-live-audit",
  "stage16:activepieces:evidence",
  "validate:canvas-security",
  "secret-scan",
  "validate:release-manifest",
];

const missingScripts = requiredScripts.filter(
  (name) => !packageJson.scripts || !packageJson.scripts[name],
);
const missingTokens = requiredReleaseGateTokens.filter(
  (token) => !releaseGate.includes(token),
);

if (/\bplaywright\b[\s\S]*\bstage16-live-audit\b/.test(releaseGate) && !releaseGate.includes("stage16:run-live-audit")) {
  missingTokens.push("release gate must use stage16:run-live-audit instead of raw Playwright");
}

if (missingScripts.length > 0 || missingTokens.length > 0) {
  console.error("[stage16-release-gate-integrity] FAIL");
  for (const script of missingScripts) {
    console.error(`- missing package script: ${script}`);
  }
  for (const token of missingTokens) {
    console.error(`- missing release gate token: ${token}`);
  }
  process.exit(1);
}

console.log("[stage16-release-gate-integrity] PASS");
