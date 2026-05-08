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
  | "profile_snapshot";

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
  readonly sourceType: ProjectKnowledgeSourceType;
  readonly sourceId: string;
  readonly mode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly citationRequired: boolean;
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

export interface UpdateChatThreadRequest {
  readonly title?: string | null;
  readonly status?: ChatThreadStatus;
}

export interface CreateChatMessageRequest {
  readonly text: string;
  readonly parentMessageId?: string | null;
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
}

export interface ChatStreamSnapshot {
  readonly streamId: string;
  readonly workspaceId: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly status: "started" | "completed" | "failed" | "cancelled";
  readonly events: readonly ChatStreamEvent[];
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
