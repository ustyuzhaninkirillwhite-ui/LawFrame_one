import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivepiecesCanvasRoute } from "./activepieces-canvas-route";

const replace = vi.fn();
const apiClient = {
  initializeActivepiecesSession: vi.fn(),
  recordActivepiecesIframeHealth: vi.fn(),
  startAutomationRun: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("./activepieces-canvas-wrapper", () => ({
  ActivepiecesCanvasWrapper: ({ onMounted }: { onMounted: () => void }) => {
    React.useEffect(() => {
      onMounted();
    }, [onMounted]);
    return <div>embedded automation canvas</div>;
  },
}));

vi.mock("./use-activepieces-session", () => ({
  useActivepiecesSession: () => ({
    apiClient,
    clearToken: vi.fn(),
    requestSession: vi.fn(),
    tokenRef: { current: null },
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
    },
  }),
}));

describe("ActivepiecesCanvasRoute", () => {
  beforeEach(() => {
    replace.mockReset();
    apiClient.initializeActivepiecesSession.mockReset();
    apiClient.recordActivepiecesIframeHealth.mockReset();
    apiClient.startAutomationRun.mockReset();
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

    fireEvent.click(screen.getByRole("button", { name: "Запустить dry-run" }));

    await waitFor(() => {
      expect(apiClient.startAutomationRun).toHaveBeenCalledWith("aut_canvas", {
        mode: "dry_run",
        idempotencyKey: expect.stringMatching(/^canvas-run:aut_canvas:/),
      });
    });
    expect(await screen.findByText(/run_canvas/)).toBeInTheDocument();
  });
});
