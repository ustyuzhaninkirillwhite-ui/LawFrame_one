import type {
  AiDataClass,
  AiProviderRoute,
  LexFrameWorkflow,
  LexFrameWorkflowStep,
  LexFrameWorkflowPatch,
  RuntimePlanPreview,
  WorkflowIssue,
  WorkflowPatchDiff,
  WorkflowPolicyReport,
  WorkflowValidationReport,
} from "@lexframe/contracts";
import { workflowPatchSchema, workflowSchema } from "@lexframe/contracts";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface ModuleContract {
  readonly code: string;
  readonly inputBindings: readonly string[];
  readonly outputBindings: readonly string[];
  readonly requiresApproval: boolean;
  readonly maxClass?: string;
}

export interface ValidationContext {
  readonly modules?: readonly ModuleContract[];
  readonly dataClass?: AiDataClass;
  readonly allowedProviderRoutes?: readonly string[];
  readonly availableConnections?: readonly string[];
}

const defaultModuleRegistry: readonly ModuleContract[] = [
  {
    code: "legal.case-search",
    inputBindings: ["factDigest", "claimBrief"],
    outputBindings: ["practice", "practiceDigest"],
    requiresApproval: false,
    maxClass: "internal",
  },
  {
    code: "legal.material-analysis",
    inputBindings: ["documents", "facts"],
    outputBindings: ["facts", "limitationSummary", "summary"],
    requiresApproval: false,
    maxClass: "confidential",
  },
  {
    code: "document.claim-draft",
    inputBindings: ["facts", "practice", "templateId"],
    outputBindings: ["draft"],
    requiresApproval: true,
    maxClass: "confidential",
  },
  {
    code: "document.pretrial-draft",
    inputBindings: ["facts", "practice", "templateId"],
    outputBindings: ["draft"],
    requiresApproval: true,
    maxClass: "confidential",
  },
  {
    code: "document.template-apply",
    inputBindings: ["documents", "practice", "templateId"],
    outputBindings: ["draft"],
    requiresApproval: false,
    maxClass: "internal",
  },
  {
    code: "document.structure-check",
    inputBindings: ["draft"],
    outputBindings: ["structureReport"],
    requiresApproval: false,
    maxClass: "internal",
  },
  {
    code: "workflow.internal-approval",
    inputBindings: ["draft"],
    outputBindings: ["approvedDraft"],
    requiresApproval: false,
    maxClass: "internal",
  },
  {
    code: "delivery.email-draft",
    inputBindings: ["document"],
    outputBindings: ["emailDraft"],
    requiresApproval: true,
    maxClass: "confidential",
  },
  {
    code: "library.publication-submit",
    inputBindings: ["templateDraft"],
    outputBindings: ["publicationRequest"],
    requiresApproval: false,
    maxClass: "internal",
  },
];

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);
ajv.addSchema(workflowSchema, "workflow.schema.json");
ajv.addSchema(workflowPatchSchema, "workflow-patch.schema.json");

const validateWorkflowSchema =
  ajv.getSchema("workflow.schema.json") ?? ajv.compile(workflowSchema);
const validatePatchSchema =
  ajv.getSchema("workflow-patch.schema.json") ??
  ajv.compile(workflowPatchSchema);

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

function createIssue(
  severity: WorkflowIssue["severity"],
  code: string,
  path: string,
  message: string,
): WorkflowIssue {
  return {
    severity,
    code,
    path,
    message,
  };
}

function collectSchemaIssues(candidate: unknown): readonly WorkflowIssue[] {
  const schemaOk = validateWorkflowSchema(candidate);

  if (schemaOk) {
    return [];
  }

  return (validateWorkflowSchema.errors ?? []).map((error) =>
    createIssue(
      "error",
      "schema_invalid",
      error.instancePath || "/",
      error.message ?? "invalid",
    ),
  );
}

function buildRegistry(context: ValidationContext) {
  return new Map(
    (context.modules ?? defaultModuleRegistry).map((module) => [
      module.code,
      module,
    ]),
  );
}

