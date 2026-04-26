import type {
  BindingValidationState,
  CanvasDataSourceCandidate,
  CanvasNodeType,
  StepInputBinding,
  StepInputState,
  StepInspectorPermissionsDto,
  StepInspectorTab,
  ValidationIssue,
  WorkflowDataField,
} from "@lexframe/contracts";

export function buildStepInspectorTabs(input: {
  readonly nodeType?: CanvasNodeType | null;
  readonly permissions?: StepInspectorPermissionsDto | null;
}): readonly StepInspectorTab[] {
  const canViewRawData = Boolean(input.permissions?.can_view_raw_data);
  const compact =
    input.nodeType === "note" ||
    input.nodeType === "group" ||
    input.nodeType === null;
  const base: StepInspectorTab[] = compact
    ? ["overview", "settings", "errors", "outputs"]
    : [
        "overview",
        "inputs",
        "settings",
        "data",
        "test",
        "errors",
        "outputs",
      ];
  return canViewRawData ? [...base, "debug"] : base;
}

export function resolveInputStatus(input: {
  readonly field: WorkflowDataField;
  readonly binding?: StepInputBinding | null;
  readonly issues?: readonly ValidationIssue[];
}): StepInputState {
  const issues = input.issues ?? [];
  if (issues.some((issue) => issue.severity === "policy_block")) {
    return "blocked_by_policy";
  }
  if (issues.some((issue) => issue.code.includes("permission"))) {
    return "requires_permission";
  }
  if (issues.some((issue) => issue.code.includes("connection"))) {
    return "requires_connection";
  }
  if (issues.some((issue) => issue.code.includes("stale"))) {
    return "configured_but_stale";
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return "configured_but_invalid";
  }
  if (!input.binding && input.field.required) {
    return "missing_required";
  }
  if (!input.binding) {
    return "configured";
  }
  if (
    input.binding.source.type === "manual_value" ||
    input.binding.source.type === "literal"
  ) {
    return "manual_value";
  }
  if (
    input.binding.created_by === "template" ||
    input.binding.created_by === "system"
  ) {
    return "auto_mapped";
  }
  return "configured";
}

export function bindingStatusFromState(
  state: StepInputState,
  binding?: StepInputBinding | null,
): BindingValidationState | "none" {
  switch (state) {
    case "blocked_by_policy":
      return "policy_blocked";
    case "configured_but_invalid":
    case "requires_connection":
    case "requires_permission":
      return "invalid";
    case "configured_but_stale":
      return "stale";
    case "missing_required":
      return "none";
    default:
      return binding?.validation_state ?? "valid";
  }
}

export function sourceCandidateKey(candidate: CanvasDataSourceCandidate) {
  return `${candidate.type}:${JSON.stringify(candidate.source)}`;
}
