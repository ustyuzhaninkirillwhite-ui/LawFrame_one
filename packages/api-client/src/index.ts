import type {
  AccessReviewCampaign,
  ActivepiecesAiTestPolicyWire,
  ActivepiecesCanvasReadinessResponse,
  ActivepiecesCanvasReadinessWireResponse,
  ActivepiecesIntegrationStatus,
  ActivepiecesRunSmokeRequest,
  ActivepiecesRunSmokeResponse,
  ActivepiecesSessionResponse,
  ActivepiecesSessionDiagnosticsWire,
  ActivepiecesSessionWarningWire,
  ActivepiecesSessionWireResponse,
  ActivepiecesWorkspaceSecurityState,
  AiChatMessageSummary,
  AiChatResponse,
  AiChatSessionSummary,
  AiProviderPolicy,
  AiRedactionPreviewRequest,
  AiRedactionPreviewResponse,
  AiRequestEvent,
  AiRequestSummary,
  AdminSecurityOverview,
  CreateAiChatMessageRequest,
  CreateAiChatSessionRequest,
  CreateReauthChallengeRequest,
  CreateWorkflowDraftRequest,
  CreateWorkflowPatchRequest,
  CanvasDraftResponse,
  CanvasDraftOpenResponse,
  CanvasDraftRequest,
  CanvasBindingValidationResponse,
  CanvasCompatibilityCheckRequest,
  CanvasCompatibilityCheckResponse,
  CanvasConnectionRequestResponse,
  CanvasConnectionRequirementsResponse,
  CanvasIoResponse,
  CanvasLockState,
  CanvasModuleCatalogResponse,
  CanvasModuleDetail,
  CanvasModuleSummary,
  CanvasOperationRequest,
  CanvasOperationPreviewRequest,
  CanvasOperationPreviewResponse,
  CanvasOperationResponse,
  CanvasPresentationMode,
  CanvasPresentationModel,
  CanvasApplySuggestedFixRequest,
  CanvasApplySuggestedFixResponse,
  CanvasAiExplanationResponse,
  CanvasAiMessageRequest,
  CanvasAiMessageResponse,
  CanvasAiPatchApplyRequest,
  CanvasAiPatchApplyResponse,
  CanvasAiPatchProposal,
  CanvasAiPatchProposalResponse,
  CanvasAiPatchRejectRequest,
  CanvasAiPatchRejectResponse,
  CanvasAiTestPlanResponse,
  CanvasPublishRequest,
  CanvasPublishResponse,
  CanvasPublishValidateResponse,
  CanvasRollbackImpactResponse,
  CanvasRollbackRequest,
  CanvasRollbackResponse,
  CanvasRuntimeProjectionVersion,
  CanvasVersionCompareResponse,
  CanvasVersionExportResponse,
  CanvasVersionStateResponse,
  CanvasPinnedDataResponse,
  CanvasSampleOutputResponse,
  CanvasSourcesResponse,
  CanvasSnapshotRequest,
  CanvasSnapshotResponse,
  CanvasRestoreVersionResponse,
  CanvasAuditExportResponse,
  CanvasAuditHashChainStatusResponse,
  CanvasAuditListResponse,
  CanvasPolicyOverrideDecisionRequest,
  CanvasPolicyOverrideRequest,
  CanvasSecurityCheckRequest,
  CanvasSecurityContext,
  CanvasSecurityPolicy,
  CanvasStepConfigValidationRequest,
  CanvasStepConfigValidationResponse,
  CanvasSuggestionApplyResponse,
  CanvasTestArtifactSummary,
  CanvasTestRunRequest,
  CanvasTestRunResponse,
  CanvasTestRunStepSummary,
  CanvasTestSupportBundle,
  CanvasVersionsResponse,
  CompileReport,
  CompileReportsResponse,
  CompileRequest,
  CompileResponse,
  RuntimeBindingDto,
  RuntimeDriftResponse,
  RuntimeImportApplyRequest,
  RuntimeImportApplyResponse,
  RuntimeImportPreviewRequest,
  RuntimeImportPreviewResponse,
  RuntimeImportRejectRequest,
  RuntimeImportRejectResponse,
  RuntimeOverwriteRequest,
  RuntimeOverwriteResponse,
  RuntimePullRequest,
  RuntimePullResponse,
  RuntimeSnapshotResponse,
  RuntimeSyncStatusResponse,
  RuntimeSyncRequest,
  StepInspectorDto,
  StepInputBinding,
  StepTestRequest,
  StepTestResultDto,
  CanvasValidateRequest,
  CanvasValidationIssueExplanation,
  CanvasValidationResult,
  ChatMessagesResponse,
  ChatSearchResponse,
  ChatStreamSnapshot,
  ChatThreadResponse,
  CreateChatMessageRequest,
  ProjectKnowledgeItem,
  ProjectKnowledgeListResponse,
  UpdateChatThreadRequest,
  UpsertProjectKnowledgeItemRequest,
  NoCodeSuggestion,
  UpdateWorkflowDraftInputsRequest,
  WorkflowDraftDetail,
  WorkflowDraftSummary,
  AcceptWorkspaceInvitationRequest,
  AutomationRuntimeRequirements,
  ActivepiecesEmbedTokenResponse,
  ApprovalRouteDetail,
  ApprovalRouteSummary,
  ApprovalTaskDetail,
  ApprovalTaskDecisionRequest,
  ApprovalTaskRequestChangesRequest,
  ApprovalTaskSummary,
  ApplyInstalledAutomationSourceUpdateRequest,
  ArtifactAcceptAsDocumentResponse,
  ArtifactSignedUrlRequest,
  AutomationTemplateDetail,
  AutomationTemplateVersionSummary,
  ClauseLibraryItemSummary,
  CreateApprovalRouteRequest,
  CreateActivepiecesEmbedTokenRequest,
  CreateActivepiecesSessionRequest,
  CreateActivepiecesSessionWireRequest,
  InitializeActivepiecesSessionRequest,
  InitializeActivepiecesSessionResponse,
  InitializeActivepiecesSessionWireResponse,
  InitializeActivepiecesSessionWireRequest,
  RecordActivepiecesIframeHealthRequest,
  RecordActivepiecesIframeHealthResponse,
  RecordActivepiecesIframeHealthWireRequest,
  RecordActivepiecesIframeHealthWireResponse,
  CreateAutomationTemplateRequest,
  CreateAutomationTemplateVersionRequest,
  CreateClauseLibraryItemRequest,
  CreateDocumentStructureRequest,
  CreateDocumentTemplateRequest,
  CreateDocumentTypeRequest,
  CreateLegalImportJobRequest,
  CreateLegalWorkProfileRequest,
  CreatePhraseRuleRequest,
  CreateProfileImportJobRequest,
  AuditEventSummary,
  AuditExportRequest,
  AuditExportResult,
  ComplianceProcessingActivity,
  CompleteUploadRequest,
  CreateDocumentVersionUploadIntentRequest,
  CreateRunArtifactRequest,
  CreateWorkspaceInvitationRequest,
  CreateWorkspaceRequest,
  DashboardEventListResponse,
  DashboardSnapshot,
  DeviceRegistrationRequest,
  DocumentDetail,
  DocumentGenerationJobDetail,
  DocumentGenerationPreviewRequest,
  DeliveryPreview,
  DeliveryIntegrationStatus,
  DeliveryRequestDetail,
  DeliverySandboxTestRequest,
  DeliverySandboxTestResponse,
  DocumentListQuery,
  DocumentListResponse,
  DocumentMutationResult,
  DocumentStructureRecord,
  DocumentTemplateDetail,
  DocumentTypeDetail,
  DocumentTypeSummary,
  DocumentValidationReportDetail,
  DocumentUploadIntentRequest,
  DocumentUploadIntentResponse,
  DocumentVersionSummary,
  DsrRequest,
  EffectiveProfilePreview,
  EffectiveProfileSnapshotSummary,
  FinalizeDocumentGenerationRequest,
  ForkAutomationTemplateRequest,
  InstalledAutomationDetail,
  InstalledAutomationSourceDiff,
  InstallAutomationTemplateRequest,
  LegalImportJob,
  LegalSearchQuery,
  LegalSearchResponse,
  LegalSourceDetail,
  LegalSourceSummary,
  LegalWorkProfileDetail,
  LegalWorkProfileVersionSummary,
  RagAnalyzeRequest,
  RagRequestSummary,
  LegalModuleDetail,
  LegalModuleSummary,
  LibraryTemplateSummary,
  ModerationDecision,
  NotificationSummary,
  NotificationListQuery,
  NotificationListResponse,
  PermissionDefinition,
  ParseDocumentTemplatePlaceholdersResponse,
  PhraseRuleSummary,
  PreviewEffectiveProfileRequest,
  ProfileImportJobSummary,
  ProfileValidationResult,
  PublicationRequest,
  PublishDocumentTemplateVersionRequest,
  ProductEventCaptureRequest,
  ProductEventCaptureResponse,
  ReadinessDetailsResponse,
  RecheckDocumentValidationRequest,
  ReadinessGate,
  ReadinessSummaryResponse,
  Stage18ReadinessResponse,
  Stage20ReadinessResponse,
  AutomationBlueprint,
  AutomationBlueprintValidationSummary,
  AutomationBuilderSessionResponse,
  AutomationCanvasDraftResponse,
  AutomationClarificationAnswerRequest,
  AutomationClarificationAnswerResponse,
  AutomationCompilePreviewResponse,
  AutomationContextPreviewResponse,
  AutomationIntentResponse,
  AutomationModuleCatalogResponse,
  AutomationModuleResolveResponse,
  AutomationPlanResponse,
  AutomationRuntimeDraftResponse,
  AutomationSecurityPreflightResponse,
  CreateAutomationIntentRequest,
  UpdateAutomationIntentRequest,
  ReauthChallenge,
  RecommendationAcceptRequest,
  RecommendationActionResult,
  RecommendationCandidate,
  RecommendationDetail,
  RecommendationDismissRequest,
  RecommendationFeedbackRequest,
  RecommendationPatternDetail,
  RecommendationPatternSummary,
  RecommendationSnoozeRequest,
  RetentionPolicy,
  RetentionReportSummary,
  RevokeSessionRequest,
  ProcessCaseSummary,
  RestoreLegalWorkProfileVersionRequest,
  RoleDefinition,
  RuntimeConnectionSummary,
  RunCreateRequest,
  RunCreateResponse,
  RunArtifact,
  RunLiveSnapshot,
  RunPreflightReport,
  RunPreflightRequest,
  RunSnapshot,
  RunSummary,
  RegisteredDevice,
  SecretInventoryItem,
  SecretRotationRequest,
  SecurityAccountState,
  SecurityAlert,
  SecurityAlertUpdateRequest,
  SecurityIncident,
  SecurityIncidentUpdateRequest,
  SecuritySessionSummary,
  SessionContext,
  SignedUrlRequest,
  SignedUrlResponse,
  StartAutomationRunRequest,
  Stage15CreateProjectRequest,
  Stage15CreateProjectChatRequest,
  Stage15ProjectCreatedResponse,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage17CanvasEnsureResponse,
  Stage15WorkflowDraftMaterializeRequest,
  Stage15WorkflowDraftMaterializeResponse,
  StartAutomationRunResponse,
  SubmitPublicationRequest,
  SyncAutomationRuntimeRequest,
  SyncAutomationRuntimeResponse,
  SwitchWorkspaceRequest,
  SystemStatusSummary,
  UpdateApprovalRouteRequest,
  UpdateClauseLibraryItemRequest,
  UpdateDocumentStructureRequest,
  UpdateDocumentTemplateRequest,
  UpdateDocumentTypeRequest,
  UpdateLegalWorkProfileDraftRequest,
  UpdatePhraseRuleRequest,
  UpsertRuntimeConnectionRequest,
  UpdateAutomationTemplateRequest,
  UpdateWorkspaceMemberRoleRequest,
  UpdateWorkspaceRequest,
  ValidateLegalModuleStepRequest,
  VerifyReauthChallengeRequest,
  WorkflowRuntimeApprovalRequestExecuteRequest,
  WorkflowRuntimeDocumentTemplateExecuteRequest,
  WorkflowRuntimeDocumentValidationExecuteRequest,
  WorkflowValidationSummary,
  WorkspaceSecuritySettings,
  WorkspaceSecuritySettingsUpdateRequest,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary,
} from "@lexframe/contracts";
import type {
  CanvasBlockDefinition,
  CanvasBlockValidationResult,
  CanvasConnectionValidationResult,
  CanvasEdgeType,
  CanvasHandleCode,
  CanvasRuntimeMapping,
} from "@lexframe/workflow-dsl";
import {
  buildQueryString,
  requestJson,
  withJsonBody,
  type FetchOptions,
} from "./core";
import { createChatClient } from "./chat-client";
import { createSettingsClient, type SettingsApi } from "./settings-client";
import { createStage15Client } from "./stage15-client";

export { ApiClientError } from "./core";
export type { FetchOptions } from "./core";
export type { ChatApi } from "./chat-client";
export type { SettingsApi } from "./settings-client";
export type { Stage15Api } from "./stage15-client";

export interface CanvasBlockSchemaResponse {
  readonly code: string;
  readonly kind: CanvasBlockDefinition["kind"];
  readonly inputSchema: CanvasBlockDefinition["inputSchema"];
  readonly outputSchema: CanvasBlockDefinition["outputSchema"];
  readonly configSchema: CanvasBlockDefinition["configSchema"];
  readonly handles: CanvasBlockDefinition["handles"];
  readonly validationRules: CanvasBlockDefinition["validationRules"];
}

export interface ValidateCanvasBlockRequest {
  readonly blockCode: string;
  readonly targetNodeId?: string;
  readonly config?: Record<string, unknown>;
  readonly bindings?: readonly StepInputBinding[];
  readonly hasApprovalPath?: boolean;
}