function collectSemanticIssues(
  workflow: LexFrameWorkflow,
  context: ValidationContext,
): readonly WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const registry = buildRegistry(context);
  const knownStepIds = new Set<string>();
  const knownOutputs = new Set(
    workflow.inputs.map((input) => `$inputs.${input.inputId}`),
  );
  const workflowOutputRefs = new Set(
    workflow.outputs.map((output) => `$outputs.${output.outputId}`),
  );

  for (const step of workflow.steps) {
    if (knownStepIds.has(step.stepId)) {
      issues.push(
        createIssue(
          "error",
          "duplicate_step_id",
          `$.steps.${step.stepId}`,
          `Duplicate stepId: ${step.stepId}`,
        ),
      );
    }

    knownStepIds.add(step.stepId);

    if (step.kind === "deliver" && !step.requiresApproval) {
      issues.push(
        createIssue(
          "error",
          "approval_required",
          `$.steps.${step.stepId}.requiresApproval`,
          `External delivery step must require approval: ${step.stepId}`,
        ),
      );
    }

    const module = registry.get(step.moduleCode);

    if (!module) {
      issues.push(
        createIssue(
          "error",
          "unknown_module",
          `$.steps.${step.stepId}.moduleCode`,
          `Unknown moduleCode: ${step.moduleCode}`,
        ),
      );
      continue;
    }

    if (module.requiresApproval && !step.requiresApproval) {
      issues.push(
        createIssue(
          "error",
          "module_requires_approval",
          `$.steps.${step.stepId}.requiresApproval`,
          `Module ${step.moduleCode} must require approval.`,
        ),
      );
    }

    for (const bindingKey of Object.keys(step.inputBindings)) {
      if (!module.inputBindings.includes(bindingKey)) {
        issues.push(
          createIssue(
            "warning",
            "unexpected_input_binding",
            `$.steps.${step.stepId}.inputBindings.${bindingKey}`,
            `Input binding ${bindingKey} is not declared for module ${step.moduleCode}`,
          ),
        );
      }

      const bindingValue = step.inputBindings[bindingKey];
      if (
        typeof bindingValue === "string" &&
        bindingValue.startsWith("$inputs.") &&
        !knownOutputs.has(bindingValue)
      ) {
        issues.push(
          createIssue(
            "error",
            "missing_workflow_input",
            `$.steps.${step.stepId}.inputBindings.${bindingKey}`,
            `Workflow input ${bindingValue} is not available before step ${step.stepId}`,
          ),
        );
      }
    }

    for (const [bindingKey, bindingValue] of Object.entries(
      step.outputBindings,
    )) {
      if (!module.outputBindings.includes(bindingKey)) {
        issues.push(
          createIssue(
            "warning",
            "unexpected_output_binding",
            `$.steps.${step.stepId}.outputBindings.${bindingKey}`,
            `Output binding ${bindingKey} is not declared for module ${step.moduleCode}`,
          ),
        );
      }

      knownOutputs.add(bindingValue);
    }
  }

  for (const transition of workflow.transitions) {
    if (!knownStepIds.has(transition.from)) {
      issues.push(
        createIssue(
          "error",
          "missing_dependency_target",
          "$.transitions",
          `Missing dependency target: ${transition.from}`,
        ),
      );
    }

    if (!knownStepIds.has(transition.to)) {
      issues.push(
        createIssue(
          "error",
          "missing_transition_target",
          "$.transitions",
          `Missing transition target: ${transition.to}`,
        ),
      );
    }
  }

  for (const outputRef of workflowOutputRefs) {
    if (!knownOutputs.has(outputRef)) {
      issues.push(
        createIssue(
          "error",
          "workflow_output_not_produced",
          "$.outputs",
          `Workflow output is never produced: ${outputRef}`,
        ),
      );
    }
  }

  return issues;
}

function resolvePreferredRoute(context: ValidationContext) {
  if (context.allowedProviderRoutes && context.allowedProviderRoutes.length > 0) {
    return context.allowedProviderRoutes[0] as AiProviderRoute;
  }

  if (
    context.dataClass === "C_CONFIDENTIAL_CLIENT" ||
    context.dataClass === "C_LEGAL_SECRET"
  ) {
    return "xai_zdr";
  }

  if (context.dataClass === "D_AI_EXTERNAL_FORBIDDEN") {
    return "local_mock";
  }

  return "xai";
}

export function createWorkflowValidationReport(
  candidate: unknown,
  context: ValidationContext = {},
): WorkflowValidationReport {
  const schemaIssues = collectSchemaIssues(candidate);

  if (schemaIssues.length > 0) {
    return {
      valid: false,
      blockingErrors: schemaIssues,
      warnings: [],
      infos: [],
    };
  }

  const semanticIssues = collectSemanticIssues(
    candidate as LexFrameWorkflow,
    context,
  );

  return {
    valid: semanticIssues.every((issue) => issue.severity !== "error"),
    blockingErrors: semanticIssues.filter((issue) => issue.severity === "error"),
    warnings: semanticIssues.filter((issue) => issue.severity === "warning"),
    infos: semanticIssues.filter((issue) => issue.severity === "info"),
  };
}

export function validateWorkflowDefinition(
  candidate: unknown,
  context: ValidationContext = {},
): ValidationResult {
  const report = createWorkflowValidationReport(candidate, context);
  const issues = [
    ...report.blockingErrors,
    ...report.warnings,
    ...report.infos,
  ].map((issue) => issue.message);

  return {
    ok: report.valid,
    issues,
  };
}

