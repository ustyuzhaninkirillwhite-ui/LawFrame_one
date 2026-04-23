"use client";

import type {
  AiRedactionPreviewRequest,
  ApplyInstalledAutomationSourceUpdateRequest,
  ArtifactSignedUrlRequest,
  CreateActivepiecesEmbedTokenRequest,
  CreateAiChatMessageRequest,
  CreateAiChatSessionRequest,
  CreateAutomationTemplateRequest,
  CreateAutomationTemplateVersionRequest,
  CreateApprovalRouteRequest,
  CreateClauseLibraryItemRequest,
  CreateDocumentStructureRequest,
  CreateDocumentTemplateRequest,
  CreateDocumentTypeRequest,
  CreateLegalImportJobRequest,
  CreateLegalWorkProfileRequest,
  CreatePhraseRuleRequest,
  CreateProfileImportJobRequest,
  CreateWorkflowDraftRequest,
  CreateWorkflowPatchRequest,
  NotificationListQuery,
  RunCreateRequest,
  RunPreflightRequest,
  DocumentGenerationPreviewRequest,
  DocumentListQuery,
  FinalizeDocumentGenerationRequest,
  ForkAutomationTemplateRequest,
  LegalSearchQuery,
  ModerationDecision,
  PreviewEffectiveProfileRequest,
  PublishDocumentTemplateVersionRequest,
  RagAnalyzeRequest,
  RecheckDocumentValidationRequest,
  RecommendationAcceptRequest,
  RecommendationDismissRequest,
  RecommendationFeedbackRequest,
  RecommendationSnoozeRequest,
  RestoreLegalWorkProfileVersionRequest,
  ApprovalTaskRequestChangesRequest,
  StartAutomationRunRequest,
  SubmitPublicationRequest,
  SyncAutomationRuntimeRequest,
  UpdateApprovalRouteRequest,
  UpdateClauseLibraryItemRequest,
  UpdateDocumentStructureRequest,
  UpdateDocumentTemplateRequest,
  UpdateDocumentTypeRequest,
  UpdateLegalWorkProfileDraftRequest,
  UpdatePhraseRuleRequest,
  UpsertRuntimeConnectionRequest,
  UpdateWorkflowDraftInputsRequest,
  UpdateAutomationTemplateRequest,
} from "@lexframe/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionBridge } from "@/providers/session-provider";

function useWorkspaceEnabled() {
  const { authPending, sessionContext } = useSessionBridge();
  const enabledState =
    sessionContext.state === "ready" || sessionContext.state === "needs_mfa";

  return {
    authPending,
    enabled: !authPending && enabledState,
    workspaceId: sessionContext.activeWorkspace?.id ?? "none",
  };
}

function templateFiltersToQuery(filters: {
  readonly q?: string;
  readonly scope?: string;
  readonly owner?: string;
  readonly mine?: boolean;
}) {
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.owner ? { owner: filters.owner } : {}),
    ...(filters.mine ? { mine: "true" } : {}),
  };
}

function useStage3Invalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["library", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["template-detail", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["my-templates", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["automation-detail", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["automation-runtime", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["runtime-connections", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["builder-token", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["runs", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["publication-requests", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["moderation-publication", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["modules", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["module-detail", workspaceId] }),
    ]);
  };
}

function useAiInvalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ai-sessions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-messages", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-drafts", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-draft", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-request", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-request-events", workspaceId] }),
    ]);
  };
}

function useLegalInvalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["legal-sources", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["legal-source", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["legal-import-job", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["legal-search", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["legal-rag-request", workspaceId] }),
    ]);
  };
}

function useStage7Invalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stage7-profile-current", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-profile-effective", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-profile-versions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-types", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-structures", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-clauses", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-phrase-rules", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-templates", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-template", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-generation", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-document-validation", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-approval-routes", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-approval-tasks", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-profile-imports", workspaceId] }),
    ]);
  };
}

function useStage8Invalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["runs", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["run", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["run-artifacts", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage7-approval-tasks", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-request", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["system-status", workspaceId] }),
    ]);
  };
}

function useRecommendationInvalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["recommendations", workspaceId] }),
      queryClient.invalidateQueries({
        queryKey: ["recommendation-detail", workspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["recommendation-patterns", workspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["recommendation-pattern", workspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["recommendation-process-cases", workspaceId],
      }),
      queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-drafts", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-draft", workspaceId] }),
    ]);
  };
}

export function useSessionContext() {
  const { authPending, sessionContext } = useSessionBridge();

  return {
    data: sessionContext,
    isLoading: authPending,
  };
}

export function useLegalModules() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["modules", workspaceId],
    queryFn: () => apiClient.listLegalModules(),
    enabled,
    staleTime: 30_000,
  });
}

export function useLegalModule(code?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["module-detail", workspaceId, code],
    queryFn: () => apiClient.getLegalModule(code!),
    enabled: enabled && Boolean(code),
    staleTime: 30_000,
  });
}

export function useLibraryTemplates(filters: {
  readonly q?: string;
  readonly scope?: string;
  readonly owner?: string;
  readonly mine?: boolean;
} = {}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["library", workspaceId, filters],
    queryFn: () => apiClient.listAutomationTemplates(templateFiltersToQuery(filters)),
    enabled,
    staleTime: 30_000,
  });
}

export function useAutomationTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["template-detail", workspaceId, id],
    queryFn: () => apiClient.getAutomationTemplate(id!),
    enabled: enabled && Boolean(id),
    staleTime: 30_000,
  });
}

export function useMyAutomationTemplates() {
  return useLibraryTemplates({ mine: true });
}

export function useTemplateRelated(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["template-related", workspaceId, id],
    queryFn: () => apiClient.getRelatedAutomationTemplates(id!),
    enabled: enabled && Boolean(id),
    staleTime: 30_000,
  });
}

export function useInstalledAutomations() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["automations", workspaceId],
    queryFn: () => apiClient.listInstalledAutomations(),
    enabled,
    staleTime: 15_000,
  });
}

export function useAutomationDetail(id = "aut_01hzyd8md4j4yhr40t1k0f8p9n") {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["automation-detail", workspaceId, id],
    queryFn: () => apiClient.getAutomation(id),
    enabled,
    staleTime: 30_000,
  });
}

export function useAutomationRuntimeRequirements(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["automation-runtime", workspaceId, id],
    queryFn: () => apiClient.getAutomationRuntimeRequirements(id!),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
  });
}

export function useSyncAutomationRuntime(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: SyncAutomationRuntimeRequest = {}) =>
      apiClient.syncAutomationRuntime(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useStartAutomationRun(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: StartAutomationRunRequest) =>
      apiClient.startAutomationRun(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRunPreflight(id?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: RunPreflightRequest = {}) =>
      apiClient.preflightAutomationRun(id!, input),
  });
}

export function useCreateAutomationRun(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: (input: RunCreateRequest) => apiClient.createAutomationRun(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRuntimeConnections() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["runtime-connections", workspaceId],
    queryFn: () => apiClient.listRuntimeConnections(),
    enabled,
    staleTime: 10_000,
  });
}

export function useUpsertRuntimeConnection() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: UpsertRuntimeConnectionRequest) =>
      apiClient.upsertRuntimeConnection(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useInstallAutomationTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: {
      readonly workspaceId?: string;
      readonly profileId?: string | null;
      readonly documentIds?: readonly string[];
      readonly connectionIds?: readonly string[];
      readonly approvalPolicy?: "manual" | "auto_with_gate";
    }) => apiClient.installAutomationTemplate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useForkAutomationTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: ForkAutomationTemplateRequest) =>
      apiClient.forkAutomationTemplate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateAutomationTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: UpdateAutomationTemplateRequest) =>
      apiClient.updateAutomationTemplate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateAutomationTemplate() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: CreateAutomationTemplateRequest) =>
      apiClient.createAutomationTemplate(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateAutomationTemplateVersion(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: CreateAutomationTemplateVersionRequest) =>
      apiClient.createAutomationTemplateVersion(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useValidateAutomationTemplateVersion(versionId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["template-validation", workspaceId, versionId],
    queryFn: () => apiClient.validateAutomationTemplateVersion(versionId!),
    enabled: enabled && Boolean(versionId),
    staleTime: 5_000,
  });
}