export interface ValidateCanvasConnectionRequest {
  readonly sourceBlockCode: string;
  readonly sourceHandle: CanvasHandleCode;
  readonly targetBlockCode: string;
  readonly targetHandle: CanvasHandleCode;
  readonly edgeType?: CanvasEdgeType;
  readonly hasApprovalPath?: boolean;
}

export interface ApiClient extends SettingsApi {
  bootstrapAuth(): Promise<{ readonly status: "ok" }>;
  getSessionContext(): Promise<SessionContext>;
  createWorkspace(input: CreateWorkspaceRequest): Promise<WorkspaceSummary>;
  listWorkspaces(): Promise<readonly WorkspaceSummary[]>;
  getWorkspace(workspaceId: string): Promise<WorkspaceSummary>;
  updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceRequest,
  ): Promise<WorkspaceSummary>;
  switchWorkspace(input: SwitchWorkspaceRequest): Promise<SessionContext>;
  listWorkspaceMembers(
    workspaceId: string,
  ): Promise<readonly WorkspaceMember[]>;
  changeWorkspaceMemberRole(
    workspaceId: string,
    memberId: string,
    input: UpdateWorkspaceMemberRoleRequest,
  ): Promise<WorkspaceMember>;
  removeWorkspaceMember(
    workspaceId: string,
    memberId: string,
  ): Promise<{ readonly status: "removed" }>;
  createWorkspaceInvitation(
    workspaceId: string,
    input: CreateWorkspaceInvitationRequest,
  ): Promise<WorkspaceInvitation>;
  listWorkspaceInvitations(
    workspaceId: string,
  ): Promise<readonly WorkspaceInvitation[]>;
  acceptWorkspaceInvitation(
    input: AcceptWorkspaceInvitationRequest,
  ): Promise<SessionContext>;
  revokeWorkspaceInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<{ readonly status: "revoked" }>;
  listRoles(): Promise<readonly RoleDefinition[]>;
  listPermissions(): Promise<readonly PermissionDefinition[]>;
  getAccountSecurity(): Promise<SecurityAccountState>;
  listSecuritySessions(): Promise<readonly SecuritySessionSummary[]>;
  revokeSecuritySession(
    sessionId: string,
    input?: RevokeSessionRequest,
  ): Promise<SecuritySessionSummary>;
  revokeAllUserSecuritySessions(
    userId: string,
    input?: RevokeSessionRequest,
  ): Promise<{ readonly status: "revoked"; readonly count: number }>;
  getWorkspaceSecuritySettings(): Promise<WorkspaceSecuritySettings>;
  updateWorkspaceSecuritySettings(
    input: WorkspaceSecuritySettingsUpdateRequest,
  ): Promise<WorkspaceSecuritySettings>;
  createReauthChallenge(
    input: CreateReauthChallengeRequest,
  ): Promise<ReauthChallenge>;
  verifyReauthChallenge(
    input: VerifyReauthChallengeRequest,
  ): Promise<ReauthChallenge>;
  getAdminSecurityOverview(): Promise<AdminSecurityOverview>;
  listSecretsInventory(): Promise<readonly SecretInventoryItem[]>;
  markSecretCompromised(
    secretCode: string,
    input?: SecretRotationRequest,
  ): Promise<{ readonly status: "compromised" }>;
  startSecretRotation(
    secretCode: string,
    input?: SecretRotationRequest,
  ): Promise<{ readonly status: "rotation_started" }>;
  completeSecretRotation(
    secretCode: string,
    input?: SecretRotationRequest,
  ): Promise<{ readonly status: "rotation_completed" }>;
  listAuditEvents(): Promise<readonly AuditEventSummary[]>;
  listAuditEventsAdmin(): Promise<readonly AuditEventSummary[]>;
  exportAuditEvents(input: AuditExportRequest): Promise<AuditExportResult>;
  listAiProviderPolicies(): Promise<readonly AiProviderPolicy[]>;
  getActivepiecesSecurityOverview(): Promise<ActivepiecesWorkspaceSecurityState>;
  listSecurityAlerts(): Promise<readonly SecurityAlert[]>;
  updateSecurityAlert(
    alertId: string,
    input: SecurityAlertUpdateRequest,
  ): Promise<SecurityAlert>;
  listSecurityIncidents(): Promise<readonly SecurityIncident[]>;
  createSecurityIncident(input: {
    readonly title: string;
    readonly severity: SecurityIncident["severity"];
  }): Promise<SecurityIncident>;
  updateSecurityIncident(
    incidentId: string,
    input: SecurityIncidentUpdateRequest,
  ): Promise<SecurityIncident>;
  listComplianceProcessingActivities(): Promise<
    readonly ComplianceProcessingActivity[]
  >;
  listRetentionPolicies(): Promise<readonly RetentionPolicy[]>;
  getRetentionReport(): Promise<RetentionReportSummary>;
  listDsrRequests(): Promise<readonly DsrRequest[]>;
  listAccessReviewCampaigns(): Promise<readonly AccessReviewCampaign[]>;
  listLegalModules(): Promise<readonly LegalModuleSummary[]>;
  getLegalModule(code: string): Promise<LegalModuleDetail>;
  validateLegalModuleStep(
    input: ValidateLegalModuleStepRequest,
  ): Promise<WorkflowValidationSummary>;
  getLibrary(): Promise<readonly LibraryTemplateSummary[]>;
  listAutomationTemplates(
    input?: Record<string, string | undefined>,
  ): Promise<readonly LibraryTemplateSummary[]>;
  getAutomationTemplate(id: string): Promise<AutomationTemplateDetail>;
  createAutomationTemplate(
    input: CreateAutomationTemplateRequest,
  ): Promise<AutomationTemplateDetail>;
  updateAutomationTemplate(
    id: string,
    input: UpdateAutomationTemplateRequest,
  ): Promise<AutomationTemplateDetail>;
  createAutomationTemplateVersion(
    id: string,
    input: CreateAutomationTemplateVersionRequest,
  ): Promise<AutomationTemplateVersionSummary>;
  validateAutomationTemplateVersion(
    id: string,
  ): Promise<WorkflowValidationSummary>;
  publishAutomationTemplateDraft(id: string): Promise<AutomationTemplateDetail>;
  installAutomationTemplate(
    id: string,
    input: InstallAutomationTemplateRequest,
  ): Promise<InstalledAutomationDetail>;
  forkAutomationTemplate(
    id: string,
    input: ForkAutomationTemplateRequest,
  ): Promise<AutomationTemplateDetail>;
  getRelatedAutomationTemplates(
    id: string,
  ): Promise<readonly LibraryTemplateSummary[]>;
  listInstalledAutomations(): Promise<readonly InstalledAutomationDetail[]>;
  getAutomation(id: string): Promise<InstalledAutomationDetail>;
  getAutomationCanvas(id: string): Promise<CanvasDraftResponse>;
  getAutomationCanvasSecurityContext(
    id: string,
  ): Promise<CanvasSecurityContext>;
  listAutomationCanvasSecurityPolicies(
    id: string,
  ): Promise<readonly CanvasSecurityPolicy[]>;
  checkAutomationCanvasSecurityAction(
    id: string,
    input: CanvasSecurityCheckRequest,
  ): Promise<CanvasSecurityContext["decisions"][string]>;
  requestAutomationCanvasPolicyOverride(
    id: string,
    input: CanvasPolicyOverrideRequest,
  ): Promise<{ readonly id: string | null; readonly status: string }>;
  approveAutomationCanvasPolicyOverride(
    id: string,
    input: CanvasPolicyOverrideDecisionRequest,
  ): Promise<{ readonly id: string; readonly status: string }>;
  rejectAutomationCanvasPolicyOverride(
    id: string,
    input: CanvasPolicyOverrideDecisionRequest,
  ): Promise<{ readonly id: string; readonly status: string }>;
  listAutomationCanvasAuditEvents(id: string): Promise<CanvasAuditListResponse>;
  getAutomationCanvasAuditEvent(
    id: string,
    eventId: string,
  ): Promise<CanvasAuditListResponse["events"][number]>;
  exportAutomationCanvasAuditEvents(
    id: string,
    input: {
      readonly from?: string | null;
      readonly to?: string | null;
      readonly format?: "json" | "jsonl";
    },
  ): Promise<CanvasAuditExportResponse>;
  getAutomationCanvasAuditHashChainStatus(
    id: string,
  ): Promise<CanvasAuditHashChainStatusResponse>;
  getAutomationCanvasPresentation(
    id: string,
    input?: {
      readonly mode?: CanvasPresentationMode | null;
      readonly locale?: string | null;
    },
  ): Promise<CanvasPresentationModel>;
  getAutomationCanvasSuggestions(
    id: string,
    input?: {
      readonly contextNodeId?: string | null;
      readonly locale?: string | null;
    },
  ): Promise<readonly NoCodeSuggestion[]>;
  applyAutomationCanvasSuggestion(
    id: string,
    suggestionId: string,
    input?: {
      readonly confirmedByUser?: boolean;
      readonly contextNodeId?: string | null;
    },
  ): Promise<CanvasSuggestionApplyResponse>;
  openAutomationCanvasDraft(
    id: string,
    input?: CanvasDraftRequest,
  ): Promise<CanvasDraftOpenResponse>;
  getAutomationCanvasVersionState(
    id: string,
  ): Promise<CanvasVersionStateResponse>;
  getAutomationCanvasVersions(
    id: string,
    input?: {
      readonly status?: string | null;
      readonly includeCheckpoints?: boolean;
      readonly cursor?: string | null;
      readonly limit?: number | null;
    },
  ): Promise<CanvasVersionsResponse>;
  getAutomationCanvasIo(id: string): Promise<CanvasIoResponse>;
  getStepInspector(id: string, nodeId: string): Promise<StepInspectorDto>;
  listStepDataSources(
    id: string,
    nodeId: string,
    inputKey: string,
  ): Promise<CanvasSourcesResponse>;
  listCanvasInputSources(
    id: string,
    nodeId: string,
    inputKey: string,
  ): Promise<CanvasSourcesResponse>;
  testCanvasNode(
    id: string,
    nodeId: string,
    input: StepTestRequest,
  ): Promise<StepTestResultDto>;
  createCanvasTestRun(
    id: string,
    mode:
      | "validate"
      | "test-step"
      | "test-until-step"
      | "test-branch"
      | "test-loop"
      | "dry-run",
    input: CanvasTestRunRequest,
  ): Promise<CanvasTestRunResponse>;
  getCanvasTestRun(
    id: string,
    testRunId: string,
  ): Promise<CanvasTestRunResponse>;
  listCanvasTestRunSteps(
    id: string,
    testRunId: string,
  ): Promise<readonly CanvasTestRunStepSummary[]>;
  getCanvasTestRunStep(
    id: string,
    testRunId: string,
    nodeId: string,
  ): Promise<CanvasTestRunStepSummary>;
  cancelCanvasTestRun(
    id: string,
    testRunId: string,
  ): Promise<CanvasTestRunResponse>;
  listCanvasTestArtifacts(
    id: string,
    testRunId: string,
  ): Promise<readonly CanvasTestArtifactSummary[]>;
  getCanvasTestSupportBundle(
    id: string,
    testRunId: string,
  ): Promise<CanvasTestSupportBundle>;
  validateCanvasBinding(
    id: string,
    input: StepInputBinding,
  ): Promise<CanvasBindingValidationResponse>;
  getCanvasSampleOutput(
    id: string,
    nodeId: string,
    outputKey: string,
  ): Promise<CanvasSampleOutputResponse>;
  pinCanvasSampleOutput(
    id: string,
    nodeId: string,
    outputKey: string,
    sampleDataId: string,
  ): Promise<CanvasPinnedDataResponse>;
  unpinCanvasSampleOutput(
    id: string,
    nodeId: string,
    outputKey: string,
  ): Promise<CanvasPinnedDataResponse>;
  applyCanvasOperations(
    id: string,
    input: CanvasOperationRequest,
  ): Promise<CanvasOperationResponse>;
  previewCanvasOperations(
    id: string,
    input: CanvasOperationPreviewRequest,
  ): Promise<CanvasOperationPreviewResponse>;
  validateAutomationCanvas(
    id: string,
    input?: CanvasValidateRequest,
  ): Promise<CanvasValidationResult>;
  validateCanvasNodeConfig(
    id: string,
    nodeId: string,
    input: CanvasStepConfigValidationRequest,
  ): Promise<CanvasStepConfigValidationResponse>;
  explainCanvasValidationIssue(
    id: string,
    issueId: string,
  ): Promise<CanvasValidationIssueExplanation>;
  applyCanvasValidationFix(
    id: string,
    issueId: string,
    input: CanvasApplySuggestedFixRequest,
  ): Promise<CanvasApplySuggestedFixResponse>;
  sendCanvasAiMessage(
    id: string,
    input: CanvasAiMessageRequest,
  ): Promise<CanvasAiMessageResponse>;
  proposeCanvasAiPatch(
    id: string,
    input: CanvasAiMessageRequest,
  ): Promise<CanvasAiPatchProposalResponse | CanvasAiMessageResponse>;
  explainCanvasWithAi(
    id: string,
    input?: Partial<CanvasAiMessageRequest>,
  ): Promise<CanvasAiExplanationResponse>;
  fixCanvasValidationWithAi(
    id: string,
    input: Partial<CanvasAiMessageRequest> & {
      readonly selected_validation_issue_id?: string | null;
    },
  ): Promise<CanvasAiMessageResponse>;
  configureCanvasStepWithAi(
    id: string,
    input: Partial<CanvasAiMessageRequest> & {
      readonly selected_node_id?: string | null;
    },
  ): Promise<CanvasAiMessageResponse>;
  createCanvasAiTestPlan(
    id: string,
    input?: Partial<CanvasAiMessageRequest>,
  ): Promise<CanvasAiTestPlanResponse>;
  applyCanvasAiPatch(
    id: string,
    input: CanvasAiPatchApplyRequest,
  ): Promise<CanvasAiPatchApplyResponse>;
  rejectCanvasAiPatch(
    id: string,
    patchId: string,
    input?: CanvasAiPatchRejectRequest,
  ): Promise<CanvasAiPatchRejectResponse>;
  getCanvasAiPatch(id: string, patchId: string): Promise<CanvasAiPatchProposal>;
  createCanvasSnapshot(
    id: string,
    input?: CanvasSnapshotRequest,
  ): Promise<CanvasSnapshotResponse>;
  createCanvasCheckpoint(
    id: string,
    input?: CanvasSnapshotRequest,
  ): Promise<CanvasSnapshotResponse>;
  restoreCanvasSnapshot(
    id: string,
    snapshotId: string,
  ): Promise<CanvasSnapshotResponse>;
  publishAutomationCanvas(
    id: string,
    input?: CanvasPublishRequest,
  ): Promise<CanvasPublishResponse>;
  validateAutomationCanvasPublish(
    id: string,
    input?: CanvasPublishRequest,
  ): Promise<CanvasPublishValidateResponse>;
  compareAutomationCanvasVersions(
    id: string,
    input: { readonly from: string; readonly to: string },
  ): Promise<CanvasVersionCompareResponse>;
  getAutomationCanvasRollbackImpact(
    id: string,
    input: Partial<CanvasRollbackRequest>,
  ): Promise<CanvasRollbackImpactResponse>;
  rollbackAutomationCanvas(
    id: string,
    input: CanvasRollbackRequest,
  ): Promise<CanvasRollbackResponse>;
  emergencyDisableAutomationCanvas(
    id: string,
    input: {
      readonly reason: string;
      readonly idempotency_key?: string | null;
    },
  ): Promise<CanvasRollbackResponse>;
  getAutomationCanvasRuntimeProjection(
    id: string,
    versionId: string,
  ): Promise<CanvasRuntimeProjectionVersion>;
  exportAutomationCanvasVersion(
    id: string,
    versionId: string,
  ): Promise<CanvasVersionExportResponse>;
  restoreAutomationCanvasVersion(
    id: string,
    versionId: string,
  ): Promise<CanvasRestoreVersionResponse>;
  previewAutomationCanvasCompile(
    id: string,
    input?: CompileRequest,
  ): Promise<CompileResponse>;
  compileAutomationCanvas(
    id: string,
    input?: CompileRequest,
  ): Promise<CompileResponse>;
  syncAutomationCanvasRuntime(
    id: string,
    input: RuntimeSyncRequest,
  ): Promise<CompileResponse>;
  getAutomationRuntimeBinding(id: string): Promise<RuntimeBindingDto | null>;
  getAutomationRuntimeSyncStatus(
    id: string,
  ): Promise<RuntimeSyncStatusResponse>;
  pullAutomationRuntime(
    id: string,
    input?: RuntimePullRequest,
  ): Promise<RuntimePullResponse>;
  previewAutomationRuntimeImport(
    id: string,
    input: RuntimeImportPreviewRequest,
  ): Promise<RuntimeImportPreviewResponse>;
  applyAutomationRuntimeImport(
    id: string,
    input: RuntimeImportApplyRequest,
  ): Promise<RuntimeImportApplyResponse>;
  rejectAutomationRuntimeImport(
    id: string,
    input: RuntimeImportRejectRequest,
  ): Promise<RuntimeImportRejectResponse>;
  overwriteAutomationRuntime(
    id: string,
    input: RuntimeOverwriteRequest,
  ): Promise<RuntimeOverwriteResponse>;
  listAutomationCompileReports(id: string): Promise<CompileReportsResponse>;
  getAutomationCompileReport(
    id: string,
    reportId: string,
  ): Promise<CompileReport>;
  checkAutomationRuntimeDrift(id: string): Promise<RuntimeDriftResponse>;
  pullAutomationRuntimeSnapshot(id: string): Promise<RuntimeSnapshotResponse>;
  acquireCanvasLock(
    id: string,
    input?: {
      readonly draftId?: string | null;
      readonly ttlSeconds?: number | null;
    },
  ): Promise<CanvasLockState>;
  heartbeatCanvasLock(
    id: string,
    input?: {
      readonly draftId?: string | null;
      readonly lockId?: string | null;
      readonly ttlSeconds?: number | null;
    },
  ): Promise<CanvasLockState>;
  releaseCanvasLock(
    id: string,
    input?: {
      readonly draftId?: string | null;
      readonly lockId?: string | null;
    },
  ): Promise<CanvasLockState>;
  listCanvasBlockTypes(): Promise<readonly CanvasBlockDefinition[]>;
  getCanvasBlockType(code: string): Promise<CanvasBlockDefinition>;
  getCanvasBlockSchema(code: string): Promise<CanvasBlockSchemaResponse>;
  listCanvasModuleCatalog(input?: {
    readonly automationId?: string | null;
    readonly draftVersionId?: string | null;
    readonly contextNodeId?: string | null;
    readonly insertPosition?: string | null;
    readonly mode?: string | null;
    readonly query?: string | null;
    readonly source?: string | null;
    readonly status?: string | null;
    readonly runtime?: string | null;
    readonly limit?: number | null;
    readonly cursor?: string | null;
  }): Promise<CanvasModuleCatalogResponse>;
  getCanvasModuleDetail(
    moduleCode: string,
    automationId?: string | null,
  ): Promise<CanvasModuleDetail>;
  checkCanvasModuleCompatibility(
    moduleCode: string,
    input: CanvasCompatibilityCheckRequest,
  ): Promise<CanvasCompatibilityCheckResponse>;
  validateCanvasBlock(
    input: ValidateCanvasBlockRequest,
  ): Promise<CanvasBlockValidationResult>;
  validateCanvasConnection(
    input: ValidateCanvasConnectionRequest,
  ): Promise<CanvasConnectionValidationResult>;
  previewCanvasBlock(input: {
    readonly blockCode: string;
  }): Promise<CanvasRuntimeMapping>;
  testCanvasBlock(input: { readonly blockCode: string }): Promise<{
    readonly status: string;
    readonly blockCode: string;
    readonly supportsStepTest: boolean;
    readonly dryRunOnly: boolean;
    readonly runtime: CanvasRuntimeMapping;
    readonly note: string;
  }>;
  listCanvasModules(
    automationId: string,
  ): Promise<readonly CanvasModuleSummary[]>;
  listConnectionRequirements(input?: {
    readonly moduleCode?: string | null;
  }): Promise<CanvasConnectionRequirementsResponse>;
  createConnectionRequest(input: {
    readonly moduleCode?: string | null;
    readonly connectionType?: string | null;
  }): Promise<CanvasConnectionRequestResponse>;
  listProjects(): Promise<Stage15ProjectListResponse>;
  createProject(
    input: Stage15CreateProjectRequest,
  ): Promise<Stage15ProjectCreatedResponse>;
  getProject(projectId: string): Promise<Stage15ProjectDetail>;
  getProjectDashboardSnapshot(
    projectId: string,
  ): Promise<Stage15ProjectSnapshot>;
  listProjectChats(
    projectId: string,
  ): Promise<readonly Stage15ProjectChatSummary[]>;
  createProjectChat(
    projectId: string,
    input?: Stage15CreateProjectChatRequest,
  ): Promise<Stage15ProjectChatCreatedResponse>;
  listProjectAutomations(
    projectId: string,
  ): Promise<readonly InstalledAutomationDetail[]>;
  ensureStage17CanvasAutomation(
    projectId: string,
  ): Promise<Stage17CanvasEnsureResponse>;
  listLegalSources(): Promise<readonly LegalSourceSummary[]>;
  getLegalSource(sourceId: string): Promise<LegalSourceDetail>;
  createLegalImportJob(
    input: CreateLegalImportJobRequest,
  ): Promise<LegalImportJob>;
  getLegalImportJob(jobId: string): Promise<LegalImportJob>;
  queryLegalSearch(input: LegalSearchQuery): Promise<LegalSearchResponse>;
  analyzeLegalRag(input: RagAnalyzeRequest): Promise<RagRequestSummary>;
  getLegalRagRequest(requestId: string): Promise<RagRequestSummary>;
  forkInstalledAutomationToTemplate(
    id: string,
    input: ForkAutomationTemplateRequest,
  ): Promise<AutomationTemplateDetail>;
  getInstalledAutomationSourceDiff(
    id: string,
  ): Promise<InstalledAutomationSourceDiff>;
  applyInstalledAutomationSourceUpdate(
    id: string,
    input: ApplyInstalledAutomationSourceUpdateRequest,
  ): Promise<InstalledAutomationDetail>;
  submitAutomationTemplatePublication(
    id: string,
    input: SubmitPublicationRequest,
  ): Promise<PublicationRequest>;
  getPublicationRequest(id: string): Promise<PublicationRequest>;
  listPublicationRequests(): Promise<readonly PublicationRequest[]>;
  getModerationPublicationRequest(id: string): Promise<PublicationRequest>;
  reviewPublicationRequest(
    id: string,
    input: ModerationDecision,
  ): Promise<PublicationRequest>;
  getRuns(): Promise<readonly RunSummary[]>;
  getDashboardSnapshot(): Promise<DashboardSnapshot>;
  getDashboardEvents(input?: {
    readonly sinceSequence?: number | null;
  }): Promise<DashboardEventListResponse>;
  getSystemStatus(): Promise<SystemStatusSummary>;
  preflightAutomationRun(
    id: string,
    input?: RunPreflightRequest,
  ): Promise<RunPreflightReport>;
  createAutomationRun(
    id: string,
    input: RunCreateRequest,
  ): Promise<RunCreateResponse>;
  getRun(runId: string): Promise<RunSnapshot>;
  getRunLiveSnapshot(runId: string): Promise<RunLiveSnapshot>;
  cancelRun(runId: string): Promise<RunSnapshot>;
  retryRun(runId: string): Promise<RunCreateResponse>;
  retryRunStep(runId: string, stepId: string): Promise<RunSnapshot>;
  getRecommendations(): Promise<readonly RecommendationCandidate[]>;
  getRecommendation(id: string): Promise<RecommendationDetail>;
  acceptRecommendation(
    id: string,
    input?: RecommendationAcceptRequest,
  ): Promise<RecommendationActionResult>;
  dismissRecommendation(
    id: string,
    input?: RecommendationDismissRequest,
  ): Promise<RecommendationActionResult>;
  snoozeRecommendation(
    id: string,
    input?: RecommendationSnoozeRequest,
  ): Promise<RecommendationActionResult>;
  sendRecommendationFeedback(
    id: string,
    input: RecommendationFeedbackRequest,
  ): Promise<RecommendationActionResult>;
  listRecommendationPatterns(): Promise<
    readonly RecommendationPatternSummary[]
  >;
  getRecommendationPattern(id: string): Promise<RecommendationPatternDetail>;
  listRecommendationProcessCases(): Promise<readonly ProcessCaseSummary[]>;
  captureProductEvent(
    input: ProductEventCaptureRequest,
  ): Promise<ProductEventCaptureResponse>;
  getReadiness(): Promise<readonly ReadinessGate[]>;
  getReadinessSummary(): Promise<ReadinessSummaryResponse>;
  getReadinessDetails(): Promise<ReadinessDetailsResponse>;
  getStage18Readiness(): Promise<Stage18ReadinessResponse>;
  getStage20Readiness(): Promise<Stage20ReadinessResponse>;
  createAutomationIntent(
    projectId: string,
    input: CreateAutomationIntentRequest,
  ): Promise<AutomationIntentResponse>;
  getAutomationIntent(intentId: string): Promise<AutomationIntentResponse>;
  updateAutomationIntent(
    intentId: string,
    input: UpdateAutomationIntentRequest,
  ): Promise<AutomationIntentResponse>;
  cancelAutomationIntent(intentId: string): Promise<{ readonly status: string }>;
  planAutomationIntent(intentId: string): Promise<AutomationPlanResponse>;
  answerAutomationClarification(
    intentId: string,
    clarificationId: string,
    input: AutomationClarificationAnswerRequest,
  ): Promise<AutomationClarificationAnswerResponse>;
  getAutomationBlueprint(blueprintId: string): Promise<AutomationBlueprint>;
  validateAutomationBlueprint(
    blueprintId: string,
  ): Promise<AutomationBlueprintValidationSummary>;
  compileAutomationBlueprintPreview(
    blueprintId: string,
  ): Promise<AutomationCompilePreviewResponse>;
  approveAutomationBlueprint(blueprintId: string): Promise<AutomationBlueprint>;
  rejectAutomationBlueprint(
    blueprintId: string,
  ): Promise<{ readonly status: string }>;
  convertAutomationBlueprintToCanvasDraft(
    blueprintId: string,
  ): Promise<AutomationCanvasDraftResponse>;
  createAutomationRuntimeDraft(
    blueprintId: string,
  ): Promise<AutomationRuntimeDraftResponse>;
  exportAutomationBlueprint(blueprintId: string): Promise<AutomationBlueprint>;
  createAutomationBuilderSession(input: {
    readonly projectId?: string | null;
    readonly title?: string | null;
  }): Promise<AutomationBuilderSessionResponse>;
  archiveAutomationBuilderSession(
    sessionId: string,
  ): Promise<AutomationBuilderSessionResponse>;
  getAutomationModuleCatalog(): Promise<AutomationModuleCatalogResponse>;
  resolveAutomationModuleCatalog(input: {
    readonly steps?: readonly {
      readonly kind?: string;
      readonly moduleCode?: string | null;
    }[];
  }): Promise<AutomationModuleResolveResponse>;
  previewAutomationBuilderContext(input: {
    readonly projectId?: string | null;
    readonly intentId?: string | null;
  }): Promise<AutomationContextPreviewResponse>;
  preflightAutomationBuilderSecurity(): Promise<AutomationSecurityPreflightResponse>;
  getAutomationRuntimeRequirements(
    id: string,
  ): Promise<AutomationRuntimeRequirements>;
  createActivepiecesSession(
    input: CreateActivepiecesSessionRequest,
  ): Promise<ActivepiecesSessionResponse>;
  getActivepiecesCanvasReadiness(input: {
    readonly projectId: string;
    readonly automationId: string;
  }): Promise<ActivepiecesCanvasReadinessResponse>;
  initializeActivepiecesSession(
    input: InitializeActivepiecesSessionRequest,
  ): Promise<InitializeActivepiecesSessionResponse>;
  recordActivepiecesIframeHealth(
    input: RecordActivepiecesIframeHealthRequest,
  ): Promise<RecordActivepiecesIframeHealthResponse>;
  syncAutomationRuntime(
    id: string,
    input: SyncAutomationRuntimeRequest,
  ): Promise<SyncAutomationRuntimeResponse>;
  startAutomationRun(
    id: string,
    input: StartAutomationRunRequest,
  ): Promise<StartAutomationRunResponse>;
  getActivepiecesIntegrationStatus(): Promise<ActivepiecesIntegrationStatus>;
  runActivepiecesSmoke(
    input: ActivepiecesRunSmokeRequest,
  ): Promise<ActivepiecesRunSmokeResponse>;
  getDeliveryIntegrationStatus(): Promise<DeliveryIntegrationStatus>;
  runDeliverySandboxTest(
    input?: DeliverySandboxTestRequest,
  ): Promise<DeliverySandboxTestResponse>;
  listRuntimeConnections(): Promise<readonly RuntimeConnectionSummary[]>;
  upsertRuntimeConnection(
    input: UpsertRuntimeConnectionRequest,
  ): Promise<RuntimeConnectionSummary>;
  listDocuments(input?: DocumentListQuery): Promise<DocumentListResponse>;
  getCurrentLegalWorkProfile(): Promise<LegalWorkProfileDetail | null>;
  getEffectiveLegalWorkProfile(): Promise<EffectiveProfileSnapshotSummary | null>;
  createLegalWorkProfile(
    input: CreateLegalWorkProfileRequest,
  ): Promise<LegalWorkProfileDetail>;
  updateLegalWorkProfileDraft(
    profileId: string,
    input: UpdateLegalWorkProfileDraftRequest,
  ): Promise<LegalWorkProfileDetail>;
  validateLegalWorkProfile(profileId: string): Promise<ProfileValidationResult>;
  publishLegalWorkProfile(profileId: string): Promise<LegalWorkProfileDetail>;
  listLegalWorkProfileVersions(
    profileId: string,
  ): Promise<readonly LegalWorkProfileVersionSummary[]>;
  restoreLegalWorkProfileVersion(
    profileId: string,
    input: RestoreLegalWorkProfileVersionRequest,
  ): Promise<LegalWorkProfileDetail>;
  previewEffectiveLegalWorkProfile(
    profileId: string,
    input: PreviewEffectiveProfileRequest,
  ): Promise<EffectiveProfilePreview>;
  listDocumentTypes(): Promise<readonly DocumentTypeSummary[]>;
  getDocumentType(id: string): Promise<DocumentTypeDetail>;
  createDocumentType(
    input: CreateDocumentTypeRequest,
  ): Promise<DocumentTypeDetail>;
  updateDocumentType(
    id: string,
    input: UpdateDocumentTypeRequest,
  ): Promise<DocumentTypeDetail>;
  listDocumentStructures(
    input?: Record<string, string | undefined>,
  ): Promise<readonly DocumentStructureRecord[]>;
  createDocumentStructure(
    input: CreateDocumentStructureRequest,
  ): Promise<DocumentStructureRecord>;
  updateDocumentStructure(
    id: string,
    input: UpdateDocumentStructureRequest,
  ): Promise<DocumentStructureRecord>;
  listClauses(): Promise<readonly ClauseLibraryItemSummary[]>;
  createClause(
    input: CreateClauseLibraryItemRequest,
  ): Promise<ClauseLibraryItemSummary>;
  updateClause(
    id: string,
    input: UpdateClauseLibraryItemRequest,
  ): Promise<ClauseLibraryItemSummary>;
  listPhraseRules(): Promise<readonly PhraseRuleSummary[]>;
  createPhraseRule(input: CreatePhraseRuleRequest): Promise<PhraseRuleSummary>;
  updatePhraseRule(
    id: string,
    input: UpdatePhraseRuleRequest,
  ): Promise<PhraseRuleSummary>;
  listDocumentTemplates(): Promise<readonly DocumentTemplateDetail[]>;
  getDocumentTemplate(id: string): Promise<DocumentTemplateDetail>;
  createDocumentTemplate(
    input: CreateDocumentTemplateRequest,
  ): Promise<DocumentTemplateDetail>;
  updateDocumentTemplate(
    id: string,
    input: UpdateDocumentTemplateRequest,
  ): Promise<DocumentTemplateDetail>;
  parseDocumentTemplatePlaceholders(
    id: string,
  ): Promise<ParseDocumentTemplatePlaceholdersResponse>;
  publishDocumentTemplateDraft(
    id: string,
    input?: PublishDocumentTemplateVersionRequest,
  ): Promise<DocumentTemplateDetail>;
  createDocumentGenerationPreview(
    input: DocumentGenerationPreviewRequest,
  ): Promise<DocumentGenerationJobDetail>;
  getDocumentGenerationJob(id: string): Promise<DocumentGenerationJobDetail>;
  finalizeDocumentGeneration(
    id: string,
    input?: FinalizeDocumentGenerationRequest,
  ): Promise<DocumentGenerationJobDetail>;
  getDocumentValidationReport(
    id: string,
  ): Promise<DocumentValidationReportDetail>;
  recheckDocumentValidation(
    id: string,
    input: RecheckDocumentValidationRequest,
  ): Promise<DocumentValidationReportDetail>;
  listApprovalRoutes(): Promise<readonly ApprovalRouteSummary[]>;
  getApprovalRoute(id: string): Promise<ApprovalRouteDetail>;
  createApprovalRoute(
    input: CreateApprovalRouteRequest,
  ): Promise<ApprovalRouteDetail>;
  updateApprovalRoute(
    id: string,
    input: UpdateApprovalRouteRequest,
  ): Promise<ApprovalRouteDetail>;
  listApprovalTasks(): Promise<readonly ApprovalTaskSummary[]>;
  getApprovalTask(id: string): Promise<ApprovalTaskDetail>;
  approveApprovalTask(
    id: string,
    input?: ApprovalTaskDecisionRequest,
  ): Promise<ApprovalTaskSummary>;
  rejectApprovalTask(
    id: string,
    input?: ApprovalTaskDecisionRequest,
  ): Promise<ApprovalTaskSummary>;
  requestApprovalTaskChanges(
    id: string,
    input?: ApprovalTaskRequestChangesRequest,
  ): Promise<ApprovalTaskDetail>;
  executeWorkflowRuntimeDocumentTemplate(
    input: WorkflowRuntimeDocumentTemplateExecuteRequest,
  ): Promise<DocumentGenerationJobDetail>;
  executeWorkflowRuntimeDocumentValidation(
    input: WorkflowRuntimeDocumentValidationExecuteRequest,
  ): Promise<DocumentValidationReportDetail>;
  executeWorkflowRuntimeApprovalRequest(
    input: WorkflowRuntimeApprovalRequestExecuteRequest,
  ): Promise<ApprovalTaskSummary>;
  createProfileImportJob(
    input: CreateProfileImportJobRequest,
  ): Promise<ProfileImportJobSummary>;
  getDocument(documentId: string): Promise<DocumentDetail>;
  listDocumentVersions(
    documentId: string,
  ): Promise<readonly DocumentVersionSummary[]>;
  createDocumentUploadIntent(
    input: DocumentUploadIntentRequest,
  ): Promise<DocumentUploadIntentResponse>;
  createDocumentVersionUploadIntent(
    documentId: string,
    input: CreateDocumentVersionUploadIntentRequest,
  ): Promise<DocumentUploadIntentResponse>;
  completeDocumentUpload(
    documentId: string,
    versionId: string,
    input: CompleteUploadRequest,
  ): Promise<DocumentDetail>;
  makeDocumentVersionCurrent(
    documentId: string,
    versionId: string,
  ): Promise<DocumentDetail>;
  createDocumentSignedUrl(
    documentId: string,
    input: SignedUrlRequest,
  ): Promise<SignedUrlResponse>;
  archiveDocument(documentId: string): Promise<DocumentMutationResult>;
  restoreDocument(documentId: string): Promise<DocumentMutationResult>;
  deleteDocument(documentId: string): Promise<DocumentMutationResult>;
  listRunArtifacts(runId: string): Promise<readonly RunArtifact[]>;
  createRunArtifact(
    runId: string,
    input: CreateRunArtifactRequest,
  ): Promise<RunArtifact>;
  createArtifactSignedUrl(
    artifactId: string,
    input: ArtifactSignedUrlRequest,
  ): Promise<SignedUrlResponse>;
  acceptArtifactAsDocument(
    artifactId: string,
  ): Promise<ArtifactAcceptAsDocumentResponse>;
  getDeliveryRequest(id: string): Promise<DeliveryRequestDetail>;
  previewDeliveryRequest(id: string): Promise<DeliveryPreview>;
  approveDeliveryRequest(id: string): Promise<DeliveryRequestDetail>;
  sendDeliveryRequest(id: string): Promise<DeliveryRequestDetail>;
  cancelDeliveryRequest(id: string): Promise<DeliveryRequestDetail>;
  retryDeliveryRequest(id: string): Promise<DeliveryRequestDetail>;
  listNotifications(
    input?: NotificationListQuery,
  ): Promise<NotificationListResponse>;
  markNotificationRead(id: string): Promise<NotificationSummary>;
  markAllNotificationsRead(): Promise<{
    readonly status: "ok";
    readonly updatedCount: number;
  }>;
  registerDevice(input: DeviceRegistrationRequest): Promise<RegisteredDevice>;
  removeDevice(id: string): Promise<{ readonly status: "removed" }>;
  createActivepiecesEmbedToken(
    input: CreateActivepiecesEmbedTokenRequest,
  ): Promise<ActivepiecesEmbedTokenResponse>;
  listAiChatSessions(): Promise<readonly AiChatSessionSummary[]>;
  getAiChatSession(sessionId: string): Promise<AiChatSessionSummary>;
  listAiChatMessages(
    sessionId: string,
  ): Promise<readonly AiChatMessageSummary[]>;
  createAiChatSession(
    input: CreateAiChatSessionRequest,
  ): Promise<AiChatSessionSummary>;
  sendAiChatMessage(input: CreateAiChatMessageRequest): Promise<AiChatResponse>;
  listWorkflowDrafts(): Promise<readonly WorkflowDraftSummary[]>;
  getWorkflowDraft(draftId: string): Promise<WorkflowDraftDetail>;
  createWorkflowDraft(
    input: CreateWorkflowDraftRequest,
  ): Promise<WorkflowDraftDetail>;
  updateWorkflowDraftInputs(
    draftId: string,
    input: UpdateWorkflowDraftInputsRequest,
  ): Promise<WorkflowDraftDetail>;
  materializeWorkflowDraft(
    draftId: string,
    input: Stage15WorkflowDraftMaterializeRequest,
  ): Promise<Stage15WorkflowDraftMaterializeResponse>;
  getChatThread(threadId: string): Promise<ChatThreadResponse>;
  updateChatThread(
    threadId: string,
    input: UpdateChatThreadRequest,
  ): Promise<ChatThreadResponse>;
  archiveChatThread(threadId: string): Promise<ChatThreadResponse>;
  deleteChatThread(threadId: string): Promise<ChatThreadResponse>;
  branchChatThread(
    threadId: string,
    input: {
      readonly sourceMessageId?: string | null;
      readonly branchMode?: "project" | "document_review" | "automation_builder";
    },
  ): Promise<ChatThreadResponse>;
  listChatMessages(threadId: string): Promise<ChatMessagesResponse>;
  createChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<unknown>;
  streamChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  resumeChatStream(
    threadId: string,
    streamId: string,
  ): Promise<{
    readonly streamId: string;
    readonly threadId: string;
    readonly status: "completed";
    readonly events: readonly unknown[];
  }>;
  cancelChatStream(
    threadId: string,
    streamId: string,
  ): Promise<{
    readonly streamId: string;
    readonly threadId: string;
    readonly status: "cancelled";
  }>;
  regenerateChatMessage(
    threadId: string,
    messageId: string,
  ): Promise<ChatStreamSnapshot>;
  editChatMessage(
    threadId: string,
    messageId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  searchChats(input: {
    readonly q: string;
    readonly projectId?: string | null;
  }): Promise<ChatSearchResponse>;
  exportChatThread(threadId: string): Promise<{
    readonly threadId: string;
    readonly format: string;
    readonly status: string;
  }>;
  listProjectKnowledge(projectId: string): Promise<ProjectKnowledgeListResponse>;
  createProjectKnowledge(
    projectId: string,
    input: UpsertProjectKnowledgeItemRequest,
  ): Promise<ProjectKnowledgeItem>;
  updateProjectKnowledge(
    projectId: string,
    itemId: string,
    input: Partial<UpsertProjectKnowledgeItemRequest>,
  ): Promise<ProjectKnowledgeItem>;
  deleteProjectKnowledge(
    projectId: string,
    itemId: string,
  ): Promise<{ readonly id: string; readonly status: "deleted" }>;
  createWorkflowPatch(
    input: CreateWorkflowPatchRequest,
  ): Promise<AiChatResponse>;
  getAiRequest(requestId: string): Promise<AiRequestSummary>;
  listAiRequestEvents(requestId: string): Promise<readonly AiRequestEvent[]>;
  previewAiRedaction(
    input: AiRedactionPreviewRequest,
  ): Promise<AiRedactionPreviewResponse>;
}