export function createWorkflowPolicyReport(
  workflow: LexFrameWorkflow,
  context: ValidationContext = {},
): WorkflowPolicyReport {
  const preferredRoute = resolvePreferredRoute(context);
  const routeViolations =
    preferredRoute === "cometapi" &&
    (context.dataClass === "C_CONFIDENTIAL_CLIENT" ||
      context.dataClass === "C_LEGAL_SECRET" ||
      context.dataClass === "D_AI_EXTERNAL_FORBIDDEN")
      ? [
          {
            code: "confidential_route_forbidden",
            message: "Sensitive workflow cannot be routed through CometAPI.",
            action: "block" as const,
            path: "$.steps",
          },
        ]
      : [];

  const approvalWarnings = workflow.steps
    .filter((step) => step.kind === "deliver" && step.requiresApproval)
    .map((step) => `Delivery step ${step.title} waits for manual approval.`);

  const valid = routeViolations.length === 0;

  return {
    valid,
    dataClass: context.dataClass ?? "A_PUBLIC",
    providerRoute: valid ? preferredRoute : "blocked",
    externalActionsRequireApproval:
      workflow.approvalPolicy.externalActionsRequireApproval,
    violations: routeViolations,
    warnings: approvalWarnings,
  };
}

export function compileRuntimePlanPreview(
  workflow: LexFrameWorkflow,
  context: ValidationContext = {},
): RuntimePlanPreview {
  const availableConnections = new Set(context.availableConnections ?? []);
  const missingRuntimeBindings = workflow.steps
    .filter((step) => step.runtime.requiredConnection)
    .filter(
      (step) => !availableConnections.has(step.runtime.requiredConnection!),
    )
    .map((step) => ({
      stepId: step.stepId,
      requiredPiece: step.runtime.requiredPiece ?? null,
      requiredConnection: step.runtime.requiredConnection ?? null,
      reason: `Missing runtime connection: ${step.runtime.requiredConnection}`,
    }));

  return {
    runnable: missingRuntimeBindings.length === 0,
    missingRuntimeBindings,
    activepiecesCandidateSteps: workflow.steps
      .filter((step) => Boolean(step.runtime.requiredPiece))
      .map((step) => step.stepId),
  };
}

export function validateWorkflowPatch(
  patch: unknown,
  workflow: LexFrameWorkflow,
): ValidationResult {
  const schemaOk = validatePatchSchema(patch);
  const issues: string[] = [];

  if (!schemaOk) {
    issues.push(
      ...(validatePatchSchema.errors ?? []).map(
        (error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`,
      ),
    );
    return {
      ok: false,
      issues,
    };
  }

  const typedPatch = patch as unknown as LexFrameWorkflowPatch;
  const existingSteps = new Set(workflow.steps.map((step) => step.stepId));

  for (const operation of typedPatch.operations) {
    if (operation.op === "add_step" && existingSteps.has(operation.step.stepId)) {
      issues.push(`Duplicate stepId in patch add_step: ${operation.step.stepId}`);
    }

    if (
      (operation.op === "update_step" || operation.op === "remove_step") &&
      !existingSteps.has(operation.stepId)
    ) {
      issues.push(`Patch references missing stepId: ${operation.stepId}`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function applyWorkflowPatch(
  workflow: LexFrameWorkflow,
  patch: LexFrameWorkflowPatch,
): LexFrameWorkflow {
  const steps = [...workflow.steps];
  const transitions = [...workflow.transitions];

  for (const operation of patch.operations) {
    if (operation.op === "add_step") {
      const index =
        operation.afterStepId === null
          ? -1
          : steps.findIndex((step) => step.stepId === operation.afterStepId);

      if (index < 0) {
        steps.unshift(operation.step);
      } else {
        steps.splice(index + 1, 0, operation.step);
      }
      continue;
    }

    if (operation.op === "update_step") {
      const index = steps.findIndex((step) => step.stepId === operation.stepId);
      if (index >= 0) {
        const currentStep = steps[index] as LexFrameWorkflowStep | undefined;

        if (!currentStep) {
          continue;
        }

        steps[index] = {
          ...currentStep,
          ...operation.changes,
        } as LexFrameWorkflowStep;
      }
      continue;
    }

    if (operation.op === "remove_step") {
      const index = steps.findIndex((step) => step.stepId === operation.stepId);
      if (index >= 0) {
        steps.splice(index, 1);
      }
    }
  }

  const remainingStepIds = new Set(steps.map((step) => step.stepId));

  return {
    ...workflow,
    steps,
    transitions: transitions.filter(
      (transition) =>
        remainingStepIds.has(transition.from) &&
        remainingStepIds.has(transition.to),
    ),
  };
}

export function generateWorkflowPatchDiff(
  workflow: LexFrameWorkflow,
  patch: LexFrameWorkflowPatch,
): WorkflowPatchDiff {
  const stepTitles = new Map(
    workflow.steps.map((step) => [step.stepId, step.title]),
  );

  return {
    addedSteps: patch.operations
      .filter((operation) => operation.op === "add_step")
      .map((operation) => operation.step.title),
    updatedSteps: patch.operations
      .filter((operation) => operation.op === "update_step")
      .map((operation) => stepTitles.get(operation.stepId) ?? operation.stepId),
    removedSteps: patch.operations
      .filter((operation) => operation.op === "remove_step")
      .map((operation) => stepTitles.get(operation.stepId) ?? operation.stepId),
  };
}