export function usePublishAutomationTemplateDraft(versionId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: () => apiClient.publishAutomationTemplateDraft(versionId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useSubmitAutomationTemplatePublication(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: SubmitPublicationRequest) =>
      apiClient.submitAutomationTemplatePublication(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useInstalledAutomationSourceDiff(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["automation-source-diff", workspaceId, id],
    queryFn: () => apiClient.getInstalledAutomationSourceDiff(id!),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
  });
}

export function useApplyInstalledAutomationSourceUpdate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: ApplyInstalledAutomationSourceUpdateRequest) =>
      apiClient.applyInstalledAutomationSourceUpdate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useForkInstalledAutomationToTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: ForkAutomationTemplateRequest) =>
      apiClient.forkInstalledAutomationToTemplate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function usePublicationRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["publication-request", workspaceId, id],
    queryFn: () => apiClient.getPublicationRequest(id!),
    enabled: enabled && Boolean(id),
    staleTime: 5_000,
  });
}

export function useModerationPublicationRequests() {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();
  const canReview = sessionContext.permissions.includes("moderation.review");

  return useQuery({
    queryKey: ["publication-requests", workspaceId],
    queryFn: () => apiClient.listPublicationRequests(),
    enabled: enabled && canReview,
    staleTime: 5_000,
  });
}

export function useModerationPublicationRequest(id?: string | null) {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();
  const canReview = sessionContext.permissions.includes("moderation.review");

  return useQuery({
    queryKey: ["moderation-publication", workspaceId, id],
    queryFn: () => apiClient.getModerationPublicationRequest(id!),
    enabled: enabled && canReview && Boolean(id),
    staleTime: 5_000,
  });
}

export function useReviewPublicationRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage3Invalidation();

  return useMutation({
    mutationFn: (input: ModerationDecision) =>
      apiClient.reviewPublicationRequest(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocuments(filters: DocumentListQuery = {}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["documents", workspaceId, filters],
    queryFn: () => apiClient.listDocuments(filters),
    enabled,
    staleTime: 15_000,
  });
}

export function useLegalSources() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["legal-sources", workspaceId],
    queryFn: () => apiClient.listLegalSources(),
    enabled,
    staleTime: 10_000,
  });
}

export function useLegalSource(sourceId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["legal-source", workspaceId, sourceId],
    queryFn: () => apiClient.getLegalSource(sourceId!),
    enabled: enabled && Boolean(sourceId),
    staleTime: 10_000,
  });
}

export function useCreateLegalImportJob() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useLegalInvalidation();

  return useMutation({
    mutationFn: (input: CreateLegalImportJobRequest) =>
      apiClient.createLegalImportJob(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useLegalImportJob(jobId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["legal-import-job", workspaceId, jobId],
    queryFn: () => apiClient.getLegalImportJob(jobId!),
    enabled: enabled && Boolean(jobId),
    staleTime: 5_000,
    refetchInterval: (query) =>
      query.state.data &&
      ["completed", "failed", "partially_failed", "cancelled"].includes(
        query.state.data.status,
      )
        ? false
        : 5_000,
  });
}

export function useLegalSearch(
  input?: LegalSearchQuery | null,
  options: { readonly enabled?: boolean } = {},
) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["legal-search", workspaceId, input],
    queryFn: () => apiClient.queryLegalSearch(input!),
    enabled: enabled && Boolean(input) && (options.enabled ?? true),
    staleTime: 5_000,
  });
}

