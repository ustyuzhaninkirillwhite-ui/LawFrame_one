import type {
  ActivepiecesRunEventCallback,
  ActivepiecesStepEventCallback,
  RecommendationCandidate,
  RunArtifact,
  RunSummary,
  SignedUrlRequest,
} from "./domain";
import type { ApprovalTaskSummary } from "./stage7";

export type RunLifecycleStatus =
  | "queued"
  | "created"
  | "precheck_failed"
  | "ready_to_start"
  | "starting"
  | "running"
  | "waiting_approval"
  | "waiting_delivery_approval"
  | "delivering"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "retrying"
  | "expired";

export type RunStepLifecycleStatus =
  | "queued"
  | "pending"
  | "skipped"
  | "running"
  | "waiting_approval"
  | "waiting_external_callback"
  | "completed"
  | "failed"
  | "failed_retryable"
  | "failed_permanent"
  | "cancelled";

export type RunAllowedAction =
  | "cancel"
  | "retry_run"
  | "retry_step"
  | "request_changes"
  | "approve_delivery"
  | "send_delivery"
  | "cancel_delivery"
  | "retry_delivery"
  | "open_artifact"
  | "accept_artifact_document";

export interface RunPreflightRequest {
  readonly profileId?: string | null;
  readonly inputs?: {
    readonly documentIds?: readonly string[];
    readonly params?: Record<string, unknown>;
  };
  readonly idempotencyKey?: string | null;
}

