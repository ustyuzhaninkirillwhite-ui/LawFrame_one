import type {
  AiEffectivePolicyDto,
  AiProviderConnectionDto,
} from "@lexframe/contracts";
import { ApiClientError } from "@lexframe/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiSettingsPanel } from "./ai-settings-panel";

let apiClient: {
  createAiProviderConnection: ReturnType<typeof vi.fn>;
  updateAiProviderConnection: ReturnType<typeof vi.fn>;
  replaceAiProviderConnectionSecret: ReturnType<typeof vi.fn>;
  updateAiRouteGroupPreference: ReturnType<typeof vi.fn>;
  testAiProviderConnection: ReturnType<typeof vi.fn>;
};

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({ apiClient }),
}));

describe("AiSettingsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("saves only the edited AI route group so chat and automation preferences stay independent", async () => {
    const connection = buildConnection("conn_workspace_ai");
    apiClient = {
      createAiProviderConnection: vi.fn().mockResolvedValue(connection),
      updateAiProviderConnection: vi.fn(),
      replaceAiProviderConnectionSecret: vi.fn(),
      updateAiRouteGroupPreference: vi.fn().mockResolvedValue({}),
      testAiProviderConnection: vi.fn(),
    };

    renderWithQueryClient(
      <AiSettingsPanel
        canManageSelf={true}
        canManageWorkspace={true}
        connections={[]}
        preferences={[]}
      />,
    );

    fireEvent.click(firstSaveButton());

    await waitFor(() => {
      expect(apiClient.createAiProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          routeGroup: "chat_ai",
          ownerScope: "workspace",
          providerCode: "cometapi",
          baseUrl: "https://api.cometapi.com/v1",
          modelId: "deepseek-v4-pro",
        }),
      );
      expect(apiClient.updateAiRouteGroupPreference).toHaveBeenCalledTimes(1);
    });
    expect(apiClient.updateAiRouteGroupPreference).toHaveBeenCalledWith(
      "chat_ai",
      expect.objectContaining({
        scopeType: "workspace",
        providerConnectionId: "conn_workspace_ai",
        modelId: "grok-4-1-fast-non-reasoning",
      }),
    );
    expect(apiClient.updateAiRouteGroupPreference).not.toHaveBeenCalledWith(
      "automation_ai",
      expect.anything(),
    );
  });

  it("saves a typed key before testing a connection with no saved secret", async () => {
    const connection = buildConnection("conn_workspace_ai", { hasSecret: false });
    const rotatedConnection = buildConnection("conn_workspace_ai", {
      fingerprint: "sha256:rotated",
    });
    apiClient = {
      createAiProviderConnection: vi.fn(),
      updateAiProviderConnection: vi.fn().mockResolvedValue(connection),
      replaceAiProviderConnectionSecret: vi.fn().mockResolvedValue(rotatedConnection),
      updateAiRouteGroupPreference: vi.fn().mockResolvedValue({}),
      testAiProviderConnection: vi.fn().mockResolvedValue({
        providerConnectionId: "conn_workspace_ai",
        status: "success",
        latencyMs: 10,
        testedAt: "2026-05-09T00:00:00.000Z",
        errorCode: null,
        message: "Provider models endpoint responded.",
        redacted: true,
      }),
    };

    renderWithQueryClient(
      <AiSettingsPanel
        canManageSelf={true}
        canManageWorkspace={true}
        connections={[connection]}
        preferences={[
          {
            routeGroup: "chat_ai",
            scopeType: "workspace",
            workspaceId: "00000000-0000-4000-8000-000000000021",
            userId: null,
            providerConnectionId: "conn_workspace_ai",
            providerCode: "cometapi",
            modelId: "grok-4-1-fast-non-reasoning",
            enabled: true,
            capabilitiesConfirmed: connection.capabilities,
            updatedAt: "2026-05-09T00:00:00.000Z",
          },
        ]}
      />,
    );

    const keyInput = firstApiKeyInput();
    fireEvent.change(keyInput, {
      target: { value: "sk-test-user-entered-key" },
    });

    const testButton = firstButton();
    expect(testButton).toHaveTextContent("Сохранить и проверить");
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(apiClient.replaceAiProviderConnectionSecret).toHaveBeenCalledWith(
        "conn_workspace_ai",
        { apiKey: "sk-test-user-entered-key" },
      );
      expect(apiClient.updateAiRouteGroupPreference).toHaveBeenCalledTimes(1);
      expect(apiClient.updateAiRouteGroupPreference).toHaveBeenCalledWith(
        "chat_ai",
        expect.objectContaining({
          providerConnectionId: "conn_workspace_ai",
        }),
      );
      expect(apiClient.testAiProviderConnection).toHaveBeenCalledWith(
        "conn_workspace_ai",
      );
    });
    expect(firstCallOrder(apiClient.replaceAiProviderConnectionSecret))
      .toBeLessThan(firstCallOrder(apiClient.testAiProviderConnection));
    await waitFor(() => {
      expect(keyInput).toHaveValue("");
    });
  });

  it("does not reuse a chat connection as the implicit automation route connection", async () => {
    const chatConnection = buildConnection("conn_chat_ai");
    const automationConnection = {
      ...buildConnection("conn_automation_ai"),
      modelId: "automation-route-model",
    };
    apiClient = {
      createAiProviderConnection: vi.fn().mockResolvedValue(automationConnection),
      updateAiProviderConnection: vi.fn().mockResolvedValue(chatConnection),
      replaceAiProviderConnectionSecret: vi.fn(),
      updateAiRouteGroupPreference: vi.fn().mockResolvedValue({}),
      testAiProviderConnection: vi.fn(),
    };

    renderWithQueryClient(
      <AiSettingsPanel
        canManageSelf={true}
        canManageWorkspace={true}
        connections={[chatConnection]}
        preferences={[
          {
            routeGroup: "chat_ai",
            scopeType: "workspace",
            workspaceId: "00000000-0000-4000-8000-000000000021",
            userId: null,
            providerConnectionId: "conn_chat_ai",
            providerCode: "cometapi",
            modelId: "chat-route-model",
            enabled: true,
            capabilitiesConfirmed: chatConnection.capabilities,
            updatedAt: "2026-05-09T00:00:00.000Z",
          },
        ]}
      />,
    );

    const automationModelInput = screen.getByTestId("settings-ai-model-id-automation_ai");
    fireEvent.change(automationModelInput, {
      target: { value: "automation-route-model" },
    });
    fireEvent.click(screen.getByTestId("settings-ai-save-automation_ai"));

    await waitFor(() => {
      expect(apiClient.createAiProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          routeGroup: "automation_ai",
          modelId: "automation-route-model",
        }),
      );
      expect(apiClient.updateAiProviderConnection).not.toHaveBeenCalled();
      expect(apiClient.updateAiRouteGroupPreference).toHaveBeenCalledWith(
        "automation_ai",
        expect.objectContaining({
          providerConnectionId: "conn_automation_ai",
          modelId: "automation-route-model",
        }),
      );
    });
  });

  it("renders secret backend failures as actionable settings errors", async () => {
    const connection = buildConnection("conn_workspace_ai", { hasSecret: false });
    apiClient = {
      createAiProviderConnection: vi.fn(),
      updateAiProviderConnection: vi.fn().mockResolvedValue(connection),
      replaceAiProviderConnectionSecret: vi.fn().mockRejectedValue(
        new ApiClientError(
          "Supabase Vault is unavailable for AI provider key storage in this environment.",
          503,
          "AI_SECRET_BACKEND_UNAVAILABLE",
          "request_001",
          undefined,
        ),
      ),
      updateAiRouteGroupPreference: vi.fn(),
      testAiProviderConnection: vi.fn(),
    };

    renderWithQueryClient(
      <AiSettingsPanel
        canManageSelf={true}
        canManageWorkspace={true}
        connections={[connection]}
        preferences={[
          {
            routeGroup: "chat_ai",
            scopeType: "workspace",
            workspaceId: "00000000-0000-4000-8000-000000000021",
            userId: null,
            providerConnectionId: "conn_workspace_ai",
            providerCode: "cometapi",
            modelId: "grok-4-1-fast-non-reasoning",
            enabled: true,
            capabilitiesConfirmed: connection.capabilities,
            updatedAt: "2026-05-09T00:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.change(firstApiKeyInput(), {
      target: { value: "sk-test-user-entered-key" },
    });
    fireEvent.click(firstButton());

    expect(
      await screen.findByText(/Хранилище AI-ключей недоступно/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unexpected backend error")).not.toBeInTheDocument();
  });

  it("shows that mock runtime mode ignores saved provider keys", () => {
    apiClient = {
      createAiProviderConnection: vi.fn(),
      updateAiProviderConnection: vi.fn(),
      replaceAiProviderConnectionSecret: vi.fn(),
      updateAiRouteGroupPreference: vi.fn(),
      testAiProviderConnection: vi.fn(),
    };

    renderWithQueryClient(
      <AiSettingsPanel
        canManageSelf={true}
        canManageWorkspace={true}
        connections={[]}
        policies={[buildPolicy({ runtimeMode: "mock" })]}
        preferences={[]}
      />,
    );

    expect(
      screen.getByText(/сохранённые ключи не используются runtime-вызовами/),
    ).toBeInTheDocument();
  });
});

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function firstSaveButton() {
  const button = screen.getAllByRole("button")[1];

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Save button not found");
  }

  return button;
}

function firstButton() {
  const button = screen.getAllByRole("button")[0];

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Button not found");
  }

  return button;
}