export function useAnalyzeLegalRag() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useLegalInvalidation();

  return useMutation({
    mutationFn: (input: RagAnalyzeRequest) => apiClient.analyzeLegalRag(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useLegalRagRequest(requestId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["legal-rag-request", workspaceId, requestId],
    queryFn: () => apiClient.getLegalRagRequest(requestId!),
    enabled: enabled && Boolean(requestId),
    staleTime: 3_000,
    refetchInterval: (query) =>
      query.state.data && ["completed", "failed", "blocked"].includes(query.state.data.status)
        ? false
        : 3_000,
  });
}

export function useDocumentDetail(documentId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["document-detail", workspaceId, documentId],
    queryFn: () => apiClient.getDocument(documentId!),
    enabled: enabled && Boolean(documentId),
    staleTime: 10_000,
  });
}

export function useDocumentVersions(documentId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["document-versions", workspaceId, documentId],
    queryFn: () => apiClient.listDocumentVersions(documentId!),
    enabled: enabled && Boolean(documentId),
    staleTime: 10_000,
  });
}

export function useRunArtifacts(runId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["run-artifacts", workspaceId, runId],
    queryFn: () => apiClient.listRunArtifacts(runId!),
    enabled: enabled && Boolean(runId),
    staleTime: 10_000,
  });
}

export function useRuns() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["runs", workspaceId],
    queryFn: () => apiClient.getRuns(),
    enabled,
    staleTime: 30_000,
  });
}

export function useDashboardSnapshot() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => apiClient.getDashboardSnapshot(),
    enabled,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useSystemStatus() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["system-status", workspaceId],
    queryFn: () => apiClient.getSystemStatus(),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useRun(runId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["run", workspaceId, runId],
    queryFn: () => apiClient.getRunLiveSnapshot(runId!),
    enabled: enabled && Boolean(runId),
    staleTime: 5_000,
    refetchInterval: 12_000,
  });
}

export function useCancelRun(runId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.cancelRun(runId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRetryRun(runId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.retryRun(runId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRetryRunStep(runId?: string | null, stepId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.retryRunStep(runId!, stepId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRecommendations() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["recommendations", workspaceId],
    queryFn: () => apiClient.getRecommendations(),
    enabled,
    staleTime: 30_000,
  });
}

export function useRecommendationDetail(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["recommendation-detail", workspaceId, id],
    queryFn: () => apiClient.getRecommendation(id!),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
  });
}

export function useAcceptRecommendation(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useRecommendationInvalidation();

  return useMutation({
    mutationFn: (input: RecommendationAcceptRequest = {}) =>
      apiClient.acceptRecommendation(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDismissRecommendation(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useRecommendationInvalidation();

  return useMutation({
    mutationFn: (input: RecommendationDismissRequest = {}) =>
      apiClient.dismissRecommendation(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useSnoozeRecommendation(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useRecommendationInvalidation();

  return useMutation({
    mutationFn: (input: RecommendationSnoozeRequest = {}) =>
      apiClient.snoozeRecommendation(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRecommendationFeedback(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useRecommendationInvalidation();

  return useMutation({
    mutationFn: (input: RecommendationFeedbackRequest) =>
      apiClient.sendRecommendationFeedback(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRecommendationPatterns(options: {
  readonly enabled?: boolean;
} = {}) {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();
  const canManage = sessionContext.permissions.includes("recommendation.manage");

  return useQuery({
    queryKey: ["recommendation-patterns", workspaceId],
    queryFn: () => apiClient.listRecommendationPatterns(),
    enabled: enabled && canManage && (options.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useRecommendationPattern(id?: string | null) {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();
  const canManage = sessionContext.permissions.includes("recommendation.manage");

  return useQuery({
    queryKey: ["recommendation-pattern", workspaceId, id],
    queryFn: () => apiClient.getRecommendationPattern(id!),
    enabled: enabled && canManage && Boolean(id),
    staleTime: 15_000,
  });
}

export function useRecommendationProcessCases(options: {
  readonly enabled?: boolean;
} = {}) {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();
  const canManage = sessionContext.permissions.includes("recommendation.manage");

  return useQuery({
    queryKey: ["recommendation-process-cases", workspaceId],
    queryFn: () => apiClient.listRecommendationProcessCases(),
    enabled: enabled && canManage && (options.enabled ?? true),
    staleTime: 15_000,
  });
}

export function useReadiness() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["readiness", workspaceId],
    queryFn: () => apiClient.getReadiness(),
    enabled,
    staleTime: 30_000,
    select: (payload) => payload,
  });
}

export function useBuilderToken(
  input?: CreateActivepiecesEmbedTokenRequest | null,
  options: { readonly enabled?: boolean } = {},
) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["builder-token", workspaceId, input?.installedAutomationId, input?.purpose],
    queryFn: () => apiClient.createActivepiecesEmbedToken(input!),
    enabled:
      enabled &&
      Boolean(input?.installedAutomationId) &&
      (options.enabled ?? true),
    staleTime: 60_000,
    retry: false,
  });
}

export function useWorkspaceMembers() {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => apiClient.listWorkspaceMembers(sessionContext.activeWorkspace!.id),
    enabled,
    staleTime: 5_000,
  });
}

export function useWorkspaceInvitations() {
  const { apiClient, sessionContext } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["workspace-invitations", workspaceId],
    queryFn: () =>
      apiClient.listWorkspaceInvitations(sessionContext.activeWorkspace!.id),
    enabled,
    staleTime: 5_000,
  });
}

export function useRoleDefinitions() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["role-definitions", workspaceId],
    queryFn: () => apiClient.listRoles(),
    enabled,
    staleTime: Infinity,
  });
}

export function usePermissionDefinitions() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["permission-definitions", workspaceId],
    queryFn: () => apiClient.listPermissions(),
    enabled,
    staleTime: Infinity,
  });
}

export function useSecurityAccount() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["security-account", workspaceId],
    queryFn: () => apiClient.getAccountSecurity(),
    enabled,
    staleTime: 30_000,
  });
}

export function useAuditEvents() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["audit-events", workspaceId],
    queryFn: () => apiClient.listAuditEvents(),
    enabled,
    staleTime: 5_000,
  });
}

