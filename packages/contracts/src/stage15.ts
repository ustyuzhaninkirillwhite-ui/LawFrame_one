import type { AiChatSessionSummary, WorkflowDraftDetail } from "./ai";
import type {
  DocumentSummary,
  InstalledAutomationDetail,
  RecommendationCandidate,
  RunSummary,
} from "./domain";
import type { PermissionCode } from "./permissions/permission-codes";
import type { ApprovalTaskSummary } from "./stage7";
import type { DashboardSnapshot, SystemStatusSummary } from "./stage8";

export type Stage15ProjectStatus = "active" | "paused" | "archived";

export type Stage15UiStatus =
  | "draft"
  | "saved"
  | "autosaving"
  | "syncing"
  | "synced"
  | "conflict"
  | "validation_failed"
  | "runtime_unavailable"
  | "missing_connection"
  | "blocked_by_policy"
  | "permission_required";

export type Stage15BlockedReason =
  | "permission_required"
  | "feature_disabled"
  | "connection_required"
  | "runtime_unavailable"
  | "blocked_by_policy";

export interface Stage15BlockedState {
  readonly reason: Stage15BlockedReason;
  readonly title: string;
  readonly description: string;
  readonly requiredPermission?: PermissionCode;
  readonly actionLabel?: string;
  readonly actionHref?: string;
}

export interface Stage15ProjectCounters {
  readonly chats: number;
  readonly automations: number;
  readonly documents: number;
  readonly activeRuns: number;
  readonly pendingApprovals: number;
  readonly recommendations: number;
  readonly missingConnections: number;
}

export interface Stage15ProjectSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
  readonly status: Stage15ProjectStatus;
  readonly ownerUserId: string | null;
  readonly role: "owner" | "editor" | "viewer";
  readonly counters: Stage15ProjectCounters;
  readonly lastActivityAt: string;
}

export interface Stage15ProjectChatSummary {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: AiChatSessionSummary["status"];
  readonly lastMessagePreview: string;
  readonly selectedDocumentIds: readonly string[];
  readonly linkedAutomationId: string | null;
  readonly updatedAt: string;
}

export interface Stage15ProjectDetail extends Stage15ProjectSummary {
  readonly chats: readonly Stage15ProjectChatSummary[];
  readonly automations: readonly InstalledAutomationDetail[];
  readonly documents: readonly DocumentSummary[];
  readonly recentRuns: readonly RunSummary[];
  readonly pendingApprovals: readonly ApprovalTaskSummary[];
  readonly recommendations: readonly RecommendationCandidate[];
  readonly systemStatus: SystemStatusSummary;
}

export interface Stage15ProjectSnapshot extends DashboardSnapshot {
  readonly project: Stage15ProjectSummary;
  readonly recentChats: readonly Stage15ProjectChatSummary[];
  readonly projectAutomations: readonly InstalledAutomationDetail[];
  readonly projectDocuments: readonly DocumentSummary[];
}

export interface Stage15ProjectListResponse {
  readonly items: readonly Stage15ProjectSummary[];
}

export interface Stage15CreateProjectRequest {
  readonly name: string;
  readonly description?: string | null;
  readonly color?: string | null;
}

export interface Stage15ProjectCreatedResponse {
  readonly project: Stage15ProjectSummary;
}

export interface Stage15CreateProjectChatRequest {
  readonly title?: string | null;
  readonly source?: "project_chat" | "automation_chat" | "global_chat";
  readonly selectedDocumentIds?: readonly string[];
  readonly selectedTemplateIds?: readonly string[];
  readonly currentAutomationId?: string | null;
}

export interface Stage15ProjectChatCreatedResponse {
  readonly chat: Stage15ProjectChatSummary;
  readonly session: AiChatSessionSummary;
}

export interface Stage17CanvasEnsureResponse {
  readonly status: "ready" | "degraded";
  readonly readinessCode: string;
  readonly automationId: string;
  readonly projectId: string;
  readonly route: string;
  readonly activepiecesProjectId: string;
  readonly activepiecesFlowId: string;
  readonly activepiecesFlowVersionId: string;
}

export interface Stage17CanvasEnsureWireResponse {
  readonly status: "ready" | "degraded";
  readonly readiness_code: string;
  readonly automation_id: string;
  readonly project_id: string;
  readonly route: string;
  readonly activepieces_project_id: string;
  readonly activepieces_flow_id: string;
  readonly activepieces_flow_version_id: string;
}

export interface Stage15WorkflowDraftMaterializeRequest {
  readonly projectId: string;
  readonly title?: string | null;
  readonly openInBuilder?: boolean;
}

export interface Stage15WorkflowDraftMaterializeResponse {
  readonly draft: WorkflowDraftDetail;
  readonly automation: InstalledAutomationDetail;
  readonly automationUrl: string;
  readonly builderUrl: string;
}
