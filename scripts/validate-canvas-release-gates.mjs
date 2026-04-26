import fs from "node:fs/promises";
import path from "node:path";

const requiredDocs = [
  "docs/testing/canvas-v2-test-strategy.md",
  "docs/testing/canvas-v2-release-gates.md",
  "docs/testing/canvas-v2-manual-qa-checklist.md",
  "docs/testing/canvas-v2-risk-matrix.md",
  "docs/testing/canvas-v2-fixtures.md",
  "docs/testing/canvas-v2-performance-budget.md",
];

const requiredAdrs = [
  "docs/architecture/adr/0007-canvas-v2-control-plane.md",
];

const requiredWorkflows = [
  ".github/workflows/workflow-dsl-ci.yml",
  ".github/workflows/canvas-ci.yml",
  ".github/workflows/canvas-e2e.yml",
  ".github/workflows/canvas-integrated.yml",
  ".github/workflows/canvas-release-gate.yml",
  ".github/workflows/canvas-security-ci.yml",
  ".github/workflows/canvas-ai-ci.yml",
  ".github/workflows/workflow-compiler-ci.yml",
];

const hardGates = [
  "Contract",
  "Validation",
  "Security",
  "Runtime",
  "E2E",
  "Integrated Readiness",
  "Performance",
  "Manifest",
];

const requiredFlags = [
  "canvas_v2_enabled",
  "canvas_v2_readonly_preview",
  "canvas_v2_step_testing_enabled",
  "canvas_v2_dry_run_enabled",
  "canvas_v2_publish_enabled",
  "canvas_v2_reverse_sync_enabled",
  "canvas_v2_advanced_builder_enabled",
  "canvas_v2_ai_assistant_enabled",
];

const requiredCanvasStateFlags = [
  "canvas_v2",
  "canvas_ai_assistant",
  "canvas_advanced_graph",
  "canvas_reverse_sync",
];

const failures = [];

async function exists(relativePath) {
  try {
    await fs.access(path.resolve(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return fs.readFile(path.resolve(relativePath), "utf-8");
}

function check(condition, label) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }
  console.error(`FAIL: ${label}`);
  failures.push(label);
}

for (const file of requiredDocs) {
  check(await exists(file), `Canvas QA document exists: ${file}`);
}

for (const file of requiredAdrs) {
  check(await exists(file), `Canvas architecture ADR exists: ${file}`);
}

for (const file of requiredWorkflows) {
  check(await exists(file), `Canvas CI workflow exists: ${file}`);
}

const releaseGatesDoc = (await exists(requiredDocs[1]))
  ? await read(requiredDocs[1])
  : "";
const riskMatrixDoc = (await exists(requiredDocs[3]))
  ? await read(requiredDocs[3])
  : "";
const releaseWorkflow = (await exists(".github/workflows/canvas-release-gate.yml"))
  ? await read(".github/workflows/canvas-release-gate.yml")
  : "";
const canvasContracts = (await exists("packages/contracts/src/canvas.ts"))
  ? await read("packages/contracts/src/canvas.ts")
  : "";
const canvasDraftService = (await exists(
  "apps/backend/src/modules/canvas/canvas-draft.service.ts",
))
  ? await read("apps/backend/src/modules/canvas/canvas-draft.service.ts")
  : "";
const validationSchema = (await exists(
  "packages/contracts/src/canvas/validation.schema.json",
))
  ? await read("packages/contracts/src/canvas/validation.schema.json")
  : "";
const workflowV2Schema = (await exists(
  "packages/contracts/src/canvas/workflow-v2.schema.json",
))
  ? await read("packages/contracts/src/canvas/workflow-v2.schema.json")
  : "";
const canvasControlPlaneAdr = (await exists(requiredAdrs[0]))
  ? await read(requiredAdrs[0])
  : "";

for (const gate of hardGates) {
  check(releaseGatesDoc.includes(`Gate: ${gate}`), `Release gate is documented: ${gate}`);
  check(releaseWorkflow.includes(gate), `Release workflow references gate: ${gate}`);
}

for (const flag of requiredFlags) {
  check(releaseGatesDoc.includes(flag), `Rollout flag is documented: ${flag}`);
}

for (const flag of requiredCanvasStateFlags) {
  check(
    canvasContracts.includes(`readonly ${flag}: boolean`) &&
      canvasDraftService.includes(`${flag}:`),
    `CanvasState feature flag is typed and returned: ${flag}`,
  );
}

check(
  canvasContracts.includes("readonly can_sync: boolean") &&
    canvasContracts.includes("readonly can_sync: boolean;") &&
    validationSchema.includes('"can_sync"') &&
    workflowV2Schema.includes('"can_sync"') &&
    workflowV2Schema.includes('"capabilities"') &&
    workflowV2Schema.includes('"blocks"'),
  "Canvas validation exposes can_sync as a required release capability",
);

check(
  canvasControlPlaneAdr.includes("Canvas v2 edits `LexFrameWorkflowV2`") &&
    canvasControlPlaneAdr.includes("Activepieces JSON is a runtime projection only") &&
    canvasControlPlaneAdr.includes("reverse sync never write directly"),
  "Canvas control-plane ADR locks canonical DSL and reverse-sync boundaries",
);

for (const severity of ["P0", "P1", "P2", "P3"]) {
  check(riskMatrixDoc.includes(`Severity ${severity}`), `Severity model includes ${severity}`);
}

check(
  releaseGatesDoc.includes("protected environment") &&
    releaseGatesDoc.includes("rollback manifest"),
  "Production gate requires protected environment and rollback manifest",
);

if (failures.length > 0) {
  console.error(`\nCanvas release-gate validation failed (${failures.length}).`);
  process.exitCode = 1;
} else {
  console.log("\nCanvas release-gate validation passed.");
}