export function useAiChatSessions() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-sessions", workspaceId],
    queryFn: () => apiClient.listAiChatSessions(),
    enabled,
    staleTime: 5_000,
  });
}

export function useAiChatSession(sessionId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-session", workspaceId, sessionId],
    queryFn: () => apiClient.getAiChatSession(sessionId!),
    enabled: enabled && Boolean(sessionId),
    staleTime: 5_000,
  });
}

export function useAiChatMessages(sessionId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-messages", workspaceId, sessionId],
    queryFn: () => apiClient.listAiChatMessages(sessionId!),
    enabled: enabled && Boolean(sessionId),
    staleTime: 3_000,
  });
}

export function useCreateAiChatSession() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: CreateAiChatSessionRequest) =>
      apiClient.createAiChatSession(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useSendAiChatMessage() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: CreateAiChatMessageRequest) =>
      apiClient.sendAiChatMessage(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useWorkflowDrafts() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-drafts", workspaceId],
    queryFn: () => apiClient.listWorkflowDrafts(),
    enabled,
    staleTime: 5_000,
  });
}

export function useWorkflowDraft(draftId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-draft", workspaceId, draftId],
    queryFn: () => apiClient.getWorkflowDraft(draftId!),
    enabled: enabled && Boolean(draftId),
    staleTime: 5_000,
  });
}

export function useCreateWorkflowDraft() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: CreateWorkflowDraftRequest) =>
      apiClient.createWorkflowDraft(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateWorkflowDraftInputs(draftId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: UpdateWorkflowDraftInputsRequest) =>
      apiClient.updateWorkflowDraftInputs(draftId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateWorkflowPatch() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: CreateWorkflowPatchRequest) =>
      apiClient.createWorkflowPatch(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useAiRequest(requestId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-request", workspaceId, requestId],
    queryFn: () => apiClient.getAiRequest(requestId!),
    enabled: enabled && Boolean(requestId),
    staleTime: 3_000,
  });
}

export function useAiRequestEvents(requestId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["ai-request-events", workspaceId, requestId],
    queryFn: () => apiClient.listAiRequestEvents(requestId!),
    enabled: enabled && Boolean(requestId),
    staleTime: 3_000,
  });
}

