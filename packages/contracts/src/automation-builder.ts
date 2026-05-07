import type { PermissionCode } from "./permissions/permission-codes";

export const automationIntentStatuses = [
  "created",
  "context_collecting",
  "needs_clarification",
  "planning",
  "blueprint_ready",
  "blueprint_invalid",
  "user_rejected",
  "user_approved",
  "draft_created",
  "runtime_creation_pending",
  "runtime_created",
  "failed",
  "cancelled",
] as const;

export type AutomationIntentStatus =
  (typeof automationIntentStatuses)[number];

export const automationBlueprintStatuses = [
  "draft",
  "schema_valid",
  "needs_clarification",
  "policy_blocked",
  "validation_failed",
  "preview_ready",
  "approved",
  "converted_to_canvas_draft",
  "runtime_projection_created",
  "archived",
] as const;

export type AutomationBlueprintStatus =
  (typeof automationBlueprintStatuses)[number];

export const automationPlannerRunStatuses = [
  "queued",
  "running",
  "completed",
  "schema_failed",
  "policy_blocked",
  "needs_clarification",
  "failed",
  "cancelled",
] as const;

export type AutomationPlannerRunStatus =
  (typeof automationPlannerRunStatuses)[number];

export type AutomationIntentSource =
  | "project_chat_action"
  | "automation_builder_page"
  | "canvas_ai_assistant"
  | "recommendation"
  | "template_remix"
  | "manual";

export type AutomationDataClassification =
  | "public"
  | "internal"
  | "workspace_internal"
  | "confidential"
  | "client_material"
  | "legal_secret"
  | "personal_data";

export type AutomationBlueprintStepKind =
  | "trigger"
  | "legal_action"
  | "ai_action"
  | "document_input"
  | "condition"
  | "router"
  | "loop"
  | "merge"
  | "approval"
  | "wait"
  | "delivery"
  | "storage"
  | "subworkflow"
  | "error_handler"
  | "note"
  | "end";

export type AutomationRuntimeProvider =
  | "lexframe_canvas"
  | "activepieces"
  | "internal_worker"
  | "ai_gateway"
  | "manual"
  | "none";

export interface AutomationIntent {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly source: AutomationIntentSource;
  readonly sourceThreadId?: string | null;
  readonly sourceMessageId?: string | null;
  readonly title?: string | null;
  readonly userGoal: string;
  readonly status: AutomationIntentStatus;
  readonly classification: AutomationDataClassification;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AutomationBlueprintSourceContext {
  readonly items: readonly AutomationBlueprintContextItem[];
  readonly policyDecision: string;
  readonly contextBudgetTokens?: number;
  readonly routePolicyDecisionId?: string | null;
}

export interface AutomationBlueprintContextItem {
  readonly id: string;
  readonly type?: AutomationBuilderContextItemType;
  readonly sourceType?: string;
  readonly sourceId: string;
  readonly classification?: AutomationDataClassification | string;
  readonly selectedMode?: AutomationContextMode;
  readonly resultHash?: string | null;
  readonly blocked?: boolean;
  readonly reasonCode?: string | null;
}

export type AutomationContextMode =
  | "raw"
  | "summary"
  | "focused_rag"
  | "reference_only"
  | "block";

export type AutomationBuilderContextItemType =
  | "project_summary"
  | "thread_summary"
  | "selected_message"
  | "selected_document"
  | "project_knowledge_item"
  | "workspace_template"
  | "personal_profile"
  | "team_profile"
  | "legal_module_catalog"
  | "installed_automation"
  | "automation_template"
  | "workflow_run_evidence"
  | "approval_policy"
  | "connection_status"
  | "delivery_policy"
  | "data_policy"
  | "runtime_capability"
  | "canvas_contract";

export interface AutomationBlueprintField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly classification: AutomationDataClassification | string;
  readonly required: boolean;
  readonly description?: string | null;
}

export type AutomationBlueprintInput = AutomationBlueprintField;
export type AutomationBlueprintOutput = AutomationBlueprintField;
export type AutomationBlueprintInputRequirement = AutomationBlueprintField;
export type AutomationBlueprintOutputDefinition = AutomationBlueprintField;

export interface AutomationBlueprintStep {
  readonly id: string;
  readonly kind: AutomationBlueprintStepKind;
  readonly moduleCode?: string | null;
  readonly moduleVersion?: string | null;
  readonly title: string;
  readonly description: string;
  readonly inputRequirements: readonly AutomationBlueprintInputRequirement[];
  readonly outputDefinitions: readonly AutomationBlueprintOutputDefinition[];
  readonly config: Record<string, unknown>;
  readonly policy: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly dataClassification:
      | "public"
      | "workspace_internal"
      | "confidential"
      | "personal_data"
      | "legal_secret"
      | "client_material";
    readonly requiresApproval: boolean;
    readonly externalAction: boolean;
    readonly aiRoutePolicy?: string;
    readonly allowedRoles?: readonly string[];
  };
  readonly runtimeMapping?: {
    readonly provider: AutomationRuntimeProvider;
    readonly pieceName?: string;
    readonly actionName?: string;
    readonly connectionRequirements?: readonly string[];
  };
}

