import type { ApiClient } from "@lexframe/api-client";
import type {
  CreateAutomationIntentRequest,
  UpdateAutomationIntentRequest,
} from "@lexframe/contracts";

export function createAutomationBuilderApi(apiClient: ApiClient) {
  return {
    getReadiness: () => apiClient.getStage20Readiness(),
    createIntent: (projectId: string, input: CreateAutomationIntentRequest) =>
      apiClient.createAutomationIntent(projectId, input),
    getIntent: (intentId: string) => apiClient.getAutomationIntent(intentId),
    updateIntent: (intentId: string, input: UpdateAutomationIntentRequest) =>
      apiClient.updateAutomationIntent(intentId, input),
    cancelIntent: (intentId: string) => apiClient.cancelAutomationIntent(intentId),
    planIntent: (intentId: string) => apiClient.planAutomationIntent(intentId),
    answerClarification: (
      intentId: string,
      clarificationId: string,
      answer: unknown,
    ) =>
      apiClient.answerAutomationClarification(intentId, clarificationId, {
        answer,
      }),
    getBlueprint: (blueprintId: string) =>
      apiClient.getAutomationBlueprint(blueprintId),
    validateBlueprint: (blueprintId: string) =>
      apiClient.validateAutomationBlueprint(blueprintId),
    compilePreview: (blueprintId: string) =>
      apiClient.compileAutomationBlueprintPreview(blueprintId),
    approveBlueprint: (blueprintId: string) =>
      apiClient.approveAutomationBlueprint(blueprintId),
    rejectBlueprint: (blueprintId: string) =>
      apiClient.rejectAutomationBlueprint(blueprintId),
    convertToCanvasDraft: (blueprintId: string) =>
      apiClient.convertAutomationBlueprintToCanvasDraft(blueprintId),
    createRuntimeDraft: (blueprintId: string) =>
      apiClient.createAutomationRuntimeDraft(blueprintId),
    exportBlueprint: (blueprintId: string) =>
      apiClient.exportAutomationBlueprint(blueprintId),
    getModuleCatalog: () => apiClient.getAutomationModuleCatalog(),
    previewContext: (projectId: string, intentId?: string | null) =>
      apiClient.previewAutomationBuilderContext({ projectId, intentId }),
    securityPreflight: () => apiClient.preflightAutomationBuilderSecurity(),
  };
}
