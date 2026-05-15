import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { SafeActivepiecesSession } from "./use-activepieces-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivepiecesCanvasWrapper } from "./activepieces-canvas-wrapper";

const theme = vi.hoisted(() => ({
  value: "light" as "light" | "dark",
}));

vi.mock("@/lib/browser-auth", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL: "http://localhost/embed.js",
  }),
}));

vi.mock("@/providers/theme-provider", () => ({
  useTheme: () => ({ theme: theme.value }),
}));

describe("ActivepiecesCanvasWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete window.activepieces;
  });

  beforeEach(() => {
    theme.value = "light";
  });

  it("configures the AP embed SDK with safe route-scoped config only", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_config")}
        tokenRef={{ current: "short_lived_embed_jwt" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(1);
    });
    const configureInput = configure.mock.calls[0]?.[0];
    expect(configureInput).toMatchObject({
      instanceUrl: "http://127.0.0.1:3100/automation-runtime",
      jwtToken: "short_lived_embed_jwt",
      prefix: "/automation-runtime",
      containerId: "activepieces-canvas-sess_config",
      locale: "ru",
      initialRoute: "/flows/flow_1",
      embedding: {
        containerId: "activepieces-canvas-sess_config",
        locale: "ru",
        styling: {
          mode: "light",
        },
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
      },
    });
    expect(JSON.stringify(configureInput)).not.toMatch(
      /ACTIVEPIECES_API_KEY|ACTIVEPIECES_SIGNING_PRIVATE_KEY|AP_JWT_SECRET|providerKey|BEGIN PRIVATE KEY/i,
    );

    const iframe = document
      .getElementById("activepieces-canvas-sess_config")
      ?.querySelector("iframe");
    expect(iframe).toHaveStyle({
      width: "100%",
      height: "100%",
      border: "0px",
      display: "block",
    });
  });

  it("treats AP login navigation as an auth failure", async () => {
    let navigationHandler: ((input: unknown) => void) | null = null;
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      navigationHandler = input.navigationHandler as (input: unknown) => void;
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const onAuthFailure = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_login_route")}
        tokenRef={{ current: "token_1" }}
        onMounted={vi.fn()}
        onAuthFailure={onAuthFailure}
      />,
    );

    await waitFor(() => {
      expect(navigationHandler).toBeTruthy();
    });
    (navigationHandler as unknown as (input: unknown) => void)({
      route: "/sign-in",
    });

    expect(onAuthFailure).toHaveBeenCalledWith("auth");
  });

  it("does not remount the iframe just because the theme provider state changes", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const stableSession = session("sess_theme");
    const tokenRef = { current: "token_1" };
    const onMounted = vi.fn();
    const onAuthFailure = vi.fn();
    const result = render(
      <ActivepiecesCanvasWrapper
        session={stableSession}
        tokenRef={tokenRef}
        onMounted={onMounted}
        onAuthFailure={onAuthFailure}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(1);
    });

    theme.value = "dark";
    result.rerender(
      <ActivepiecesCanvasWrapper
        session={stableSession}
        tokenRef={tokenRef}
        onMounted={onMounted}
        onAuthFailure={onAuthFailure}
      />,
    );

    expect(configure).toHaveBeenCalledTimes(1);
  });

  it("reports embedded Invalid Access as an auth failure instead of ready canvas", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Invalid Access You tried to access a project that you do not have access to.");
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();
    const onAuthFailure = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session()}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={onAuthFailure}
      />,
    );

    await waitFor(() => {
      expect(onAuthFailure).toHaveBeenCalledWith("invalid_access");
    });
    expect(onMounted).not.toHaveBeenCalled();
  });

  it("creates a fresh iframe on route remount instead of restoring a detached canvas", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();

    const first = render(
      <ActivepiecesCanvasWrapper
        session={session("sess_parked")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(1);
    });
    first.unmount();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_parked")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(2);
    });
    expect(configure).toHaveBeenCalledTimes(2);
    expect(
      document.body.querySelector("[data-lexframe-canvas-parked]"),
    ).not.toBeInTheDocument();
  });

  it("does not report the canvas ready when the iframe only contains css text", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(
        String(input.containerId),
        "<style>[data-sonner-toaster][dir=ltr]{--toast-icon-margin-start:-3px;}</style>",
      );
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_css")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(configure).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    expect(onMounted).not.toHaveBeenCalled();
  });

  it("accepts an attached cross-origin iframe after SDK configuration", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeCrossOriginIframe(String(input.containerId));
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_cross_origin")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(1);
    });
  });

  it("reports a stuck loading iframe after a previously ready canvas", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();
    const onAuthFailure = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_stuck")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={onAuthFailure}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(onMounted).toHaveBeenCalledTimes(1);

    const iframe = document
      .getElementById("activepieces-canvas-sess_stuck")
      ?.querySelector("iframe");
    iframe?.contentDocument?.open();
    iframe?.contentDocument?.write('<main><svg class="animate-spin"></svg></main>');
    iframe?.contentDocument?.close();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    expect(onAuthFailure).toHaveBeenCalledWith("stuck_loading");
  });

  it("keeps the legacy ready signal working for visible builder text", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };
    const onMounted = vi.fn();

    render(
      <ActivepiecesCanvasWrapper
        session={session("sess_ready")}
        tokenRef={{ current: "token_1" }}
        onMounted={onMounted}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onMounted).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps Activepieces browser session tokens on iframe unmount for route cache reuse", async () => {
    const configure = vi.fn(async (input: Record<string, unknown>) => {
      window.sessionStorage.setItem(
        "token",
        [
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
          "eyJpc3MiOiJhY3RpdmVwaWVjZXMiLCJ0eXBlIjoiQUNDRVNTIn0",
          "signature",
        ].join("."),
      );
      writeIframe(String(input.containerId), "Flow Builder");
    });
    window.activepieces = { configure };

    const result = render(
      <ActivepiecesCanvasWrapper
        session={session("sess_token_cleanup")}
        tokenRef={{ current: "runtime_token" }}
        onMounted={vi.fn()}
        onAuthFailure={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(window.sessionStorage.getItem("token")).toContain(".");
    });

    result.unmount();

    expect(window.sessionStorage.getItem("token")).toContain(".");
  });
});

function writeIframe(containerId: string, text: string) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Missing container ${containerId}`);
  }
  const iframe = document.createElement("iframe");
  container.appendChild(iframe);
  iframe.contentDocument?.open();
  iframe.contentDocument?.write(`<main>${text}</main>`);
  iframe.contentDocument?.close();
}

function writeCrossOriginIframe(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Missing container ${containerId}`);
  }
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "contentDocument", {
    configurable: true,
    get: () => null,
  });
  container.appendChild(iframe);
}

function session(sessionId = "sess_1"): SafeActivepiecesSession {
  return {
    status: "ready",
    readinessCode: "READY",
    sessionId,
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
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
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
      containerId: `activepieces-canvas-${sessionId}`,
      prefix: "/automation-runtime",
      locale: "ru",
      brandDisplayName: "Automation",
      designSystem: "activepieces_like",
      navigationSync: true,
      embedding: {
        containerId: `activepieces-canvas-${sessionId}`,
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
  };
}
