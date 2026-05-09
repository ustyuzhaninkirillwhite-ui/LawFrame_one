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
  CanvasAiMessageRequest,
  CanvasAiPatchApplyRequest,
  CanvasAiPatchRejectRequest,
  CanvasDraftResponse,
  CanvasApplySuggestedFixRequest,
  CanvasOperationRequest,
  CanvasOperationPreviewRequest,
  CanvasPublishRequest,
  CanvasPresentationMode,
  CanvasPolicyOverrideDecisionRequest,
  CanvasPolicyOverrideRequest,
  CanvasRollbackRequest,
  CanvasSecurityCheckRequest,
  CanvasSnapshotRequest,
  CanvasStepConfigValidationRequest,
  CanvasTestRunRequest,
  CanvasValidateRequest,
  StepInputBinding,
  StepTestRequest,
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
  RuntimeImportApplyRequest,
  RuntimeImportPreviewRequest,
  RuntimeImportRejectRequest,
  RuntimeOverwriteRequest,
  RuntimePullRequest,
  RestoreLegalWorkProfileVersionRequest,
  ApprovalTaskRequestChangesRequest,
  StartAutomationRunRequest,
  Stage15CreateProjectChatRequest,
  Stage15CreateProjectRequest,
  Stage15WorkflowDraftMaterializeRequest,
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

function useStage15Invalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stage15-projects", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage15-project", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage15-project-snapshot", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage15-project-chats", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage15-project-automations", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-sessions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["ai-drafts", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] }),
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

export function useStage15Projects() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage15-projects", workspaceId],
    queryFn: () => apiClient.listProjects(),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateStage15Project() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage15Invalidation();

  return useMutation({
    mutationFn: (input: Stage15CreateProjectRequest) =>
      apiClient.createProject(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useStage15Project(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage15-project", workspaceId, projectId],
    queryFn: () => apiClient.getProject(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 10_000,
  });
}

export function useStage15ProjectSnapshot(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage15-project-snapshot", workspaceId, projectId],
    queryFn: () => apiClient.getProjectDashboardSnapshot(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useStage15ProjectChats(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage15-project-chats", workspaceId, projectId],
    queryFn: () => apiClient.listProjectChats(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 5_000,
  });
}

export function useCreateStage15ProjectChat(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage15Invalidation();

  return useMutation({
    mutationFn: (input: Stage15CreateProjectChatRequest = {}) =>
      apiClient.createProjectChat(projectId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useStage15ProjectAutomations(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["stage15-project-automations", workspaceId, projectId],
    queryFn: () => apiClient.listProjectAutomations(projectId!),
    enabled: enabled && Boolean(projectId),
    staleTime: 10_000,
  });
}

export function useEnsureStage17CanvasAutomation(projectId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage15Invalidation();

  return useMutation({
    mutationFn: () => apiClient.ensureStage17CanvasAutomation(projectId!),
    onSuccess: () => {
      void invalidate(workspaceId);
    },
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

export function useCanvasDraft(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "draft"],
    queryFn: () => apiClient.getAutomationCanvas(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 5_000,
  });
}

export function useCanvasSecurityContext(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "security-context"],
    queryFn: () => apiClient.getAutomationCanvasSecurityContext(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 5_000,
  });
}

export function useCanvasSecurityPolicies(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "security-policies"],
    queryFn: () => apiClient.listAutomationCanvasSecurityPolicies(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 30_000,
  });
}

export function useCanvasSecurityCheck(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: CanvasSecurityCheckRequest) =>
      apiClient.checkAutomationCanvasSecurityAction(automationId!, input),
  });
}

export function useCanvasPolicyOverrideRequest(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CanvasPolicyOverrideRequest) =>
      apiClient.requestAutomationCanvasPolicyOverride(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId, "security-context"],
      });
    },
  });
}

export function useCanvasPolicyOverrideDecision(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CanvasPolicyOverrideDecisionRequest & {
      readonly decision: "approve" | "reject";
    }) =>
      input.decision === "approve"
        ? apiClient.approveAutomationCanvasPolicyOverride(automationId!, input)
        : apiClient.rejectAutomationCanvasPolicyOverride(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId, "security-context"],
      });
    },
  });
}