function toActivepiecesSessionWireRequest(
  input: CreateActivepiecesSessionRequest,
): CreateActivepiecesSessionWireRequest {
  return {
    ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
    project_id: input.projectId,
    automation_id: input.automationId,
    purpose: input.purpose,
    client_route: input.clientRoute,
    ...(input.preferredMode ? { preferred_mode: input.preferredMode } : {}),
    ...(input.modePreference ? { mode_preference: input.modePreference } : {}),
    ...(input.returnBuilderConfig !== undefined
      ? { return_builder_config: input.returnBuilderConfig }
      : {}),
    ...(input.clientTraceId !== undefined
      ? { client_trace_id: input.clientTraceId }
      : {}),
    ...(input.idempotencyKey !== undefined
      ? { idempotency_key: input.idempotencyKey }
      : {}),
  };
}

function toInitializeActivepiecesSessionWireRequest(
  input: InitializeActivepiecesSessionRequest,
): InitializeActivepiecesSessionWireRequest {
  return {
    ...(input.clientTraceId !== undefined
      ? { client_trace_id: input.clientTraceId }
      : {}),
  };
}

function toRecordActivepiecesIframeHealthWireRequest(
  input: RecordActivepiecesIframeHealthRequest,
): RecordActivepiecesIframeHealthWireRequest {
  return {
    event: input.event,
    ...(input.details !== undefined ? { details: input.details } : {}),
    ...(input.clientTraceId !== undefined
      ? { client_trace_id: input.clientTraceId }
      : {}),
  };
}

