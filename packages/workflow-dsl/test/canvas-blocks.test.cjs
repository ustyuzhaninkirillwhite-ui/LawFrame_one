const assert = require("node:assert/strict");
const {
  canvasBlockCategories,
  canvasBlockDefinitions,
  findCanvasBlockDefinition,
  validateCanvasBlock,
  validateCanvasConnection,
} = require("../dist/index.js");

const mvpCodes = [
  "manual_start",
  "select_documents",
  "select_profile",
  "case_law_search",
  "case_material_analysis",
  "condition",
  "pretrial_claim_draft",
  "document_template_apply",
  "document_structure_check",
  "human_approval",
  "save_to_documents",
  "email_delivery",
  "error_handler",
  "end_success",
];

for (const code of mvpCodes) {
  const block = findCanvasBlockDefinition(code);
  assert.ok(block, `MVP block is missing: ${code}`);
  assert.equal(block.mvp, true, `MVP flag is not set for ${code}`);
  assert.ok(block.handles, `Handles are missing for ${code}`);
  assert.ok(block.policies, `Policies are missing for ${code}`);
  assert.ok(block.runtime, `Runtime mapping is missing for ${code}`);
}

const categories = new Set(canvasBlockDefinitions.map((block) => block.category));
for (const category of canvasBlockCategories) {
  assert.ok(categories.has(category), `Category is missing from registry: ${category}`);
}

const manualStart = findCanvasBlockDefinition("manual_start");
const claimDraft = findCanvasBlockDefinition("pretrial_claim_draft");
const approval = findCanvasBlockDefinition("human_approval");
const delivery = findCanvasBlockDefinition("email_delivery");
const end = findCanvasBlockDefinition("end_success");
const storage = findCanvasBlockDefinition("save_to_documents");

assert.ok(manualStart && claimDraft && approval && delivery && end && storage);

const triggerToTrigger = validateCanvasConnection({
  sourceBlock: manualStart,
  sourceHandle: "main_output",
  targetBlock: manualStart,
  targetHandle: "main_input",
});
assert.equal(triggerToTrigger.allowed, false);
assert.match(triggerToTrigger.reason ?? "", /trigger to trigger/i);

const endToAny = validateCanvasConnection({
  sourceBlock: end,
  sourceHandle: "main_output",
  targetBlock: claimDraft,
  targetHandle: "main_input",
});
assert.equal(endToAny.allowed, false);
assert.match(endToAny.reason ?? "", /End block/i);

const deliveryWithoutApproval = validateCanvasConnection({
  sourceBlock: claimDraft,
  sourceHandle: "main_output",
  targetBlock: delivery,
  targetHandle: "main_input",
  hasApprovalPath: false,
});
assert.equal(deliveryWithoutApproval.allowed, false);
assert.equal(
  deliveryWithoutApproval.policy.blocks[0].code,
  "EXTERNAL_DELIVERY_REQUIRES_APPROVAL",
);

const approvedDelivery = validateCanvasConnection({
  sourceBlock: approval,
  sourceHandle: "approved",
  targetBlock: delivery,
  targetHandle: "main_input",
  edgeType: "approval_flow",
  hasApprovalPath: true,
});
assert.equal(approvedDelivery.allowed, true);

const missingDraftInputs = validateCanvasBlock({
  block: claimDraft,
  bindings: [],
});
assert.equal(missingDraftInputs.valid, false);
assert.ok(
  missingDraftInputs.issues.some((issue) => issue.code === "REQUIRED_INPUT_MISSING"),
);

const configuredDraft = validateCanvasBlock({
  block: claimDraft,
  targetNodeId: "node_claim_draft",
  bindings: [
    {
      targetNodeId: "node_claim_draft",
      targetInputKey: "facts",
      source: { type: "step_output", sourceNodeId: "analysis", outputKey: "facts" },
    },
    {
      targetNodeId: "node_claim_draft",
      targetInputKey: "template_id",
      source: { type: "literal", value: "template_pretrial_claim" },
    },
    {
      targetNodeId: "node_claim_draft",
      targetInputKey: "profile_snapshot",
      source: { type: "profile_snapshot", profileSnapshotId: "profile_snapshot_1" },
    },
  ],
});
assert.equal(configuredDraft.valid, true);

assert.equal(
  storage.outputs.some((output) => output.type === "signed_url" || output.key === "signed_url"),
  false,
);

console.log("workflow-dsl canvas block contract tests passed");