export function useCanvasAuditEvents(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "audit"],
    queryFn: () => apiClient.listAutomationCanvasAuditEvents(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 15_000,
  });
}

export function useCanvasPresentation(input: {
  readonly automationId?: string | null;
  readonly mode?: CanvasPresentationMode | null;
  readonly locale?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "presentation",
      input.mode ?? "basic",
      input.locale ?? "ru-RU",
    ],
    queryFn: () =>
      apiClient.getAutomationCanvasPresentation(input.automationId!, {
        mode: input.mode ?? "basic",
        locale: input.locale ?? "ru-RU",
      }),
    enabled: enabled && Boolean(input.automationId),
    staleTime: 5_000,
  });
}

export function useCanvasSuggestions(input: {
  readonly automationId?: string | null;
  readonly contextNodeId?: string | null;
  readonly locale?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "suggestions",
      input.contextNodeId,
      input.locale ?? "ru-RU",
    ],
    queryFn: () =>
      apiClient.getAutomationCanvasSuggestions(input.automationId!, {
        contextNodeId: input.contextNodeId,
        locale: input.locale ?? "ru-RU",
      }),
    enabled: enabled && Boolean(input.automationId),
    staleTime: 10_000,
  });
}

export function useCanvasSuggestionApply(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      readonly suggestionId: string;
      readonly confirmedByUser?: boolean;
      readonly contextNodeId?: string | null;
    }) =>
      apiClient.applyAutomationCanvasSuggestion(
        automationId!,
        input.suggestionId,
        {
          confirmedByUser: input.confirmedByUser,
          contextNodeId: input.contextNodeId,
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasDraftOpen(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.openAutomationCanvasDraft(automationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasVersions(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "versions"],
    queryFn: () => apiClient.getAutomationCanvasVersions(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 10_000,
  });
}

export function useCanvasVersionState(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "version-state"],
    queryFn: () => apiClient.getAutomationCanvasVersionState(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 10_000,
  });
}

export function useCanvasVersionCompare(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: { readonly from: string; readonly to: string }) =>
      apiClient.compareAutomationCanvasVersions(automationId!, input),
  });
}

export function useCanvasIo(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "io"],
    queryFn: () => apiClient.getAutomationCanvasIo(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 5_000,
  });
}

export function useStepInspector(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "inspector",
      input.nodeId,
    ],
    queryFn: () =>
      apiClient.getStepInspector(input.automationId!, input.nodeId!),
    enabled:
      enabled && Boolean(input.automationId) && Boolean(input.nodeId),
    staleTime: 5_000,
  });
}

export function useStepDataSources(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
  readonly inputKey?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "inspector-sources",
      input.nodeId,
      input.inputKey,
    ],
    queryFn: () =>
      apiClient.listStepDataSources(
        input.automationId!,
        input.nodeId!,
        input.inputKey!,
      ),
    enabled:
      enabled &&
      Boolean(input.automationId) &&
      Boolean(input.nodeId) &&
      Boolean(input.inputKey),
    staleTime: 5_000,
  });
}

export function useCanvasInputSources(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
  readonly inputKey?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "sources",
      input.nodeId,
      input.inputKey,
    ],
    queryFn: () =>
      apiClient.listCanvasInputSources(
        input.automationId!,
        input.nodeId!,
        input.inputKey!,
      ),
    enabled:
      enabled &&
      Boolean(input.automationId) &&
      Boolean(input.nodeId) &&
      Boolean(input.inputKey),
    staleTime: 5_000,
  });
}

export function useCanvasModules(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "modules"],
    queryFn: () => apiClient.listCanvasModules(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 60_000,
  });
}