function mapActivepiecesSessionResponse(
  response: ActivepiecesSessionWireResponse,
): ActivepiecesSessionResponse {
  if (response.status === "blocked" || response.status === "unavailable") {
    const failureResponse = {
      readinessCode: response.readiness_code,
      jwtToken: null,
      expiresAt: null,
      role: null,
      message: response.message,
      fallback: {
        showBuilderUnavailableState:
          response.fallback.show_builder_unavailable_state,
        allowLexframeCanvasReserve:
          response.fallback.allow_lexframe_canvas_reserve,
        allowRunsTab: response.fallback.allow_runs_tab,
        allowSettingsTab: response.fallback.allow_settings_tab,
        allowDiagnosticsTab: response.fallback.allow_diagnostics_tab,
      },
      ...(response.warnings
        ? { warnings: response.warnings.map(mapActivepiecesSessionWarning) }
        : {}),
      ...(response.status === "blocked" && response.ai_test_policy
        ? { aiTestPolicy: mapActivepiecesAiTestPolicy(response.ai_test_policy) }
        : {}),
      ...(response.diagnostics
        ? {
            diagnostics: mapActivepiecesSessionDiagnostics(
              response.diagnostics,
            ),
          }
        : {}),
      ...(response.open_check
        ? { openCheck: mapActivepiecesOpenCheck(response.open_check) }
        : {}),
    } as const;

    if (response.status === "blocked") {
      return {
        status: "blocked",
        ...failureResponse,
      };
    }

    return {
      status: "unavailable",
      ...failureResponse,
    };
  }

  return {
    status: response.status,
    readinessCode: response.readiness_code,
    sessionId: response.session_id,
    mode: response.mode,
    issuedAt: response.issued_at,
    instanceUrl: response.instance_url,
    builderUrl: response.builder_url,
    initialRoute: response.initial_route,
    expectedRoute: response.expected_route ?? response.initial_route,
    refreshPolicy: mapActivepiecesRefreshPolicy(response.refresh_policy),
    jwtToken: response.jwt_token,
    expiresAt: response.expires_at,
    ttlSeconds: response.ttl_seconds,
    locale: response.locale,
    brandDisplayName: response.brand_display_name,
    brand: {
      shortName: response.brand.short_name,
      longName: response.brand.long_name,
      documentTitle: response.brand.document_title,
      logoAlt: response.brand.logo_alt,
      ariaLabel: response.brand.aria_label,
    },
    role: response.role,
    permissions: {
      canView: response.permissions.can_view,
      canEdit: response.permissions.can_edit,
      canManageConnections: response.permissions.can_manage_connections,
      canOpenDiagnostics: response.permissions.can_open_diagnostics,
    },
    piecesPolicy: {
      piecesFilterType: response.pieces_policy.pieces_filter_type,
      piecesTags: response.pieces_policy.pieces_tags,
      policyHash: response.pieces_policy.policy_hash,
    },
    sdkConfig: {
      containerId: response.sdk_config.container_id,
      prefix: response.sdk_config.prefix,
      locale: response.sdk_config.locale,
      brandDisplayName: response.sdk_config.brand_display_name,
      designSystem: response.sdk_config.design_system,
      navigationSync: response.sdk_config.navigation_sync,
      embedding: {
        containerId: response.sdk_config.embedding.container_id,
        locale: response.sdk_config.embedding.locale,
        builder: {
          disableNavigation:
            response.sdk_config.embedding.builder.disable_navigation,
          hideFlowName: response.sdk_config.embedding.builder.hide_flow_name,
          homeButtonIcon:
            response.sdk_config.embedding.builder.home_button_icon,
        },
        dashboard: {
          hideSidebar: response.sdk_config.embedding.dashboard.hide_sidebar,
          hideFlowsPageNavbar:
            response.sdk_config.embedding.dashboard.hide_flows_page_navbar,
          hidePageHeader:
            response.sdk_config.embedding.dashboard.hide_page_header,
        },
        hideFolders: response.sdk_config.embedding.hide_folders,
        hideExportAndImportFlow:
          response.sdk_config.embedding.hide_export_and_import_flow,
        hideDuplicateFlow: response.sdk_config.embedding.hide_duplicate_flow,
        navigationSync: response.sdk_config.embedding.navigation_sync,
      },
    },
    designSystem: response.design_system,
    flowBinding: {
      automationId: response.flow_binding.automation_id,
      activepiecesProjectId: response.flow_binding.activepieces_project_id,
      activepiecesFlowId: response.flow_binding.activepieces_flow_id,
      activepiecesFlowVersionId:
        response.flow_binding.activepieces_flow_version_id,
      syncStatus: response.flow_binding.sync_status,
      syncHash: response.flow_binding.sync_hash,
    },
    runtimeStatus: {
      apApp: response.runtime_status.ap_app,
      apWorker: response.runtime_status.ap_worker,
      apDb: response.runtime_status.ap_db,
      redis: response.runtime_status.redis,
    },
    ...(response.open_check
      ? { openCheck: mapActivepiecesOpenCheck(response.open_check) }
      : {}),
    ...(response.warnings
      ? { warnings: response.warnings.map(mapActivepiecesSessionWarning) }
      : {}),
    ...(response.ai_test_policy
      ? { aiTestPolicy: mapActivepiecesAiTestPolicy(response.ai_test_policy) }
      : {}),
    ...(response.diagnostics
      ? { diagnostics: mapActivepiecesSessionDiagnostics(response.diagnostics) }
      : {}),
  };
}

