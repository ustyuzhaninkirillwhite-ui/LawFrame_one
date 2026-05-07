import type {
  AutomationBlueprint,
  AutomationBlueprintValidationSummary,
  AutomationCanvasDraftResponse,
  AutomationClarificationQuestion,
  AutomationCompilePreviewResponse,
  AutomationIntent,
  AutomationPlanResponse,
  AutomationRuntimeDraftResponse,
  Stage20ReadinessResponse,
} from "@lexframe/contracts";

export type {
  AutomationBlueprint,
  AutomationBlueprintValidationSummary,
  AutomationCanvasDraftResponse,
  AutomationClarificationQuestion,
  AutomationCompilePreviewResponse,
  AutomationIntent,
  AutomationPlanResponse,
  AutomationRuntimeDraftResponse,
  Stage20ReadinessResponse,
};

export type AutomationBuilderStage =
  | "idle"
  | "intent"
  | "planning"
  | "clarification"
  | "preview"
  | "approved"
  | "canvas_draft"
  | "runtime_draft"
  | "blocked";

export interface AutomationBuilderAction {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly onClick: () => void;
}

export interface AutomationBuilderSnapshot {
  readonly intent: AutomationIntent | null;
  readonly blueprint: AutomationBlueprint | null;
  readonly validation: AutomationBlueprintValidationSummary | null;
  readonly compilePreview: AutomationCompilePreviewResponse | null;
  readonly canvasDraft: AutomationCanvasDraftResponse | null;
  readonly runtimeDraft: AutomationRuntimeDraftResponse | null;
  readonly readiness: Stage20ReadinessResponse | null;
}
