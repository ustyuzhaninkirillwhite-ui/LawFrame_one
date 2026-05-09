import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ActivepiecesSessionReadyResponse } from "@lexframe/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActivepiecesSession } from "./use-activepieces-session";

const bridge = vi.hoisted(() => ({
  apiClient: {
    createActivepiecesSession: vi.fn(),
    getActivepiecesCanvasReadiness: vi.fn(),
  },
  authPending: false,
  sessionContext: {
    activeWorkspace: {
      id: "ws_1",
    },
  },
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => bridge,
}));

describe("useActivepiecesSession", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    bridge.apiClient.createActivepiecesSession.mockReset();
    bridge.apiClient.getActivepiecesCanvasReadiness.mockReset();
    bridge.authPending = false;
    bridge.sessionContext.activeWorkspace.id = "ws_1";
    bridge.apiClient.createActivepiecesSession.mockResolvedValue(
      readySession({
        sessionId: "sess_1",
        jwtToken: "token_1",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      }),
    );
    bridge.apiClient.getActivepiecesCanvasReadiness.mockResolvedValue({
      status: "ready",
      reasonCode: "READY",
      readinessCode: "READY",
      activepiecesProjectId: "ap_project_1",
      activepiecesFlowId: "flow_1",
      activepiecesFlowVersionId: null,
      readinessVersion: "readiness_1",
      activepiecesVersion: "0.82.0",
      embedSdkVersion: "0.9.0",
      repairAttempted: false,
      checkedAt: "2026-05-08T10:00:00.000Z",
      checks: [],
      canonicalReplacementRoute: null,
      message: null,
    });
  });

  it("reuses a valid canvas session across route remounts", async () => {
    const first = render(
      <SessionProbe projectId="project_claim_001" automationId="aut_1" />,
    );

    expect(await screen.findByText("available:sess_1")).toBeInTheDocument();
    first.unmount();

    render(
      <SessionProbe projectId="project_claim_001" automationId="aut_1" />,
    );

    expect(await screen.findByText("available:sess_1")).toBeInTheDocument();
    await waitFor(() => {
      expect(bridge.apiClient.createActivepiecesSession).toHaveBeenCalledTimes(1);
    });
    expect(
      bridge.apiClient.getActivepiecesCanvasReadiness,
    ).toHaveBeenCalledTimes(2);
    expect(bridge.apiClient.createActivepiecesSession).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "canvas:ws_1:project_claim_001:aut_1",
      }),
    );
  });

  it("does not start a foreground session refresh while a canvas remains healthy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
    bridge.apiClient.createActivepiecesSession.mockResolvedValue(
      readySession({
        sessionId: "sess_healthy",
        jwtToken: "token_healthy",
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      }),
    );

    render(
      <SessionProbe
        projectId="project_claim_001"
        automationId="aut_refresh_guard"
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("available:sess_healthy")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });

    expect(bridge.apiClient.createActivepiecesSession).toHaveBeenCalledTimes(1);
    expect(
      bridge.apiClient.getActivepiecesCanvasReadiness,
    ).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

function SessionProbe({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const { state } = useActivepiecesSession({ projectId, automationId });

  return (
    <div>
      {state.phase}
      {state.session ? `:${state.session.sessionId}` : ""}
    </div>
  );
}

function readySession(input: {
  readonly sessionId: string;
  readonly jwtToken: string;
  readonly expiresAt: string;
}): ActivepiecesSessionReadyResponse {
  return {
    status: "ready",
    readinessCode: "READY",
    sessionId: input.sessionId,
    mode: "iframe_embed",
    issuedAt: "2026-05-08T10:00:00.000Z",
    instanceUrl: "http://127.0.0.1:3100/automation-runtime",
    builderUrl: "http://127.0.0.1:3100/automation-runtime/flows/flow_1",
    initialRoute: "/flows/flow_1",
    expectedRoute: "/flows/flow_1",
    refreshPolicy: {
      strategy: "no_foreground_refresh",
      recoverOn: ["auth", "invalid_access", "stuck_loading"],
    },
    jwtToken: input.jwtToken,
    expiresAt: input.expiresAt,
    ttlSeconds: 120,
    locale: "ru",
    brandDisplayName: "Automation",
    brand: {
      shortName: "Автоматизация",
      longName: "Конструктор автоматизаций",
      documentTitle: "Конструктор автоматизаций",
      logoAlt: "Автоматизация",
      ariaLabel: "Конструктор автоматизаций",
    },
    role: "EDITOR",
    permissions: {
      canView: true,
      canEdit: true,
      canManageConnections: false,
      canOpenDiagnostics: true,
    },
    piecesPolicy: {
      piecesFilterType: "ALLOWED",
      piecesTags: [],
      policyHash: "sha256:policy",
    },
    sdkConfig: {
      containerId: "activepieces-canvas-sess_1",
      prefix: "/automation-runtime",
      locale: "ru",
      brandDisplayName: "Automation",
      designSystem: "activepieces_like",
      navigationSync: true,
      embedding: {
        containerId: "activepieces-canvas-sess_1",
        locale: "ru",
        builder: {
          disableNavigation: false,
          hideFlowName: false,
          homeButtonIcon: "logo",
        },
        dashboard: {
          hideSidebar: false,
          hideFlowsPageNavbar: false,
          hidePageHeader: false,
        },
        hideFolders: false,
        hideExportAndImportFlow: false,
        hideDuplicateFlow: false,
        navigationSync: true,
      },
    },
    designSystem: "activepieces_like",
    flowBinding: {
      automationId: "aut_1",
      activepiecesProjectId: "ap_project_1",
      activepiecesFlowId: "flow_1",
      activepiecesFlowVersionId: null,
      syncStatus: "synced",
      syncHash: "hash_1",
    },
    runtimeStatus: {
      apApp: "ok",
      apWorker: "unknown",
      apDb: "unknown",
      redis: "unknown",
    },
    openCheck: {
      status: "ready",
      reasonCode: "READY",
      activepiecesProjectId: "ap_project_1",
      activepiecesFlowId: "flow_1",
      activepiecesFlowVersionId: null,
      readinessVersion: "readiness_1",
      activepiecesVersion: "0.82.0",
      embedSdkVersion: "0.9.0",
      expectedRoute: "/flows/flow_1",
      refreshPolicy: {
        strategy: "no_foreground_refresh",
        recoverOn: ["auth", "invalid_access", "stuck_loading"],
      },
      repairAttempted: false,
      checkedAt: "2026-05-08T10:00:00.000Z",
      checks: [],
      canonicalReplacementRoute: null,
      message: null,
    },
  };
}
