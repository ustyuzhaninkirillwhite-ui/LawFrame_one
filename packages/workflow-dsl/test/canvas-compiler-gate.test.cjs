const assert = require("node:assert/strict");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const {
  helpers,
  invalidFixtures,
  runtimeSnapshots,
  validFixtures,
} = require("../../canvas-test-fixtures/index.cjs");

const runtimeProjectionSchema = require(path.resolve(
  __dirname,
  "../../../packages/contracts/src/canvas/runtime-projection.schema.json",
));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateRuntimeProjection = ajv.compile(runtimeProjectionSchema);

const approvalDelivery = validFixtures.find(
  (fixture) => fixture.name === "approval-before-delivery-workflow",
);
const unsafeDelivery = invalidFixtures.find(
  (fixture) => fixture.name === "unsafe-delivery.invalid",
);

assert.ok(approvalDelivery, "approval-before-delivery fixture is required");
assert.ok(unsafeDelivery, "unsafe delivery fixture is required");
assert.equal(approvalDelivery.workflow.validation.can_compile, true);
assert.ok(
  unsafeDelivery.expectedValidationCodes.includes(
    "WF_POLICY_002_EXTERNAL_DELIVERY_APPROVAL_REQUIRED",
  ),
);

const projection = {
  provider: "activepieces",
  activepieces_flow: {
    schemaVersion: "20",
    displayName: approvalDelivery.workflow.metadata.title,
    trigger: { name: "manual_start", type: "PIECE_TRIGGER" },
    steps: approvalDelivery.workflow.nodes
      .filter((node) => !["trigger", "note", "group"].includes(node.type))
      .map((node) => ({ name: node.id, type: "PIECE" })),
  },
  required_pieces: [
    {
      package_name: "@lexframe/piece-delivery",
      version: "0.1.0",
      node_ids: ["delivery"],
    },
  ],
  required_connections: [],
  unsupported_nodes: [],
  policy_warnings: [],
  projection_hash: helpers.hash(approvalDelivery.workflow).slice(0, 32),
  can_compile: true,
};

assert.equal(
  validateRuntimeProjection(projection),
  true,
  `runtime projection should pass schema: ${JSON.stringify(validateRuntimeProjection.errors)}`,
);

assert.ok(runtimeSnapshots.some((item) => item.name === "unknown-runtime-node"));
assert.ok(runtimeSnapshots.some((item) => item.name === "direct-ai-provider"));
assert.ok(runtimeSnapshots.some((item) => item.name === "approval-removed-before-delivery"));

console.log("canvas compiler gate tests passed");
