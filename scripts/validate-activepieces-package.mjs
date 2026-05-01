import fs from "node:fs/promises";
import path from "node:path";

const packageJsonPath = path.resolve("packages/activepieces-legal-pieces/package.json");
const sourcePath = path.resolve("packages/activepieces-legal-pieces/src/index.ts");

const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
const source = await fs.readFile(sourcePath, "utf-8");
const failures = [];

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }

  console.error(`FAIL: ${label}`);
  failures.push(label);
}

check(/^\d+\.\d+\.\d+/.test(packageJson.version), "Activepieces package uses semver");
check(
  source.includes("ACTIVEPIECES_LEGAL_PIECES_VERSION"),
  "Package exports a pinned legal pieces version",
);
check(source.includes("legalSearchPiece"), "Legal search piece is exported");
check(source.includes("documentTemplatePiece"), "Document template piece is exported");
check(source.includes("approvalRequestPiece"), "Approval request piece is exported");
check(source.includes("aiGatewayPiece"), "AI Gateway piece is exported");
check(
  source.includes('endpoint: "/workflow-runtime/ai-gateway/actions/analyze"'),
  "AI Gateway piece calls the LexFrame runtime endpoint",
);
check(
  !/provider(Api)?Key|api[_-]?key/i.test(source),
  "Activepieces package surface does not expose provider key fields",
);
check(source.includes("legalResearchWorkflowPreset"), "Workflow preset exists for smoke/runtime validation");
check(source.includes("activepiecesSmokeFlows"), "Smoke flow manifest is exported");
check(source.includes("activepiecesCompatibilityNotes"), "Compatibility notes are exported");
check(source.includes("activepiecesRollbackPolicy"), "Rollback policy is exported");

if (failures.length > 0) {
  console.error("\nActivepieces package validation failed.");
  process.exitCode = 1;
} else {
  console.log("\nActivepieces package validation passed.");
}
