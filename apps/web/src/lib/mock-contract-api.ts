import type {
  CompleteUploadRequest,
  CreateLegalImportJobRequest,
  CreateDocumentVersionUploadIntentRequest,
  CreateRunArtifactRequest,
  DeliveryIntegrationStatus,
  DeliverySandboxTestRequest,
  DeliverySandboxTestResponse,
  DocumentDetail,
  DocumentListQuery,
  DocumentListResponse,
  DocumentMutationResult,
  DocumentUploadIntentRequest,
  DocumentUploadIntentResponse,
  DocumentVersionSummary,
  LegalImportJob,
  LegalSearchQuery,
  LegalSearchResponse,
  LegalSourceDetail,
  LegalSourceSummary,
  RagAnalyzeRequest,
  RagRequestSummary,
  ProductEventCaptureRequest,
  ProductEventCaptureResponse,
  RecommendationAcceptRequest,
  RecommendationActionResult,
  RecommendationDetail,
  RecommendationDismissRequest,
  RecommendationFeedbackRequest,
  RecommendationPatternDetail,
  RecommendationPatternSummary,
  RecommendationSnoozeRequest,
  ProcessCaseSummary,
  RunArtifact,
  SignedUrlRequest,
  SignedUrlResponse,
} from "@lexframe/contracts";
import type {
  AutomationRuntimeRequirements,
  ActivepiecesIntegrationStatus,
  ActivepiecesRunSmokeRequest,
  ActivepiecesRunSmokeResponse,
  CreateActivepiecesEmbedTokenRequest,
  ActivepiecesEmbedTokenResponse,
  InstalledAutomationDetail,
  LibraryTemplateSummary,
  ReadinessDetailsResponse,
  ReadinessGate,
  ReadinessSummaryResponse,
  RecommendationCandidate,
  RuntimeConnectionSummary,
  RunSummary,
  SessionContext,
  StartAutomationRunRequest,
  StartAutomationRunResponse,
  SyncAutomationRuntimeRequest,
  SyncAutomationRuntimeResponse,
  UpsertRuntimeConnectionRequest,
} from "@lexframe/contracts";
import {
  activepiecesEmbedTokenFixture,
  createRunArtifactFixture,
  deliveryIntegrationStatusFixture,
  deliverySandboxTestFixture,
  documentDetailFixture,
  documentUploadIntentFixture,
  documentVersionsFixture,
  documentsFixture,
  installedAutomationFixture,
  legalImportJobFixture,
  legalSearchResponseFixture,
  legalSourceDetailFixture,
  legalSourceSummaryFixture,
  libraryTemplatesFixture,
  processCasesFixture,
  readinessFixture,
  recommendationActionResultFixture,
  recommendationDetailFixture,
  recommendationDetailsFixture,
  recommendationPatternDetailFixture,
  recommendationPatternsFixture,
  recommendationsFixture,
  ragRequestFixture,
  runArtifactsFixture,
  runsFixture,
  sessionContextFixture,
  signedUrlFixture,
  productEventCaptureResponseFixture,
} from "@lexframe/contracts";