function mapActivepiecesOpenCheck(
  openCheck: NonNullable<ActivepiecesSessionWireResponse["open_check"]>,
) {
  return {
    status: openCheck.status,
    reasonCode: openCheck.reason_code,
    readinessCode: openCheck.readiness_code ?? openCheck.reason_code,
    activepiecesProjectId: openCheck.activepieces_project_id,
    activepiecesFlowId: openCheck.activepieces_flow_id,
    activepiecesFlowVersionId:
      openCheck.activepieces_flow_version_id ?? null,
    readinessVersion: openCheck.readiness_version ?? null,
    activepiecesVersion: openCheck.activepieces_version ?? null,
    embedSdkVersion: openCheck.embed_sdk_version ?? null,
    expectedRoute: openCheck.expected_route ?? null,
    ...(openCheck.refresh_policy
      ? { refreshPolicy: mapActivepiecesRefreshPolicy(openCheck.refresh_policy) }
      : {}),
    repairAttempted: openCheck.repair_attempted,
    checkedAt: openCheck.checked_at,
    checks: openCheck.checks ?? [],
    canonicalReplacementRoute:
      openCheck.canonical_replacement_route ?? null,
    message: openCheck.message ?? null,
  };
}

function mapActivepiecesRefreshPolicy(
  policy: NonNullable<
    NonNullable<ActivepiecesSessionWireResponse["open_check"]>["refresh_policy"]
  >,
) {
  return {
    strategy: policy.strategy,
    recoverOn: policy.recover_on,
  };
}

function mapActivepiecesCanvasReadinessResponse(
  response: ActivepiecesCanvasReadinessWireResponse,
): ActivepiecesCanvasReadinessResponse {
  const mapped = mapActivepiecesOpenCheck(response);
  return {
    ...mapped,
    status: response.status,
    readinessCode: response.readiness_code,
  };
}

function mapActivepiecesSessionWarning(
  warning: ActivepiecesSessionWarningWire,
) {
  return {
    code: warning.code,
    severity: warning.severity,
    title: warning.title,
    message: warning.message,
  };
}

function mapActivepiecesAiTestPolicy(policy: ActivepiecesAiTestPolicyWire) {
  return {
    status: policy.status,
    blockRequiredAiTests: policy.block_required_ai_tests,
    allowNonAiCanvasEditing: policy.allow_non_ai_canvas_editing,
  };
}

function mapActivepiecesSessionDiagnostics(
  diagnostics: ActivepiecesSessionDiagnosticsWire,
) {
  return {
    traceId: diagnostics.trace_id,
    ...(diagnostics.audit_event_id !== undefined
      ? { auditEventId: diagnostics.audit_event_id }
      : {}),
    ...(diagnostics.safe_to_show !== undefined
      ? { safeToShow: diagnostics.safe_to_show }
      : {}),
    ...(diagnostics.ap_app !== undefined ? { apApp: diagnostics.ap_app } : {}),
    ...(diagnostics.ap_worker !== undefined
      ? { apWorker: diagnostics.ap_worker }
      : {}),
    ...(diagnostics.local_owner_keys !== undefined
      ? { localOwnerKeys: diagnostics.local_owner_keys }
      : {}),
  };
}

function mapInitializeActivepiecesSessionResponse(
  response: InitializeActivepiecesSessionWireResponse,
): InitializeActivepiecesSessionResponse {
  return {
    status: response.status,
    sessionId: response.session_id,
    initializedAt: response.initialized_at,
  };
}

function mapRecordActivepiecesIframeHealthResponse(
  response: RecordActivepiecesIframeHealthWireResponse,
): RecordActivepiecesIframeHealthResponse {
  return {
    status: response.status,
    sessionId: response.session_id,
    event: response.event,
    recordedAt: response.recorded_at,
  };
}

