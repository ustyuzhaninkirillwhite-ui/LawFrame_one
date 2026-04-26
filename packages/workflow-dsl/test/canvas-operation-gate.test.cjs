const assert = require("node:assert/strict");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const { helpers } = require("../../canvas-test-fixtures/index.cjs");

const operationSchema = require(path.resolve(
  __dirname,
  "../../../packages/contracts/src/canvas/operation.schema.json",
));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateOperation = ajv.compile(operationSchema);

const operationTypes = [
  "ADD_NODE_FROM_MODULE",
  "ADD_NODE",
  "DUPLICATE_NODE",
  "UPDATE_NODE",
  "MOVE_NODE",
  "DELETE_NODE",
  "ADD_EDGE",
  "DELETE_EDGE",
  "UPDATE_EDGE",
  "UPDATE_NODE_CONFIG",
  "UPDATE_LAYOUT",
  "UPSERT_WORKFLOW_INPUT",
  "DELETE_WORKFLOW_INPUT",
  "UPSERT_WORKFLOW_OUTPUT",
  "DELETE_WORKFLOW_OUTPUT",
  "UPSERT_INPUT_BINDING",
  "DELETE_INPUT_BINDING",
  "PIN_SAMPLE_DATA",
  "UNPIN_SAMPLE_DATA",
  "UPDATE_CONDITION",
  "UPDATE_WORKFLOW_POLICY",
  "UPDATE_NODE_POLICY",
  "SNAPSHOT_RESTORE",
  "RUNTIME_IMPORT_AS_DRAFT",
];

for (const operationType of operationTypes) {
  const operation = {
    client_operation_id: `op_${operationType.toLowerCase()}`,
    operation_type: operationType,
    operation_payload: {
      fixture: true,
      workflow_hash: helpers.hash(operationType).slice(0, 16),
    },
    base_workflow_hash: helpers.hash("base").slice(0, 16),
    base_revision_counter: 1,
    idempotency_key: `idem_${operationType.toLowerCase()}`,
  };
  assert.equal(
    validateOperation(operation),
    true,
    `${operationType} should pass operation schema: ${JSON.stringify(validateOperation.errors)}`,
  );
}

const invalidOperation = {
  client_operation_id: "op_invalid",
  operation_type: "DROP_DATABASE",
  operation_payload: {},
};

assert.equal(validateOperation(invalidOperation), false);

console.log("canvas operation gate tests passed");
