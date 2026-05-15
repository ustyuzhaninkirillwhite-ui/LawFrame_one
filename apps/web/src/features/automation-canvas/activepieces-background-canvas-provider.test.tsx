import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActivepiecesBackgroundCanvasViewport,
  ActivepiecesBackgroundCanvasProvider,
  useActivepiecesBackgroundCanvas,
} from "./activepieces-background-canvas-provider";

const mocks = vi.hoisted(() => ({
  wrapperMounts: 0,
  wrapperUnmounts: 0,
  pathname: "/app/projects/project_claim_001",
  automationsCalls: [] as unknown[],
  automationsState: {
    data: [
      {
        id: "automation_1",
        canOpenBuilder: true,
        runtimeProjectId: "ap_project_1",
        runtimeFlowId: "flow_1",
      },
    ] as
      | Array<{
          id: string;
          canOpenBuilder: boolean;
          runtimeProjectId: string;
          runtimeFlowId: string;
        }>
      | undefined,
    isSuccess: true,
    isError: false,
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  ensureState: {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
  },
  requestSession: vi.fn(),
  clearToken: vi.fn(),
  state: {
    phase: "available",
    session: {
      flowBinding: {
        automationId: "automation_1",
        activepiecesFlowId: "flow_1",
      },
    },
  } as Record<string, unknown>,
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
    return mocks.automationsState;
  },
  useEnsureStage17CanvasAutomation: () => mocks.ensureState,
}));

