"use client";

import type {
  CreateReauthChallengeRequest,
  SecretRotationRequest,
  SecurityAlertUpdateRequest,
  SecurityIncidentUpdateRequest,
  WorkspaceSecuritySettingsUpdateRequest,
} from "@lexframe/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionBridge } from "@/providers/session-provider";

function useSecurityWorkspace() {
  const { authPending, sessionContext } = useSessionBridge();

  return {
    enabled: !authPending && sessionContext.state === "ready",
    workspaceId: sessionContext.activeWorkspace?.id ?? "none",
  };
}

function useSecurityInvalidation() {
  const queryClient = useQueryClient();

  return async (workspaceId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stage11-security-overview", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-security-sessions", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-security-settings", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-secrets", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-audit-events", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-ai-policies", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-activepieces-security", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-security-alerts", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-security-incidents", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-processing-activities", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-retention-policies", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-retention-report", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-dsr-requests", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["stage11-access-reviews", workspaceId] }),
    ]);
  };
}

export function useAdminSecurityOverview() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-security-overview", workspaceId],
    queryFn: () => apiClient.getAdminSecurityOverview(),
    enabled,
    staleTime: 10_000,
  });
}

export function useSecuritySessions() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-security-sessions", workspaceId],
    queryFn: () => apiClient.listSecuritySessions(),
    enabled,
    staleTime: 5_000,
  });
}

export function useWorkspaceSecuritySettings() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-security-settings", workspaceId],
    queryFn: () => apiClient.getWorkspaceSecuritySettings(),
    enabled,
    staleTime: 10_000,
  });
}

export function useSecretsInventory() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-secrets", workspaceId],
    queryFn: () => apiClient.listSecretsInventory(),
    enabled,
    staleTime: 10_000,
  });
}

export function useAuditEventsAdmin() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-audit-events", workspaceId],
    queryFn: () => apiClient.listAuditEventsAdmin(),
    enabled,
    staleTime: 10_000,
  });
}

export function useAiProviderPolicies() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-ai-policies", workspaceId],
    queryFn: () => apiClient.listAiProviderPolicies(),
    enabled,
    staleTime: 15_000,
  });
}

export function useActivepiecesSecurityOverview() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-activepieces-security", workspaceId],
    queryFn: () => apiClient.getActivepiecesSecurityOverview(),
    enabled,
    staleTime: 10_000,
  });
}

export function useSecurityAlerts() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-security-alerts", workspaceId],
    queryFn: () => apiClient.listSecurityAlerts(),
    enabled,
    staleTime: 5_000,
  });
}

export function useSecurityIncidents() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-security-incidents", workspaceId],
    queryFn: () => apiClient.listSecurityIncidents(),
    enabled,
    staleTime: 5_000,
  });
}

export function useComplianceProcessingActivities() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-processing-activities", workspaceId],
    queryFn: () => apiClient.listComplianceProcessingActivities(),
    enabled,
    staleTime: 15_000,
  });
}

export function useRetentionPolicies() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-retention-policies", workspaceId],
    queryFn: () => apiClient.listRetentionPolicies(),
    enabled,
    staleTime: 15_000,
  });
}

export function useRetentionReport() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-retention-report", workspaceId],
    queryFn: () => apiClient.getRetentionReport(),
    enabled,
    staleTime: 15_000,
  });
}

export function useDsrRequests() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-dsr-requests", workspaceId],
    queryFn: () => apiClient.listDsrRequests(),
    enabled,
    staleTime: 15_000,
  });
}

export function useAccessReviewCampaigns() {
  const { apiClient } = useSessionBridge();
  const { enabled, workspaceId } = useSecurityWorkspace();

  return useQuery({
    queryKey: ["stage11-access-reviews", workspaceId],
    queryFn: () => apiClient.listAccessReviewCampaigns(),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateReauthChallenge() {
  const { apiClient } = useSessionBridge();

  return useMutation({
    mutationFn: (input: CreateReauthChallengeRequest) =>
      apiClient.createReauthChallenge(input),
  });
}

export function useVerifyReauthChallenge() {
  const { apiClient, setReauthToken } = useSessionBridge();

  return useMutation({
    mutationFn: (input: { readonly challengeId: string; readonly verificationCode: string }) =>
      apiClient.verifyReauthChallenge(input),
    onSuccess: (challenge) => {
      if (challenge.token) {
        setReauthToken(challenge.token);
      }
    },
  });
}

export function useRevokeSecuritySession(sessionId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation({
    mutationFn: (input: { readonly reason?: string | null } = {}) =>
      apiClient.revokeSecuritySession(sessionId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateWorkspaceSecuritySettings() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation({
    mutationFn: (input: WorkspaceSecuritySettingsUpdateRequest) =>
      apiClient.updateWorkspaceSecuritySettings(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useSecretRotation(secretCode?: string | null, mode: "compromised" | "start" | "complete" = "start") {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation<{ readonly status: string }, Error, SecretRotationRequest>({
    mutationKey: ["stage11-secret-rotation", workspaceId, secretCode, mode],
    mutationFn: (input: SecretRotationRequest = {}) => {
      if (mode === "compromised") {
        return apiClient.markSecretCompromised(secretCode!, input);
      }

      if (mode === "complete") {
        return apiClient.completeSecretRotation(secretCode!, input);
      }

      return apiClient.startSecretRotation(secretCode!, input);
    },
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateSecurityAlert(alertId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation({
    mutationFn: (input: SecurityAlertUpdateRequest) =>
      apiClient.updateSecurityAlert(alertId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useCreateSecurityIncident() {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation({
    mutationFn: (input: {
      readonly title: string;
      readonly severity: "low" | "medium" | "high" | "critical";
    }) => apiClient.createSecurityIncident(input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}

export function useUpdateSecurityIncident(incidentId?: string | null) {
  const { apiClient } = useSessionBridge();
  const { workspaceId } = useSecurityWorkspace();
  const invalidate = useSecurityInvalidation();

  return useMutation({
    mutationFn: (input: SecurityIncidentUpdateRequest) =>
      apiClient.updateSecurityIncident(incidentId!, input),
    onSuccess: async () => {
      await invalidate(workspaceId);
    },
  });
}
