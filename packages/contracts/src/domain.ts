import type { DataClassification } from "./enums/data-classification";
import type {
  AiClarificationQuestion,
  LexFrameWorkflow,
  RuntimePlanPreview,
  WorkflowDraftDetail,
  WorkflowPolicyReport,
  WorkflowValidationReport,
} from "./ai";
import type { PermissionCode, RoleCode } from "./permissions/permission-codes";

export type ReadinessState =
  | "not_started"
  | "design_ready"
  | "contract_ready"
  | "backend_ready"
  | "frontend_ready"
  | "integration_ready"
  | "production_ready";

export type ReadinessProfile =
  | "local-basic"
  | "local-integrated"
  | "staging-rc"
  | "production";

export type ReadinessServiceCode =
  | "postgres"
  | "supabase-storage"
  | "backend"
  | "web"
  | "activepieces"
  | "redis"
  | "opensearch"
  | "delivery-sandbox"
  | "real-ai-provider"
  | "realtime";

export type ReadinessServiceState = "ready" | "degraded" | "blocked";

export type SessionState =
  | "unauthenticated"
  | "email_unconfirmed"
  | "needs_workspace"
  | "needs_mfa"
  | "ready";

export type WorkspaceStatus = "active" | "archived" | "suspended";

export interface ActorSummary {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly locale: string;
  readonly timezone: string;
  readonly onboardingStatus: "new" | "email_unconfirmed" | "ready";
}

export interface WorkspaceSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly role: RoleCode;
  readonly status: WorkspaceStatus;
}

export interface DataPolicy {
  readonly aiAllowed: boolean;
  readonly directSupabaseRead: boolean;
  readonly externalDeliveryRequiresApproval: boolean;
}

export interface SessionSecurityState {
  readonly mfaRequired: boolean;
  readonly ssoRequired: boolean;
  readonly sessionRisk: "low" | "medium" | "high";
  readonly adminActionsRequireReauth: boolean;
  readonly aiSensitiveDataPolicy:
    | "allow"
    | "zdr_or_block"
    | "private_only"
    | "block";
  readonly externalDeliveryRequiresApproval: boolean;
}

export interface SessionContext {
  readonly state: SessionState;
  readonly requestId: string;
  readonly actor: ActorSummary | null;
  readonly activeWorkspace: WorkspaceSummary | null;
  readonly workspaces: readonly WorkspaceSummary[];
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly PermissionCode[];
  readonly featureFlags: readonly string[];
  readonly dataPolicy: DataPolicy;
  readonly security: SessionSecurityState;
}

export interface WorkspaceMember {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly role: RoleCode;
  readonly status: "active" | "removed";
  readonly joinedAt: string;
  readonly lastActiveAt: string | null;
}

export interface WorkspaceInvitationDeliveryPreview {
  readonly acceptToken: string;
  readonly acceptUrl: string;
}

export interface WorkspaceInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: RoleCode;
  readonly status: "pending" | "accepted" | "revoked" | "expired";
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
  readonly deliveryMode: "mock";
  readonly deliveryPreview?: WorkspaceInvitationDeliveryPreview;
}

export interface RoleDefinition {
  readonly code: RoleCode;
  readonly label: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
}

export interface PermissionDefinition {
  readonly code: PermissionCode;
  readonly label: string;
  readonly description: string;
  readonly scope:
    | "workspace"
    | "profile"
    | "document"
    | "module"
    | "ai"
    | "automation"
    | "activepieces"
    | "approval"
    | "connection"
    | "moderation"
    | "recommendation"
    | "billing"
    | "audit";
  readonly highRisk: boolean;
}

export interface RolePermissionMatrix {
  readonly roles: readonly RoleDefinition[];
  readonly permissions: readonly PermissionDefinition[];
}

export interface SecurityAccountState {
  readonly userId: string;
  readonly email: string;
  readonly emailConfirmed: boolean;
  readonly assuranceLevel: "aal1" | "aal2";
  readonly mfaRequiredForAdminActions: boolean;
  readonly currentRoles: readonly RoleCode[];
  readonly activeSessionCount: number;
  readonly ssoRequired: boolean;
  readonly sessionRisk: "low" | "medium" | "high";
}

export interface AuditEventSummary {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUserId: string | null;
  readonly actorEmail: string | null;
  readonly workspaceId: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly result: "success" | "denied" | "error";
  readonly reasonCode: string | null;
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly eventCategory: string | null;
  readonly sessionId: string | null;
  readonly dataClass: DataClassification | null;
  readonly metadata: Record<string, unknown>;
}

export interface SecuritySessionSummary {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly deviceLabel: string | null;
  readonly authProvider: string | null;
  readonly mfaLevel: string | null;
  readonly riskScore: number;
  readonly riskLevel: "low" | "medium" | "high";
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
}

