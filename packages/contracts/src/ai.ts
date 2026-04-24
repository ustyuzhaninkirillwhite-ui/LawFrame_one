import type { DataClassification } from "./enums/data-classification";
import type { PermissionCode } from "./permissions/permission-codes";

export type AiDataClass =
  | "A_PUBLIC"
  | "A_TEMPLATE_NON_SENSITIVE"
  | "B_INTERNAL_WORKSPACE"
  | "B_ANONYMIZED_LEGAL"
  | "C_CONFIDENTIAL_CLIENT"
  | "C_LEGAL_SECRET"
  | "D_AI_EXTERNAL_FORBIDDEN";

export type AiProvider = "xai" | "cometapi" | "local";

export type AiProviderRoute =
  | "xai"
  | "xai_zdr"
  | "cometapi"
  | "local_mock"
  | "blocked";

export type AiTaskType =
  | "workflow_planning"
  | "workflow_patch"
  | "document_analysis"
  | "field_extraction"
  | "clarification";

export type AiChatSource =
  | "global_chat"
  | "automation_chat"
  | "project_chat"
  | "document_chat";

export type AiChatMode =
  | "create_workflow"
  | "modify_workflow"
  | "explain_workflow"
  | "extract_fields";

export type AiChatSessionStatus = "active" | "archived";

export type AiContentStorageMode =
  | "metadata_only"
  | "encrypted"
  | "plaintext_allowed";

export type AiMessageRole = "user" | "assistant" | "system";

export type AiMessageResponseType =
  | "workflow_draft_ready"
  | "clarification_required"
  | "patch_ready"
  | "blocked_by_policy"
  | "queued"
  | "error"
  | "explanation";

export type WorkflowDraftStatus =
  | "created"
  | "planning"
  | "clarification_required"
  | "validation_failed"
  | "ready_for_review"
  | "saved"
  | "applied_to_automation"
  | "archived";

export type WorkflowIssueSeverity = "error" | "warning" | "info";

export type ClarificationFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "date"
  | "email"
  | "number"
  | "document"
  | "template"
  | "profile";

export interface ClarificationOption {
  readonly value: string;
  readonly label: string;
}

export interface AiClarificationQuestion {
  readonly field: string;
  readonly label: string;
  readonly type: ClarificationFieldType;
  readonly required: boolean;
  readonly helpText?: string;
  readonly options?: readonly ClarificationOption[];
  readonly defaultValue?: unknown;
}

export interface WorkflowIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: WorkflowIssueSeverity;
}

export interface WorkflowValidationReport {
  readonly valid: boolean;
  readonly blockingErrors: readonly WorkflowIssue[];
  readonly warnings: readonly WorkflowIssue[];
  readonly infos: readonly WorkflowIssue[];
}

export interface WorkflowPolicyViolation {
  readonly code: string;
  readonly message: string;
  readonly action: "block" | "warn";
  readonly path?: string;
}

export interface WorkflowPolicyReport {
  readonly valid: boolean;
  readonly dataClass: AiDataClass;
  readonly providerRoute: AiProviderRoute;
  readonly externalActionsRequireApproval: boolean;
  readonly violations: readonly WorkflowPolicyViolation[];
  readonly warnings: readonly string[];
}

export interface RuntimeRequirement {
  readonly stepId: string;
  readonly requiredPiece?: string | null;
  readonly requiredConnection?: string | null;
  readonly reason: string;
}

export interface RuntimePlanPreview {
  readonly runnable: boolean;
  readonly missingRuntimeBindings: readonly RuntimeRequirement[];
  readonly activepiecesCandidateSteps: readonly string[];
}

export interface LexFrameWorkflowInput {
  readonly inputId: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly source: "user_selection" | "profile" | "template" | "workspace_context";
  readonly dataClass: DataClassification | AiDataClass;
}

export interface LexFrameWorkflowOutput {
  readonly outputId: string;
  readonly label: string;
  readonly type: string;
  readonly format?: string | null;
}

export interface LexFrameWorkflowStep {
  readonly stepId: string;
  readonly moduleCode: string;
  readonly moduleVersion: string;
  readonly title: string;
  readonly description: string;
  readonly kind:
    | "ingest"
    | "analyze"
    | "generate"
    | "review"
    | "deliver"
    | "store";
  readonly inputBindings: Record<string, string>;
  readonly outputBindings: Record<string, string>;
  readonly requiresApproval: boolean;
  readonly dataPolicy: {
    readonly maxClass: DataClassification | AiDataClass;
    readonly allowedAiRoutes: readonly AiProviderRoute[];
  };
  readonly runtime: {
    readonly requiredPiece?: string | null;
    readonly requiredConnection?: string | null;
  };
  readonly onError?: {
    readonly strategy: "stop_and_ask_user" | "stop" | "continue";
    readonly message: string;
  };
}

