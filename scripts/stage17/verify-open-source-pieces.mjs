import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const artifactsDir = path.join(root, "artifacts", "stage17");
const inventory = readJson("pieces-inventory.json");
const build = readJson("pieces-build-report.json");
const sync = readJson("pieces-sync-report.json");
const localization = readJson("pieces-localization-report.json");

const findings = [];
if (!inventory) findings.push("missing pieces-inventory.json");
if (!build) findings.push("missing pieces-build-report.json");
if (!sync) findings.push("missing pieces-sync-report.json");
if (!localization) findings.push("missing pieces-localization-report.json");

if (inventory) {
  if (inventory.counts.total <= 1) findings.push("pieces inventory does not prove a palette broader than router");
  if (inventory.specialPieces.gmail.status !== "found") findings.push("gmail is not explicitly found/documented");
  if (inventory.specialPieces.cometapi.status !== "found") findings.push("cometapi is not explicitly found/documented");
}

if (build && build.status === "FAIL") {
  findings.push("pieces build report contains failed builds");
}
if (sync && sync.status === "FAIL") {
  findings.push("pieces sync report contains failed sync");
}

const result = {
  stage: "17.12",
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "PASS" : "FAIL",
  findings,
  inventorySummary: inventory
    ? {
        total: inventory.counts.total,
        core: inventory.counts.core,
        community: inventory.counts.community,
        gmail: inventory.specialPieces.gmail.status,
        cometapi: inventory.specialPieces.cometapi.status,
      }
    : null,
  buildSummary: build?.summary ?? null,
  syncStatus: sync?.result?.status ?? null,
};

fs.writeFileSync(
  path.join(artifactsDir, "pieces-verify-report.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(result, null, 2));

if (result.status !== "PASS") {
  process.exit(1);
}

function readJson(name) {
  const filePath = path.join(artifactsDir, name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