export function useCanvasModuleCatalog(input: {
  readonly automationId?: string | null;
  readonly contextNodeId?: string | null;
  readonly insertPosition?: string | null;
  readonly mode?: string | null;
  readonly query?: string | null;
  readonly source?: string | null;
  readonly status?: string | null;
  readonly runtime?: string | null;
  readonly limit?: number | null;
  readonly cursor?: string | null;
} = {}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "module-catalog",
      input.contextNodeId,
      input.insertPosition,
      input.mode,
      input.query,
      input.source,
      input.status,
      input.runtime,
      input.limit,
      input.cursor,
    ],
    queryFn: () =>
      apiClient.listCanvasModuleCatalog({
        automationId: input.automationId!,
        contextNodeId: input.contextNodeId,
        insertPosition: input.insertPosition,
        mode: input.mode,
        query: input.query,
        source: input.source,
        status: input.status,
        runtime: input.runtime,
        limit: input.limit,
        cursor: input.cursor,
      }),
    enabled,
    staleTime: 30_000,
  });
}

export function useCanvasBlockTypes(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["canvas", workspaceId, automationId, "block-types"],
    queryFn: () => apiClient.listCanvasBlockTypes(),
    enabled: enabled && Boolean(automationId),
    staleTime: 60_000,
  });
}

export function useCanvasOperations(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CanvasOperationRequest) =>
      apiClient.applyCanvasOperations(automationId!, input),
    onSuccess: async (response) => {
      queryClient.setQueryData<CanvasDraftResponse>(
        ["canvas", workspaceId, automationId, "draft"],
        (previous) =>
          previous
            ? {
                ...previous,
                workflow: response.workflow,
                canvas: response.canvas ?? previous.canvas,
                workflow_hash:
                  response.draft_hash ?? response.new_workflow_hash,
                draft_hash:
                  response.draft_hash ?? response.new_workflow_hash,
                revision_counter: response.revision_counter,
                revision: response.revision ?? response.revision_counter,
                validation: response.validation,
              }
            : previous,
      );
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["automation-detail", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasOperationPreview(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: CanvasOperationPreviewRequest) =>
      apiClient.previewCanvasOperations(automationId!, input),
  });
}

export function useCanvasAiMessage(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: CanvasAiMessageRequest) =>
      apiClient.sendCanvasAiMessage(automationId!, input),
  });
}

export function useCanvasAiPatchProposal(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: CanvasAiMessageRequest) =>
      apiClient.proposeCanvasAiPatch(automationId!, input),
  });
}

export function useCanvasAiExplain(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input?: Partial<CanvasAiMessageRequest>) =>
      apiClient.explainCanvasWithAi(automationId!, input),
  });
}

export function useCanvasAiValidationFix(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (
      input: Partial<CanvasAiMessageRequest> & {
        readonly selected_validation_issue_id?: string | null;
      },
    ) => apiClient.fixCanvasValidationWithAi(automationId!, input),
  });
}

export function useCanvasAiConfigureStep(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (
      input: Partial<CanvasAiMessageRequest> & {
        readonly selected_node_id?: string | null;
      },
    ) => apiClient.configureCanvasStepWithAi(automationId!, input),
  });
}

export function useCanvasAiTestPlan(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input?: Partial<CanvasAiMessageRequest>) =>
      apiClient.createCanvasAiTestPlan(automationId!, input),
  });
}

export function useCanvasAiPatchApply(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CanvasAiPatchApplyRequest) =>
      apiClient.applyCanvasAiPatch(automationId!, input),
    onSuccess: async (response) => {
      queryClient.setQueryData<CanvasDraftResponse>(
        ["canvas", workspaceId, automationId, "draft"],
        (previous) =>
          previous
            ? {
                ...previous,
                workflow: response.operation_response.workflow,
                canvas: response.operation_response.canvas ?? previous.canvas,
                workflow_hash: response.workflow_hash,
                draft_hash: response.workflow_hash,
                revision_counter: response.revision_counter,
                revision: response.revision_counter,
                validation: response.operation_response.validation,
              }
            : previous,
      );
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["automation-detail", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasAiPatchReject(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      readonly patchId: string;
      readonly request?: CanvasAiPatchRejectRequest;
    }) =>
      apiClient.rejectCanvasAiPatch(
        automationId!,
        input.patchId,
        input.request,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useStepInspectorMutations(automationId?: string | null) {
  return useCanvasOperations(automationId);
}

export function useStepTest(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StepTestRequest) =>
      apiClient.testCanvasNode(input.automationId!, input.nodeId!, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, input.automationId],
      });
    },
  });
}

