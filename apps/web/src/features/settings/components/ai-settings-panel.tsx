"use client";

import { ApiClientError } from "@lexframe/api-client";
import type {
  AiConnectionTestResultDto,
  AiEffectivePolicyDto,
  AiProviderConnectionDto,
  AiRouteGroup,
  AiRouteGroupPreferenceDto,
} from "@lexframe/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";
import type { AiProviderConnectionFormValue } from "./ai-provider-connection-form";
import { AiRouteGroupCard } from "./ai-route-group-card";
import { SettingsErrorState } from "./settings-error-state";

export function AiSettingsPanel({
  canManageSelf,
  canManageWorkspace,
  connections,
  policies = [],
  preferences,
}: {
  readonly canManageSelf: boolean;
  readonly canManageWorkspace: boolean;
  readonly connections: readonly AiProviderConnectionDto[];
  readonly policies?: readonly AiEffectivePolicyDto[];
  readonly preferences: readonly AiRouteGroupPreferenceDto[];
}) {
  const { apiClient } = useSessionBridge();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [testResults, setTestResults] = React.useState<
    Record<string, AiConnectionTestResultDto>
  >({});
  const [resetSensitiveInputVersion, setResetSensitiveInputVersion] =
    React.useState(0);
  const ownerScope = "workspace";
  const canManage = canManageWorkspace;
  const isMockRuntime = policies.some((policy) => policy.runtimeMode === "mock");
  void canManageSelf;

  const persistAiSettings = async (input: {
    readonly routeGroup: AiRouteGroup;
    readonly form: AiProviderConnectionFormValue;
    readonly connection: AiProviderConnectionDto | null;
  }) => {
    const apiKey = input.form.apiKey.trim();
    let persistedConnection = input.connection
      ? await apiClient.updateAiProviderConnection(input.connection.id, {
          format: "manual_form",
          providerCode: input.form.providerCode,
          baseUrl: input.form.baseUrl,
          modelId: input.form.modelId,
          capabilities: input.form.capabilities,
          enabled: true,
        })
      : await apiClient.createAiProviderConnection({
          format: "manual_form",
          routeGroup: input.routeGroup,
          ownerScope,
          providerCode: input.form.providerCode,
          baseUrl: input.form.baseUrl,
          modelId: input.form.modelId,
          apiKey: apiKey || null,
          capabilities: input.form.capabilities,
        });

    if (input.connection && apiKey) {
      persistedConnection = await apiClient.replaceAiProviderConnectionSecret(
        input.connection.id,
        { apiKey },
      );
    }

    await apiClient.updateAiRouteGroupPreference(input.routeGroup, {
      format: "manual_form",
      scopeType: ownerScope,
      providerConnectionId: persistedConnection.id,
      modelId: persistedConnection.modelId,
      enabled: true,
      capabilitiesConfirmed: input.form.capabilities,
    });

    return persistedConnection;
  };

  const saveMutation = useMutation({
    mutationFn: async (input: {
      readonly routeGroup: AiRouteGroup;
      readonly form: AiProviderConnectionFormValue;
      readonly connection: AiProviderConnectionDto | null;
    }) => {
      setError(null);
      return persistAiSettings(input);
    },
    onSuccess: () => {
      setResetSensitiveInputVersion((current) => current + 1);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] });
    },
    onError: (mutationError) => {
      setError(formatAiSettingsError(mutationError, "AI settings save failed."));
    },
  });

  const saveAndTestMutation = useMutation({
    mutationFn: async (input: {
      readonly routeGroup: AiRouteGroup;
      readonly form: AiProviderConnectionFormValue;
      readonly connection: AiProviderConnectionDto | null;
    }) => {
      setError(null);
      const persistedConnection = await persistAiSettings(input);
      return apiClient.testAiProviderConnection(persistedConnection.id);
    },
    onSuccess: (result) => {
      setTestResults((current) => ({
        ...current,
        [result.providerConnectionId]: result,
      }));
      setResetSensitiveInputVersion((current) => current + 1);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] });
    },
    onError: (mutationError) => {
      setError(
        formatAiSettingsError(mutationError, "Connection save and test failed."),
      );
    },
  });

  const testMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      setError(null);
      return apiClient.testAiProviderConnection(connectionId);
    },
    onSuccess: (result) => {
      setTestResults((current) => ({
        ...current,
        [result.providerConnectionId]: result,
      }));
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "ai"] });
    },
    onError: (mutationError) => {
      setError(formatAiSettingsError(mutationError, "Connection test failed."));
    },
  });

  const renderCard = (routeGroup: AiRouteGroup, title: string) => {
    const preference = pickPreference(preferences, routeGroup, ownerScope);
    const connection = pickConnection(connections, preference);
    const isTesting = testMutation.isPending || saveAndTestMutation.isPending;

    return (
      <AiRouteGroupCard
        key={routeGroup}
        canManageWorkspace={canManage}
        connection={connection}
        isSaving={saveMutation.isPending || saveAndTestMutation.isPending}
        preference={preference}
        resetSensitiveInputVersion={resetSensitiveInputVersion}
        routeGroup={routeGroup}
        testPending={isTesting}
        testResult={connection ? testResults[connection.id] : null}
        title={title}
        onSave={(form) =>
          saveMutation.mutateAsync({ routeGroup, form, connection }).then(() => undefined)
        }
        onTest={(form) => {
          const shouldPersistBeforeTest =
            Boolean(form.apiKey.trim()) || !connection?.secret.hasSecret;

          if (shouldPersistBeforeTest) {
            return saveAndTestMutation
              .mutateAsync({ routeGroup, form, connection })
              .then(() => undefined);
          }

          if (connection) {
            return testMutation.mutateAsync(connection.id).then(() => undefined);
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
      {isMockRuntime ? (
        <div className="rounded-[var(--lf-radius-control)] border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-3 text-sm text-[color:var(--lf-text-primary)]">
          AI_PROVIDER_MODE=mock: сохранённые ключи не используются runtime-вызовами.
        </div>
      ) : null}
      {error ? (
        <SettingsErrorState
          title="Не удалось сохранить или проверить AI-настройки"
          message={error}
        />
      ) : null}
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

  return null;
}

function formatAiSettingsError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.code === "AI_SECRET_BACKEND_UNAVAILABLE") {
      return `Хранилище AI-ключей недоступно: ${error.message}`;
    }

    if (error.code === "AI_SECRET_MISSING") {
      return "API-ключ не сохранён. Введите новый ключ, сохраните настройки и повторите проверку.";
    }

    if (
      error.code === "AI_PROVIDER_UNAVAILABLE" ||
      error.status >= 500 ||
      !isSafeAiUiErrorMessage(error.message)
    ) {
      return "AI provider is temporarily unavailable. Check provider status and saved connection settings.";
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function isSafeAiUiErrorMessage(message: string) {
  return (
    message.length > 0 &&
    message.length <= 220 &&
    !/authorization|bearer|x-api-key|api[_ -]?key|sk-[A-Za-z0-9_-]{8,}|BEGIN PRIVATE KEY|upstream\s+5\d\d/i.test(
      message,
    )
  );
}
