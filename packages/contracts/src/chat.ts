import type { PermissionCode } from "./permissions/permission-codes";

export type ChatThreadKind =
  | "general"
  | "project"
  | "document_review"
  | "automation_builder"
  | "run_support";

export type ChatThreadStatus = "active" | "archived" | "deleted";

export type ChatThreadVisibility = "private" | "workspace" | "project";

export type ChatMessageStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "redacted";

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export type ChatMessagePartType =
  | "text"
  | "markdown"
  | "attachment_ref"
  | "document_ref"
  | "legal_source_ref"
  | "tool_call"
  | "tool_result"
  | "evidence"
  | "route_snapshot"
  | "error"
  | "citation"
  | "context_summary";

export type ChatAttachmentMode =
  | "thread_attachment"
  | "project_knowledge"
  | "workspace_knowledge"
  | "full_context"
  | "focused_rag"
  | "summary_only"
  | "reference_only";

export type ProjectKnowledgeSourceType =
  | "document_version"
  | "legal_source"
  | "automation_snapshot"
  | "run_artifact"
  | "chat_summary"
  | "manual_note"
  | "profile_snapshot"
  | "web_search_result";

export type ChatDataClassification =
  | "public"
  | "internal"
  | "workspace_internal"
  | "confidential"
  | "client_material"
  | "legal_secret"
  | "personal_data";

export type ChatStreamEventType =
  | "message_start"
  | "run_status"
  | "text_delta"
  | "tool_call_start"
  | "tool_call_delta"
  | "tool_result"
  | "usage"
  | "route_snapshot"
  | "evidence"
  | "error"
  | "message_done";

export interface ChatRouteSnapshot {
  readonly route:
    | "default_chat"
    | "agent_general"
    | "rag_legal_summary"
    | "document_generation_assist"
    | "chat_title_generation";
  readonly provider: string;
  readonly model: string;
  readonly policyDecisionId: string;
  readonly keyFingerprint?: string | null;
  readonly keyFingerprintPrefix?: string | null;
  readonly traceId: string;
}

export interface ChatStreamEvent {
  readonly type: ChatStreamEventType;
  readonly payload: Record<string, unknown>;
}

export type ChatRunStatus =
  | "started"
  | "queued"
  | "thinking"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovering";

export type ChatAttachmentStatus =
  | "pending_upload"
  | "uploaded"
  | "attached"
  | "deleted"
  | "failed";

export interface ChatRunSummary {
  readonly runId: string;
  readonly streamId: string;
  readonly threadId: string;
  readonly messageId: string | null;
  readonly status: ChatRunStatus;
  readonly retryable: boolean;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly completedAt?: string | null;
}

export interface ChatBranchInfo {
  readonly branchId: string | null;
  readonly activeBranchId: string | null;
  readonly ordinal: number;
  readonly total: number;
  readonly canSwitch: boolean;
}

export interface ChatThreadSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly kind: ChatThreadKind;
  readonly visibility: ChatThreadVisibility;
  readonly status: ChatThreadStatus;
  readonly title: string;
  readonly lastMessagePreview: string | null;
  readonly currentBranchId: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

export interface ChatMessagePartDto {
  readonly id: string;
  readonly type: ChatMessagePartType;
  readonly text: string | null;
  readonly payload: Record<string, unknown>;
  readonly sequence: number;
}

