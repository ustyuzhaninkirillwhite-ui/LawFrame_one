const assert = require("node:assert/strict");
const {
  invalidFixtures,
  largeFixtures,
  mswFixtures,
  performanceBudgets,
  releaseGateMatrix,
  runtimeSnapshots,
  validFixtures,
} = require("../index.cjs");

assert.ok(validFixtures.length >= 20, "Canvas v2 requires at least 20 valid fixtures");
assert.ok(invalidFixtures.length >= 20, "Canvas v2 requires at least 20 invalid fixtures");
assert.ok(
  largeFixtures.some((fixture) => fixture.workflow.nodes.length >= 100),
  "Canvas v2 requires a 100-node performance fixture",
);
assert.deepEqual(
  releaseGateMatrix.map((item) => item.gate),
  [
    "Contract",
    "Validation",
    "Security",
    "Runtime",
    "E2E",
    "Integrated Readiness",
    "Performance",
    "Manifest",
  ],
);
assert.ok(runtimeSnapshots.length >= 5, "Runtime reverse-sync fixtures are required");
assert.ok(mswFixtures.endpoints.length >= 10, "Canvas MSW contract endpoints are required");
assert.ok(mswFixtures.errors.some((item) => item.code === "CANVAS_POLICY_BLOCKED"));
assert.equal(performanceBudgets.initialLoad100NodesP95Ms, 3000);

console.log("canvas-test-fixtures contract passed");
