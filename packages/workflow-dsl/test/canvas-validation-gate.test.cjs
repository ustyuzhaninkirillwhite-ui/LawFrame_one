const assert = require("node:assert/strict");
const { invalidFixtures, releaseGateMatrix } = require("../../canvas-test-fixtures/index.cjs");

const stablePrefixes = [
  "WF_SCHEMA_",
  "WF_STRUCTURE_",
  "WF_TYPE_",
  "WF_POLICY_",
  "WF_RUNTIME_",
  "WF_LEGAL_",
  "WF_UX_",
];

for (const fixture of invalidFixtures) {
  assert.ok(
    fixture.expectedValidationCodes.length > 0,
    `${fixture.name} must declare expected validation codes`,
  );
  for (const code of fixture.expectedValidationCodes) {
    assert.ok(
      stablePrefixes.some((prefix) => code.startsWith(prefix)),
      `${fixture.name} uses unstable validation code: ${code}`,
    );
  }
}

const expectedGates = new Set([
  "Contract",
  "Validation",
  "Security",
  "Runtime",
  "E2E",
  "Integrated Readiness",
  "Performance",
  "Manifest",
]);
assert.deepEqual(new Set(releaseGateMatrix.map((item) => item.gate)), expectedGates);

assert.ok(
  invalidFixtures.some((item) =>
    item.expectedValidationCodes.includes("WF_POLICY_002_EXTERNAL_DELIVERY_APPROVAL_REQUIRED"),
  ),
  "Validation gate must cover external delivery without approval",
);
assert.ok(
  invalidFixtures.some((item) =>
    item.expectedValidationCodes.includes("WF_POLICY_004_CROSS_WORKSPACE_REFERENCE"),
  ),
  "Validation gate must cover cross-workspace reference",
);
assert.ok(
  invalidFixtures.some((item) =>
    item.expectedValidationCodes.includes("WF_POLICY_005_SECRET_VALUE_IN_CONFIG"),
  ),
  "Validation gate must cover secret literal in node config",
);

console.log("canvas validation gate tests passed");