vi.mock("./use-activepieces-session", () => ({
  useActivepiecesSession: () => ({
    state: mocks.state,
    tokenRef: { current: "short_lived_jwt" },
    requestSession: mocks.requestSession,
    clearToken: mocks.clearToken,
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
    mocks.automationsState = {
      data: [
        {
          id: "automation_1",
          canOpenBuilder: true,
          runtimeProjectId: "ap_project_1",
          runtimeFlowId: "flow_1",
        },
      ],
      isSuccess: true,
      isError: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.ensureState = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
    };
    mocks.requestSession = vi.fn();
    mocks.clearToken = vi.fn();
    mocks.state = {
      phase: "available",
      session: {
        flowBinding: {
          automationId: "automation_1",
          activepiecesFlowId: "flow_1",
        },
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the warmed iframe host in a stable DOM position when attaching a route viewport", async () => {
    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await screen.findByTestId("mock-activepieces-wrapper");
    const host = screen.getByTestId("activepieces-background-canvas-host");
    const initialHostParent = host.parentElement;

    await act(async () => {
      screen.getByRole("button", { name: "show" }).click();
    });

    await waitFor(() => {
      expect(host).toHaveAttribute("data-canvas-host-location", "viewport");
    });
    expect(host.parentElement).toBe(initialHostParent);
    expect(screen.getByTestId("route-viewport")).not.toContainElement(host);
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
      expect(screen.getByTestId("activepieces-background-canvas-host")).toHaveAttribute(
        "data-canvas-host-location",
        "viewport",
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
      expect(screen.getByTestId("activepieces-background-canvas-host")).toHaveAttribute(
        "data-canvas-host-location",
        "viewport",
      );
    });
  });

  it("keeps the real route viewport attached after background state rerenders", async () => {
    render(
      <React.StrictMode>
        <ActivepiecesBackgroundCanvasProvider>
          <ViewportHarness />
        </ActivepiecesBackgroundCanvasProvider>
      </React.StrictMode>,
    );

    await screen.findByTestId("mock-activepieces-wrapper");

    await act(async () => {
      screen.getByRole("button", { name: "show viewport" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("activepieces-background-canvas-host")).toHaveAttribute(
        "data-canvas-host-location",
        "viewport",
      );
    });

    await act(async () => {
      screen.getByRole("button", { name: "retry" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("activepieces-background-canvas-host")).toHaveAttribute(
        "data-canvas-host-location",
        "viewport",
      );
    });
    expect(screen.getByTestId("activepieces-background-canvas-hidden-root")).not.toContainElement(
      screen.getByTestId("mock-activepieces-wrapper"),
    );
  });

  it("does not let stale route viewport cleanup detach a newer viewport", async () => {
    render(
      <ActivepiecesBackgroundCanvasProvider>
        <ReplacingViewportHarness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await screen.findByTestId("mock-activepieces-wrapper");

    await act(async () => {
      screen.getByRole("button", { name: "replace viewport" }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("activepieces-background-canvas-host")).toHaveAttribute(
        "data-canvas-host-location",
        "viewport",
      );
    });
    expect(screen.getByTestId("activepieces-background-canvas-hidden-root")).not.toContainElement(
      screen.getByTestId("mock-activepieces-wrapper"),
    );
  });

  it("keeps the hidden background host viewport-sized so AP can render before route attach", async () => {
    render(
      <ActivepiecesBackgroundCanvasProvider>
        <div />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await screen.findByTestId("mock-activepieces-wrapper");
    const host = screen.getByTestId("activepieces-background-canvas-host");

    expect(host).toHaveStyle({
      width: "100vw",
      height: "100vh",
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

  it("reports unavailable instead of warming forever when the automation list fails", async () => {
    mocks.pathname = "/app/projects/project_claim_001/automations";
    mocks.automationsState = {
      data: undefined,
      isSuccess: false,
      isError: true,
      isLoading: false,
      error: new Error("relation app.projects does not exist"),
      refetch: vi.fn(),
    };

    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("background-phase")).toHaveTextContent(
        "unavailable",
      );
    });
  });

  it("uses a ready automation instead of keeping a stale ensure error unavailable", async () => {
    mocks.pathname = "/app/projects/project_claim_001/automations";
    mocks.ensureState = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: true,
    };

    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("background-phase")).toHaveTextContent(
        "available",
      );
    });
    expect(await screen.findByTestId("mock-activepieces-wrapper")).toBeTruthy();
  });

  it("resets the stale ensure mutation and retries the session recovery cycle", async () => {
    mocks.pathname = "/app/projects/project_claim_001/automations";
    mocks.ensureState = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: true,
    };
    mocks.state = {
      phase: "error",
      session: null,
      response: null,
      message: "temporary failure",
      code: "SESSION_BRIDGE_UNAVAILABLE",
    };

    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await act(async () => {
      screen.getByRole("button", { name: "retry" }).click();
    });

    expect(mocks.ensureState.reset).toHaveBeenCalledTimes(1);
    expect(mocks.automationsState.refetch).toHaveBeenCalledTimes(1);
    expect(mocks.requestSession).toHaveBeenCalledWith("retry");
  });

  it("does not repeatedly auto-ensure after a failed ensure until the user retries", async () => {
    mocks.pathname = "/app/projects/project_claim_001/automations";
    mocks.automationsState = {
      data: [],
      isSuccess: true,
      isError: false,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.ensureState = {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: true,
    };

    render(
      <ActivepiecesBackgroundCanvasProvider>
        <Harness />
      </ActivepiecesBackgroundCanvasProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("background-phase")).toHaveTextContent(
        "unavailable",
      );
    });
    expect(mocks.ensureState.mutate).not.toHaveBeenCalled();
  });
});

function Harness() {
  const canvas = useActivepiecesBackgroundCanvas();
  const [visible, setVisible] = React.useState(false);

  return (
    <div>
      <span data-testid="background-phase">{canvas.state.phase}</span>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        {visible ? "hide" : "show"}
      </button>
      <button type="button" onClick={canvas.retry}>
        retry
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

function ViewportHarness() {
  const canvas = useActivepiecesBackgroundCanvas();
  const [visible, setVisible] = React.useState(false);

  return (
    <div>
      <button type="button" onClick={() => setVisible(true)}>
        show viewport
      </button>
      <button type="button" onClick={canvas.retry}>
        retry
      </button>
      {visible ? (
        <div data-testid="route-viewport">
          <ActivepiecesBackgroundCanvasViewport />
        </div>
      ) : null}
    </div>
  );
}

function ReplacingViewportHarness() {
  const [version, setVersion] = React.useState(1);

  return (
    <div>
      <button type="button" onClick={() => setVersion(2)}>
        replace viewport
      </button>
      {version === 1 ? (
        <div data-testid="route-viewport-1">
          <ActivepiecesBackgroundCanvasViewport />
        </div>
      ) : (
        <div data-testid="route-viewport-2">
          <ActivepiecesBackgroundCanvasViewport />
        </div>
      )}
    </div>
  );
}
