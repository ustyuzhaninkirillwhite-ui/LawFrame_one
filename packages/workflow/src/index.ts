import {
  invalidWorkflowExample,
  validWorkflowExample,
  validWorkflowPatchExample,
} from "./examples";
import {
  validateWorkflowDefinition,
  validateWorkflowPatch,
} from "./semantic-validator";

export * from "./examples";
export * from "./semantic-validator";

export function validateExampleWorkflows() {
  const validResult = validateWorkflowDefinition(validWorkflowExample);
  const invalidResult = validateWorkflowDefinition(invalidWorkflowExample);
  const patchResult = validateWorkflowPatch(
    validWorkflowPatchExample,
    validWorkflowExample,
  );

  const issues = [
    ...(!validResult.ok ? validResult.issues.map((issue) => `valid example: ${issue}`) : []),
    ...(invalidResult.ok ? ["invalid example unexpectedly passed validation"] : []),
    ...(!patchResult.ok ? patchResult.issues.map((issue) => `patch example: ${issue}`) : []),
  ];

  return {
    ok: issues.length === 0,
    issues,
  };
}