function delay<T>(value: T, ms = 120) {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

const readinessSummaryFixture: ReadinessSummaryResponse = {
  gates: readinessFixture,
  profile: "local-basic",
  allowReadinessGateBlocked: true,
  contractSatisfied: true,
  serviceSummary: {
    total: 10,
    ready: 4,
    degraded: 0,
    blocked: 6,
  },
  workflowDsl: {},
  aiGateway: {},
  audit: {},
};

export function getSessionContext(): Promise<SessionContext> {
  return delay(sessionContextFixture);
}

export function getLibraryTemplates(): Promise<
  readonly LibraryTemplateSummary[]
> {
  return delay(libraryTemplatesFixture);
}

export function getAutomationDetail(): Promise<InstalledAutomationDetail> {
  return delay(installedAutomationFixture);
}

export function listLegalSources(): Promise<readonly LegalSourceSummary[]> {
  return delay([legalSourceSummaryFixture]);
}

export function getLegalSource(_sourceId?: string): Promise<LegalSourceDetail> {
  void _sourceId;
  return delay(legalSourceDetailFixture);
}

export function createLegalImportJob(
  _input: CreateLegalImportJobRequest,
): Promise<LegalImportJob> {
  void _input;
  return delay(legalImportJobFixture);
}

export function getLegalImportJob(_jobId?: string): Promise<LegalImportJob> {
  void _jobId;
  return delay(legalImportJobFixture);
}

export function queryLegalSearch(
  _input: LegalSearchQuery,
): Promise<LegalSearchResponse> {
  void _input;
  return delay(legalSearchResponseFixture);
}

export function analyzeLegalRag(
  _input: RagAnalyzeRequest,
): Promise<RagRequestSummary> {
  void _input;
  return delay(ragRequestFixture);
}

export function getLegalRagRequest(
  _requestId?: string,
): Promise<RagRequestSummary> {
  void _requestId;
  return delay(ragRequestFixture);
}

export function getAutomationRuntimeRequirements(): Promise<AutomationRuntimeRequirements> {
  return delay({
    automationId: installedAutomationFixture.id,
    canOpenBuilder: installedAutomationFixture.canOpenBuilder,
    canRun: installedAutomationFixture.canRun,
    builderState: installedAutomationFixture.builderState,
    syncState: installedAutomationFixture.syncState,
    runtimeProjectId: installedAutomationFixture.runtimeProjectId,
    runtimeFlowId: installedAutomationFixture.runtimeFlowId,
    missingConnections: installedAutomationFixture.missingConnections.map(
      (code) => ({
        id: `missing:${code}`,
        code,
        provider: code,
        displayName: `${code} connection`,
        scope: "workspace",
        status: "missing",
        externalConnectionName: null,
        lastCheckedAt: null,
        usedByAutomationIds: [installedAutomationFixture.id],
      }),
    ),
    availableConnections: [] satisfies readonly RuntimeConnectionSummary[],
    requiredPieces: [
      {
        packageName: "@lexframe/piece-document",
        stepCode: "generate_document",
        status: "available",
      },
      {
        packageName: "@lexframe/piece-callback",
        stepCode: "notify_callback",
        status: "available",
      },
    ],
    warnings: installedAutomationFixture.canRun
      ? []
      : ["Sync runtime and resolve missing connections before execution."],
  });
}

export function syncAutomationRuntime(
  _automationId: string,
  _input: SyncAutomationRuntimeRequest = {},
): Promise<SyncAutomationRuntimeResponse> {
  void _automationId;
  void _input;

  return delay({
    status: "synced",
    runtimeProjectId:
      installedAutomationFixture.runtimeProjectId ?? "ap_proj_demo",
    runtimeFlowId: installedAutomationFixture.runtimeFlowId ?? "flow_demo",
    syncHash: installedAutomationFixture.syncHash ?? "sync_demo",
    requiredPieces: ["@lexframe/piece-document", "@lexframe/piece-callback"],
    requiredConnections: installedAutomationFixture.missingConnections,
    warnings: [],
  });
}

export function startAutomationRun(
  _automationId: string,
  _input: StartAutomationRunRequest,
): Promise<StartAutomationRunResponse> {
  void _automationId;
  void _input;

  return delay({
    runId: runsFixture[0]!.id,
    status: runsFixture[0]!.status,
    traceId: runsFixture[0]!.traceId,
  });
}

export function listRuntimeConnections(): Promise<
  readonly RuntimeConnectionSummary[]
> {
  return delay([]);
}

export function upsertRuntimeConnection(
  _input: UpsertRuntimeConnectionRequest,
): Promise<RuntimeConnectionSummary> {
  return delay({
    id: "conn_demo",
    code: _input.code,
    provider: _input.provider,
    displayName: _input.displayName ?? `${_input.provider} connection`,
    scope: "workspace",
    status: "connected",
    externalConnectionName: _input.externalConnectionName ?? null,
    lastCheckedAt: new Date().toISOString(),
    usedByAutomationIds: [installedAutomationFixture.id],
  });
}

export function listDocuments(
  _input: DocumentListQuery = {},
): Promise<DocumentListResponse> {
  void _input;
  return delay(documentsFixture);
}

export function getDocument(_documentId?: string): Promise<DocumentDetail> {
  void _documentId;
  return delay(documentDetailFixture);
}

export function listDocumentVersions(
  _documentId?: string,
): Promise<readonly DocumentVersionSummary[]> {
  void _documentId;
  return delay(documentVersionsFixture);
}

export function createDocumentUploadIntent(
  _input: DocumentUploadIntentRequest,
): Promise<DocumentUploadIntentResponse> {
  void _input;
  return delay(documentUploadIntentFixture);
}

export function createDocumentVersionUploadIntent(
  _documentId: string,
  _input: CreateDocumentVersionUploadIntentRequest,
): Promise<DocumentUploadIntentResponse> {
  void _documentId;
  void _input;
  return delay(documentUploadIntentFixture);
}

export function completeDocumentUpload(
  _documentId: string,
  _versionId: string,
  _input: CompleteUploadRequest,
): Promise<DocumentDetail> {
  void _documentId;
  void _versionId;
  void _input;
  return delay(documentDetailFixture);
}

export function makeDocumentVersionCurrent(
  _documentId: string,
  _versionId: string,
): Promise<DocumentDetail> {
  void _documentId;
  void _versionId;
  return delay(documentDetailFixture);
}

export function createDocumentSignedUrl(
  _documentId: string,
  _input: SignedUrlRequest,
): Promise<SignedUrlResponse> {
  void _documentId;
  void _input;
  return delay(signedUrlFixture);
}

export function archiveDocument(): Promise<DocumentMutationResult> {
  return delay({
    status: "archived",
    documentId: documentDetailFixture.id,
  });
}

export function restoreDocument(): Promise<DocumentMutationResult> {
  return delay({
    status: "restored",
    documentId: documentDetailFixture.id,
  });
}

export function deleteDocument(): Promise<DocumentMutationResult> {
  return delay({
    status: "deleted",
    documentId: documentDetailFixture.id,
  });
}

export function getRuns(): Promise<readonly RunSummary[]> {
  return delay(runsFixture);
}

export function listRunArtifacts(): Promise<readonly RunArtifact[]> {
  return delay(runArtifactsFixture);
}

export function createRunArtifact(
  _runId: string,
  _input: CreateRunArtifactRequest = createRunArtifactFixture,
): Promise<RunArtifact> {
  void _runId;
  void _input;
  return delay(runArtifactsFixture[0]!);
}

export function getRecommendations(): Promise<
  readonly RecommendationCandidate[]
> {
  return delay(recommendationsFixture);
}

export function getRecommendation(
  recommendationId?: string,
): Promise<RecommendationDetail> {
  const match =
    recommendationDetailsFixture.find((item) => item.id === recommendationId) ??
    recommendationDetailFixture;

  return delay(match);
}

export function acceptRecommendation(
  _recommendationId: string,
  _input: RecommendationAcceptRequest = {},
): Promise<RecommendationActionResult> {
  void _recommendationId;
  void _input;
  return delay(recommendationActionResultFixture);
}

export function dismissRecommendation(
  recommendationId: string,
  _input: RecommendationDismissRequest = {},
): Promise<RecommendationActionResult> {
  void _input;
  return delay({
    ...recommendationActionResultFixture,
    recommendationId,
    status: "dismissed",
    draftId: null,
    workflowDraft: null,
    notificationId: null,
    message:
      "Рекомендация скрыта. Паттерн остаётся рекомендательным и может появиться снова при повторении активности.",
  });
}

export function snoozeRecommendation(
  recommendationId: string,
  input: RecommendationSnoozeRequest = {},
): Promise<RecommendationActionResult> {
  const snoozedUntil = input.until ?? "2026-04-28T09:00:00.000Z";

  return delay({
    ...recommendationActionResultFixture,
    recommendationId,
    status: "snoozed",
    draftId: null,
    workflowDraft: null,
    notificationId: null,
    snoozedUntil,
    message:
      "Рекомендация отложена и не будет попадать в realtime-доставку до выбранной даты.",
  });
}

export function sendRecommendationFeedback(
  recommendationId: string,
  input: RecommendationFeedbackRequest,
): Promise<RecommendationActionResult> {
  void input;
  return delay({
    ...recommendationActionResultFixture,
    recommendationId,
    status: "candidate",
    draftId: null,
    workflowDraft: null,
    notificationId: null,
    message: "Обратная связь сохранена для оценки и будущих решений о подавлении.",
  });
}

export function listRecommendationPatterns(): Promise<
  readonly RecommendationPatternSummary[]
> {
  return delay(recommendationPatternsFixture);
}

export function getRecommendationPattern(
  _patternId?: string,
): Promise<RecommendationPatternDetail> {
  void _patternId;
  return delay(recommendationPatternDetailFixture);
}

export function listRecommendationProcessCases(): Promise<
  readonly ProcessCaseSummary[]
> {
  return delay(processCasesFixture);
}

export function captureProductEvent(
  _input: ProductEventCaptureRequest,
): Promise<ProductEventCaptureResponse> {
  void _input;
  return delay(productEventCaptureResponseFixture, 60);
}

export function getReadiness(): Promise<readonly ReadinessGate[]> {
  return delay(readinessFixture);
}

export function getReadinessSummary(): Promise<ReadinessSummaryResponse> {
  return delay(readinessSummaryFixture);
}

export function getReadinessDetails(): Promise<ReadinessDetailsResponse> {
  return delay({
    ...readinessSummaryFixture,
    effectiveProfile: "local-basic",
    serviceStatuses: [
      {
        service: "postgres",
        state: "ready",
        required: true,
        summary: "Основное хранилище PostgreSQL ответило на readiness probe.",
        blockers: [],
        diagnostics: {},
      },
      {
        service: "supabase-storage",
        state: "blocked",
        required: false,
        summary: "Подписание Supabase остаётся необязательным в профиле local-basic.",
        blockers: ["Endpoint подписанных ссылок Supabase Storage не настроен."],
        diagnostics: {},
      },
    ],
    blockedReasons: ["Endpoint подписанных ссылок Supabase Storage не настроен."],
    diagnostics: {
      env: {
        readinessProfile: "local-basic",
      },
      runtime: {},
    },
  });
}

export function getActivepiecesIntegrationStatus(): Promise<ActivepiecesIntegrationStatus> {
  return delay({
    instanceUrl: activepiecesEmbedTokenFixture.instanceUrl,
    simulateRuns: true,
    canDispatchRealRuns: false,
    piecesFilterType: activepiecesEmbedTokenFixture.piecesFilterType,
    piecesTags: activepiecesEmbedTokenFixture.piecesTags,
    smokePresetCodes: ["legal-research-to-draft"],
    dependencies: [
      {
        code: "app",
        state: "ready",
        summary: "Mock-приложение Activepieces доступно для локальной UI-проверки.",
      },
      {
        code: "simulate-mode",
        state: "blocked",
        summary: "Режим симуляции остаётся включённым в mock API.",
      },
    ],
  });
}

export function runActivepiecesSmoke(
  _input: ActivepiecesRunSmokeRequest,
): Promise<ActivepiecesRunSmokeResponse> {
  void _input;
  return delay({
    status: "completed",
    runId: "run_smoke_mock_01",
    externalRunId: "ap_run_mock_smoke",
    artifactIds: [runArtifactsFixture[0]!.id],
    callbackReceiptSummary: {
      received: 4,
      processed: 4,
      types: ["artifact", "run_event", "step_event"],
    },
  });
}

export function getDeliveryIntegrationStatus(): Promise<DeliveryIntegrationStatus> {
  return delay(deliveryIntegrationStatusFixture);
}

export function runDeliverySandboxTest(
  _input: DeliverySandboxTestRequest = {},
): Promise<DeliverySandboxTestResponse> {
  void _input;
  return delay(deliverySandboxTestFixture);
}

export function getBuilderToken(
  _input?: CreateActivepiecesEmbedTokenRequest,
): Promise<ActivepiecesEmbedTokenResponse> {
  void _input;
  return delay(activepiecesEmbedTokenFixture);
}
