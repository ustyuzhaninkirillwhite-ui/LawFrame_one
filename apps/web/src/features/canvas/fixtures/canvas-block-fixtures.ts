import {
  canvasBlockDefinitions,
  validateCanvasConnection,
  validateCanvasBlock,
  type CanvasBlockDefinition,
} from "@lexframe/workflow-dsl";

export const mockCanvasBlockTypes: readonly CanvasBlockDefinition[] =
  canvasBlockDefinitions;

export const mockLegalActionBlocks = mockCanvasBlockTypes.filter(
  (block) => block.kind === "legal_action",
);

export const mockTriggerBlocks = mockCanvasBlockTypes.filter(
  (block) => block.kind === "trigger",
);

export const mockConditionBlocks = mockCanvasBlockTypes.filter(
  (block) => block.kind === "condition",
);

export const mockApprovalBlocks = mockCanvasBlockTypes.filter(
  (block) => block.kind === "approval",
);

export const mockDeliveryBlocks = mockCanvasBlockTypes.filter(
  (block) => block.kind === "delivery",
);

const manualStart = block("manual_start");
const legalAction = block("case_law_search");
const approval = block("human_approval");
const delivery = block("email_delivery");
const end = block("end_success");

export const mockInvalidConnections = [
  validateCanvasConnection({
    sourceBlock: manualStart,
    sourceHandle: "main_output",
    targetBlock: manualStart,
    targetHandle: "main_input",
  }),
  validateCanvasConnection({
    sourceBlock: end,
    sourceHandle: "main_output",
    targetBlock: legalAction,
    targetHandle: "main_input",
  }),
  validateCanvasConnection({
    sourceBlock: legalAction,
    sourceHandle: "main_output",
    targetBlock: delivery,
    targetHandle: "main_input",
    hasApprovalPath: false,
  }),
];

export const mockBlockValidationResults = [
  validateCanvasBlock({
    block: delivery,
    hasApprovalPath: false,
    permissions: ["canvas.view"],
    roleCodes: ["viewer"],
  }),
  validateCanvasBlock({
    block: approval,
    hasApprovalPath: true,
    permissions: ["canvas.view", "canvas.edit"],
    roleCodes: ["lawyer"],
  }),
];

function block(code: string) {
  const definition = mockCanvasBlockTypes.find((item) => item.code === code);
  if (!definition) {
    throw new Error(`Missing canvas block fixture: ${code}`);
  }
  return definition;
}
