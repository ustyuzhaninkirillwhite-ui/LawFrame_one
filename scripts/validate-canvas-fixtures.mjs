import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  invalidFixtures,
  largeFixtures,
  mswFixtures,
  performanceBudgets,
  releaseGateMatrix,
  runtimeSnapshots,
  validFixtures,
} = require("../packages/canvas-test-fixtures/index.cjs");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

async function loadSchema(relativePath) {
  return JSON.parse(await fs.readFile(path.resolve(relativePath), "utf-8"));
}

const schemas = {
  workflow: await loadSchema("packages/contracts/src/canvas/workflow-v2.schema.json"),
  node: await loadSchema("packages/contracts/src/canvas/node.schema.json"),
  edge: await loadSchema("packages/contracts/src/canvas/edge.schema.json"),
  binding: await loadSchema("packages/contracts/src/canvas/binding.schema.json"),
  operation: await loadSchema("packages/contracts/src/canvas/operation.schema.json"),
  validation: await loadSchema("packages/contracts/src/canvas/validation.schema.json"),
  pinnedData: await loadSchema("packages/contracts/src/canvas/pinned-data.schema.json"),
  runtimeProjection: await loadSchema(
    "packages/contracts/src/canvas/runtime-projection.schema.json",
  ),
};

const validateWorkflow = ajv.compile(schemas.workflow);
const validateValidation = ajv.compile(schemas.validation);
const validatePinnedData = ajv.compile(schemas.pinnedData);
const validateRuntimeProjection = ajv.compile(schemas.runtimeProjection);

const failures = [];

function check(condition, label, details) {
  if (condition) {
    console.log(`OK: ${label}`);
    return;
  }
  console.error(`FAIL: ${label}`);
  if (details) {
    console.error(details);
  }
  failures.push(label);
}

check(validFixtures.length >= 20, "At least 20 valid Canvas fixtures exist");
check(invalidFixtures.length >= 20, "At least 20 invalid Canvas fixtures exist");
check(releaseGateMatrix.length === 8, "Eight Canvas release gates are declared");
check(
  releaseGateMatrix.every((gate) => gate.blocksOn.length > 0),
  "Every release gate has blocking conditions",
);
check(
  mswFixtures.endpoints.includes("POST /automations/:id/canvas/compile-preview"),
  "MSW fixtures cover compile preview",
);
check(
  mswFixtures.errors.some((item) => item.code === "CANVAS_PERMISSION_DENIED"),
  "MSW fixtures cover permission denied",
);
check(
  runtimeSnapshots.some((item) => item.name === "direct-ai-provider"),
  "Runtime fixtures cover direct AI provider reverse sync",
);
check(
  largeFixtures.some((item) => item.workflow.nodes.length >= 100),
  "Large fixtures include at least 100 nodes",
);
check(
  performanceBudgets.operationApplyP95Ms <= 200,
  "Operation apply p95 budget is <= 200ms",
);

for (const fixture of validFixtures) {
  check(
    validateWorkflow(fixture.workflow),
    `Valid fixture passes workflow schema: ${fixture.name}`,
    JSON.stringify(validateWorkflow.errors, null, 2),
  );
  check(
    validateValidation(fixture.workflow.validation),
    `Valid fixture validation block passes schema: ${fixture.name}`,
    JSON.stringify(validateValidation.errors, null, 2),
  );
}

for (const fixture of invalidFixtures) {
  const schemaValid = validateWorkflow(fixture.workflow);
  if (fixture.schemaValid === false) {
    check(
      !schemaValid,
      `Schema-invalid fixture is rejected: ${fixture.name}`,
      JSON.stringify(validateWorkflow.errors, null, 2),
    );
  } else {
    check(
      schemaValid,
      `Validation-invalid fixture remains schema-compatible: ${fixture.name}`,
      JSON.stringify(validateWorkflow.errors, null, 2),
    );
    check(
      Array.isArray(fixture.expectedValidationCodes) &&
        fixture.expectedValidationCodes.every((code) =>
          /^WF_(SCHEMA|STRUCTURE|TYPE|POLICY|RUNTIME|LEGAL|UX)_/.test(code),
        ),
      `Invalid fixture uses stable WF_* code prefixes: ${fixture.name}`,
    );
  }
}

for (const fixture of largeFixtures) {
  check(
    validateWorkflow(fixture.workflow),
    `Large fixture passes workflow schema: ${fixture.name}`,
    JSON.stringify(validateWorkflow.errors, null, 2),
  );
}

check(
  validatePinnedData({
    node_id: "analysis",
    output_key: "facts",
    pinned_sample_data_id: "sample_analysis_facts",
    draft_only: true,
    expires_at: null,
  }),
  "Pinned data fixture passes schema",
  JSON.stringify(validatePinnedData.errors, null, 2),
);

check(
  validateRuntimeProjection({
    provider: "activepieces",
    activepieces_flow: { schemaVersion: "20", trigger: null, steps: [] },
    required_pieces: [],
    required_connections: [],
    unsupported_nodes: [],
    policy_warnings: [],
    projection_hash: "0123456789abcdef",
    can_compile: true,
  }),
  "Runtime projection fixture passes schema",
  JSON.stringify(validateRuntimeProjection.errors, null, 2),
);

if (failures.length > 0) {
  console.error(`\nCanvas fixture validation failed (${failures.length}).`);
  process.exitCode = 1;
} else {
  console.log("\nCanvas fixture validation passed.");
}