function firstApiKeyInput() {
  const input = screen.getAllByLabelText(/API key/)[0];

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("API key input not found");
  }

  return input;
}

function firstCallOrder(mock: ReturnType<typeof vi.fn>) {
  const order = mock.mock.invocationCallOrder[0];

  if (order === undefined) {
    throw new Error("Expected mock to have been called");
  }

  return order;
}

function buildConnection(
  id: string,
  overrides?: {
    readonly hasSecret?: boolean;
    readonly fingerprint?: string | null;
  },
): AiProviderConnectionDto {
  const hasSecret = overrides?.hasSecret ?? true;

  return {
    id,
    workspaceId: "00000000-0000-4000-8000-000000000021",
    ownerScope: "workspace",
    ownerUserId: null,
    providerCode: "cometapi",
    uiLabel: "CometAPI Grok",
    baseUrl: "https://api.cometapi.com/v1",
    modelId: "grok-4-1-fast-non-reasoning",
    enabled: true,
    secret: {
      hasSecret,
      secretStatus: hasSecret ? "active" : "missing",
      fingerprint: hasSecret ? (overrides?.fingerprint ?? "sha256:workspace") : null,
      lastUpdatedAt: hasSecret ? "2026-05-09T00:00:00.000Z" : null,
      backend: hasSecret ? "supabase_vault" : null,
    },
    capabilities: {
      streaming: true,
      jsonMode: true,
      structuredJsonSchema: true,
      toolCalls: true,
    },
    lastTestStatus: "not_tested",
    lastTestedAt: null,
    lastUsedAt: null,
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
  };
}

function buildPolicy(
  overrides?: Partial<AiEffectivePolicyDto>,
): AiEffectivePolicyDto {
  return {
    routeGroup: "chat_ai",
    routeCode: "default_chat",
    source: "workspace_preference",
    providerConnectionId: "conn_workspace_ai",
    providerCode: "cometapi",
    modelId: "grok-4-1-fast-non-reasoning",
    baseUrl: "https://api.cometapi.com/v1",
    hasSecret: true,
    secretStatus: "active",
    fingerprint: "sha256:workspace",
    supportsStreaming: true,
    supportsJson: true,
    supportsToolCalls: true,
    runtimeMode: "controlled-real",
    runtimeUsesSavedConnection: true,
    runtimeNotice: null,
    policyDecisionId: "policy_001",
    resolvedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}