export function useAiRedactionPreview() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useAiInvalidation();

  return useMutation({
    mutationFn: (input: AiRedactionPreviewRequest) =>
      apiClient.previewAiRedaction(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCurrentLegalWorkProfile() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-profile-current", workspaceId],
    queryFn: () => apiClient.getCurrentLegalWorkProfile(),
    enabled,
    staleTime: 5_000,
  });
}

export function useEffectiveLegalWorkProfile() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-profile-effective", workspaceId],
    queryFn: () => apiClient.getEffectiveLegalWorkProfile(),
    enabled,
    staleTime: 5_000,
  });
}

export function useLegalWorkProfileVersions(profileId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-profile-versions", workspaceId, profileId],
    queryFn: () => apiClient.listLegalWorkProfileVersions(profileId!),
    enabled: enabled && Boolean(profileId),
    staleTime: 5_000,
  });
}

export function useCreateLegalWorkProfile() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateLegalWorkProfileRequest) =>
      apiClient.createLegalWorkProfile(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateLegalWorkProfileDraft(profileId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateLegalWorkProfileDraftRequest) =>
      apiClient.updateLegalWorkProfileDraft(profileId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function usePublishLegalWorkProfile(profileId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: () => apiClient.publishLegalWorkProfile(profileId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function usePreviewEffectiveLegalWorkProfile(profileId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: PreviewEffectiveProfileRequest) =>
      apiClient.previewEffectiveLegalWorkProfile(profileId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRestoreLegalWorkProfileVersion(profileId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: RestoreLegalWorkProfileVersionRequest) =>
      apiClient.restoreLegalWorkProfileVersion(profileId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocumentTypes() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-types", workspaceId],
    queryFn: () => apiClient.listDocumentTypes(),
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateDocumentType() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateDocumentTypeRequest) =>
      apiClient.createDocumentType(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateDocumentType(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateDocumentTypeRequest) =>
      apiClient.updateDocumentType(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocumentStructures() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-structures", workspaceId],
    queryFn: () => apiClient.listDocumentStructures(),
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateDocumentStructure() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateDocumentStructureRequest) =>
      apiClient.createDocumentStructure(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateDocumentStructure(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateDocumentStructureRequest) =>
      apiClient.updateDocumentStructure(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useClauses() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-clauses", workspaceId],
    queryFn: () => apiClient.listClauses(),
    enabled,
    staleTime: 5_000,
  });
}

export function useCreateClause() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateClauseLibraryItemRequest) =>
      apiClient.createClause(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateClause(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateClauseLibraryItemRequest) =>
      apiClient.updateClause(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function usePhraseRules() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-phrase-rules", workspaceId],
    queryFn: () => apiClient.listPhraseRules(),
    enabled,
    staleTime: 5_000,
  });
}

export function useCreatePhraseRule() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreatePhraseRuleRequest) =>
      apiClient.createPhraseRule(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdatePhraseRule(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdatePhraseRuleRequest) =>
      apiClient.updatePhraseRule(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocumentTemplates() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-templates", workspaceId],
    queryFn: () => apiClient.listDocumentTemplates(),
    enabled,
    staleTime: 5_000,
  });
}

export function useDocumentTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-template", workspaceId, id],
    queryFn: () => apiClient.getDocumentTemplate(id!),
    enabled: enabled && Boolean(id),
    staleTime: 5_000,
  });
}