export interface AutomationBlueprintEdge {
  readonly id: string;
  readonly sourceStepId: string;
  readonly targetStepId: string;
  readonly kind: "control" | "data" | "approval" | "error" | "loop" | "annotation";
  readonly label?: string | null;
}

export interface AutomationBlueprintDataBinding {
  readonly id: string;
  readonly sourceStepId?: string | null;
  readonly targetStepId: string;
  readonly targetInputKey: string;
  readonly source: Record<string, unknown>;
  readonly classification?: AutomationDataClassification | string;
}

export interface AutomationBlueprintDocumentRequirement {
  readonly id: string;
  readonly label: string;
  readonly sourceId?: string | null;
  readonly required: boolean;
  readonly classification: AutomationDataClassification | string;
}

export interface AutomationBlueprintConnectionRequirement {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly status: "ready" | "missing" | "blocked" | "unknown";
  readonly required: boolean;
}

export interface AutomationBlueprintApprovalGate {
  readonly id: string;
  readonly stepId?: string | null;
  readonly title: string;
  readonly requiredRole?: string | null;
  readonly requiredPermission?: PermissionCode | string | null;
  readonly reason: string;
}

export interface AutomationBlueprintDataPolicy {
  readonly highestClassification: AutomationDataClassification | string;
  readonly contextModes: readonly AutomationContextMode[];
  readonly externalProviderAllowed: boolean;
  readonly rawSecretMaterialAllowed: boolean;
}

export interface AutomationRuntimePlan {
  readonly target:
    | "canvas_draft"
    | "activepieces_draft"
    | "internal_worker"
    | "manual"
    | "none";
  readonly activepieces?: {
    readonly required: boolean;
    readonly createDraftAllowed: boolean;
    readonly requiredPieces?: readonly string[];
    readonly requiredConnections?: readonly string[];
  };
}

export interface AutomationTestPlan {
  readonly scenarios: readonly {
    readonly id?: string;
    readonly title: string;
    readonly expectedResult?: string;
  }[];
}

export interface AutomationRiskReport {
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly warnings: readonly string[];
  readonly blocks: readonly string[];
}

export interface AutomationClarificationState {
  readonly status: "complete" | "needs_answers";
  readonly questions: readonly AutomationClarificationQuestion[];
}

export interface AutomationClarificationQuestion {
  readonly id: string;
  readonly intentId: string;
  readonly blueprintId?: string;
  readonly kind:
    | "missing_goal"
    | "missing_trigger"
    | "missing_documents"
    | "missing_profile"
    | "missing_template"
    | "missing_recipient"
    | "missing_approval_policy"
    | "missing_connection"
    | "ambiguous_legal_action"
    | "data_policy_choice"
    | "runtime_choice"
    | "risk_acceptance";
  readonly question: string;
  readonly choices?: readonly {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly value: unknown;
  }[];
  readonly required: boolean;
  readonly answerType:
    | "text"
    | "single_choice"
    | "multi_choice"
    | "document_picker"
    | "template_picker"
    | "profile_picker"
    | "connection_picker"
    | "approval_route_picker"
    | "boolean"
    | "number"
    | "date";
  readonly policyContext?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface AiRouteSnapshotSafe {
  readonly route: "automation_planner_high" | string;
  readonly provider: string;
  readonly model: string;
  readonly keyFingerprint?: string | null;
  readonly policyDecision?: string | null;
  readonly latencyMs?: number | null;
  readonly inputTokens?: number | null;
  readonly outputTokens?: number | null;
}

export interface AutomationBlueprintIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error" | "policy_block";
  readonly stepId?: string | null;
  readonly edgeId?: string | null;
}

export interface AutomationBlueprintValidationSummary {
  readonly status:
    | "valid"
    | "valid_with_warnings"
    | "invalid"
    | "policy_blocked";
  readonly errors: readonly AutomationBlueprintIssue[];
  readonly warnings: readonly AutomationBlueprintIssue[];
  readonly policyBlocks: readonly AutomationBlueprintIssue[];
  readonly affectedSteps: readonly string[];
  readonly affectedEdges: readonly string[];
  readonly canAskClarification: boolean;
  readonly canApprove: boolean;
  readonly canConvertToCanvasDraft: boolean;
  readonly canCreateRuntimeDraft: boolean;
  readonly canPublish: false;
  readonly canRunProduction: false;
}