export interface RunPreflightCheck {
  readonly code: string;
  readonly label: string;
  readonly category:
    | "runtime"
    | "connection"
    | "profile"
    | "document"
    | "policy"
    | "approval";
  readonly status: "ready" | "warning" | "blocked";
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RunPreflightReport {
  readonly automationId: string;
  readonly canStart: boolean;
  readonly summary: string;
  readonly checks: readonly RunPreflightCheck[];
  readonly requiredInputs: readonly string[];
  readonly warnings: readonly string[];
  readonly missingConnectionCodes: readonly string[];
  readonly traceId: string;
}

export interface RunCreateRequest {
  readonly profileId?: string | null;
  readonly inputs?: {
    readonly documentIds?: readonly string[];
    readonly params?: Record<string, unknown>;
  };
  readonly idempotencyKey?: string | null;
}

export interface RunCreateResponse {
  readonly runId: string;
  readonly status: RunLifecycleStatus;
  readonly traceId: string;
  readonly allowedActions: readonly RunAllowedAction[];
  readonly runUrl: string;
}

export interface RunStepDetail {
  readonly id: string;
  readonly stepCode: string;
  readonly moduleCode: string;
  readonly status: RunStepLifecycleStatus;
  readonly requiresApproval: boolean;
  readonly outputs: Record<string, unknown>;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly attemptCount: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly lastEventAt: string | null;
}

export interface ApprovalTaskDetail extends ApprovalTaskSummary {
  readonly kind: "run_approval" | "delivery_approval" | "document_finalization";
  readonly deliveryRequestId: string | null;
  readonly requestedChangesCount: number;
  readonly expiresAt: string | null;
  readonly metadata: Record<string, unknown>;
}

export type DeliveryChannel = "email";

export type DeliveryRequestStatus =
  | "draft"
  | "waiting_approval"
  | "approved"
  | "queued"
  | "sending"
  | "sent"
  | "failed_retryable"
  | "failed_permanent"
  | "cancelled";

export interface DeliveryPreview {
  readonly channel: DeliveryChannel;
  readonly subject: string;
  readonly bodyPreview: string;
  readonly recipientEmails: readonly string[];
  readonly attachmentCount: number;
  readonly contentHash: string;
  readonly approvalRequired: boolean;
}

export interface DeliveryRequestSummary {
  readonly id: string;
  readonly workflowRunId: string;
  readonly approvalTaskId: string | null;
  readonly channel: DeliveryChannel;
  readonly title: string;
  readonly status: DeliveryRequestStatus;
  readonly recipientEmails: readonly string[];
  readonly attachmentArtifactIds: readonly string[];
  readonly contentHash: string;
  readonly requiresApproval: boolean;
  readonly approvedAt: string | null;
  readonly sentAt: string | null;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeliveryAttemptSummary {
  readonly id: string;
  readonly status:
    | "queued"
    | "sending"
    | "sent"
    | "failed_retryable"
    | "failed_permanent";
  readonly attemptNo: number;
  readonly provider: string;
  readonly errorCode: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
}

export interface DeliveryEventSummary {
  readonly id: string;
  readonly eventType: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface DeliveryRequestDetail extends DeliveryRequestSummary {
  readonly subject: string;
  readonly body: string;
  readonly metadata: Record<string, unknown>;
  readonly preview: DeliveryPreview;
  readonly attempts: readonly DeliveryAttemptSummary[];
  readonly events: readonly DeliveryEventSummary[];
}

export type ArtifactSignedUrlRequest = SignedUrlRequest;

export interface ArtifactAcceptAsDocumentResponse {
  readonly artifact: RunArtifact;
  readonly documentAccepted: true;
}

export interface NotificationSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string | null;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly severity: "info" | "success" | "warning" | "error";
  readonly priority: "low" | "normal" | "high" | "urgent";
  readonly actionUrl: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface RunSnapshot {
  readonly id: string;
  readonly automationId: string;
  readonly title: string;
  readonly status: RunLifecycleStatus;
  readonly traceId: string;
  readonly externalRunId: string | null;
  readonly currentStep: string;
  readonly progressPercent: number;
  readonly approvalState:
    | "not_required"
    | "pending"
    | "approved"
    | "rejected"
    | "changes_requested";
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly allowedActions: readonly RunAllowedAction[];
  readonly inputs: {
    readonly profileId: string | null;
    readonly documentIds: readonly string[];
    readonly params: Record<string, unknown>;
  } | null;
  readonly steps: readonly RunStepDetail[];
  readonly artifacts: readonly RunArtifact[];
  readonly approvalTasks: readonly ApprovalTaskDetail[];
  readonly deliveryRequests: readonly DeliveryRequestSummary[];
}

export interface RunLiveSnapshot extends RunSnapshot {
  readonly snapshotVersion: number;
  readonly liveTopics: readonly string[];
}

export interface NotificationAction {
  readonly label: string;
  readonly href: string;
  readonly kind: "open" | "approve" | "review" | "download";
}

export interface NotificationPreferences {
  readonly emailEnabled: boolean;
  readonly pushEnabled: boolean;
  readonly realtimeEnabled: boolean;
  readonly quietHours: Record<string, unknown>;
}

export interface DeviceRegistrationRequest {
  readonly deviceType: "web_push" | "ios" | "android";
  readonly deviceToken: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RegisteredDevice {
  readonly id: string;
  readonly deviceType: DeviceRegistrationRequest["deviceType"];
  readonly deviceToken: string;
  readonly metadata: Record<string, unknown>;
  readonly lastRegisteredAt: string;
}

export interface NotificationListQuery {
  readonly cursor?: string | null;
  readonly limit?: number;
  readonly status?: "all" | "unread" | "read";
  readonly type?: string | null;
}

export interface NotificationListResponse {
  readonly items: readonly NotificationSummary[];
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

export interface SystemStatusComponent {
  readonly code: string;
  readonly label: string;
  readonly status: "healthy" | "degraded" | "blocked";
  readonly summary: string;
  readonly checkedAt: string;
}

export interface SystemStatusSummary {
  readonly overall: "healthy" | "degraded" | "blocked";
  readonly summary: string;
  readonly checkedAt: string;
  readonly incidentsOpen: number;
  readonly components: readonly SystemStatusComponent[];
}

export interface DashboardSnapshot {
  readonly snapshotVersion: number;
  readonly generatedAt: string;
  readonly activeRuns: readonly RunSummary[];
  readonly failedRuns: readonly RunSummary[];
  readonly pendingApprovals: readonly ApprovalTaskSummary[];
  readonly recentArtifacts: readonly RunArtifact[];
  readonly recommendations: readonly RecommendationCandidate[];
  readonly unreadNotificationsCount: number;
  readonly systemStatus: SystemStatusSummary;
}

export interface DashboardEvent {
  readonly id: string;
  readonly sequenceId: number;
  readonly topic: string;
  readonly eventType: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

export interface DashboardEventListResponse {
  readonly snapshotVersion: number;
  readonly events: readonly DashboardEvent[];
  readonly nextSequence: number | null;
}

export interface ApprovalTaskRequestChangesRequest {
  readonly comment?: string | null;
}

export type RuntimeStepEventCallback = ActivepiecesStepEventCallback;

export type RuntimeRunEventCallback = ActivepiecesRunEventCallback;

export interface RuntimeApprovalGateCallback {
  readonly runId: string;
  readonly stepCode: string;
  readonly title: string;
  readonly approvalRouteId?: string | null;
  readonly approverUserId?: string | null;
  readonly approverRole?: string | null;
  readonly expiresAt?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface RuntimeDeliveryGateCallback {
  readonly runId: string;
  readonly title: string;
  readonly channel: DeliveryChannel;
  readonly subject: string;
  readonly body: string;
  readonly recipientEmails: readonly string[];
  readonly artifactIds?: readonly string[];
  readonly requiresApproval?: boolean;
  readonly metadata?: Record<string, unknown> | null;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}