export interface ChatMessageAttachmentDto {
  readonly id: string;
  readonly sourceType: ProjectKnowledgeSourceType | "uploaded_file";
  readonly sourceId: string;
  readonly mode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly citationRequired: boolean;
  readonly originalFilename?: string | null;
  readonly mimeType?: string | null;
  readonly sizeBytes?: number | null;
  readonly status?: ChatAttachmentStatus;
  readonly downloadPath?: string | null;
  readonly storageKey?: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface ChatMessageDto {
  readonly id: string;
  readonly threadId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly role: ChatMessageRole;
  readonly status: ChatMessageStatus;
  readonly parentMessageId: string | null;
  readonly clientMessageId?: string | null;
  readonly branchId?: string | null;
  readonly branchInfo?: ChatBranchInfo | null;
  readonly run?: ChatRunSummary | null;
  readonly createdBy: string | null;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly parts: readonly ChatMessagePartDto[];
  readonly attachments: readonly ChatMessageAttachmentDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectKnowledgeItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly sourceType: ProjectKnowledgeSourceType;
  readonly sourceId: string;
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly url?: string | null;
  readonly mode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly pinned: boolean;
  readonly enabledForChat: boolean;
  readonly citationRequired: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectKnowledgeListResponse {
  readonly items: readonly ProjectKnowledgeItem[];
}

export interface UpsertProjectKnowledgeItemRequest {
  readonly sourceType: ProjectKnowledgeSourceType;
  readonly sourceId: string;
  readonly mode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly pinned?: boolean;
  readonly enabledForChat?: boolean;
  readonly citationRequired?: boolean;
}

export interface ProjectWebSearchRequest {
  readonly query: string;
  readonly saveResults?: boolean;
  readonly maxResults?: number;
}

export interface ProjectWebSearchResult {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly sourceType: "web_search_result";
  readonly score?: number | null;
  readonly knowledgeItemId?: string | null;
  readonly createdAt?: string | null;
}

export interface ProjectWebSearchResponse {
  readonly provider: "tavily";
  readonly status: "ok" | "unconfigured" | "failed";
  readonly items: readonly ProjectWebSearchResult[];
  readonly error?: {
    readonly code: "provider_unconfigured" | "provider_failed" | "invalid_query";
    readonly message: string;
  } | null;
}

export interface ResourceAccessPolicy {
  readonly requiredPermissions?: readonly PermissionCode[];
  readonly allowedRoles?: readonly string[];
  readonly dataPolicy?: "default" | "redacted" | "reference_only";
}

export interface PromptVariable {
  readonly name: string;
  readonly label: string;
  readonly type: "text" | "long_text" | "document_ref" | "select" | "boolean";
  readonly required: boolean;
  readonly options?: readonly string[];
}

export interface LegalPromptTemplate {
  readonly id: string;
  readonly command: string;
  readonly title: string;
  readonly scope: "product" | "workspace" | "project" | "user";
  readonly variables: readonly PromptVariable[];
  readonly outputMode:
    | "chat_answer"
    | "document_draft"
    | "automation_blueprint_placeholder"
    | "checklist"
    | "risk_report"
    | "legal_summary";
  readonly version: string;
  readonly enabled: boolean;
  readonly accessPolicy: ResourceAccessPolicy;
}

export interface LegalSkill {
  readonly id: string;
  readonly title: string;
  readonly scope: "product" | "workspace" | "project" | "user";
  readonly kind:
    | "drafting_style"
    | "document_review"
    | "citation_policy"
    | "risk_analysis"
    | "automation_design"
    | "court_position"
    | "client_communication";
  readonly markdownInstructions: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly accessPolicy: ResourceAccessPolicy;
}

export interface CreateChatThreadRequest {
  readonly title?: string | null;
  readonly kind?: ChatThreadKind;
}

export interface ChatThreadListQuery {
  readonly scope?: "global" | "project";
  readonly projectId?: string | null;
}

export interface UpdateChatThreadRequest {
  readonly title?: string | null;
  readonly status?: ChatThreadStatus;
}

export interface CreateChatMessageRequest {
  readonly text: string;
  readonly parentMessageId?: string | null;
  readonly clientMessageId?: string | null;
  readonly branchId?: string | null;
  readonly attachmentIds?: readonly string[];
  readonly attachments?: readonly {
    readonly sourceType: ProjectKnowledgeSourceType;
    readonly sourceId: string;
    readonly mode?: ChatAttachmentMode;
  }[];
}

export interface ChatThreadResponse {
  readonly thread: ChatThreadSummary;
}

export interface ChatThreadListResponse {
  readonly items: readonly ChatThreadSummary[];
}

export interface ChatMessagesResponse {
  readonly items: readonly ChatMessageDto[];
  readonly latestRun?: ChatRunSummary | null;
}

export interface ChatStreamSnapshot {
  readonly streamId: string;
  readonly workspaceId: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly status: ChatRunStatus;
  readonly clientMessageId?: string | null;
  readonly userMessage?: ChatMessageDto | null;
  readonly assistantMessage?: ChatMessageDto | null;
  readonly run?: ChatRunSummary | null;
  readonly events: readonly ChatStreamEvent[];
}

export interface ChatAttachmentValidationError {
  readonly code:
    | "empty_file"
    | "unsupported_mime_type"
    | "unsupported_extension"
    | "file_too_large"
    | "unsafe_filename"
    | "duplicate_file";
  readonly message: string;
}

export interface ChatAttachmentUploadIntentRequest {
  readonly threadId: string;
  readonly files: readonly {
    readonly clientAttachmentId?: string | null;
    readonly filename: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly sha256?: string | null;
  }[];
}

export interface ChatAttachmentUploadIntent {
  readonly id: string;
  readonly clientAttachmentId?: string | null;
  readonly uploadUrl: string;
  readonly method: "PUT";
  readonly headers: Record<string, string>;
  readonly expiresAt: string;
  readonly attachment: ChatMessageAttachmentDto;
}

export interface ChatAttachmentUploadIntentResponse {
  readonly items: readonly ChatAttachmentUploadIntent[];
  readonly errors: readonly (ChatAttachmentValidationError & {
    readonly clientAttachmentId?: string | null;
    readonly filename?: string | null;
  })[];
}

export interface ChatAttachmentCompleteRequest {
  readonly threadId: string;
  readonly messageId?: string | null;
  readonly runId?: string | null;
  readonly sha256?: string | null;
}

export interface ChatAttachmentResponse {
  readonly attachment: ChatMessageAttachmentDto;
}

export interface ChatAttachmentDeleteResponse {
  readonly id: string;
  readonly status: "deleted";
}

export interface ChatAttachmentDownloadResponse {
  readonly id: string;
  readonly downloadUrl: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly expiresAt: string;
}

export interface ChatSearchResult {
  readonly thread: ChatThreadSummary;
  readonly messageId: string | null;
  readonly snippet: string | null;
  readonly classification: ChatDataClassification | null;
}

export interface ChatSearchResponse {
  readonly items: readonly ChatSearchResult[];
  readonly nextCursor: string | null;
}

export interface Stage19ReadinessResponse {
  readonly status: "ready" | "degraded" | "unavailable";
  readonly checks: Record<
    | "stage18_ai_gateway"
    | "default_chat_route"
    | "assistant_ui_dependency"
    | "chat_db"
    | "chat_api"
    | "chat_streaming"
    | "stream_resume"
    | "attachments"
    | "project_knowledge"
    | "context_assembler"
    | "chat_search"
    | "branching"
    | "prompt_library"
    | "legal_skills"
    | "browser_secret_scan"
    | "direct_provider_call_scan"
    | "cross_workspace_security"
    | "license_mit_only"
    | "reference_repos_checked"
    | "borrowed_elements_verified",
    {
      readonly status: "pass" | "degraded" | "fail" | "not_configured";
      readonly reason?: string;
    }
  >;
}