export interface AutomationBlueprint {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly intentId: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string;
  readonly status: AutomationBlueprintStatus;
  readonly sourceContext: AutomationBlueprintSourceContext;
  readonly workflowInputs: readonly AutomationBlueprintInput[];
  readonly workflowOutputs: readonly AutomationBlueprintOutput[];
  readonly steps: readonly AutomationBlueprintStep[];
  readonly edges: readonly AutomationBlueprintEdge[];
  readonly dataBindings: readonly AutomationBlueprintDataBinding[];
  readonly requiredDocuments: readonly AutomationBlueprintDocumentRequirement[];
  readonly requiredConnections: readonly AutomationBlueprintConnectionRequirement[];
  readonly approvalGates: readonly AutomationBlueprintApprovalGate[];
  readonly dataPolicy: AutomationBlueprintDataPolicy;
  readonly runtimePlan: AutomationRuntimePlan;
  readonly testPlan: AutomationTestPlan;
  readonly riskReport: AutomationRiskReport;
  readonly clarificationState: AutomationClarificationState;
  readonly routeSnapshot?: AiRouteSnapshotSafe;
  readonly validationSummary: AutomationBlueprintValidationSummary;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AutomationPlannerEventType =
  | "intent_created"
  | "context_collecting"
  | "context_collected"
  | "planning_started"
  | "planner_delta"
  | "route_snapshot"
  | "schema_validation_started"
  | "schema_validation_failed"
  | "clarification_required"
  | "blueprint_created"
  | "blueprint_validation_started"
  | "blueprint_validation_failed"
  | "blueprint_validation_passed"
  | "compile_preview_started"
  | "compile_preview_ready"
  | "user_approval_required"
  | "canvas_draft_created"
  | "runtime_draft_creation_started"
  | "runtime_draft_created"
  | "error"
  | "done";

export interface CreateAutomationIntentRequest {
  readonly source?: AutomationIntentSource;
  readonly sourceThreadId?: string | null;
  readonly sourceMessageId?: string | null;
  readonly title?: string | null;
  readonly userGoal: string;
  readonly classification?: AutomationDataClassification;
}

export interface UpdateAutomationIntentRequest {
  readonly title?: string | null;
  readonly userGoal?: string;
  readonly classification?: AutomationDataClassification;
}

export interface AutomationIntentResponse {
  readonly intent: AutomationIntent;
  readonly latestBlueprint?: AutomationBlueprint | null;
}

export interface AutomationPlanResponse {
  readonly intent: AutomationIntent;
  readonly plannerRunId: string;
  readonly blueprint: AutomationBlueprint | null;
  readonly events: readonly AutomationPlannerEventType[];
}

export interface AutomationCompilePreviewResponse {
  readonly blueprintId: string;
  readonly status: "preview_ready" | "blocked";
  readonly workflowHash: string | null;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly warnings: readonly string[];
}

export interface AutomationCanvasDraftResponse {
  readonly blueprintId: string;
  readonly automationId: string;
  readonly draftVersionId: string;
  readonly canvasUrl: string;
  readonly status: "canvas_draft_created" | "already_exists";
}

export interface AutomationRuntimeDraftResponse {
  readonly blueprintId: string;
  readonly status:
    | "runtime_created"
    | "runtime_creation_unavailable"
    | "runtime_creation_blocked"
    | "not_configured";
  readonly canvasDraft: {
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly workflow: Record<string, unknown>;
  };
  readonly activepiecesProjectId: string | null;
  readonly activepiecesFlowId: string | null;
  readonly activepiecesVersionId?: string | null;
  readonly mcpInvocationId: string | null;
  readonly evidenceHash: string;
  readonly warnings: readonly string[];
}

export interface AutomationClarificationAnswerRequest {
  readonly answer: unknown;
}

export interface AutomationClarificationAnswerResponse {
  readonly id: string;
  readonly status: "answered";
}

export interface AutomationBuilderSessionResponse {
  readonly id: string | null;
  readonly status: "active" | "archived" | string;
}

export interface AutomationModuleCatalogItem {
  readonly code: string;
  readonly kind: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly runtimeProvider: string;
  readonly activepiecesPiece: string | null;
  readonly activepiecesAction: string | null;
}

export interface AutomationModuleCatalogResponse {
  readonly modules: readonly AutomationModuleCatalogItem[];
}

export interface AutomationModuleResolveResponse {
  readonly resolved: readonly {
    readonly moduleCode: string | null;
    readonly kind: string | null;
    readonly supported: boolean;
    readonly canvasNodeType: string | null;
    readonly runtimeProvider: string;
  }[];
}

export interface AutomationContextPreviewResponse {
  readonly items: readonly AutomationBlueprintContextItem[];
  readonly policyDecision: string;
  readonly contextBudgetTokens: number;
}

export interface AutomationSecurityPreflightResponse {
  readonly status: "pass" | "degraded" | "blocked";
  readonly workspaceId: string;
  readonly plannerRoute: "automation_planner_high";
  readonly frontendProviderCallsAllowed: false;
  readonly frontendRuntimeCallsAllowed: false;
  readonly canPublish: false;
  readonly canRunProduction: false;
}

export interface Stage20ReadinessCheck {
  readonly status: "pass" | "degraded" | "not_configured" | "fail";
  readonly reason: string;
  readonly diagnostics?: Record<string, unknown>;
}

export interface Stage20ReadinessResponse {
  readonly status: "ready" | "degraded" | "unavailable";
  readonly checks: Record<string, Stage20ReadinessCheck>;
}
