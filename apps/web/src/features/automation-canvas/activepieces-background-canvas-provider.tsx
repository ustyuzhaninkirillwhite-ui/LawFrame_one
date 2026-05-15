"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { AutomationCanvasReadinessCode } from "@lexframe/contracts";
import {
  useEnsureStage17CanvasAutomation,
  useStage15ProjectAutomations,
  useStage15Projects,
} from "@/hooks/domain/stage15";
import { useSessionBridge } from "@/providers/session-provider";
import { useStage15ShellStore } from "@/stores/stage15-shell-store";
import { clearActivepiecesBrowserSessionTokens } from "./activepieces-browser-session";
import { ActivepiecesCanvasWrapper } from "./activepieces-canvas-wrapper";
import { useActivepiecesSession } from "./use-activepieces-session";

const fallbackProjectId = "project_claim_001";
const BACKGROUND_CANVAS_TIMEOUT_MS = 20_000;

type BackgroundCanvasPhase = "idle" | "warming" | "available" | "unavailable";

type BackgroundCanvasState = {
  readonly phase: BackgroundCanvasPhase;
  readonly message: string | null;
  readonly code?: AutomationCanvasReadinessCode | null;
};

type ActivepiecesBackgroundCanvasContextValue = {
  readonly state: BackgroundCanvasState;
  readonly activeProjectId: string | null;
  readonly activeAutomationId: string | null;
  readonly route: string | null;
  readonly attach: (target: HTMLElement) => void;
  readonly detach: (target?: HTMLElement | null) => void;
  readonly retry: () => void;
  readonly clear: () => void;
};

const noop = () => {};

const defaultContext: ActivepiecesBackgroundCanvasContextValue = {
  state: { phase: "idle", message: null, code: null },
  activeProjectId: null,
  activeAutomationId: null,
  route: null,
  attach: noop,
  detach: noop,
  retry: noop,
  clear: noop,
};

const ActivepiecesBackgroundCanvasContext =
  React.createContext<ActivepiecesBackgroundCanvasContextValue>(defaultContext);

export function ActivepiecesBackgroundCanvasProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const { authPending, sessionContext } = useSessionBridge();
  const pathname = usePathname();
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;
  const shouldWarmBackground = shouldWarmActivepiecesCanvas(pathname);
  const storedActiveProjectId = useStage15ShellStore(
    (state) => state.activeProjectId,
  );
  const projectsQuery = useStage15Projects();
  const activeProjectId =
    storedActiveProjectId ?? projectsQuery.data?.items[0]?.id ?? fallbackProjectId;
  const automationsQuery = useStage15ProjectAutomations(activeProjectId, {
    enabled: shouldWarmBackground,
  });
  const refetchAutomations = automationsQuery.refetch;
  const ensureCanvas = useEnsureStage17CanvasAutomation(activeProjectId);
  const ensuredProjectsRef = React.useRef(new Set<string>());
  const warmingKey = `${workspaceId ?? "no-workspace"}:${activeProjectId ?? "no-project"}:${
    shouldWarmBackground ? "warm" : "idle"
  }`;
  const [warmingTimeout, setWarmingTimeout] = React.useState<{
    readonly key: string;
    readonly timedOut: boolean;
  }>({ key: "", timedOut: false });
  const warmingTimedOut =
    warmingTimeout.key === warmingKey && warmingTimeout.timedOut;
  const [hiddenRoot, setHiddenRoot] = React.useState<HTMLDivElement | null>(
    null,
  );
  const previousWorkspaceIdRef = React.useRef<string | null | undefined>(
    undefined,
  );
  const [attachedTarget, setAttachedTarget] =
    React.useState<HTMLElement | null>(null);
  const canvasHost = React.useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const host = document.createElement("div");
    host.dataset.testid = "activepieces-background-canvas-host";
    applyHiddenCanvasHostStyles(host);
    return host;
  }, []);

  React.useLayoutEffect(() => {
    if (!canvasHost || typeof document === "undefined") {
      return;
    }

    if (canvasHost.parentElement !== document.body) {
      document.body.appendChild(canvasHost);
    }

    return () => {
      canvasHost.remove();
    };
  }, [canvasHost]);

  React.useEffect(() => {
    if (!hiddenRoot) {
      return;
    }
    hiddenRoot.setAttribute("inert", "");
  }, [hiddenRoot]);

  const automationToOpen = React.useMemo(() => {
    const items = automationsQuery.data ?? [];
    return (
      items.find(
        (item) =>
          item.canOpenBuilder &&
          Boolean(item.runtimeProjectId) &&
          Boolean(item.runtimeFlowId),
      ) ?? null
    );
  }, [automationsQuery.data]);
  const automationId = automationToOpen?.id ?? null;
  const ensureErrorBlocksCanvas = ensureCanvas.isError && !automationToOpen;
  const session = useActivepiecesSession({
    projectId: activeProjectId,
    automationId: automationId ?? "__pending_automation__",
    enabled: Boolean(shouldWarmBackground && workspaceId && automationId),
  });
  const {
    apiClient,
    clearToken,
    requestSession,
    state: sessionState,
    tokenRef,
  } = session;

  React.useEffect(() => {
    if (
      authPending ||
      !shouldWarmBackground ||
      !workspaceId ||
      !activeProjectId ||
      !automationsQuery.isSuccess ||
      automationToOpen ||
      ensureCanvas.isPending ||
      ensureErrorBlocksCanvas ||
      ensuredProjectsRef.current.has(activeProjectId)
    ) {
      return;
    }

    ensuredProjectsRef.current.add(activeProjectId);
    ensureCanvas.mutate(undefined, {
      onError: () => {
        ensuredProjectsRef.current.delete(activeProjectId);
      },
    });
  }, [
    activeProjectId,
    authPending,
    automationToOpen,
    automationsQuery.isSuccess,
    ensureCanvas,
    ensureErrorBlocksCanvas,
    shouldWarmBackground,
    workspaceId,
  ]);

  React.useEffect(() => {
    if (
      authPending ||
      !shouldWarmBackground ||
      !workspaceId ||
      !activeProjectId ||
      automationToOpen ||
      automationsQuery.isError ||
      ensureErrorBlocksCanvas ||
      sessionState.phase === "available" ||
      sessionState.phase === "blocked" ||
      sessionState.phase === "unavailable" ||
      sessionState.phase === "error"
    ) {
      return;
    }

    const timeoutKey = warmingKey;
    const timeoutId = window.setTimeout(() => {
      setWarmingTimeout({ key: timeoutKey, timedOut: true });
    }, BACKGROUND_CANVAS_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeProjectId,
    authPending,
    automationToOpen,
    automationsQuery.isError,
    ensureErrorBlocksCanvas,
    sessionState.phase,
    shouldWarmBackground,
    warmingKey,
    workspaceId,
  ]);

  React.useLayoutEffect(() => {
    if (!canvasHost) {
      return;
    }

    if (!attachedTarget) {
      applyHiddenCanvasHostStyles(canvasHost);
      return;
    }

    let updateFrame = 0;
    const updatePosition = () => {
      applyViewportCanvasHostStyles(canvasHost, attachedTarget);
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(updateFrame);
      updateFrame = window.requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();
    const resizeFrame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(attachedTarget);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(updateFrame);
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [attachedTarget, canvasHost]);

  React.useEffect(() => {
    if (previousWorkspaceIdRef.current === workspaceId) {
      return;
    }
    previousWorkspaceIdRef.current = workspaceId;
    clearToken();
    setAttachedTarget(null);
    clearActivepiecesBrowserSessionTokens();
  }, [clearToken, workspaceId]);

  const handleMounted = React.useCallback(() => {
    const safeSession =
      sessionState.phase === "available" ? sessionState.session : null;
    if (!safeSession) {
      return;
    }

    void apiClient.initializeActivepiecesSession({
      sessionId: safeSession.sessionId,
    });
    void apiClient.recordActivepiecesIframeHealth({
      sessionId: safeSession.sessionId,
      event: "ready",
    });
    clearActivepiecesBrowserSessionTokens();
  }, [apiClient, sessionState]);

  const handleAuthFailure = React.useCallback(
    (reason: "auth" | "invalid_access" | "stuck_loading") => {
      clearToken();
      clearActivepiecesBrowserSessionTokens();
      void requestSession(
        reason === "invalid_access" ? "invalid_access" : "recover",
      );
    },
    [clearToken, requestSession],
  );

  const attach = React.useCallback((target: HTMLElement) => {
    setAttachedTarget((current) => (current === target ? current : target));
  }, []);

  const detach = React.useCallback((target?: HTMLElement | null) => {
    setAttachedTarget((current) => {
      if (!target || current === target) {
        return null;
      }
      return current;
    });
  }, []);

  const retry = React.useCallback(() => {
    setWarmingTimeout({ key: warmingKey, timedOut: false });
    ensureCanvas.reset?.();
    if (activeProjectId) {
      ensuredProjectsRef.current.delete(activeProjectId);
    }
    void refetchAutomations?.();
    void requestSession("retry");
  }, [activeProjectId, ensureCanvas, refetchAutomations, requestSession, warmingKey]);

  const clear = React.useCallback(() => {
    clearToken();
    setAttachedTarget(null);
    clearActivepiecesBrowserSessionTokens();
  }, [clearToken]);

  const route =
    activeProjectId && automationId
      ? `/app/projects/${activeProjectId}/automations/${automationId}/automation`
      : null;
  const state = React.useMemo<BackgroundCanvasState>(() => {
    if (authPending || !shouldWarmBackground || !workspaceId || !activeProjectId) {
      return { phase: "idle", message: null, code: null };
    }
    if (automationsQuery.isError) {
      return {
        phase: "unavailable",
        message: "Не удалось загрузить список автоматизаций. Повторите попытку.",
      };
    }
    if (ensureErrorBlocksCanvas) {
      return {
        phase: "unavailable",
        message: "Не удалось подготовить runtime-привязку автоматизации. Повторите попытку.",
      };
    }
    if (warmingTimedOut) {
      return {
        phase: "unavailable",
        message: "Конструктор автоматизаций не ответил вовремя. Повторите попытку.",
      };
    }
    if (!automationId || sessionState.phase === "loading") {
      return {
        phase: "warming",
        message: "Готовим конструктор автоматизаций.",
      };
    }
    if (sessionState.phase === "available") {
      return { phase: "available", message: null, code: null };
    }
    if (
      sessionState.phase === "blocked" ||
      sessionState.phase === "unavailable" ||
      sessionState.phase === "error"
    ) {
      return {
        phase: "unavailable",
        message: sessionState.message,
      };
    }
    return {
      phase: "warming",
      message: sessionState.message ?? "Готовим конструктор автоматизаций.",
    };
  }, [
    activeProjectId,
    automationsQuery.isError,
    authPending,
    automationId,
    ensureErrorBlocksCanvas,
    shouldWarmBackground,
    sessionState,
    warmingTimedOut,
    workspaceId,
  ]);

  const contextValue = React.useMemo<ActivepiecesBackgroundCanvasContextValue>(
    () => ({
      state,
      activeProjectId,
      activeAutomationId: automationId,
      route,
      attach,
      detach,
      retry,
      clear,
    }),
    [activeProjectId, attach, automationId, clear, detach, retry, route, state],
  );

  return (
    <ActivepiecesBackgroundCanvasContext.Provider value={contextValue}>
      {children}
      <div
        ref={(node) => {
          setHiddenRoot(node);
        }}
        aria-hidden="true"
        data-testid="activepieces-background-canvas-hidden-root"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <span data-testid="automation-canvas-background-state">
          {state.phase}
        </span>
      </div>
      {canvasHost && state.phase === "available" && sessionState.phase === "available"
        ? createPortal(
            <ActivepiecesCanvasWrapper
              session={sessionState.session}
              tokenRef={tokenRef}
              onMounted={handleMounted}
              onAuthFailure={handleAuthFailure}
            />,
            canvasHost,
          )
        : null}
    </ActivepiecesBackgroundCanvasContext.Provider>
  );
}

function shouldWarmActivepiecesCanvas(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    return true;
  }

  return (
    pathname === "/chat" ||
    pathname.startsWith("/chat/")
  );
}

function applyHiddenCanvasHostStyles(host: HTMLDivElement) {
  host.dataset.canvasHostLocation = "hidden";
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("inert", "");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0px",
    width: "100vw",
    height: "100vh",
    minHeight: "0",
    overflow: "hidden",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "0",
  });
}

function applyViewportCanvasHostStyles(
  host: HTMLDivElement,
  target: HTMLElement,
) {
  const rect = target.getBoundingClientRect();
  host.dataset.canvasHostLocation = "viewport";
  host.removeAttribute("aria-hidden");
  host.removeAttribute("inert");
  Object.assign(host.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${Math.max(rect.width, 0)}px`,
    height: `${Math.max(rect.height, 0)}px`,
    minHeight: "0",
    overflow: "hidden",
    opacity: "1",
    pointerEvents: "auto",
    zIndex: "10",
  });
}

export function useActivepiecesBackgroundCanvas() {
  return React.useContext(ActivepiecesBackgroundCanvasContext);
}

export function ActivepiecesBackgroundCanvasViewport({
  className,
}: {
  readonly className?: string;
}) {
  const { attach, detach } = useActivepiecesBackgroundCanvas();
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!node) {
      return;
    }

    attach(node);
    return () => {
      detach(node);
    };
  }, [attach, detach, node]);

  return (
    <div
      ref={setNode}
      className={className}
      data-canvas-host-location={node ? "viewport" : "detached"}
      data-testid="automation-canvas-ready-viewport"
    />
  );
}
