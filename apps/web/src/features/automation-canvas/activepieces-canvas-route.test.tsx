import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivepiecesCanvasRoute } from "./activepieces-canvas-route";

const replace = vi.fn();
const apiClient = {
  initializeActivepiecesSession: vi.fn(),
  recordActivepiecesIframeHealth: vi.fn(),
  startAutomationRun: vi.fn(),
};
const sessionHook = vi.hoisted(() => ({
  clearToken: vi.fn(),
  requestSession: vi.fn(),
  tokenRef: { current: null as string | null },
  state: {
    phase: "available",
    session: {
      sessionId: "sess_canvas",
      flowBinding: {
        automationId: "aut_canvas",
        activepiecesFlowId: "flow_canvas",
      },
      openCheck: null,
    },
  } as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("./activepieces-canvas-wrapper", () => ({
  ActivepiecesCanvasWrapper: ({
    onAuthFailure,
    onMounted,
  }: {
    onAuthFailure: (reason: "auth" | "invalid_access" | "stuck_loading") => void;
    onMounted: () => void;
  }) => {
    React.useEffect(() => {
      onMounted();
    }, [onMounted]);
    return (
      <div>
        embedded automation canvas
        <button type="button" onClick={() => onAuthFailure("invalid_access")}>
          simulate invalid access
        </button>
      </div>
    );
  },
}));

vi.mock("./use-activepieces-session", () => ({
  useActivepiecesSession: () => ({
    apiClient,
    clearToken: sessionHook.clearToken,
    requestSession: sessionHook.requestSession,
    tokenRef: sessionHook.tokenRef,
    state: sessionHook.state,
  }),
}));

describe("ActivepiecesCanvasRoute", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    replace.mockReset();
    apiClient.initializeActivepiecesSession.mockReset();
    apiClient.recordActivepiecesIframeHealth.mockReset();
    apiClient.startAutomationRun.mockReset();
    sessionHook.clearToken.mockReset();
    sessionHook.requestSession.mockReset();
    sessionHook.tokenRef.current = null;
    sessionHook.state = availableState();
    apiClient.startAutomationRun.mockResolvedValue({
      runId: "run_canvas",
      status: "queued",
      traceId: "trace_canvas",
      externalRunId: "ap_run_canvas",
      dispatchMode: "simulated",
    });
  });

  it("starts a dry-run from the canvas route through the LexFrame backend", async () => {
    render(
      <ActivepiecesCanvasRoute
        projectId="project_claim_001"
        automationId="aut_canvas"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dry-run/i }));

    await waitFor(() => {
      expect(apiClient.startAutomationRun).toHaveBeenCalledWith("aut_canvas", {
        mode: "dry_run",
        idempotencyKey: expect.stringMatching(/^canvas-run:aut_canvas:/),
      });
    });
    expect(await screen.findByText(/run_canvas/)).toBeInTheDocument();
  });

  it("ignores duplicate dry-run clicks while the first run is pending", async () => {
    let resolveRun: (value: {
      readonly runId: string;
      readonly status: string;
      readonly traceId: string;
      readonly externalRunId: string;
      readonly dispatchMode: string;
    }) => void = () => undefined;
    apiClient.startAutomationRun.mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );

    render(
      <ActivepiecesCanvasRoute
        projectId="project_claim_001"
        automationId="aut_canvas"
      />,
    );

    const dryRunButton = screen.getByRole("button", { name: /dry-run/i });
    act(() => {
      dryRunButton.click();
      dryRunButton.click();
    });

    expect(apiClient.startAutomationRun).toHaveBeenCalledTimes(1);
    expect(dryRunButton).toBeDisabled();

    resolveRun({
      runId: "run_canvas",
      status: "queued",
      traceId: "trace_canvas",
      externalRunId: "ap_run_canvas",
      dispatchMode: "simulated",
    });
    expect(await screen.findByText(/run_canvas/)).toBeInTheDocument();
  });

  it("records invalid_access iframe health, clears token and retries the AP session", async () => {
    render(
      <ActivepiecesCanvasRoute
        projectId="project_claim_001"
        automationId="aut_canvas"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "simulate invalid access" }));

    await waitFor(() => {
      expect(apiClient.recordActivepiecesIframeHealth).toHaveBeenCalledWith({
        sessionId: "sess_canvas",
        event: "invalid_access",
      });
      expect(sessionHook.clearToken).toHaveBeenCalledTimes(1);
      expect(sessionHook.requestSession).toHaveBeenCalledWith("invalid_access");
    });
  });

  it("renders controlled unavailable state instead of a raw AP login/error", () => {
    sessionHook.state = {
      phase: "unavailable",
      session: null,
      response: {
        status: "unavailable",
        readinessCode: "ACTIVEPIECES_UNAVAILABLE",
        jwtToken: null,
        expiresAt: null,
        role: null,
        message: "Activepieces runtime is temporarily unavailable.",
        fallback: {
          showBuilderUnavailableState: true,
          allowLexframeCanvasReserve: true,
          allowRunsTab: true,
          allowSettingsTab: true,
          allowDiagnosticsTab: true,
        },
        diagnostics: {
          traceId: "trace_unavailable",
          safeToShow: true,
        },
      },
      message: "Activepieces runtime is temporarily unavailable.",
      code: "ACTIVEPIECES_UNAVAILABLE",
    };

    render(
      <ActivepiecesCanvasRoute
        projectId="project_claim_001"
        automationId="aut_canvas"
      />,
    );

    expect(
      screen.getByText("Activepieces runtime is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sign in|login/i)).not.toBeInTheDocument();
  });

  it("applies canonical replacement routes from readiness without losing params", async () => {
    sessionHook.state = availableState({
      openCheck: {
        canonicalReplacementRoute:
          "/app/projects/project_claim_001/automations/aut_canvas/automation",
      },
    });

    render(
      <ActivepiecesCanvasRoute
        projectId="project_claim_001"
        automationId="aut_canvas"
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/automations/aut_canvas/automation",
      );
    });
  });
});

function availableState(patch?: { readonly openCheck?: unknown }) {
  return {
    phase: "available",
    session: {
      sessionId: "sess_canvas",
      flowBinding: {
        automationId: "aut_canvas",
        activepiecesFlowId: "flow_canvas",
      },
      openCheck: patch?.openCheck ?? null,
    },
  } as unknown;
}
