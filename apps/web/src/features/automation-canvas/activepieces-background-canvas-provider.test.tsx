import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActivepiecesBackgroundCanvasProvider,
  useActivepiecesBackgroundCanvas,
} from "./activepieces-background-canvas-provider";

const mocks = vi.hoisted(() => ({
  wrapperMounts: 0,
  wrapperUnmounts: 0,
  pathname: "/app/projects/project_claim_001",
  automationsCalls: [] as unknown[],
  state: {
    phase: "available",
    session: {
      flowBinding: {
        automationId: "automation_1",
        activepiecesFlowId: "flow_1",
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    authPending: false,
    sessionContext: {
      activeWorkspace: { id: "workspace_1" },
      permissions: ["automation.view"],
    },
  }),
}));

vi.mock("@/stores/stage15-shell-store", () => ({
  useStage15ShellStore: (selector: (state: { activeProjectId: string }) => unknown) =>
    selector({ activeProjectId: "project_claim_001" }),
}));

vi.mock("@/hooks/domain/stage15", () => ({
  useStage15Projects: () => ({
    data: { items: [{ id: "project_claim_001", name: "Проект" }] },
  }),
  useStage15ProjectAutomations: (...args: unknown[]) => {
    mocks.automationsCalls.push(args);
    return {
      data: [
        {
          id: "automation_1",
          canOpenBuilder: true,
          runtimeProjectId: "ap_project_1",
          runtimeFlowId: "flow_1",
        },
      ],
      isSuccess: true,
      refetch: vi.fn(),
    };
  },
  useEnsureStage17CanvasAutomation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./use-activepieces-session", () => ({
  useActivepiecesSession: () => ({
    state: mocks.state,
    tokenRef: { current: "short_lived_jwt" },
    requestSession: vi.fn(),
    clearToken: vi.fn(),
    apiClient: {
      initializeActivepiecesSession: vi.fn(),
      recordActivepiecesIframeHealth: vi.fn(),
    },
  }),
}));

vi.mock("./activepieces-canvas-wrapper", () => ({
  ActivepiecesCanvasWrapper: () => {
    React.useEffect(() => {
      mocks.wrapperMounts += 1;
      return () => {
        mocks.wrapperUnmounts += 1;
      };
    }, []);
    return <div data-testid="mock-activepieces-wrapper">Canvas</div>;
  },
}));

describe("ActivepiecesBackgroundCanvasProvider", () => {
  beforeEach(() => {
    mocks.wrapperMounts = 0;
    mocks.wrapperUnmounts = 0;
    mocks.pathname = "/app/projects/project_claim_001";
    mocks.automationsCalls = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the hidden canvas mounted while attaching it to and detaching it from a route viewport", async () => {
    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await screen.findByTestId("mock-activepieces-wrapper");
    expect(mocks.wrapperMounts).toBe(1);

    await act(async () => {
      screen.getByRole("button", { name: "show" }).click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("route-viewport")).toContainElement(
        screen.getByTestId("mock-activepieces-wrapper"),
      );
    });

    await act(async () => {
      screen.getByRole("button", { name: "hide" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "show" }).click();
    });

    expect(mocks.wrapperMounts).toBe(1);
    expect(mocks.wrapperUnmounts).toBe(0);
    await waitFor(() => {
      expect(screen.getByTestId("route-viewport")).toContainElement(
        screen.getByTestId("mock-activepieces-wrapper"),
      );
    });
  });

  it("does not warm the automation list on transitional dashboard routes", () => {
    mocks.pathname = "/dashboard";

    render(
      <ActivepiecesBackgroundCanvasProvider>
        <div />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    expect(mocks.automationsCalls).toContainEqual([
      "project_claim_001",
      { enabled: false },
    ]);
  });
});

function Harness() {
  const canvas = useActivepiecesBackgroundCanvas();
  const [visible, setVisible] = React.useState(false);

  return (
    <div>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? "hide" : "show"}
      </button>
      {visible ? (
        <div
          data-testid="route-viewport"
          ref={(node) => {
            if (node) {
              canvas.attach(node);
            }
          }}
        />
      ) : null}
    </div>
  );
}
