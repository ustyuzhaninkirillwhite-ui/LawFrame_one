"use client";

import type {
  AiConnectionTestResultDto,
  AiProviderConnectionDto,
  AiRouteGroup,
  AiRouteGroupPreferenceDto,
} from "@lexframe/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { SettingsErrorState } from "./settings-error-state";
import { AiRouteGroupCard } from "./ai-route-group-card";
import type { AiProviderConnectionFormValue } from "./ai-provider-connection-form";
import { useSessionBridge } from "@/providers/session-provider";

export function AiSettingsPanel({
  canManageSelf,
  canManageWorkspace,
  connections,
  preferences,
}: {
  readonly canManageSelf: boolean;
  readonly canManageWorkspace: boolean;
  readonly connections: readonly AiProviderConnectionDto[];
  readonly preferences: readonly AiRouteGroupPreferenceDto[];
}) {
  const { apiClient } = useSessionBridge();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<
    Record<string, AiConnectionTestResultDto>
  >({});
  const ownerScope = canManageWorkspace ? "workspace" : "user";
  const canManage = canManageWorkspace || canManageSelf;

  const saveMutation = useMutation({
    mutationFn: async (input: {
      readonly routeGroup: AiRouteGroup;
      readonly form: AiProviderConnectionFormValue;
      readonly connection: AiProviderConnectionDto | null;
    }) => {
      setError(null);
      const connection =
        input.connection ??
        (await apiClient.createAiProviderConnection({
          format: "manual_form",
          routeGroup: input.routeGroup,
          ownerScope,
          providerCode: input.form.providerCode,
          baseUrl: input.form.baseUrl,
          modelId: input.form.modelId,
          apiKey: input.form.apiKey || null,
          capabilities: input.form.capabilities,
        }));

      const updatedConnection = input.connection
        ? await apiClient.updateAiProviderConnection(input.connection.id, {
            format: "manual_form",
            providerCode: input.form.providerCode,
            baseUrl: input.form.baseUrl,
            modelId: input.form.modelId,
            capabilities: input.form.capabilities,
            enabled: true,
          })
        : connection;

      if (input.connection && input.form.apiKey) {
        await apiClient.replaceAiProviderConnectionSecret(input.connection.id, {
          apiKey: input.form.apiKey,
        });
      }

      await apiClient.updateAiRouteGroupPreference(input.routeGroup, {
        format: "manual_form",
        scopeType: ownerScope,
        providerConnectionId: updatedConnection.id,
        modelId: input.form.modelId,
        enabled: true,
        capabilitiesConfirmed: input.form.capabilities,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "AI settings save failed.",
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: async (connectionId: string) =>
      apiClient.testAiProviderConnection(connectionId),
    onSuccess: (result) => {
      setTestResults((current) => ({
        ...current,
        [result.providerConnectionId]: result,
      }));
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Connection test failed.",
      );
    },
  });

  const renderCard = (routeGroup: AiRouteGroup, title: string) => {
    const preference = pickPreference(preferences, routeGroup, ownerScope);
    const connection = pickConnection(connections, preference);
    return (
      <AiRouteGroupCard
        key={routeGroup}
        canManageWorkspace={canManage}
        connection={connection}
        isSaving={saveMutation.isPending}
        preference={preference}
        routeGroup={routeGroup}
        testPending={testMutation.isPending}
        testResult={connection ? testResults[connection.id] : null}
        title={title}
        onSave={(form) =>
          saveMutation.mutateAsync({ routeGroup, form, connection })
        }
        onTest={() => {
          if (connection) {
            testMutation.mutate(connection.id);
          }
        }}
      />
    );
  };

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">AI и модели</h2>
        <p className="mt-1 text-sm text-[color:var(--lf-text-muted)]">
          Чат и автоматизации используют разные route groups в LexFrame AI Gateway.
        </p>
      </div>
      {error ? <SettingsErrorState message={error} /> : null}
      <div className="grid gap-4">
        {renderCard("chat_ai", "Чат и общение")}
        {renderCard("automation_ai", "Автоматизации")}
      </div>
    </section>
  );
}

function pickPreference(
  preferences: readonly AiRouteGroupPreferenceDto[],
  routeGroup: AiRouteGroup,
  ownerScope: "user" | "workspace",
) {
  return (
    preferences.find(
      (preference) =>
        preference.routeGroup === routeGroup &&
        preference.scopeType === ownerScope,
    ) ??
    preferences.find((preference) => preference.routeGroup === routeGroup) ??
    null
  );
}

function pickConnection(
  connections: readonly AiProviderConnectionDto[],
  preference: AiRouteGroupPreferenceDto | null,
) {
  if (preference?.providerConnectionId) {
    const preferred = connections.find(
      (connection) => connection.id === preference.providerConnectionId,
    );
    if (preferred) {
      return preferred;
    }
  }

  return connections[0] ?? null;
}
