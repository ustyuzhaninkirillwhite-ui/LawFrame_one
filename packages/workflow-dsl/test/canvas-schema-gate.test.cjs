const assert = require("node:assert/strict");
const path = require("node:path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const {
  invalidFixtures,
  largeFixtures,
  validFixtures,
} = require("../../canvas-test-fixtures/index.cjs");

const root = path.resolve(__dirname, "../../..");
const workflowSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/workflow-v2.schema.json",
));
const nodeSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/node.schema.json",
));
const edgeSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/edge.schema.json",
));
const bindingSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/binding.schema.json",
));
const operationSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/operation.schema.json",
));
const validationSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/validation.schema.json",
));
const pinnedDataSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/pinned-data.schema.json",
));
const runtimeProjectionSchema = require(path.join(
  root,
  "packages/contracts/src/canvas/runtime-projection.schema.json",
));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

for (const [name, schema] of Object.entries({
  workflowSchema,
  nodeSchema,
  edgeSchema,
  bindingSchema,
  operationSchema,
  validationSchema,
  pinnedDataSchema,
  runtimeProjectionSchema,
})) {
  assert.equal(ajv.validateSchema(schema), true, `${name} must be a valid JSON schema`);
}

const validateWorkflow = ajv.compile(workflowSchema);
const validateNode = ajv.compile(nodeSchema);
const validateEdge = ajv.compile(edgeSchema);
const validateBinding = ajv.compile(bindingSchema);

assert.ok(validFixtures.length >= 20);
assert.ok(invalidFixtures.length >= 20);

for (const fixture of [...validFixtures, ...largeFixtures]) {
  assert.equal(
    validateWorkflow(fixture.workflow),
    true,
    `${fixture.name} should pass Workflow DSL v2 schema: ${JSON.stringify(validateWorkflow.errors)}`,
  );
  for (const node of fixture.workflow.nodes) {
    assert.equal(
      validateNode(node),
      true,
      `${fixture.name}/${node.id} should pass node schema: ${JSON.stringify(validateNode.errors)}`,
    );
  }
  for (const edge of fixture.workflow.edges) {
    assert.equal(
      validateEdge(edge),
      true,
      `${fixture.name}/${edge.id} should pass edge schema: ${JSON.stringify(validateEdge.errors)}`,
    );
  }
  for (const binding of fixture.workflow.nodes.flatMap((node) => node.input_bindings ?? [])) {
    assert.equal(
      validateBinding(binding),
      true,
      `${fixture.name}/${binding.id} should pass binding schema: ${JSON.stringify(validateBinding.errors)}`,
    );
  }
}

for (const fixture of invalidFixtures.filter((item) => item.schemaValid === false)) {
  assert.equal(
    validateWorkflow(fixture.workflow),
    false,
    `${fixture.name} should be rejected by Workflow DSL v2 schema`,
  );
}

console.log("canvas schema gate tests passed");