export interface LexFrameWorkflowTransition {
  readonly from: string;
  readonly to: string;
  readonly condition: "success" | "failure" | "always" | "approved";
}

export interface LexFrameWorkflow {
  readonly schemaVersion: "lexframe.workflow.v1";
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly intent: string;
  readonly jurisdiction: string;
  readonly practiceArea: string;
  readonly inputs: readonly LexFrameWorkflowInput[];
  readonly outputs: readonly LexFrameWorkflowOutput[];
  readonly steps: readonly LexFrameWorkflowStep[];
  readonly transitions: readonly LexFrameWorkflowTransition[];
  readonly approvalPolicy: {
    readonly externalActionsRequireApproval: boolean;
    readonly documentGenerationRequiresReview: boolean;
  };
  readonly securityLabels: readonly string[];
  readonly createdBy: "ai_planner" | "human";
  readonly confidence: number;
  readonly metadata?: Record<string, unknown>;
}

export interface WorkflowPatchAddStepOperation {
  readonly op: "add_step";
  readonly afterStepId: string | null;
  readonly step: LexFrameWorkflowStep;
}

export interface WorkflowPatchUpdateStepOperation {
  readonly op: "update_step";
  readonly stepId: string;
  readonly changes: Partial<LexFrameWorkflowStep>;
}

export interface WorkflowPatchRemoveStepOperation {
  readonly op: "remove_step";
  readonly stepId: string;
}

export type LexFrameWorkflowPatchOperation =
  | WorkflowPatchAddStepOperation
  | WorkflowPatchUpdateStepOperation
  | WorkflowPatchRemoveStepOperation;

export interface LexFrameWorkflowPatch {
  readonly patchVersion: "lexframe.workflow_patch.v1";
  readonly baseWorkflowVersionId: string;
  readonly operations: readonly LexFrameWorkflowPatchOperation[];
  readonly explanation: string;
  readonly riskChange: "none" | "low_to_medium" | "medium_to_high" | "high_to_critical";
}

export interface WorkflowPatchDiff {
  readonly addedSteps: readonly string[];
  readonly updatedSteps: readonly string[];
  readonly removedSteps: readonly string[];
}

export interface AiChatSessionSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly source: AiChatSource;
  readonly mode: AiChatMode;
  readonly status: AiChatSessionStatus;
  readonly title: string;
  readonly currentAutomationId: string | null;
  readonly selectedDocumentIds: readonly string[];
  readonly selectedTemplateIds: readonly string[];
  readonly selectedProfileId: string | null;
  readonly contentStorageMode: AiContentStorageMode;
  readonly allowedModes: readonly AiChatMode[];
  readonly aiPolicySummary: {
    readonly externalAiEnabled: boolean;
    readonly confidentialDataAllowed: boolean;
    readonly cometapiAllowedForPublicData: boolean;
  };
  readonly lastMessageAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiChatMessageSummary {
  readonly id: string;
  readonly sessionId: string;
  readonly role: AiMessageRole;
  readonly responseType: AiMessageResponseType | null;
  readonly contentText: string | null;
  readonly contentPreview: string;
  readonly contentStorageMode: AiContentStorageMode;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface WorkflowDraftSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly ownerId: string;
  readonly source: "ai_chat" | "recommendation" | "manual";
  readonly status: WorkflowDraftStatus;
  readonly title: string;
  readonly currentVersionId: string;
  readonly linkedAutomationId: string | null;
  readonly linkedSessionId: string | null;
  readonly updatedAt: string;
  readonly createdAt: string;
}

export interface WorkflowDraftVersionSummary {
  readonly id: string;
  readonly draftId: string;
  readonly versionNo: number;
  readonly schemaVersion: string;
  readonly promptVersion: string;
  readonly aiRequestId: string | null;
  readonly workflow: LexFrameWorkflow;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
  readonly runtimePlanPreview: RuntimePlanPreview;
  readonly createdAt: string;
}

export interface WorkflowDraftDetail extends WorkflowDraftSummary {
  readonly workflow: LexFrameWorkflow;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
  readonly runtimePlanPreview: RuntimePlanPreview;
  readonly versions: readonly WorkflowDraftVersionSummary[];
  readonly clarificationQuestions: readonly AiClarificationQuestion[];
  readonly patch: LexFrameWorkflowPatch | null;
  readonly diff: WorkflowPatchDiff | null;
}