export function createApiClient(options: FetchOptions): ApiClient {
  return {
    bootstrapAuth: () =>
      requestJson(options, "/auth/bootstrap", { method: "POST" }),
    getSessionContext: () => requestJson(options, "/session/context"),
    createWorkspace: (input) =>
      requestJson(
        options,
        "/workspaces",
        withJsonBody(input, { method: "POST" }),
      ),
    listWorkspaces: () => requestJson(options, "/workspaces"),
    getWorkspace: (workspaceId) =>
      requestJson(options, `/workspaces/${workspaceId}`),
    updateWorkspace: (workspaceId, input) =>
      requestJson(
        options,
        `/workspaces/${workspaceId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    switchWorkspace: (input) =>
      requestJson(options, `/workspaces/${input.workspaceId}/switch`, {
        method: "POST",
      }),
    listWorkspaceMembers: (workspaceId) =>
      requestJson(options, `/workspaces/${workspaceId}/members`),
    changeWorkspaceMemberRole: (workspaceId, memberId, input) =>
      requestJson(
        options,
        `/workspaces/${workspaceId}/members/${memberId}/role`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    removeWorkspaceMember: (workspaceId, memberId) =>
      requestJson(options, `/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      }),
    createWorkspaceInvitation: (workspaceId, input) =>
      requestJson(
        options,
        `/workspaces/${workspaceId}/invitations`,
        withJsonBody(input, { method: "POST" }),
      ),
    listWorkspaceInvitations: (workspaceId) =>
      requestJson(options, `/workspaces/${workspaceId}/invitations`),
    acceptWorkspaceInvitation: (input) =>
      requestJson(
        options,
        "/workspace-invitations/accept",
        withJsonBody(input, { method: "POST" }),
      ),
    revokeWorkspaceInvitation: (workspaceId, invitationId) =>
      requestJson(
        options,
        `/workspaces/${workspaceId}/invitations/${invitationId}`,
        {
          method: "DELETE",
        },
      ),
    listRoles: () => requestJson(options, "/rbac/roles"),
    listPermissions: () => requestJson(options, "/rbac/permissions"),
    getAccountSecurity: () => requestJson(options, "/account/security"),
    listSecuritySessions: () =>
      requestJson(options, "/admin/security/sessions"),
    revokeSecuritySession: (sessionId, input = {}) =>
      requestJson(
        options,
        `/admin/security/sessions/${sessionId}/revoke`,
        withJsonBody(input, { method: "POST" }),
      ),
    revokeAllUserSecuritySessions: (userId, input = {}) =>
      requestJson(
        options,
        `/admin/security/users/${userId}/revoke-all-sessions`,
        withJsonBody(input, { method: "POST" }),
      ),
    getWorkspaceSecuritySettings: () =>
      requestJson(options, "/admin/security/workspace-policies"),
    updateWorkspaceSecuritySettings: (input) =>
      requestJson(
        options,
        "/admin/security/workspace-policies",
        withJsonBody(input, { method: "PATCH" }),
      ),
    createReauthChallenge: (input) =>
      requestJson(
        options,
        "/security/reauth/challenge",
        withJsonBody(input, { method: "POST" }),
      ),
    verifyReauthChallenge: (input) =>
      requestJson(
        options,
        "/security/reauth/verify",
        withJsonBody(input, { method: "POST" }),
      ),
    getAdminSecurityOverview: () =>
      requestJson(options, "/admin/security/overview"),
    listSecretsInventory: () => requestJson(options, "/admin/security/secrets"),
    markSecretCompromised: (secretCode, input = {}) =>
      requestJson(
        options,
        `/admin/security/secrets/${secretCode}/mark-compromised`,
        withJsonBody(input, { method: "POST" }),
      ),
    startSecretRotation: (secretCode, input = {}) =>
      requestJson(
        options,
        `/admin/security/secrets/${secretCode}/rotation/start`,
        withJsonBody(input, { method: "POST" }),
      ),
    completeSecretRotation: (secretCode, input = {}) =>
      requestJson(
        options,
        `/admin/security/secrets/${secretCode}/rotation/complete`,
        withJsonBody(input, { method: "POST" }),
      ),
    listAuditEvents: () => requestJson(options, "/audit/events"),
    listAuditEventsAdmin: () =>
      requestJson(options, "/admin/security/audit-events"),
    exportAuditEvents: (input) =>
      requestJson(
        options,
        "/admin/security/audit/export",
        withJsonBody(input, { method: "POST" }),
      ),
    listAiProviderPolicies: () =>
      requestJson(options, "/admin/security/ai/policies"),
    getActivepiecesSecurityOverview: () =>
      requestJson(options, "/admin/security/activepieces"),
    listSecurityAlerts: () => requestJson(options, "/admin/security/alerts"),
    updateSecurityAlert: (alertId, input) =>
      requestJson(
        options,
        `/admin/security/alerts/${alertId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listSecurityIncidents: () =>
      requestJson(options, "/admin/security/incidents"),
    createSecurityIncident: (input) =>
      requestJson(
        options,
        "/admin/security/incidents",
        withJsonBody(input, { method: "POST" }),
      ),
    updateSecurityIncident: (incidentId, input) =>
      requestJson(
        options,
        `/admin/security/incidents/${incidentId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listComplianceProcessingActivities: () =>
      requestJson(options, "/admin/compliance/processing-activities"),
    listRetentionPolicies: () =>
      requestJson(options, "/admin/compliance/retention-policies"),
    getRetentionReport: () =>
      requestJson(options, "/admin/compliance/retention/report"),
    listDsrRequests: () => requestJson(options, "/admin/compliance/dsr"),
    listAccessReviewCampaigns: () =>
      requestJson(options, "/admin/compliance/access-reviews"),
    listLegalModules: () => requestJson(options, "/legal-modules"),
    getLegalModule: (code) => requestJson(options, `/legal-modules/${code}`),
    validateLegalModuleStep: (input) =>
      requestJson(
        options,
        "/legal-modules/validate-step",
        withJsonBody(input, { method: "POST" }),
      ),
    getLibrary: () => requestJson(options, "/library"),
    listAutomationTemplates: (input = {}) =>
      requestJson(options, `/automation-templates${buildQueryString(input)}`),
    getAutomationTemplate: (id) =>
      requestJson(options, `/automation-templates/${id}`),
    createAutomationTemplate: (input) =>
      requestJson(
        options,
        "/automation-templates",
        withJsonBody(input, { method: "POST" }),
      ),
    updateAutomationTemplate: (id, input) =>
      requestJson(
        options,
        `/automation-templates/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    createAutomationTemplateVersion: (id, input) =>
      requestJson(
        options,
        `/automation-templates/${id}/versions`,
        withJsonBody(input, { method: "POST" }),
      ),
    validateAutomationTemplateVersion: (id) =>
      requestJson(options, `/automation-template-versions/${id}/validate`, {
        method: "POST",
      }),
    publishAutomationTemplateDraft: (id) =>
      requestJson(
        options,
        `/automation-template-versions/${id}/publish-draft`,
        {
          method: "POST",
        },
      ),
    installAutomationTemplate: (id, input) =>
      requestJson(
        options,
        `/automation-templates/${id}/install`,
        withJsonBody(input, { method: "POST" }),
      ),
    forkAutomationTemplate: (id, input) =>
      requestJson(
        options,
        `/automation-templates/${id}/fork`,
        withJsonBody(input, { method: "POST" }),
      ),
    getRelatedAutomationTemplates: (id) =>
      requestJson(options, `/automation-templates/${id}/related`),
    listInstalledAutomations: () => requestJson(options, "/automations"),
    getAutomation: (id) => requestJson(options, `/automations/${id}`),
    getAutomationCanvas: (id) =>
      requestJson(options, `/automations/${id}/canvas`),
    getAutomationCanvasSecurityContext: (id) =>
      requestJson(options, `/automations/${id}/canvas/security/context`),
    listAutomationCanvasSecurityPolicies: (id) =>
      requestJson(options, `/automations/${id}/canvas/security/policies`),
    checkAutomationCanvasSecurityAction: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/security/check-action`,
        withJsonBody(input, { method: "POST" }),
      ),
    requestAutomationCanvasPolicyOverride: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/security/request-override`,
        withJsonBody(input, { method: "POST" }),
      ),
    approveAutomationCanvasPolicyOverride: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/security/approve-override`,
        withJsonBody(input, { method: "POST" }),
      ),
    rejectAutomationCanvasPolicyOverride: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/security/reject-override`,
        withJsonBody(input, { method: "POST" }),
      ),
    listAutomationCanvasAuditEvents: (id) =>
      requestJson(options, `/automations/${id}/canvas/audit`),
    getAutomationCanvasAuditEvent: (id, eventId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/audit/${encodeURIComponent(eventId)}`,
      ),
    exportAutomationCanvasAuditEvents: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/audit/export`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationCanvasAuditHashChainStatus: (id) =>
      requestJson(options, `/automations/${id}/canvas/audit/hash-chain/status`),
    getAutomationCanvasPresentation: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/presentation${buildQueryString({
          mode: input.mode ?? undefined,
          locale: input.locale ?? undefined,
        })}`,
      ),
    getAutomationCanvasSuggestions: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/suggestions${buildQueryString({
          contextNodeId: input.contextNodeId ?? undefined,
          locale: input.locale ?? undefined,
        })}`,
      ),
    applyAutomationCanvasSuggestion: (id, suggestionId, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/suggestions/${encodeURIComponent(
          suggestionId,
        )}/apply`,
        withJsonBody(
          {
            confirmed_by_user: input.confirmedByUser === true,
            context_node_id: input.contextNodeId ?? undefined,
          },
          { method: "POST" },
        ),
      ),
    openAutomationCanvasDraft: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/drafts`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationCanvasVersionState: (id) =>
      requestJson(options, `/automations/${id}/canvas/version-state`),
    getAutomationCanvasVersions: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/versions${buildQueryString({
          status: input.status ?? undefined,
          include_checkpoints:
            input.includeCheckpoints === undefined
              ? undefined
              : String(input.includeCheckpoints),
          cursor: input.cursor ?? undefined,
          limit:
            input.limit === undefined || input.limit === null
              ? undefined
              : String(input.limit),
        })}`,
      ),
    getAutomationCanvasIo: (id) =>
      requestJson(options, `/automations/${id}/canvas/io`),
    getStepInspector: (id, nodeId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/inspector`,
      ),
    listStepDataSources: (id, nodeId, inputKey) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/data-sources${buildQueryString({ input_key: inputKey })}`,
      ),
    listCanvasInputSources: (id, nodeId, inputKey) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/inputs/${encodeURIComponent(inputKey)}/sources`,
      ),
    testCanvasNode: (id, nodeId, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(nodeId)}/test`,
        withJsonBody(input, { method: "POST" }),
      ),
    createCanvasTestRun: (id, mode, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${mode}`,
        withJsonBody(input, { method: "POST" }),
      ),
    getCanvasTestRun: (id, testRunId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(testRunId)}`,
      ),
    listCanvasTestRunSteps: (id, testRunId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(
          testRunId,
        )}/steps`,
      ),
    getCanvasTestRunStep: (id, testRunId, nodeId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(
          testRunId,
        )}/steps/${encodeURIComponent(nodeId)}`,
      ),
    cancelCanvasTestRun: (id, testRunId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(
          testRunId,
        )}/cancel`,
        { method: "POST" },
      ),
    listCanvasTestArtifacts: (id, testRunId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(
          testRunId,
        )}/artifacts`,
      ),
    getCanvasTestSupportBundle: (id, testRunId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/test-runs/${encodeURIComponent(
          testRunId,
        )}/support-bundle`,
      ),
    validateCanvasBinding: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/bindings/validate`,
        withJsonBody(input, { method: "POST" }),
      ),
    getCanvasSampleOutput: (id, nodeId, outputKey) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/outputs/${encodeURIComponent(outputKey)}/sample`,
      ),
    pinCanvasSampleOutput: (id, nodeId, outputKey, sampleDataId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/outputs/${encodeURIComponent(outputKey)}/pinned-data`,
        withJsonBody({ sample_data_id: sampleDataId }, { method: "POST" }),
      ),
    unpinCanvasSampleOutput: (id, nodeId, outputKey) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/outputs/${encodeURIComponent(outputKey)}/pinned-data`,
        { method: "DELETE" },
      ),
    applyCanvasOperations: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/operations`,
        withJsonBody(input, { method: "POST" }),
      ),
    previewCanvasOperations: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/operations/preview`,
        withJsonBody(input, { method: "POST" }),
      ),
    validateAutomationCanvas: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/validate`,
        withJsonBody(input, { method: "POST" }),
      ),
    validateCanvasNodeConfig: (id, nodeId, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/nodes/${encodeURIComponent(
          nodeId,
        )}/validate-config`,
        withJsonBody(input, { method: "POST" }),
      ),
    explainCanvasValidationIssue: (id, issueId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/validation/issues/${encodeURIComponent(
          issueId,
        )}/explain`,
        { method: "POST" },
      ),
    applyCanvasValidationFix: (id, issueId, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/validation/issues/${encodeURIComponent(
          issueId,
        )}/apply-fix`,
        withJsonBody(input, { method: "POST" }),
      ),
    sendCanvasAiMessage: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/messages`,
        withJsonBody(input, { method: "POST" }),
      ),
    proposeCanvasAiPatch: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/propose-patch`,
        withJsonBody(
          { ...input, mode: input.mode ?? "edit" },
          { method: "POST" },
        ),
      ),
    explainCanvasWithAi: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/explain`,
        withJsonBody(
          {
            ...input,
            mode: "explain",
            message: input.message ?? "Explain the current Canvas workflow.",
          },
          { method: "POST" },
        ),
      ),
    fixCanvasValidationWithAi: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/fix-validation`,
        withJsonBody(
          {
            ...input,
            mode: "fix_validation",
            message:
              input.message ??
              "Propose a fix for the selected Canvas validation issue.",
          },
          { method: "POST" },
        ),
      ),
    configureCanvasStepWithAi: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/configure-step`,
        withJsonBody(
          {
            ...input,
            mode: "configure_step",
            message: input.message ?? "Configure the selected Canvas step.",
          },
          { method: "POST" },
        ),
      ),
    createCanvasAiTestPlan: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/test-plan`,
        withJsonBody(
          {
            ...input,
            mode: "test_plan",
            message: input.message ?? "Create a draft-only Canvas test plan.",
          },
          { method: "POST" },
        ),
      ),
    applyCanvasAiPatch: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/apply-patch`,
        withJsonBody(input, { method: "POST" }),
      ),
    rejectCanvasAiPatch: (id, patchId, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/patches/${encodeURIComponent(
          patchId,
        )}/reject`,
        withJsonBody(input, { method: "POST" }),
      ),
    getCanvasAiPatch: (id, patchId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/ai/patches/${encodeURIComponent(patchId)}`,
      ),
    createCanvasSnapshot: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/snapshots`,
        withJsonBody(input, { method: "POST" }),
      ),
    createCanvasCheckpoint: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/checkpoints`,
        withJsonBody(input, { method: "POST" }),
      ),
    restoreCanvasSnapshot: (id, snapshotId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/snapshots/${snapshotId}/restore`,
        { method: "POST" },
      ),
    publishAutomationCanvas: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/publish`,
        withJsonBody(input, { method: "POST" }),
      ),
    validateAutomationCanvasPublish: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/publish/validate`,
        withJsonBody(input, { method: "POST" }),
      ),
    compareAutomationCanvasVersions: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/versions/compare${buildQueryString({
          from: input.from,
          to: input.to,
        })}`,
      ),
    getAutomationCanvasRollbackImpact: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/rollback/impact`,
        withJsonBody(input, { method: "POST" }),
      ),
    rollbackAutomationCanvas: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/rollback`,
        withJsonBody(input, { method: "POST" }),
      ),
    emergencyDisableAutomationCanvas: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/emergency-disable`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationCanvasRuntimeProjection: (id, versionId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/versions/${versionId}/runtime-projection`,
      ),
    exportAutomationCanvasVersion: (id, versionId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/versions/${versionId}/export`,
      ),
    restoreAutomationCanvasVersion: (id, versionId) =>
      requestJson(
        options,
        `/automations/${id}/canvas/versions/${versionId}/restore-as-draft`,
        { method: "POST" },
      ),
    previewAutomationCanvasCompile: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/compile-preview`,
        withJsonBody(input, { method: "POST" }),
      ),
    compileAutomationCanvas: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/compile`,
        withJsonBody(input, { method: "POST" }),
      ),
    syncAutomationCanvasRuntime: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/canvas/sync-runtime`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationRuntimeBinding: (id) =>
      requestJson(options, `/automations/${id}/runtime-binding`),
    getAutomationRuntimeSyncStatus: (id) =>
      requestJson(options, `/automations/${id}/runtime/sync-status`),
    pullAutomationRuntime: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/runtime/pull`,
        withJsonBody(input, { method: "POST" }),
      ),
    previewAutomationRuntimeImport: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runtime/import-preview`,
        withJsonBody(input, { method: "POST" }),
      ),
    applyAutomationRuntimeImport: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runtime/import-apply`,
        withJsonBody(input, { method: "POST" }),
      ),
    rejectAutomationRuntimeImport: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runtime/import-reject`,
        withJsonBody(input, { method: "POST" }),
      ),
    overwriteAutomationRuntime: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runtime/overwrite`,
        withJsonBody(input, { method: "POST" }),
      ),
    listAutomationCompileReports: (id) =>
      requestJson(options, `/automations/${id}/compile-reports`),
    getAutomationCompileReport: (id, reportId) =>
      requestJson(options, `/automations/${id}/compile-reports/${reportId}`),
    checkAutomationRuntimeDrift: (id) =>
      requestJson(options, `/automations/${id}/runtime/check-drift`, {
        method: "POST",
      }),
    pullAutomationRuntimeSnapshot: (id) =>
      requestJson(options, `/automations/${id}/runtime/pull-snapshot`, {
        method: "POST",
      }),
    acquireCanvasLock: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/lock`,
        withJsonBody(
          {
            draft_id: input.draftId ?? null,
            ttl_seconds: input.ttlSeconds ?? null,
          },
          { method: "POST" },
        ),
      ),
    heartbeatCanvasLock: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/lock/heartbeat`,
        withJsonBody(
          {
            draft_id: input.draftId ?? null,
            lock_id: input.lockId ?? null,
            ttl_seconds: input.ttlSeconds ?? null,
          },
          { method: "POST" },
        ),
      ),
    releaseCanvasLock: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/canvas/lock`,
        withJsonBody(
          {
            draft_id: input.draftId ?? null,
            lock_id: input.lockId ?? null,
          },
          { method: "DELETE" },
        ),
      ),
    listCanvasBlockTypes: () => requestJson(options, "/canvas/block-types"),
    getCanvasBlockType: (code) =>
      requestJson(options, `/canvas/block-types/${code}`),
    getCanvasBlockSchema: (code) =>
      requestJson(options, `/canvas/block-types/${code}/schema`),
    listCanvasModuleCatalog: (input = {}) =>
      requestJson(
        options,
        `/canvas/modules${buildQueryString({
          automation_id: input.automationId ?? undefined,
          draft_version_id: input.draftVersionId ?? undefined,
          context_node_id: input.contextNodeId ?? undefined,
          insert_position: input.insertPosition ?? undefined,
          mode: input.mode ?? undefined,
          q: input.query ?? undefined,
          source: input.source ?? undefined,
          status: input.status ?? undefined,
          runtime: input.runtime ?? undefined,
          limit:
            input.limit !== undefined && input.limit !== null
              ? String(input.limit)
              : undefined,
          cursor: input.cursor ?? undefined,
        })}`,
      ),
    getCanvasModuleDetail: (moduleCode, automationId) =>
      requestJson(
        options,
        `/canvas/modules/${encodeURIComponent(moduleCode)}${buildQueryString({
          automation_id: automationId ?? undefined,
        })}`,
      ),
    checkCanvasModuleCompatibility: (moduleCode, input) =>
      requestJson(
        options,
        `/canvas/modules/${encodeURIComponent(moduleCode)}/compatibility-check`,
        withJsonBody(input, { method: "POST" }),
      ),
    validateCanvasBlock: (input) =>
      requestJson(
        options,
        "/canvas/validate-block",
        withJsonBody(input, { method: "POST" }),
      ),
    validateCanvasConnection: (input) =>
      requestJson(
        options,
        "/canvas/validate-connection",
        withJsonBody(input, { method: "POST" }),
      ),
    previewCanvasBlock: (input) =>
      requestJson(
        options,
        "/canvas/preview-block",
        withJsonBody(input, { method: "POST" }),
      ),
    testCanvasBlock: (input) =>
      requestJson(
        options,
        "/canvas/test-block",
        withJsonBody(input, { method: "POST" }),
      ),
    listCanvasModules: (automationId) =>
      requestJson(
        options,
        `/modules${buildQueryString({
          context: "canvas",
          automation_id: automationId,
        })}`,
      ),
    listConnectionRequirements: (input = {}) =>
      requestJson(
        options,
        `/connections/requirements${buildQueryString({
          module_code: input.moduleCode ?? undefined,
        })}`,
      ),
    createConnectionRequest: (input) =>
      requestJson(
        options,
        "/connections/requests",
        withJsonBody(
          {
            module_code: input.moduleCode ?? null,
            connection_type: input.connectionType ?? null,
          },
          { method: "POST" },
        ),
      ),
    ...createStage15Client(options),
    ...createChatClient(options),
    ...createSettingsClient(options),
    listLegalSources: () => requestJson(options, "/legal-sources"),
    getLegalSource: (sourceId) =>
      requestJson(options, `/legal-sources/${sourceId}`),
    createLegalImportJob: (input) =>
      requestJson(
        options,
        "/legal-sources/import-jobs",
        withJsonBody(input, { method: "POST" }),
      ),
    getLegalImportJob: (jobId) =>
      requestJson(options, `/legal-import-jobs/${jobId}`),
    queryLegalSearch: (input) =>
      requestJson(
        options,
        "/legal-search/query",
        withJsonBody(input, { method: "POST" }),
      ),
    analyzeLegalRag: (input) =>
      requestJson(
        options,
        "/legal-rag/analyze",
        withJsonBody(input, { method: "POST" }),
      ),
    getLegalRagRequest: (requestId) =>
      requestJson(options, `/legal-rag/requests/${requestId}`),
    forkInstalledAutomationToTemplate: (id, input) =>
      requestJson(
        options,
        `/installed-automations/${id}/fork-to-template`,
        withJsonBody(input, { method: "POST" }),
      ),
    getInstalledAutomationSourceDiff: (id) =>
      requestJson(options, `/installed-automations/${id}/source-diff`),
    applyInstalledAutomationSourceUpdate: (id, input) =>
      requestJson(
        options,
        `/installed-automations/${id}/apply-source-update`,
        withJsonBody(input, { method: "POST" }),
      ),
    submitAutomationTemplatePublication: (id, input) =>
      requestJson(
        options,
        `/automation-templates/${id}/submit-publication`,
        withJsonBody(input, { method: "POST" }),
      ),
    getPublicationRequest: (id) =>
      requestJson(options, `/publication-requests/${id}`),
    listPublicationRequests: () =>
      requestJson(options, "/moderation/publication-requests"),
    getModerationPublicationRequest: (id) =>
      requestJson(options, `/moderation/publication-requests/${id}`),
    reviewPublicationRequest: (id, input) =>
      requestJson(
        options,
        `/moderation/publication-requests/${id}/${input.decision}`,
        withJsonBody(input, { method: "POST" }),
      ),
    getRuns: () => requestJson(options, "/runs"),
    getDashboardSnapshot: () => requestJson(options, "/dashboard/snapshot"),
    getDashboardEvents: (input = {}) =>
      requestJson(
        options,
        `/dashboard/events${buildQueryString({
          ...(input.sinceSequence !== undefined && input.sinceSequence !== null
            ? { since_sequence: String(input.sinceSequence) }
            : {}),
        })}`,
      ),
    getSystemStatus: () => requestJson(options, "/system/status"),
    preflightAutomationRun: (id, input = {}) =>
      requestJson(
        options,
        `/automations/${id}/runs/preflight`,
        withJsonBody(input, { method: "POST" }),
      ),
    createAutomationRun: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runs`,
        withJsonBody(input, { method: "POST" }),
      ),
    getRun: (runId) => requestJson(options, `/runs/${runId}`),
    getRunLiveSnapshot: (runId) =>
      requestJson(options, `/runs/${runId}/live-snapshot`),
    cancelRun: (runId) =>
      requestJson(options, `/runs/${runId}/cancel`, { method: "POST" }),
    retryRun: (runId) =>
      requestJson(options, `/runs/${runId}/retry`, { method: "POST" }),
    retryRunStep: (runId, stepId) =>
      requestJson(options, `/runs/${runId}/steps/${stepId}/retry`, {
        method: "POST",
      }),
    getRecommendations: () => requestJson(options, "/recommendations"),
    getRecommendation: (id) => requestJson(options, `/recommendations/${id}`),
    acceptRecommendation: (id, input = {}) =>
      requestJson(
        options,
        `/recommendations/${id}/accept`,
        withJsonBody(input, { method: "POST" }),
      ),
    dismissRecommendation: (id, input = {}) =>
      requestJson(
        options,
        `/recommendations/${id}/dismiss`,
        withJsonBody(input, { method: "POST" }),
      ),
    snoozeRecommendation: (id, input = {}) =>
      requestJson(
        options,
        `/recommendations/${id}/snooze`,
        withJsonBody(input, { method: "POST" }),
      ),
    sendRecommendationFeedback: (id, input) =>
      requestJson(
        options,
        `/recommendations/${id}/feedback`,
        withJsonBody(input, { method: "POST" }),
      ),
    listRecommendationPatterns: () =>
      requestJson(options, "/admin/recommendations/patterns"),
    getRecommendationPattern: (id) =>
      requestJson(options, `/admin/analytics/patterns/${id}`),
    listRecommendationProcessCases: () =>
      requestJson(options, "/admin/analytics/process-cases"),
    captureProductEvent: (input) =>
      requestJson(
        options,
        "/events/capture",
        withJsonBody(input, { method: "POST" }),
      ),
    getReadiness: async () => {
      const response = await requestJson<ReadinessSummaryResponse>(
        options,
        "/health/readiness",
      );

      return response.gates;
    },
    getReadinessSummary: () => requestJson(options, "/health/readiness"),
    getReadinessDetails: () =>
      requestJson(options, "/health/readiness/details"),
    getStage18Readiness: () => requestJson(options, "/readiness/stage18"),
    getStage20Readiness: () => requestJson(options, "/readiness/stage20"),
    createAutomationIntent: (projectId, input) =>
      requestJson(
        options,
        `/projects/${encodeURIComponent(projectId)}/automation-intents`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationIntent: (intentId) =>
      requestJson(
        options,
        `/automation-intents/${encodeURIComponent(intentId)}`,
      ),
    updateAutomationIntent: (intentId, input) =>
      requestJson(
        options,
        `/automation-intents/${encodeURIComponent(intentId)}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    cancelAutomationIntent: (intentId) =>
      requestJson(
        options,
        `/automation-intents/${encodeURIComponent(intentId)}/cancel`,
        { method: "POST" },
      ),
    planAutomationIntent: (intentId) =>
      requestJson(
        options,
        `/automation-intents/${encodeURIComponent(intentId)}/plan`,
        { method: "POST" },
      ),
    answerAutomationClarification: (intentId, clarificationId, input) =>
      requestJson(
        options,
        `/automation-intents/${encodeURIComponent(intentId)}/clarifications/${encodeURIComponent(clarificationId)}/answer`,
        withJsonBody(input, { method: "POST" }),
      ),
    getAutomationBlueprint: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}`,
      ),
    validateAutomationBlueprint: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/validate`,
        { method: "POST" },
      ),
    compileAutomationBlueprintPreview: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/compile-preview`,
        { method: "POST" },
      ),
    approveAutomationBlueprint: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/approve`,
        { method: "POST" },
      ),
    rejectAutomationBlueprint: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/reject`,
        { method: "POST" },
      ),
    convertAutomationBlueprintToCanvasDraft: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/convert-to-canvas-draft`,
        { method: "POST" },
      ),
    createAutomationRuntimeDraft: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/create-runtime-draft`,
        { method: "POST" },
      ),
    exportAutomationBlueprint: (blueprintId) =>
      requestJson(
        options,
        `/automation-blueprints/${encodeURIComponent(blueprintId)}/export`,
        { method: "POST" },
      ),
    createAutomationBuilderSession: (input) =>
      requestJson(
        options,
        "/automation-builder/sessions",
        withJsonBody(input, { method: "POST" }),
      ),
    archiveAutomationBuilderSession: (sessionId) =>
      requestJson(
        options,
        `/automation-builder/sessions/${encodeURIComponent(sessionId)}/archive`,
        { method: "POST" },
      ),
    getAutomationModuleCatalog: () =>
      requestJson(options, "/automation-builder/module-catalog"),
    resolveAutomationModuleCatalog: (input) =>
      requestJson(
        options,
        "/automation-builder/module-catalog/resolve",
        withJsonBody(input, { method: "POST" }),
      ),
    previewAutomationBuilderContext: (input) =>
      requestJson(
        options,
        "/automation-builder/context/preview",
        withJsonBody(input, { method: "POST" }),
      ),
    preflightAutomationBuilderSecurity: () =>
      requestJson(
        options,
        "/automation-builder/security/preflight",
        { method: "POST" },
      ),
    getAutomationRuntimeRequirements: (id) =>
      requestJson(options, `/automations/${id}/runtime/requirements`),
    createActivepiecesSession: async (input) =>
      mapActivepiecesSessionResponse(
        await requestJson<ActivepiecesSessionWireResponse>(
          options,
          "/activepieces/session",
          withJsonBody(toActivepiecesSessionWireRequest(input), {
            method: "POST",
            ...(input.idempotencyKey
              ? { headers: { "x-idempotency-key": input.idempotencyKey } }
              : {}),
          }),
        ),
      ),
    getActivepiecesCanvasReadiness: async (input) =>
      mapActivepiecesCanvasReadinessResponse(
        await requestJson<ActivepiecesCanvasReadinessWireResponse>(
          options,
          `/projects/${encodeURIComponent(input.projectId)}/automations/${encodeURIComponent(
            input.automationId,
          )}/canvas-readiness`,
        ),
      ),
    initializeActivepiecesSession: async (input) =>
      mapInitializeActivepiecesSessionResponse(
        await requestJson<InitializeActivepiecesSessionWireResponse>(
          options,
          `/activepieces/session/${encodeURIComponent(input.sessionId)}/initialized`,
          withJsonBody(toInitializeActivepiecesSessionWireRequest(input), {
            method: "POST",
          }),
        ),
      ),
    recordActivepiecesIframeHealth: async (input) =>
      mapRecordActivepiecesIframeHealthResponse(
        await requestJson<RecordActivepiecesIframeHealthWireResponse>(
          options,
          `/activepieces/session/${encodeURIComponent(input.sessionId)}/iframe-health`,
          withJsonBody(toRecordActivepiecesIframeHealthWireRequest(input), {
            method: "POST",
          }),
        ),
      ),
    syncAutomationRuntime: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/runtime/sync`,
        withJsonBody(input, { method: "POST" }),
      ),
    startAutomationRun: (id, input) =>
      requestJson(
        options,
        `/automations/${id}/run`,
        withJsonBody(input, { method: "POST" }),
      ),
    getActivepiecesIntegrationStatus: () =>
      requestJson(options, "/integrations/activepieces/status"),
    runActivepiecesSmoke: (input) =>
      requestJson(
        options,
        "/activepieces/run-smoke",
        withJsonBody(input, { method: "POST" }),
      ),
    getDeliveryIntegrationStatus: () =>
      requestJson(options, "/integrations/delivery/status"),
    runDeliverySandboxTest: (input = {}) =>
      requestJson(
        options,
        "/delivery/sandbox/test",
        withJsonBody(input, { method: "POST" }),
      ),
    listRuntimeConnections: () => requestJson(options, "/runtime/connections"),
    upsertRuntimeConnection: (input) =>
      requestJson(
        options,
        "/runtime/connections",
        withJsonBody(input, { method: "POST" }),
      ),
    listDocuments: (input = {}) =>
      requestJson(options, `/documents${buildQueryString(input)}`),
    getCurrentLegalWorkProfile: () => requestJson(options, "/profiles/current"),
    getEffectiveLegalWorkProfile: () =>
      requestJson(options, "/profiles/effective"),
    createLegalWorkProfile: (input) =>
      requestJson(
        options,
        "/profiles",
        withJsonBody(input, { method: "POST" }),
      ),
    updateLegalWorkProfileDraft: (profileId, input) =>
      requestJson(
        options,
        `/profiles/${profileId}/draft`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    validateLegalWorkProfile: (profileId) =>
      requestJson(options, `/profiles/${profileId}/validate`, {
        method: "POST",
      }),
    publishLegalWorkProfile: (profileId) =>
      requestJson(options, `/profiles/${profileId}/publish`, {
        method: "POST",
      }),
    listLegalWorkProfileVersions: (profileId) =>
      requestJson(options, `/profiles/${profileId}/versions`),
    restoreLegalWorkProfileVersion: (profileId, input) =>
      requestJson(
        options,
        `/profiles/${profileId}/restore-version`,
        withJsonBody(input, { method: "POST" }),
      ),
    previewEffectiveLegalWorkProfile: (profileId, input) =>
      requestJson(
        options,
        `/profiles/${profileId}/preview-effective`,
        withJsonBody(input, { method: "POST" }),
      ),
    listDocumentTypes: () => requestJson(options, "/document-types"),
    getDocumentType: (id) => requestJson(options, `/document-types/${id}`),
    createDocumentType: (input) =>
      requestJson(
        options,
        "/document-types",
        withJsonBody(input, { method: "POST" }),
      ),
    updateDocumentType: (id, input) =>
      requestJson(
        options,
        `/document-types/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listDocumentStructures: (input = {}) =>
      requestJson(options, `/document-structures${buildQueryString(input)}`),
    createDocumentStructure: (input) =>
      requestJson(
        options,
        "/document-structures",
        withJsonBody(input, { method: "POST" }),
      ),
    updateDocumentStructure: (id, input) =>
      requestJson(
        options,
        `/document-structures/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listClauses: () => requestJson(options, "/clauses"),
    createClause: (input) =>
      requestJson(options, "/clauses", withJsonBody(input, { method: "POST" })),
    updateClause: (id, input) =>
      requestJson(
        options,
        `/clauses/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listPhraseRules: () => requestJson(options, "/phrase-rules"),
    createPhraseRule: (input) =>
      requestJson(
        options,
        "/phrase-rules",
        withJsonBody(input, { method: "POST" }),
      ),
    updatePhraseRule: (id, input) =>
      requestJson(
        options,
        `/phrase-rules/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listDocumentTemplates: () => requestJson(options, "/document-templates"),
    getDocumentTemplate: (id) =>
      requestJson(options, `/document-templates/${id}`),
    createDocumentTemplate: (input) =>
      requestJson(
        options,
        "/document-templates",
        withJsonBody(input, { method: "POST" }),
      ),
    updateDocumentTemplate: (id, input) =>
      requestJson(
        options,
        `/document-templates/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    parseDocumentTemplatePlaceholders: (id) =>
      requestJson(options, `/document-templates/${id}/parse-placeholders`, {
        method: "POST",
      }),
    publishDocumentTemplateDraft: (id, input = {}) =>
      requestJson(
        options,
        `/document-template-versions/${id}/publish-draft`,
        withJsonBody(input, { method: "POST" }),
      ),
    createDocumentGenerationPreview: (input) =>
      requestJson(
        options,
        "/document-generation/previews",
        withJsonBody(input, { method: "POST" }),
      ),
    getDocumentGenerationJob: (id) =>
      requestJson(options, `/document-generation/${id}`),
    finalizeDocumentGeneration: (id, input = {}) =>
      requestJson(
        options,
        `/document-generation/${id}/finalize`,
        withJsonBody(input, { method: "POST" }),
      ),
    getDocumentValidationReport: (id) =>
      requestJson(options, `/document-validations/${id}`),
    recheckDocumentValidation: (id, input) =>
      requestJson(
        options,
        `/document-validations/${id}/recheck`,
        withJsonBody(input, { method: "POST" }),
      ),
    listApprovalRoutes: () => requestJson(options, "/approval-routes"),
    getApprovalRoute: (id) => requestJson(options, `/approval-routes/${id}`),
    createApprovalRoute: (input) =>
      requestJson(
        options,
        "/approval-routes",
        withJsonBody(input, { method: "POST" }),
      ),
    updateApprovalRoute: (id, input) =>
      requestJson(
        options,
        `/approval-routes/${id}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    listApprovalTasks: () => requestJson(options, "/approval-tasks"),
    getApprovalTask: (id) => requestJson(options, `/approval-tasks/${id}`),
    approveApprovalTask: (id, input = {}) =>
      requestJson(
        options,
        `/approval-tasks/${id}/approve`,
        withJsonBody(input, { method: "POST" }),
      ),
    rejectApprovalTask: (id, input = {}) =>
      requestJson(
        options,
        `/approval-tasks/${id}/reject`,
        withJsonBody(input, { method: "POST" }),
      ),
    requestApprovalTaskChanges: (id, input = {}) =>
      requestJson(
        options,
        `/approval-tasks/${id}/request-changes`,
        withJsonBody(input, { method: "POST" }),
      ),
    executeWorkflowRuntimeDocumentTemplate: (input) =>
      requestJson(
        options,
        "/workflow-runtime/document-template/execute",
        withJsonBody(input, { method: "POST" }),
      ),
    executeWorkflowRuntimeDocumentValidation: (input) =>
      requestJson(
        options,
        "/workflow-runtime/document-validation/execute",
        withJsonBody(input, { method: "POST" }),
      ),
    executeWorkflowRuntimeApprovalRequest: (input) =>
      requestJson(
        options,
        "/workflow-runtime/approval-request/execute",
        withJsonBody(input, { method: "POST" }),
      ),
    createProfileImportJob: (input) =>
      requestJson(
        options,
        "/profile-imports",
        withJsonBody(input, { method: "POST" }),
      ),
    getDocument: (documentId) =>
      requestJson(options, `/documents/${documentId}`),
    listDocumentVersions: (documentId) =>
      requestJson(options, `/documents/${documentId}/versions`),
    createDocumentUploadIntent: (input) =>
      requestJson(
        options,
        "/documents/upload-intents",
        withJsonBody(input, { method: "POST" }),
      ),
    createDocumentVersionUploadIntent: (documentId, input) =>
      requestJson(
        options,
        `/documents/${documentId}/versions/upload-intent`,
        withJsonBody(input, { method: "POST" }),
      ),
    completeDocumentUpload: (documentId, versionId, input) =>
      requestJson(
        options,
        `/documents/${documentId}/versions/${versionId}/complete`,
        withJsonBody(input, { method: "POST" }),
      ),
    makeDocumentVersionCurrent: (documentId, versionId) =>
      requestJson(
        options,
        `/documents/${documentId}/versions/${versionId}/make-current`,
        {
          method: "POST",
        },
      ),
    createDocumentSignedUrl: (documentId, input) =>
      requestJson(
        options,
        `/documents/${documentId}/signed-url`,
        withJsonBody(input, { method: "POST" }),
      ),
    archiveDocument: (documentId) =>
      requestJson(options, `/documents/${documentId}/archive`, {
        method: "POST",
      }),
    restoreDocument: (documentId) =>
      requestJson(options, `/documents/${documentId}/restore`, {
        method: "POST",
      }),
    deleteDocument: (documentId) =>
      requestJson(options, `/documents/${documentId}`, { method: "DELETE" }),
    listRunArtifacts: (runId) =>
      requestJson(options, `/runs/${runId}/artifacts`),
    createRunArtifact: (runId, input) =>
      requestJson(
        options,
        `/runs/${runId}/artifacts`,
        withJsonBody(input, { method: "POST" }),
      ),
    createArtifactSignedUrl: (artifactId, input) =>
      requestJson(
        options,
        `/artifacts/${artifactId}/signed-url`,
        withJsonBody(input, { method: "POST" }),
      ),
    acceptArtifactAsDocument: (artifactId) =>
      requestJson(options, `/artifacts/${artifactId}/accept-as-document`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    getDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}`),
    previewDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}/preview`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    approveDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}/approve`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    sendDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}/send`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    cancelDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}/cancel`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    retryDeliveryRequest: (id) =>
      requestJson(options, `/delivery-requests/${id}/retry`, {
        ...withJsonBody({}, { method: "POST" }),
      }),
    listNotifications: (input = {}) =>
      requestJson(
        options,
        `/notifications${buildQueryString({
          ...(input.cursor ? { cursor: input.cursor } : {}),
          ...(input.limit ? { limit: String(input.limit) } : {}),
          ...(input.status && input.status !== "all"
            ? { status: input.status }
            : {}),
          ...(input.type ? { type: input.type } : {}),
        })}`,
      ),
    markNotificationRead: (id) =>
      requestJson(options, `/notifications/${id}/read`, { method: "POST" }),
    markAllNotificationsRead: () =>
      requestJson(options, "/notifications/read-all", { method: "POST" }),
    registerDevice: (input) =>
      requestJson(
        options,
        "/devices/register",
        withJsonBody(input, { method: "POST" }),
      ),
    removeDevice: (id) =>
      requestJson(options, `/devices/${id}`, { method: "DELETE" }),
    createActivepiecesEmbedToken: (input) =>
      requestJson(
        options,
        "/activepieces/embed-token",
        withJsonBody(input, { method: "POST" }),
      ),
    listAiChatSessions: () => requestJson(options, "/ai/chat/sessions"),
    getAiChatSession: (sessionId) =>
      requestJson(options, `/ai/chat/sessions/${sessionId}`),
    listAiChatMessages: (sessionId) =>
      requestJson(options, `/ai/chat/sessions/${sessionId}/messages`),
    createAiChatSession: (input) =>
      requestJson(
        options,
        "/ai/chat/sessions",
        withJsonBody(input, { method: "POST" }),
      ),
    sendAiChatMessage: (input) =>
      requestJson(
        options,
        "/ai/chat/messages",
        withJsonBody(input, { method: "POST" }),
      ),
    listWorkflowDrafts: () => requestJson(options, "/ai/workflow-drafts"),
    getWorkflowDraft: (draftId) =>
      requestJson(options, `/ai/workflow-drafts/${draftId}`),
    createWorkflowDraft: (input) =>
      requestJson(
        options,
        "/ai/workflow-drafts",
        withJsonBody(input, { method: "POST" }),
      ),
    updateWorkflowDraftInputs: (draftId, input) =>
      requestJson(
        options,
        `/ai/workflow-drafts/${draftId}/inputs`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    materializeWorkflowDraft: (draftId, input) =>
      requestJson(
        options,
        `/workflow-drafts/${draftId}/materialize`,
        withJsonBody(input, { method: "POST" }),
      ),
    createWorkflowPatch: (input) =>
      requestJson(
        options,
        "/ai/workflow-patches",
        withJsonBody(input, { method: "POST" }),
      ),
    getAiRequest: (requestId) =>
      requestJson(options, `/ai/requests/${requestId}`),
    listAiRequestEvents: (requestId) =>
      requestJson(options, `/ai/requests/${requestId}/events`),
    previewAiRedaction: (input) =>
      requestJson(
        options,
        "/ai/redaction/preview",
        withJsonBody(input, { method: "POST" }),
      ),
  };
}
