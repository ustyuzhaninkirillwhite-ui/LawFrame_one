"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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

type BackgroundCanvasPhase = "idle" | "warming" | "available" | "unavailable";

type BackgroundCanvasState = {
  readonly phase: BackgroundCanvasPhase;
  readonly message: string | null;
};

type ActivepiecesBackgroundCanvasContextValue = {
  readonly state: BackgroundCanvasState;
  readonly activeProjectId: string | null;
  readonly activeAutomationId: string | null;
  readonly route: string | null;
  readonly attach: (target: HTMLElement) => void;
  readonly detach: () => void;
  readonly retry: () => void;
  readonly clear: () => void;
};

const noop = () => {};

const defaultContext: ActivepiecesBackgroundCanvasContextValue = {
  state: { phase: "idle", message: null },
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
  const ensureCanvas = useEnsureStage17CanvasAutomation(activeProjectId);
  const ensuredProjectsRef = React.useRef(new Set<string>());
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
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.minHeight = "0";
    return host;
  }, []);

  React.useEffect(() => {
    return () => {
      canvasHost?.remove();
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

  React.useEffect(() => {
    if (
      authPending ||
      !shouldWarmBackground ||
      !workspaceId ||
      !activeProjectId ||
      !automationsQuery.isSuccess ||
      automationToOpen ||
      ensureCanvas.isPending ||
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
    shouldWarmBackground,
    workspaceId,
  ]);

  const automationId = automationToOpen?.id ?? null;
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
    if (!canvasHost) {
      return;
    }

    const target = attachedTarget ?? hiddenRoot;
    if (!target || canvasHost.parentElement === target) {
      return;
    }

    target.appendChild(canvasHost);
  }, [attachedTarget, canvasHost, hiddenRoot]);

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
    setAttachedTarget(target);
  }, []);

  const detach = React.useCallback(() => {
    setAttachedTarget(null);
  }, []);

  const retry = React.useCallback(() => {
    void requestSession("retry");
  }, [requestSession]);

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
      return { phase: "idle", message: null };
    }
    if (!automationId || sessionState.phase === "loading") {
      return {
        phase: "warming",
        message: "Готовим конструктор автоматизаций.",
      };
    }
    if (sessionState.phase === "available") {
      return { phase: "available", message: null };
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
    authPending,
    automationId,
    shouldWarmBackground,
    sessionState,
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
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
      {canvasHost && sessionState.phase === "available"
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

  if (
    pathname === "/app/projects" ||
    pathname.match(/^\/app\/projects\/[^/]+\/automations(?:\/.*)?$/)
  ) {
    return true;
  }

  return (
    pathname === "/chat" ||
    pathname.startsWith("/chat/")
  );
}

export function useActivepiecesBackgroundCanvas() {
  return React.useContext(ActivepiecesBackgroundCanvasContext);
}

export function ActivepiecesBackgroundCanvasViewport({
  className,
}: {
  readonly className?: string;
}) {
  const canvas = useActivepiecesBackgroundCanvas();
  const ref = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        canvas.attach(node);
        return;
      }
      canvas.detach();
    },
    [canvas],
  );

  React.useEffect(() => () => canvas.detach(), [canvas]);

  return (
    <div
      ref={ref}
      className={className}
      data-testid="activepieces-background-canvas-viewport"
    />
  );
}