export interface CreateAiChatSessionRequest {
  readonly source: AiChatSource;
  readonly mode?: AiChatMode;
  readonly currentAutomationId?: string | null;
  readonly selectedDocumentIds?: readonly string[];
  readonly selectedTemplateIds?: readonly string[];
  readonly selectedProfileId?: string | null;
}

export interface CreateAiChatMessageRequest {
  readonly sessionId?: string | null;
  readonly mode: AiChatMode;
  readonly message: string;
  readonly selectedDocumentIds?: readonly string[];
  readonly selectedTemplateIds?: readonly string[];
  readonly selectedProfileId?: string | null;
  readonly currentAutomationId?: string | null;
  readonly clientTraceId?: string | null;
}

export interface CreateWorkflowDraftRequest {
  readonly title: string;
  readonly workflow: LexFrameWorkflow;
  readonly source?: WorkflowDraftSummary["source"];
  readonly linkedSessionId?: string | null;
}

export interface UpdateWorkflowDraftInputsRequest {
  readonly answers: Record<string, unknown>;
}

export interface CreateWorkflowPatchRequest {
  readonly automationId: string;
  readonly baseVersionId: string;
  readonly instruction: string;
  readonly sessionId?: string | null;
}

export interface AiRedactionPreviewRequest {
  readonly text: string;
  readonly classification: AiDataClass;
  readonly redactionPolicy: "strict" | "balanced";
}

export interface AiRedactionEntity {
  readonly placeholder: string;
  readonly type: string;
  readonly hash: string;
  readonly confidence: number;
}

export interface AiRedactionPreviewResponse {
  readonly redactedText: string;
  readonly entities: readonly AiRedactionEntity[];
  readonly reversible: boolean;
  readonly mappingId: string;
}

export interface AiRequestSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly sessionId: string | null;
  readonly taskType: AiTaskType;
  readonly dataClass: AiDataClass;
  readonly provider: AiProvider | null;
  readonly model: string | null;
  readonly routeReason: string;
  readonly promptHash: string;
  readonly responseHash: string | null;
  readonly schemaVersion: string | null;
  readonly promptVersion: string;
  readonly status: "queued" | "completed" | "blocked" | "error";
  readonly errorCode: string | null;
  readonly latencyMs: number | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly createdAt: string;
}

export interface AiRequestEvent {
  readonly id: string;
  readonly requestId: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

export interface WorkflowDraftReadyResponse {
  readonly status: "workflow_draft_ready";
  readonly sessionId: string;
  readonly messageId: string;
  readonly draftId: string;
  readonly draftVersionId: string;
  readonly workflow: LexFrameWorkflow;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
  readonly runtimePlanPreview: RuntimePlanPreview;
  readonly warnings: readonly string[];
}

export interface ClarificationRequiredResponse {
  readonly status: "clarification_required";
  readonly sessionId: string;
  readonly messageId: string;
  readonly draftId: string | null;
  readonly questions: readonly AiClarificationQuestion[];
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
}

export interface WorkflowPatchReadyResponse {
  readonly status: "patch_ready";
  readonly sessionId: string;
  readonly messageId: string;
  readonly patchId: string;
  readonly draftId: string;
  readonly patch: LexFrameWorkflowPatch;
  readonly diff: WorkflowPatchDiff;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
}

export interface PolicyBlockedResponse {
  readonly status: "blocked_by_policy";
  readonly reasonCode: string;
  readonly message: string;
  readonly allowedActions: readonly string[];
  readonly policyReport: WorkflowPolicyReport;
}

export interface AiProcessingQueuedResponse {
  readonly status: "queued";
  readonly requestId: string;
}

export interface AiErrorResponse {
  readonly status: "error";
  readonly errorCode: string;
  readonly message: string;
}

export type AiChatResponse =
  | WorkflowDraftReadyResponse
  | ClarificationRequiredResponse
  | WorkflowPatchReadyResponse
  | PolicyBlockedResponse
  | AiProcessingQueuedResponse
  | AiErrorResponse;

export interface AiActionAvailability {
  readonly canSaveDraft: boolean;
  readonly canApplyPatch: boolean;
  readonly canOpenBuilder: boolean;
  readonly canRunDryRun: boolean;
  readonly missingPermissions: readonly PermissionCode[];
}