export interface WorkspaceSecuritySettings {
  readonly workspaceId: string;
  readonly requireMfaForAdmins: boolean;
  readonly requireMfaForAll: boolean;
  readonly allowedEmailDomains: readonly string[];
  readonly ssoRequired: boolean;
  readonly sessionMaxAgeMinutes: number;
  readonly idleTimeoutMinutes: number;
  readonly allowPersonalApiTokens: boolean;
  readonly aiSensitiveDataAllowed: boolean;
  readonly externalDeliveryRequiresApproval: boolean;
}

export interface ReauthChallenge {
  readonly id: string;
  readonly challengeType: "password" | "mfa" | "sso";
  readonly reason: string;
  readonly expiresAt: string;
  readonly verifiedAt: string | null;
  readonly token: string | null;
}

export interface CreateReauthChallengeRequest {
  readonly reason: string;
  readonly challengeType?: "password" | "mfa" | "sso";
}

export interface VerifyReauthChallengeRequest {
  readonly challengeId: string;
  readonly verificationCode: string;
}

export interface SecretInventoryItem {
  readonly id: string;
  readonly secretCode: string;
  readonly provider: string;
  readonly status:
    | "configured"
    | "missing"
    | "rotation_due"
    | "compromised"
    | "disabled";
  readonly backendOnly: boolean;
  readonly lastRotatedAt: string | null;
  readonly nextRotationDueAt: string | null;
  readonly usedBy: readonly string[];
  readonly lastUsedAt: string | null;
}

export interface WorkspaceSecuritySettingsUpdateRequest {
  readonly requireMfaForAdmins?: boolean;
  readonly requireMfaForAll?: boolean;
  readonly allowedEmailDomains?: readonly string[];
  readonly ssoRequired?: boolean;
  readonly sessionMaxAgeMinutes?: number;
  readonly idleTimeoutMinutes?: number;
  readonly allowPersonalApiTokens?: boolean;
  readonly aiSensitiveDataAllowed?: boolean;
  readonly externalDeliveryRequiresApproval?: boolean;
}

export interface RevokeSessionRequest {
  readonly reason?: string | null;
}

export interface SecretRotationRequest {
  readonly notes?: string | null;
}

export interface SecurityAlertUpdateRequest {
  readonly status: "acknowledged" | "resolved";
}

export interface SecurityIncidentUpdateRequest {
  readonly status?: "open" | "contained" | "resolved" | "closed";
  readonly incidentModeEnabled?: boolean;
  readonly assignedTo?: string | null;
}

export interface AuditExportRequest {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly category?: string | null;
  readonly format?: "jsonl" | "json";
}

export interface AuditExportResult {
  readonly format: "jsonl" | "json";
  readonly itemCount: number;
  readonly content: string;
}

export interface AiProviderPolicy {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly provider: string;
  readonly model: string;
  readonly allowedDataClasses: readonly DataClassification[];
  readonly requiresZdr: boolean;
  readonly requiresRedaction: boolean;
  readonly storePrompts: boolean;
  readonly maxTokens: number | null;
  readonly monthlyBudgetCents: number | null;
  readonly enabled: boolean;
}

export interface DocumentSecurityLabel {
  readonly documentId: string;
  readonly workspaceId: string;
  readonly dataClass: DataClassification;
  readonly containsLegalSecret: boolean;
  readonly containsPersonalData: boolean;
  readonly downloadRequiresReason: boolean;
  readonly incidentLocked: boolean;
  readonly retentionPolicyId: string | null;
}

export interface SecurityAlert {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ruleCode: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "acknowledged" | "resolved";
  readonly title: string;
  readonly description: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly createdAt: string;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
}

