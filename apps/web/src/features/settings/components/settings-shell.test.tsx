import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsShell } from "./settings-shell";

const replace = vi.fn();
let searchParams = new URLSearchParams();
let organizationCanEdit = true;

const apiClient = {
  getSettingsBootstrap: vi.fn(),
  getAiSettings: vi.fn(),
  updateSettingsProfile: vi.fn(),
  updateSettingsOrganization: vi.fn(),
};
const refreshSessionContext = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/settings",
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient,
    refreshSessionContext,
    sessionContext: {
      permissions: [
        "settings.ai.manage_self",
        "settings.ai.manage_workspace",
      ],
    },
  }),
}));

describe("SettingsShell", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    organizationCanEdit = true;
    replace.mockReset();
    refreshSessionContext.mockReset();
    apiClient.getSettingsBootstrap.mockImplementation(async () => buildBootstrap());
    apiClient.getAiSettings.mockResolvedValue(buildAiSettings());
    apiClient.updateSettingsProfile.mockResolvedValue({});
    apiClient.updateSettingsOrganization.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders compact settings tabs and saves profile changes", async () => {
    renderSettingsShell(<SettingsShell mode="dialog" onClose={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Настройки" })).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-profile")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-organization")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-ai")).toBeInTheDocument();
    expect(screen.getByTestId("settings-tab-diagnostics")).toBeInTheDocument();

    const displayName = await screen.findByTestId("settings-profile-display-name");
    fireEvent.change(displayName, {
      target: { value: "Updated Owner" },
    });
    fireEvent.click(screen.getByTestId("settings-save-button"));

    await waitFor(() => {
      expect(apiClient.updateSettingsProfile).toHaveBeenCalled();
      expect(apiClient.updateSettingsProfile.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          displayName: "Updated Owner",
          format: "manual_form",
        }),
      );
      expect(refreshSessionContext).toHaveBeenCalled();
    });
  });

  it("keeps organization fields read-only for a non-admin bootstrap", async () => {
    organizationCanEdit = false;

    renderSettingsShell(<SettingsShell mode="dialog" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByTestId("settings-tab-organization"));

    expect(screen.getByTestId("settings-organization-display-name")).toBeDisabled();
    expect(screen.getByTestId("settings-organization-legal-name")).toBeDisabled();
    expect(screen.getByTestId("settings-save-button")).toBeDisabled();
  });

  it("loads AI and diagnostics tabs without rendering saved provider keys", async () => {
    renderSettingsShell(<SettingsShell mode="dialog" onClose={vi.fn()} />);

    await screen.findByTestId("settings-profile-display-name");
    fireEvent.click(screen.getByTestId("settings-tab-ai"));

    expect(await screen.findByRole("heading", { name: "AI и модели" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Чат и общение" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Автоматизации" })).toBeInTheDocument();
    expect(screen.getAllByText("sha256:block2").length).toBeGreaterThan(0);
    expect(screen.queryByText("sk-block2-secret")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-tab-diagnostics"));
    expect(await screen.findByText(/policy_block2/)).toBeInTheDocument();
  });
});

function renderSettingsShell(ui: React.ReactElement) {
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

function buildBootstrap() {
  return {
    profile: {
      userId: "usr_block2",
      email: "owner@lexframe.local",
      firstName: "Stage",
      lastName: "Owner",
      displayName: "Stage Owner",
      fullName: "Stage Owner",
      locale: "ru",
      timezone: "Europe/Berlin",
    },
    organization: {
      workspaceId: "ws_block2",
      workspaceSlug: "block2",
      workspaceName: "Block2 workspace",
      organizationDisplayName: "Block2 Org",
      organizationLegalName: "Block2 Org LLC",
      status: "active",
      role: organizationCanEdit ? "admin" : "viewer",
      canEditDisplayFields: organizationCanEdit,
    },
    permissions: [
      "settings.ai.manage_self",
      "settings.ai.manage_workspace",
      "settings.organization.view",
      ...(organizationCanEdit ? ["settings.organization.update"] : []),
    ],
    tabs: ["profile", "organization", "ai", "diagnostics"],
  };
}

function buildAiSettings() {
  return {
    providerConnections: [
      {
        id: "pc_block2",
        workspaceId: "ws_block2",
        ownerScope: "workspace",
        ownerUserId: null,
        providerCode: "openai_compatible",
        uiLabel: "Workspace chat model",
        baseUrl: "https://api.example.com/v1",
        modelId: "block2-chat-model",
        enabled: true,
        secret: {
          hasSecret: true,
          secretStatus: "active",
          fingerprint: "sha256:block2",
          lastUpdatedAt: "2026-05-13T00:00:00.000Z",
          backend: "supabase_vault",
        },
        capabilities: {
          streaming: true,
          jsonMode: true,
          structuredJsonSchema: true,
          toolCalls: true,
        },
        lastTestStatus: "success",
        lastTestedAt: null,
        lastUsedAt: null,
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    ],
    routeGroups: [
      {
        routeGroup: "chat_ai",
        scopeType: "workspace",
        workspaceId: "ws_block2",
        userId: null,
        providerConnectionId: "pc_block2",
        providerCode: "openai_compatible",
        modelId: "block2-chat-model",
        enabled: true,
        capabilitiesConfirmed: {
          streaming: true,
          jsonMode: true,
          structuredJsonSchema: true,
          toolCalls: true,
        },
        updatedAt: "2026-05-13T00:00:00.000Z",
      },
    ],
    effectivePolicies: [
      {
        routeGroup: "chat_ai",
        routeCode: "default_chat",
        source: "workspace_preference",
        providerConnectionId: "pc_block2",
        providerCode: "openai_compatible",
        modelId: "block2-chat-model",
        baseUrl: "https://api.example.com/v1",
        hasSecret: true,
        secretStatus: "active",
        fingerprint: "sha256:block2",
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        runtimeMode: "mock",
        runtimeUsesSavedConnection: false,
        runtimeNotice: null,
        policyDecisionId: "policy_block2",
        resolvedAt: "2026-05-13T00:00:00.000Z",
      },
    ],
  };
}
