import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "docs/stage17/17.12-audit-start.md",
  "docs/stage17/stage17-final-closure.md",
  "docs/stage17/stage17-traceability-matrix.md",
  "docs/stage17/ADR-stage17-canvas-strategy.md",
  "docs/stage17/stage17-known-limitations.md",
  "docs/stage17/stage17-risk-register.md",
  "docs/stage17/stage17-evidence-index.md",
  "docs/stage17/localization-runtime-audit.md",
  "docs/stage17/localization-flicker-hardening.md",
  "docs/stage17/debranding-runtime-audit.md",
  "docs/stage17/open-source-pieces-pack.md",
  "docs/stage17/pieces-localization-report.md",
  "artifacts/stage17/evidence-index.json",
  "artifacts/stage17/localization-flicker-evidence.json",
  "artifacts/stage17/debranding-icon-evidence.json",
  "artifacts/stage17/pieces-inventory.json",
  "artifacts/stage17/pieces-build-report.json",
  "artifacts/stage17/pieces-sync-report.json",
  "artifacts/stage17/pieces-localization-report.json",
  "apps/web/public/lexframe-automation-icon.svg",
  "apps/web/public/lexframe-automation-logo.svg",
  "scripts/stage17/localization-manifest.json",
  "scripts/stage17/debranding-manifest.json"
];

const entries = required.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  const exists = fs.existsSync(absolutePath);
  const size = exists ? fs.statSync(absolutePath).size : 0;
  return {
    path: relativePath,
    status: exists && size > 0 ? "PASS" : "FAIL",
    bytes: size,
  };
});

const result = {
  stage: "17.12",
  generatedAt: new Date().toISOString(),
  status: entries.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
  entries,
};

fs.mkdirSync(path.join(root, "artifacts", "stage17"), { recursive: true });
fs.writeFileSync(
  path.join(root, "artifacts", "stage17", "stage17-closure-check.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(result, null, 2));

if (result.status !== "PASS") {
  process.exit(1);
}
