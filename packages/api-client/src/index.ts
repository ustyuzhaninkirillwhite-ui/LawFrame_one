import type {
  AccessReviewCampaign,
  ActivepiecesIntegrationStatus,
  ActivepiecesRunSmokeRequest,
  ActivepiecesRunSmokeResponse,
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
  ApiErrorResponse,
  ArtifactAcceptAsDocumentResponse,
  ArtifactSignedUrlRequest,
  AutomationTemplateDetail,
  AutomationTemplateVersionSummary,
  ClauseLibraryItemSummary,
  CreateApprovalRouteRequest,
  CreateActivepiecesEmbedTokenRequest,
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

type MaybePromise<T> = T | Promise<T>;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
    public readonly requestId: string | null,
    public readonly details: Record<string, unknown> | undefined,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiClient {
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
  getAutomationRuntimeRequirements(
    id: string,
  ): Promise<AutomationRuntimeRequirements>;
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
  createWorkflowPatch(
    input: CreateWorkflowPatchRequest,
  ): Promise<AiChatResponse>;
  getAiRequest(requestId: string): Promise<AiRequestSummary>;
  listAiRequestEvents(requestId: string): Promise<readonly AiRequestEvent[]>;
  previewAiRedaction(
    input: AiRedactionPreviewRequest,
  ): Promise<AiRedactionPreviewResponse>;
}

interface FetchOptions {
  readonly baseUrl: string;
  readonly headers?:
    | HeadersInit
    | (() => MaybePromise<HeadersInit | undefined>);
  readonly getAccessToken?: () => MaybePromise<string | null | undefined>;
  readonly getWorkspaceId?: () => MaybePromise<string | null | undefined>;
  readonly getReauthToken?: () => MaybePromise<string | null | undefined>;
}

async function resolveHeaders(
  options: FetchOptions,
  init?: RequestInit,
): Promise<HeadersInit> {
  const baseHeaders =
    typeof options.headers === "function"
      ? await options.headers()
      : options.headers;
  const headers = new Headers(baseHeaders);
  const token = options.getAccessToken ? await options.getAccessToken() : null;
  const workspaceId = options.getWorkspaceId
    ? await options.getWorkspaceId()
    : null;
  const reauthToken = options.getReauthToken
    ? await options.getReauthToken()
    : null;

  if (workspaceId) {
    headers.set("x-workspace-id", workspaceId);
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  if (reauthToken) {
    headers.set("x-reauth-token", reauthToken);
  }

  if (init?.headers) {
    const requestHeaders = new Headers(init.headers);
    requestHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (init?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function requestJson<T>(
  options: FetchOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${options.baseUrl}${path}`, {
    ...init,
    headers: await resolveHeaders(options, init),
  });

  if (!response.ok) {
    let payload: ApiErrorResponse | null = null;

    try {
      payload = (await response.json()) as ApiErrorResponse;
    } catch {
      payload = null;
    }

    throw new ApiClientError(
      payload?.error.message ?? `HTTP ${response.status} for ${path}`,
      response.status,
      payload?.error.code ?? null,
      payload?.requestId ?? response.headers.get("x-request-id"),
      payload?.error.details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function withJsonBody(body: unknown, init?: RequestInit): RequestInit {
  return {
    method: init?.method ?? "POST",
    ...init,
    body: JSON.stringify(body),
  };
}

function buildQueryString(params: object) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : "";
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
    getAutomationRuntimeRequirements: (id) =>
      requestJson(options, `/automations/${id}/runtime/requirements`),
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
