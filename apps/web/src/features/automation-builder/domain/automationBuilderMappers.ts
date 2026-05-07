import type {
  AutomationBlueprint,
  AutomationBlueprintValidationSummary,
  AutomationBuilderStage,
  AutomationIntent,
  Stage20ReadinessResponse,
} from "./automationBuilderTypes";

export function deriveAutomationBuilderStage(input: {
  readonly intent: AutomationIntent | null;
  readonly blueprint: AutomationBlueprint | null;
  readonly runtimeCreated: boolean;
  readonly canvasCreated: boolean;
}): AutomationBuilderStage {
  if (!input.intent) {
    return "idle";
  }

  if (input.intent.status === "planning" || input.intent.status === "context_collecting") {
    return "planning";
  }

  if (input.blueprint?.clarificationState.status === "needs_answers") {
    return "clarification";
  }

  if (input.runtimeCreated) {
    return "runtime_draft";
  }

  if (input.canvasCreated || input.blueprint?.status === "converted_to_canvas_draft") {
    return "canvas_draft";
  }

  if (input.blueprint?.status === "approved" || input.intent.status === "user_approved") {
    return "approved";
  }

  if (
    input.blueprint?.validationSummary.status === "invalid" ||
    input.blueprint?.validationSummary.status === "policy_blocked"
  ) {
    return "blocked";
  }

  if (input.blueprint) {
    return "preview";
  }

  return "intent";
}

export function summarizeValidation(
  validation: AutomationBlueprintValidationSummary | null | undefined,
) {
  if (!validation) {
    return {
      status: "not_checked",
      label: "Проверка не запускалась",
      issueCount: 0,
    };
  }

  return {
    status: validation.status,
    label:
      validation.status === "valid"
        ? "Можно согласовать Blueprint"
        : validation.status === "valid_with_warnings"
          ? "Есть предупреждения"
          : validation.status === "policy_blocked"
            ? "Заблокировано политикой"
            : "Нужно исправление",
    issueCount:
      validation.errors.length +
      validation.warnings.length +
      validation.policyBlocks.length,
  };
}

export function readinessStatusLabel(readiness: Stage20ReadinessResponse | null) {
  if (!readiness) {
    return "readiness неизвестна";
  }

  if (readiness.status === "ready") {
    return "Stage 20 ready";
  }

  if (readiness.status === "degraded") {
    return "Stage 20 degraded";
  }

  return "Stage 20 unavailable";
}

export function hasBlockingReadiness(readiness: Stage20ReadinessResponse | null) {
  if (!readiness) {
    return false;
  }

  return Object.values(readiness.checks).some((check) => check.status === "fail");
}

export function formatPolicyValue(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "not recorded";
}

export function blueprintStepCount(blueprint: AutomationBlueprint | null) {
  return blueprint?.steps.filter((step) => step.kind !== "note").length ?? 0;
}