export function useCreateDocumentTemplate() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateDocumentTemplateRequest) =>
      apiClient.createDocumentTemplate(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateDocumentTemplate(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateDocumentTemplateRequest) =>
      apiClient.updateDocumentTemplate(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useParseDocumentTemplatePlaceholders(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: () => apiClient.parseDocumentTemplatePlaceholders(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function usePublishDocumentTemplateDraft(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: PublishDocumentTemplateVersionRequest = {}) =>
      apiClient.publishDocumentTemplateDraft(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateDocumentGenerationPreview() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: DocumentGenerationPreviewRequest) =>
      apiClient.createDocumentGenerationPreview(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocumentGenerationJob(jobId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-generation", workspaceId, jobId],
    queryFn: () => apiClient.getDocumentGenerationJob(jobId!),
    enabled: enabled && Boolean(jobId),
    staleTime: 3_000,
  });
}

export function useFinalizeDocumentGeneration(jobId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input?: FinalizeDocumentGenerationRequest) =>
      apiClient.finalizeDocumentGeneration(jobId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDocumentValidationReport(reportId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-document-validation", workspaceId, reportId],
    queryFn: () => apiClient.getDocumentValidationReport(reportId!),
    enabled: enabled && Boolean(reportId),
    staleTime: 3_000,
  });
}

export function useRecheckDocumentValidation(reportId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: RecheckDocumentValidationRequest) =>
      apiClient.recheckDocumentValidation(reportId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useApprovalRoutes() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-approval-routes", workspaceId],
    queryFn: () => apiClient.listApprovalRoutes(),
    enabled,
    staleTime: 5_000,
  });
}

export function useCreateApprovalRoute() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateApprovalRouteRequest) =>
      apiClient.createApprovalRoute(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateApprovalRoute(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: UpdateApprovalRouteRequest) =>
      apiClient.updateApprovalRoute(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useApprovalTasks() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-approval-tasks", workspaceId],
    queryFn: () => apiClient.listApprovalTasks(),
    enabled,
    staleTime: 5_000,
  });
}

export function useApprovalTask(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage7-approval-task", workspaceId, id],
    queryFn: () => apiClient.getApprovalTask(id!),
    enabled: enabled && Boolean(id),
    staleTime: 5_000,
  });
}

export function useApproveApprovalTask(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();
  const invalidateStage8 = useStage8Invalidation();

  return useMutation({
    mutationFn: (input: { comment?: string | null } = {}) =>
      apiClient.approveApprovalTask(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
      await invalidateStage8(workspaceId);
    },
  });
}

export function useRejectApprovalTask(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();
  const invalidateStage8 = useStage8Invalidation();

  return useMutation({
    mutationFn: (input: { comment?: string | null } = {}) =>
      apiClient.rejectApprovalTask(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
      await invalidateStage8(workspaceId);
    },
  });
}

export function useRequestApprovalTaskChanges(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();
  const invalidateStage8 = useStage8Invalidation();

  return useMutation({
    mutationFn: (input: ApprovalTaskRequestChangesRequest = {}) =>
      apiClient.requestApprovalTaskChanges(id!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
      await invalidateStage8(workspaceId);
    },
  });
}

export function useCreateArtifactSignedUrl(artifactId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: ArtifactSignedUrlRequest) =>
      apiClient.createArtifactSignedUrl(artifactId!, input),
  });
}

export function useAcceptArtifactAsDocument(artifactId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.acceptArtifactAsDocument(artifactId!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useDeliveryRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["delivery-request", workspaceId, id],
    queryFn: () => apiClient.getDeliveryRequest(id!),
    enabled: enabled && Boolean(id),
    staleTime: 5_000,
  });
}

export function useApproveDeliveryRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.approveDeliveryRequest(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useSendDeliveryRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.sendDeliveryRequest(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCancelDeliveryRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.cancelDeliveryRequest(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useRetryDeliveryRequest(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.retryDeliveryRequest(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useNotifications(
  input: NotificationListQuery = {},
  options?: {
    readonly enabled?: boolean;
  },
) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["notifications", workspaceId, input],
    queryFn: () => apiClient.listNotifications(input),
    enabled: enabled && (options?.enabled ?? true),
    staleTime: 10_000,
    refetchInterval: 45_000,
  });
}

export function useMarkNotificationRead(id?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.markNotificationRead(id!),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage8Invalidation();

  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateProfileImportJob() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage7Invalidation();

  return useMutation({
    mutationFn: (input: CreateProfileImportJobRequest) =>
      apiClient.createProfileImportJob(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}