export function useCanvasTestRun(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      readonly endpoint:
        | "validate"
        | "test-step"
        | "test-until-step"
        | "test-branch"
        | "test-loop"
        | "dry-run";
      readonly request: CanvasTestRunRequest;
    }) =>
      apiClient.createCanvasTestRun(
        automationId!,
        input.endpoint,
        input.request,
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["canvas-test-run", workspaceId, automationId, response.test_run_id],
      });
    },
  });
}

export function useCanvasTestRunSnapshot(input: {
  readonly automationId?: string | null;
  readonly testRunId?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas-test-run",
      workspaceId,
      input.automationId,
      input.testRunId,
    ],
    queryFn: () =>
      apiClient.getCanvasTestRun(input.automationId!, input.testRunId!),
    enabled: enabled && Boolean(input.automationId) && Boolean(input.testRunId),
    staleTime: 5_000,
  });
}

export function useCanvasTestSupportBundle(input: {
  readonly automationId?: string | null;
  readonly testRunId?: string | null;
}) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: () =>
      apiClient.getCanvasTestSupportBundle(
        input.automationId!,
        input.testRunId!,
      ),
  });
}

export function useCanvasCompilePreview(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.previewAutomationCanvasCompile(automationId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useRuntimeSyncStatus(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: ["runtime-sync-status", workspaceId, automationId],
    queryFn: () => apiClient.getAutomationRuntimeSyncStatus(automationId!),
    enabled: enabled && Boolean(automationId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useRuntimePull(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RuntimePullRequest = {}) =>
      apiClient.pullAutomationRuntime(automationId!, input),
    onSuccess: async () => {
      await invalidateRuntimeSyncQueries(queryClient, workspaceId, automationId);
    },
  });
}

export function useRuntimeImportPreview(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RuntimeImportPreviewRequest) =>
      apiClient.previewAutomationRuntimeImport(automationId!, input),
    onSuccess: async () => {
      await invalidateRuntimeSyncQueries(queryClient, workspaceId, automationId);
    },
  });
}

export function useRuntimeImportApply(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RuntimeImportApplyRequest) =>
      apiClient.applyAutomationRuntimeImport(automationId!, input),
    onSuccess: async () => {
      await invalidateRuntimeSyncQueries(queryClient, workspaceId, automationId);
    },
  });
}

export function useRuntimeImportReject(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RuntimeImportRejectRequest) =>
      apiClient.rejectAutomationRuntimeImport(automationId!, input),
    onSuccess: async () => {
      await invalidateRuntimeSyncQueries(queryClient, workspaceId, automationId);
    },
  });
}

export function useRuntimeOverwrite(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RuntimeOverwriteRequest) =>
      apiClient.overwriteAutomationRuntime(automationId!, input),
    onSuccess: async () => {
      await invalidateRuntimeSyncQueries(queryClient, workspaceId, automationId);
    },
  });
}

async function invalidateRuntimeSyncQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  automationId?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["runtime-sync-status", workspaceId, automationId],
    }),
    queryClient.invalidateQueries({
      queryKey: ["canvas", workspaceId, automationId],
    }),
    queryClient.invalidateQueries({
      queryKey: ["automation-detail", workspaceId, automationId],
    }),
    queryClient.invalidateQueries({
      queryKey: ["automation-runtime", workspaceId],
    }),
  ]);
}

export function useValidateCanvasBinding(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: StepInputBinding) =>
      apiClient.validateCanvasBinding(automationId!, input),
  });
}

export function useCanvasSampleOutput(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
  readonly outputKey?: string | null;
}) {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useWorkspaceEnabled();

  return useQuery({
    queryKey: [
      "canvas",
      workspaceId,
      input.automationId,
      "sample",
      input.nodeId,
      input.outputKey,
    ],
    queryFn: () =>
      apiClient.getCanvasSampleOutput(
        input.automationId!,
        input.nodeId!,
        input.outputKey!,
      ),
    enabled:
      enabled &&
      Boolean(input.automationId) &&
      Boolean(input.nodeId) &&
      Boolean(input.outputKey),
    staleTime: 5_000,
  });
}