export interface SecurityIncident {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly title: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly status: "open" | "contained" | "resolved" | "closed";
  readonly incidentModeEnabled: boolean;
  readonly assignedTo: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ComplianceProcessingActivity {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly activityCode: string;
  readonly purpose: string;
  readonly legalBasis: string | null;
  readonly dataCategories: readonly string[];
  readonly recipientCategories: readonly string[];
  readonly retentionPolicyId: string | null;
  readonly ownerUserId: string | null;
}

export interface RetentionPolicy {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly code: string;
  readonly label: string;
  readonly retentionDays: number;
  readonly legalHoldEnabled: boolean;
}

export interface DsrRequest {
  readonly id: string;
  readonly userId: string | null;
  readonly workspaceId: string | null;
  readonly requestType: "export" | "delete" | "access" | "rectification";
  readonly status:
    | "pending"
    | "in_progress"
    | "completed"
    | "rejected"
    | "cancelled";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AccessReviewCampaign {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly status: "draft" | "active" | "completed";
  readonly dueAt: string | null;
  readonly createdAt: string;
}

export interface Stage11ReleaseGateSummary {
  readonly gateCode: string;
  readonly title: string;
  readonly severity: string;
  readonly required: boolean;
  readonly owner: string;
  readonly latestStatus: string | null;
}

export interface AdminSecurityOverview {
  readonly secrets: readonly SecretInventoryItem[];
  readonly openAlerts: number;
  readonly openIncidents: number;
  readonly releaseGates: readonly Stage11ReleaseGateSummary[];
  readonly criticalAlerts: readonly SecurityAlert[];
}

export interface ActivepiecesWorkspaceSecurityState {
  readonly workspaceId: string | null;
  readonly builderAdminAllowed: boolean;
  readonly sandboxRequired: boolean;
  readonly eventStreamingEnabled: boolean;
  readonly signingKeyConfigured: boolean;
  readonly tokenTtlSeconds: number;
  readonly piecesFilterType: string;
  readonly piecesTags: readonly string[];
  readonly incidentLockActive: boolean;
  readonly runtimeConnections: readonly RuntimeConnectionSummary[];
}

export interface ActivepiecesIntegrationDependencyStatus {
  readonly code:
    | "app"
    | "worker"
    | "redis"
    | "postgres"
    | "api-key"
    | "signing-key"
    | "simulate-mode"
    | "pieces-policy";
  readonly state: ReadinessServiceState;
  readonly summary: string;
  readonly inferred?: boolean;
  readonly details?: Record<string, unknown>;
}

export interface ActivepiecesIntegrationStatus {
  readonly instanceUrl: string;
  readonly simulateRuns: boolean;
  readonly canDispatchRealRuns: boolean;
  readonly piecesFilterType: "allowlist";
  readonly piecesTags: readonly string[];
  readonly smokePresetCodes: readonly string[];
  readonly dependencies: readonly ActivepiecesIntegrationDependencyStatus[];
}

export interface DeliveryIntegrationDependencyStatus {
  readonly code:
    | "transport"
    | "webhook-url"
    | "webhook-token"
    | "from-email"
    | "sandbox-receiver";
  readonly state: ReadinessServiceState;
  readonly summary: string;
  readonly inferred?: boolean;
  readonly details?: Record<string, unknown>;
}

export interface DeliverySandboxReceiverStatus {
  readonly baseUrl: string | null;
  readonly healthy: boolean;
  readonly captureCount: number | null;
  readonly lastCaptureId: string | null;
  readonly lastCaptureAt: string | null;
}

export interface DeliveryIntegrationStatus {
  readonly transport: "disabled" | "webhook";
  readonly canSend: boolean;
  readonly webhookUrlConfigured: boolean;
  readonly webhookHost: string | null;
  readonly webhookPath: string | null;
  readonly fromEmail: string;
  readonly sandbox: DeliverySandboxReceiverStatus;
  readonly dependencies: readonly DeliveryIntegrationDependencyStatus[];
}

export interface DeliverySandboxTestRequest {
  readonly subject?: string;
  readonly body?: string;
  readonly recipientEmails?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface DeliverySandboxTestResponse {
  readonly status: "accepted";
  readonly provider: string;
  readonly providerMessageId: string;
  readonly responsePayload: Record<string, unknown>;
  readonly sandbox: DeliverySandboxReceiverStatus;
}

export interface RetentionReportSummary {
  readonly policies: readonly RetentionPolicy[];
  readonly dsrRequestsOpen: number;
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly path: string;
  readonly requestId: string | null;
}

export interface CreateWorkspaceRequest {
  readonly name: string;
  readonly slug?: string;
}

export interface UpdateWorkspaceRequest {
  readonly name?: string;
  readonly status?: WorkspaceStatus;
}

export interface SwitchWorkspaceRequest {
  readonly workspaceId: string;
}

export interface CreateWorkspaceInvitationRequest {
  readonly email: string;
  readonly role: RoleCode;
  readonly expiresInDays?: number;
}

export interface AcceptWorkspaceInvitationRequest {
  readonly token: string;
}

export interface UpdateWorkspaceMemberRoleRequest {
  readonly role: RoleCode;
}

export type ModuleVersionStatus = "draft" | "published" | "deprecated";

export type TemplateVersionStatus = "draft" | "published" | "deprecated";

export type PublicationStatus =
  | "not_requested"
  | "submitted"
  | "approved"
  | "rejected"
  | "changes_requested";

export type RuntimeSyncState =
  | "not_requested"
  | "pending"
  | "synced"
  | "failed";

export type CompatibilityStatus =
  | "compatible"
  | "runtime_sync_pending"
  | "missing_requirements"
  | "policy_blocked";

export type TemplateRequirementKind =
  | "document"
  | "profile"
  | "connection"
  | "approval"
  | "permission";

export interface TemplateRequirement {
  readonly code: string;
  readonly label: string;
  readonly kind: TemplateRequirementKind;
  readonly description: string;
  readonly status: "ready" | "missing" | "blocked";
  readonly optional: boolean;
  readonly sourceDocumentId: string | null;
}

export interface LegalModuleIoSchema {
  readonly code: string;
  readonly label: string;
  readonly schema: Record<string, unknown>;
}

export interface LegalModuleVersionSummary {
  readonly id: string;
  readonly version: string;
  readonly status: ModuleVersionStatus;
  readonly validationStatus: "valid" | "invalid";
  readonly validationIssues: readonly string[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

export interface LegalModuleSummary {
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly riskLevel: "low" | "medium" | "high";
  readonly publishedVersion: string | null;
  readonly status: ModuleVersionStatus;
  readonly inputCodes: readonly string[];
  readonly outputCodes: readonly string[];
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly compatibilityStatus: CompatibilityStatus;
}

export interface LegalModuleDetail extends LegalModuleSummary {
  readonly versions: readonly LegalModuleVersionSummary[];
  readonly inputs: readonly LegalModuleIoSchema[];
  readonly outputs: readonly LegalModuleIoSchema[];
  readonly requirements: readonly TemplateRequirement[];
  readonly runtimeMapping: Record<string, unknown>;
  readonly examples: readonly string[];
}

export type AutomationTemplateOwner = "lexframe" | "workspace" | "public" | "private";

export type AutomationTemplateScope = "product" | "workspace" | "public" | "private";

export interface AutomationTemplateSummary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly status: "draft" | "ready" | "blocked";
  readonly owner: AutomationTemplateOwner;
  readonly scope: AutomationTemplateScope;
  readonly version: string;
  readonly readiness: ReadinessState;
  readonly requiredPermissions: readonly PermissionCode[];
  readonly moduleCodes: readonly string[];
  readonly description: string;
  readonly publicationStatus: PublicationStatus;
  readonly compatibilityStatus: CompatibilityStatus;
  readonly runtimeSyncState: RuntimeSyncState;
  readonly available: boolean;
  readonly disabledReason: string | null;
}

export type LibraryTemplateSummary = AutomationTemplateSummary;

export interface AutomationTemplateVersionSummary {
  readonly id: string;
  readonly version: string;
  readonly status: TemplateVersionStatus;
  readonly publicationStatus: PublicationStatus;
  readonly validationStatus: "valid" | "invalid";
  readonly validationIssues: readonly string[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly moduleCodes: readonly string[];
  readonly requiredInputs: readonly string[];
}

export interface AutomationTemplateDetail extends AutomationTemplateSummary {
  readonly versions: readonly AutomationTemplateVersionSummary[];
  readonly requirements: readonly TemplateRequirement[];
  readonly workflow: Record<string, unknown>;
  readonly sourceTemplateId: string | null;
  readonly sourceTemplateVersionId: string | null;
  readonly relatedTemplateIds: readonly string[];
  readonly editable: boolean;
}

export interface ValidateLegalModuleStepRequest {
  readonly moduleCode: string;
  readonly inputCodes: readonly string[];
  readonly outputCodes: readonly string[];
  readonly requiresApproval?: boolean;
}

export interface WorkflowValidationSummary {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

export interface CreateAutomationTemplateRequest {
  readonly code: string;
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly scope: Exclude<AutomationTemplateScope, "product" | "public">;
  readonly requiredPermissions: readonly PermissionCode[];
  readonly moduleCodes: readonly string[];
  readonly workflow: Record<string, unknown>;
  readonly requirements: readonly TemplateRequirement[];
  readonly sourceTemplateId?: string | null;
}

export interface UpdateAutomationTemplateRequest {
  readonly title?: string;
  readonly category?: string;
  readonly description?: string;
  readonly requiredPermissions?: readonly PermissionCode[];
}

export interface CreateAutomationTemplateVersionRequest {
  readonly version: string;
  readonly workflow: Record<string, unknown>;
  readonly requirements: readonly TemplateRequirement[];
}

export interface InstallAutomationTemplateRequest {
  readonly workspaceId?: string;
  readonly profileId?: string | null;
  readonly documentIds?: readonly string[];
  readonly connectionIds?: readonly string[];
  readonly approvalPolicy?: "manual" | "auto_with_gate";
}

export interface ForkAutomationTemplateRequest {
  readonly title?: string;
  readonly targetScope?: "workspace" | "private";
}

export interface SubmitPublicationRequest {
  readonly note?: string;
}

export interface InstalledAutomationDetail {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly workspaceId: string;
  readonly templateId: string;
  readonly sourceTemplateVersionId: string;
  readonly workflowState: "draft" | "compiled" | "execution_ready";
  readonly builderState: "unavailable" | "mock" | "ready";
  readonly syncState: RuntimeSyncState;
  readonly compatibilityStatus: CompatibilityStatus;
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly requiredInputs: readonly string[];
  readonly requirements: readonly TemplateRequirement[];
  readonly missingConnections: readonly string[];
  readonly nextGate: string;
  readonly runtimeProjectId: string | null;
  readonly runtimeFlowId: string | null;
  readonly syncHash: string | null;
  readonly lastSyncedAt: string | null;
  readonly requirementsSummary: {
    readonly ready: number;
    readonly missing: number;
    readonly blocked: number;
  };
  readonly canOpenBuilder: boolean;
  readonly canRun: boolean;
}

export interface CreateActivepiecesEmbedTokenRequest {
  readonly installedAutomationId: string;
  readonly purpose?: "builder" | "viewer";
}

export interface RuntimeConnectionSummary {
  readonly id: string;
  readonly code: string;
  readonly provider: string;
  readonly displayName: string;
  readonly scope: "workspace" | "predefined";
  readonly status: "connected" | "missing" | "error" | "revoked";
  readonly externalConnectionName: string | null;
  readonly lastCheckedAt: string | null;
  readonly usedByAutomationIds: readonly string[];
}

export interface UpsertRuntimeConnectionRequest {
  readonly code: string;
  readonly provider: string;
  readonly displayName?: string;
  readonly externalConnectionName?: string | null;
}

export interface RuntimePieceRequirement {
  readonly packageName: string;
  readonly stepCode: string;
  readonly status: "available" | "blocked";
}

export interface AutomationRuntimeRequirements {
  readonly automationId: string;
  readonly canOpenBuilder: boolean;
  readonly canRun: boolean;
  readonly builderState: InstalledAutomationDetail["builderState"];
  readonly syncState: RuntimeSyncState;
  readonly runtimeProjectId: string | null;
  readonly runtimeFlowId: string | null;
  readonly missingConnections: readonly RuntimeConnectionSummary[];
  readonly availableConnections: readonly RuntimeConnectionSummary[];
  readonly requiredPieces: readonly RuntimePieceRequirement[];
  readonly warnings: readonly string[];
}

export interface SyncAutomationRuntimeRequest {
  readonly versionId?: string | null;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}

export interface SyncAutomationRuntimeResponse {
  readonly status: "synced" | "noop" | "failed";
  readonly runtimeProjectId: string;
  readonly runtimeFlowId: string;
  readonly syncHash: string;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly warnings: readonly string[];
}

export interface StartAutomationRunRequest {
  readonly mode: "dry_run" | "full_run";
  readonly inputs?: {
    readonly documentIds?: readonly string[];
    readonly params?: Record<string, unknown>;
  };
  readonly profileId?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface StartAutomationRunResponse {
  readonly runId: string;
  readonly status: RunSummary["status"];
  readonly traceId: string;
  readonly externalRunId?: string | null;
  readonly dispatchMode?: "simulated" | "activepieces-api";
}

export interface ActivepiecesRunSmokeRequest {
  readonly automationId: string;
  readonly mode?: StartAutomationRunRequest["mode"];
}

export interface ActivepiecesRunSmokeResponse {
  readonly status: RunSummary["status"];
  readonly runId: string;
  readonly externalRunId: string | null;
  readonly artifactIds: readonly string[];
  readonly callbackReceiptSummary: {
    readonly received: number;
    readonly processed: number;
    readonly types: readonly string[];
  };
}

export interface ActivepiecesStepEventCallback {
  readonly runId: string;
  readonly externalRunId?: string | null;
  readonly stepCode: string;
  readonly moduleCode?: string | null;
  readonly eventType: "queued" | "running" | "completed" | "failed" | "waiting_approval";
  readonly outputs?: Record<string, unknown> | null;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  } | null;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface ActivepiecesRunEventCallback {
  readonly runId: string;
  readonly externalRunId?: string | null;
  readonly eventType: "queued" | "running" | "completed" | "failed" | "waiting_approval";
  readonly error?: {
    readonly code: string;
    readonly message: string;
  } | null;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}

export interface InstalledAutomationSourceDiff {
  readonly installedAutomationId: string;
  readonly sourceTemplateId: string;
  readonly sourceTemplateVersionId: string;
  readonly targetTemplateVersionId: string;
  readonly hasUpdates: boolean;
  readonly changedModuleCodes: readonly string[];
  readonly changedRequirementCodes: readonly string[];
  readonly summary: string;
}

export interface PublicationRequest {
  readonly id: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly workspaceId: string;
  readonly status: PublicationStatus;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewerUserId: string | null;
  readonly reviewNote: string | null;
  readonly publicTemplateId: string | null;
}

export interface ModerationDecision {
  readonly decision: "approve" | "reject" | "request_changes";
  readonly note: string;
}

export interface ApplyInstalledAutomationSourceUpdateRequest {
  readonly targetTemplateVersionId: string;
}

export type DocumentKind =
  | "case_material"
  | "evidence"
  | "legal_source"
  | "document_template"
  | "generated_document"
  | "draft_document"
  | "delivery_attachment"
  | "profile_clause"
  | "other";

export type DocumentStatus =
  | "upload_pending"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "archived"
  | "soft_deleted"
  | "hard_delete_pending";

export type DocumentSource =
  | "user_upload"
  | "automation_result"
  | "activepieces_artifact"
  | "ai_generated"
  | "template_library"
  | "profile_library"
  | "system_import";

export type DocumentObjectRole =
  | "original"
  | "preview_pdf"
  | "thumbnail"
  | "extracted_text"
  | "redacted_copy";

export type DocumentJobType =
  | "virus_scan"
  | "metadata_extract"
  | "text_extract"
  | "preview_generate"
  | "thumbnail_generate"
  | "index_prepare";

export type DocumentJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type DocumentScanStatus =
  | "not_started"
  | "queued"
  | "clean"
  | "infected"
  | "manual_review_required"
  | "not_configured";

export type DocumentPreviewStatus =
  | "not_started"
  | "queued"
  | "ready"
  | "failed";

export type DocumentExtractionStatus =
  | "not_started"
  | "queued"
  | "ready"
  | "failed"
  | "requires_ocr";

export type StorageState =
  | "private_bucket"
  | "signed_url_only"
  | "quarantined"
  | "draft";

export type UploadMethod = "direct" | "backend_proxy" | "service_ingest";

export interface DocumentVersionSummary {
  readonly id: string;
  readonly documentId: string;
  readonly versionNo: number;
  readonly status: DocumentStatus;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string | null;
  readonly storageState: StorageState;
  readonly scanStatus: DocumentScanStatus;
  readonly previewStatus: DocumentPreviewStatus;
  readonly extractionStatus: DocumentExtractionStatus;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface DocumentStorageObject {
  readonly id: string;
  readonly versionId: string;
  readonly role: DocumentObjectRole;
  readonly mimeType: string;
  readonly sizeBytes: number | null;
  readonly status: StorageState;
  readonly createdAt: string;
}

export interface DocumentRelation {
  readonly id: string;
  readonly relationType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
  readonly createdAt: string;
}

export interface DocumentRelationInput {
  readonly relationType: string;
  readonly targetEntityType: string;
  readonly targetEntityId: string;
}

export interface DocumentProcessingJob {
  readonly id: string;
  readonly versionId: string;
  readonly jobType: DocumentJobType;
  readonly status: DocumentJobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: DocumentKind;
  readonly status: DocumentStatus;
  readonly classification: DataClassification;
  readonly source: DocumentSource;
  readonly tags: readonly string[];
  readonly currentVersion: DocumentVersionSummary | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

export interface DocumentDetail extends DocumentSummary {
  readonly versions: readonly DocumentVersionSummary[];
  readonly storageObjects: readonly DocumentStorageObject[];
  readonly relations: readonly DocumentRelation[];
  readonly processingJobs: readonly DocumentProcessingJob[];
  readonly availableActions: {
    readonly canUploadVersion: boolean;
    readonly canDelete: boolean;
    readonly canRestore: boolean;
    readonly canManageTemplate: boolean;
    readonly canRequestSignedUrl: boolean;
  };
}

export interface DocumentListResponse {
  readonly items: readonly DocumentSummary[];
  readonly nextCursor: string | null;
}

export interface DocumentListQuery {
  readonly q?: string;
  readonly kind?: DocumentKind;
  readonly status?: DocumentStatus;
  readonly classification?: DataClassification;
  readonly tag?: string;
  readonly cursor?: string;
}

export interface DocumentUploadIntentRequest {
  readonly title: string;
  readonly description?: string;
  readonly kind: DocumentKind;
  readonly classification: DataClassification;
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly tags?: readonly string[];
  readonly relations?: readonly DocumentRelationInput[];
}

export interface CreateDocumentVersionUploadIntentRequest {
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface DocumentUploadIntentResponse {
  readonly documentId: string;
  readonly versionId: string;
  readonly bucket: string;
  readonly storagePath: string;
  readonly uploadMethod: UploadMethod;
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
  readonly expiresAt: string;
}

export interface CompleteUploadRequest {
  readonly clientReportedSize: number;
  readonly clientReportedMimeType: string;
  readonly sha256?: string | null;
}

export interface SignedUrlRequest {
  readonly versionId?: string;
  readonly objectRole: DocumentObjectRole;
  readonly purpose: "download" | "preview";
  readonly expiresInSeconds?: number;
  readonly reason?: string | null;
  readonly acknowledgeClassificationWarning?: boolean;
}

export interface SignedUrlResponse {
  readonly documentId: string;
  readonly versionId: string;
  readonly objectRole: DocumentObjectRole;
  readonly signedUrl: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
  readonly dataClass?: DataClassification;
  readonly reasonLogged?: boolean;
}

export interface DocumentMutationResult {
  readonly status: "archived" | "restored" | "deleted";
  readonly documentId: string;
}

export interface RunArtifact {
  readonly id: string;
  readonly workflowRunId: string;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly artifactType: string;
  readonly title: string;
  readonly mimeType: string;
  readonly source: DocumentSource;
  readonly createdAt: string;
}

export interface CreateRunArtifactRequest {
  readonly artifactType: string;
  readonly title: string;
  readonly mimeType: string;
  readonly classification: DataClassification;
  readonly source: DocumentSource;
  readonly sourceDocumentId?: string;
}

export type DocumentRecord = DocumentSummary;

export interface RunSummary {
  readonly id: string;
  readonly automationId: string;
  readonly title: string;
  readonly status:
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
  readonly currentStep: string;
  readonly progressPercent: number;
  readonly traceId: string;
  readonly externalRunId: string | null;
  readonly stepStatus: readonly {
    readonly stepCode: string;
    readonly moduleCode: string;
    readonly status:
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
    readonly requiresApproval: boolean;
    readonly errorCode: string | null;
  }[];
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly errorCode: string | null;
  readonly artifactRefs: readonly string[];
  readonly approvalState:
    | "not_required"
    | "pending"
    | "approved"
    | "rejected"
    | "changes_requested";
}

export type RecommendationScope = "personal" | "team";

export type RecommendationRiskLevel = "low" | "medium" | "high";

export type RecommendationStatus =
  | "candidate"
  | "accepted"
  | "dismissed"
  | "snoozed";

export type RecommendationActionCode =
  | "accept"
  | "dismiss"
  | "snooze"
  | "feedback";

export type RecommendationPatternStrategy =
  | "n_gram"
  | "exact_variant"
  | "prefixspan"
  | "markov"
  | "pm4py";

export type RecommendationFeedbackType =
  | "helpful"
  | "not_helpful"
  | "already_covered"
  | "too_risky"
  | "not_relevant";

export interface RecommendationPatternSummary {
  readonly id: string;
  readonly scope: RecommendationScope;
  readonly title: string;
  readonly strategy: RecommendationPatternStrategy;
  readonly activitySequence: readonly string[];
  readonly caseCount: number;
  readonly distinctUserCount: number;
  readonly repeatCount: number;
  readonly periodDays: number;
  readonly riskLevel: RecommendationRiskLevel;
  readonly explainabilitySummary: string;
  readonly overlapStatus:
    | "none"
    | "existing_automation"
    | "installed_template"
    | "suppressed";
  readonly status: "candidate" | "suppressed" | "accepted" | "archived";
  readonly lastSeenAt: string;
}

export interface ProcessCaseSummary {
  readonly id: string;
  readonly scope: RecommendationScope;
  readonly caseKey: string;
  readonly processInstanceId: string | null;
  readonly sessionId: string | null;
  readonly traceId: string | null;
  readonly runId: string | null;
  readonly actorIds: readonly string[];
  readonly activitySequence: readonly string[];
  readonly eventCount: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly status: "completed" | "in_progress" | "failed" | "abandoned";
}

export interface RecommendationQualityMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: "count" | "percent" | "minutes";
  readonly window: "24h" | "7d" | "30d";
  readonly warning: boolean;
}

export interface RecommendationQualitySnapshot {
  readonly capturedAt: string;
  readonly metrics: readonly RecommendationQualityMetric[];
  readonly miningLagMinutes: number;
  readonly quarantineRatePercent: number;
  readonly missingTraceRatePercent: number;
}

export interface RecommendationListItem {
  readonly id: string;
  readonly patternId: string;
  readonly scope: RecommendationScope;
  readonly title: string;
  readonly summary: string;
  readonly rationale: string;
  readonly activitySequence: readonly string[];
  readonly sourceEvents: readonly string[];
  readonly advisoryOnly: true;
  readonly riskLevel: RecommendationRiskLevel;
  readonly repeatCount: number;
  readonly periodDays: number;
  readonly estimatedTimeSavedMinutes: number;
  readonly explainabilitySummary: string;
  readonly warnings: readonly string[];
  readonly availableActions: readonly RecommendationActionCode[];
  readonly status: RecommendationStatus;
  readonly snoozedUntil: string | null;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type RecommendationCandidate = RecommendationListItem;

export interface RecommendationFeedbackEntry {
  readonly id: string;
  readonly actorUserId: string;
  readonly feedbackType: RecommendationFeedbackType;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface RecommendationDetail extends RecommendationListItem {
  readonly pattern: RecommendationPatternSummary;
  readonly workflowSkeleton: LexFrameWorkflow;
  readonly validationReport: WorkflowValidationReport;
  readonly policyReport: WorkflowPolicyReport;
  readonly runtimePlanPreview: RuntimePlanPreview;
  readonly missingInputs: readonly AiClarificationQuestion[];
  readonly sourceTraceIds: readonly string[];
  readonly similarTemplateIds: readonly string[];
  readonly feedbackHistory: readonly RecommendationFeedbackEntry[];
}

export interface RecommendationPatternModuleMapping {
  readonly activityCode: string;
  readonly moduleCode: string;
  readonly confidence: number;
  readonly resolution:
    | "deterministic"
    | "profile_hint"
    | "template_hint"
    | "manual_input";
}

export interface RecommendationPatternDetail
  extends RecommendationPatternSummary {
  readonly qualitySnapshot: RecommendationQualitySnapshot;
  readonly exampleCases: readonly ProcessCaseSummary[];
  readonly moduleMapping: readonly RecommendationPatternModuleMapping[];
  readonly warnings: readonly string[];
}

export interface RecommendationAcceptRequest {
  readonly templatePreference?: "private_automation" | "workspace_template";
  readonly draftTitle?: string;
  readonly idempotencyKey?: string | null;
}

export interface RecommendationDismissRequest {
  readonly reasonCode?: string | null;
  readonly note?: string | null;
  readonly suppressPattern?: boolean;
}

export interface RecommendationSnoozeRequest {
  readonly until?: string | null;
  readonly days?: number | null;
}

export interface RecommendationFeedbackRequest {
  readonly feedbackType: RecommendationFeedbackType;
  readonly note?: string | null;
}

export interface RecommendationActionResult {
  readonly recommendationId: string;
  readonly status: RecommendationStatus;
  readonly draftId: string | null;
  readonly workflowDraft: WorkflowDraftDetail | null;
  readonly notificationId: string | null;
  readonly snoozedUntil: string | null;
  readonly message: string;
}

export type ProductEventSource =
  | "frontend"
  | "backend"
  | "workflow_runtime"
  | "analytics";

export interface ProductEventCaptureRequest {
  readonly eventName: string;
  readonly eventTime: string;
  readonly sessionId: string;
  readonly traceId: string;
  readonly workspaceId: string;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
  readonly processInstanceId?: string | null;
  readonly runId?: string | null;
  readonly properties: Record<string, unknown>;
  readonly clientEventId?: string | null;
  readonly idempotencyKey?: string | null;
  readonly source?: ProductEventSource;
}

export interface ProductEventCaptureResponse {
  readonly status: "queued" | "quarantined";
  readonly eventId: string;
  readonly outboxId: string | null;
  readonly quarantineId: string | null;
  readonly traceId: string;
}

export interface ReadinessGate {
  readonly stage: string;
  readonly state: ReadinessState;
  readonly blockers: readonly string[];
  readonly owner: string;
  readonly linkedContracts: readonly string[];
  readonly linkedTests: readonly string[];
}

export interface ReadinessServiceStatus {
  readonly service: ReadinessServiceCode;
  readonly state: ReadinessServiceState;
  readonly required: boolean;
  readonly summary: string;
  readonly blockers: readonly string[];
  readonly diagnostics: Record<string, unknown>;
}

export interface ReadinessServiceSummary {
  readonly total: number;
  readonly ready: number;
  readonly degraded: number;
  readonly blocked: number;
}

export interface ReadinessSummaryResponse {
  readonly gates: readonly ReadinessGate[];
  readonly profile: ReadinessProfile;
  readonly allowReadinessGateBlocked: boolean;
  readonly contractSatisfied: boolean;
  readonly serviceSummary: ReadinessServiceSummary;
  readonly workflowDsl: Record<string, unknown>;
  readonly aiGateway: Record<string, unknown>;
  readonly audit: Record<string, unknown>;
}

export interface ReadinessDetailsResponse extends ReadinessSummaryResponse {
  readonly effectiveProfile: ReadinessProfile;
  readonly serviceStatuses: readonly ReadinessServiceStatus[];
  readonly blockedReasons: readonly string[];
  readonly diagnostics: {
    readonly env: Record<string, unknown>;
    readonly runtime: Record<string, unknown>;
  };
}

export interface ActivepiecesEmbedTokenResponse {
  readonly instanceUrl: string;
  readonly token: string;
  readonly expiresAt: string;
  readonly role: "builder" | "viewer";
  readonly piecesFilterType: "allowlist";
  readonly piecesTags: readonly string[];
  readonly runtimeProjectId: string | null;
  readonly runtimeFlowId: string | null;
  readonly mode: "embedded-builder";
}