export function usePinCanvasSampleData(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return {
    pin: useMutation({
      mutationFn: (input: {
        readonly nodeId: string;
        readonly outputKey: string;
        readonly sampleDataId: string;
      }) =>
        apiClient.pinCanvasSampleOutput(
          automationId!,
          input.nodeId,
          input.outputKey,
          input.sampleDataId,
        ),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
    unpin: useMutation({
      mutationFn: (input: { readonly nodeId: string; readonly outputKey: string }) =>
        apiClient.unpinCanvasSampleOutput(
          automationId!,
          input.nodeId,
          input.outputKey,
        ),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
  };
}

export function useValidateCanvas(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CanvasValidateRequest) =>
      apiClient.validateAutomationCanvas(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasNodeConfigValidation(input: {
  readonly automationId?: string | null;
  readonly nodeId?: string | null;
}) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (request: CanvasStepConfigValidationRequest) =>
      apiClient.validateCanvasNodeConfig(
        input.automationId!,
        input.nodeId!,
        request,
      ),
  });
}

export function useCanvasIssueExplanation(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (issueId: string) =>
      apiClient.explainCanvasValidationIssue(automationId!, issueId),
  });
}

export function useCanvasApplyValidationFix(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      readonly issueId: string;
      readonly request: CanvasApplySuggestedFixRequest;
    }) =>
      apiClient.applyCanvasValidationFix(
        automationId!,
        input.issueId,
        input.request,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["automation-detail", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasPublish(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CanvasPublishRequest) =>
      apiClient.publishAutomationCanvas(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["automation-detail", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasPublishValidate(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input?: CanvasPublishRequest) =>
      apiClient.validateAutomationCanvasPublish(automationId!, input),
  });
}

export function useCanvasSnapshots(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return {
    create: useMutation({
      mutationFn: (input?: CanvasSnapshotRequest) =>
        apiClient.createCanvasSnapshot(automationId!, input),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
    restore: useMutation({
      mutationFn: (snapshotId: string) =>
        apiClient.restoreCanvasSnapshot(automationId!, snapshotId),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
  };
}

export function useCanvasCheckpointCreate(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CanvasSnapshotRequest) =>
      apiClient.createCanvasCheckpoint(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasVersionRestore(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiClient.restoreAutomationCanvasVersion(automationId!, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasRollbackImpact(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: Partial<CanvasRollbackRequest>) =>
      apiClient.getAutomationCanvasRollbackImpact(automationId!, input),
  });
}

export function useCanvasRollback(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CanvasRollbackRequest) =>
      apiClient.rollbackAutomationCanvas(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["runtime-sync-status", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["automation-detail", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasEmergencyDisable(automationId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { readonly reason: string; readonly idempotency_key?: string | null }) =>
      apiClient.emergencyDisableAutomationCanvas(automationId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["canvas", workspaceId, automationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["runtime-sync-status", workspaceId, automationId],
      });
    },
  });
}

export function useCanvasRuntimeProjection(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiClient.getAutomationCanvasRuntimeProjection(automationId!, versionId),
  });
}

export function useCanvasVersionExport(automationId?: string | null) {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (versionId: string) =>
      apiClient.exportAutomationCanvasVersion(automationId!, versionId),
  });
}

export function useCanvasLock(
  automationId?: string | null,
  draftId?: string | null,
) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const queryClient = useQueryClient();

  return {
    acquire: useMutation({
      mutationFn: (input?: { readonly ttlSeconds?: number | null }) =>
        apiClient.acquireCanvasLock(automationId!, {
          draftId,
          ttlSeconds: input?.ttlSeconds ?? 120,
        }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
    heartbeat: useMutation({
      mutationFn: () =>
        apiClient.heartbeatCanvasLock(automationId!, {
          draftId,
          ttlSeconds: 120,
        }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
    release: useMutation({
      mutationFn: () => apiClient.releaseCanvasLock(automationId!, { draftId }),
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: ["canvas", workspaceId, automationId],
        });
      },
    }),
  };
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

export function useMaterializeWorkflowDraft(draftId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useWorkspaceEnabled();
  const invalidate = useStage15Invalidation();

  return useMutation({
    mutationFn: (input: Stage15WorkflowDraftMaterializeRequest) =>
      apiClient.materializeWorkflowDraft(draftId!, input),
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
