"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QueryState } from "@/components/stage3-shared";
import { ActivepiecesCanvasWrapper } from "./activepieces-canvas-wrapper";
import { BuilderUnavailableState } from "./builder-unavailable-state";
import { useActivepiecesSession } from "./use-activepieces-session";

type CanvasRecoveryReason = "auth" | "invalid_access" | "stuck_loading";

export function ActivepiecesCanvasRoute({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const router = useRouter();
  const session = useActivepiecesSession({
    projectId,
    automationId,
    enabled: true,
  });
  const { apiClient, clearToken, requestSession, state, tokenRef } = session;
  const recoveryRetriesRef = React.useRef(0);
  const [canvasFailure, setCanvasFailure] =
    React.useState<ReturnType<typeof buildCanvasFailure> | null>(null);
  const safeSession =
    state.phase === "available" ? state.session : null;
  const canonicalReplacementRoute =
    state.phase === "available"
      ? state.session.openCheck?.canonicalReplacementRoute
      : state.response?.openCheck?.canonicalReplacementRoute;

  const handleAuthFailure = React.useCallback((reason: CanvasRecoveryReason) => {
    if (safeSession && reason !== "auth") {
      void apiClient.recordActivepiecesIframeHealth({
        sessionId: safeSession.sessionId,
        event: reason,
      });
    }
    clearToken();
    if (recoveryRetriesRef.current >= 1) {
      setCanvasFailure(buildCanvasFailure("AP_IFRAME_NAVIGATION_FAILED"));
      return;
    }

    recoveryRetriesRef.current += 1;
    void requestSession(reason === "invalid_access" ? "invalid_access" : "recover");
  }, [apiClient, clearToken, requestSession, safeSession]);

  const handleMounted = React.useCallback(() => {
    if (!safeSession) {
      return;
    }

    const healthEvent =
      recoveryRetriesRef.current > 0 ? "recovered" : "ready";
    recoveryRetriesRef.current = 0;
    setCanvasFailure(null);
    void apiClient
      .initializeActivepiecesSession({
        sessionId: safeSession.sessionId,
      });
    void apiClient.recordActivepiecesIframeHealth({
      sessionId: safeSession.sessionId,
      event: healthEvent,
    });
  }, [apiClient, safeSession]);

  const handleRetry = React.useCallback(() => {
    recoveryRetriesRef.current = 0;
    setCanvasFailure(null);
    void requestSession("retry");
  }, [requestSession]);

  React.useEffect(() => {
    if (canonicalReplacementRoute) {
      router.replace(canonicalReplacementRoute);
    }
  }, [canonicalReplacementRoute, router]);

  return (
    <section
      aria-label="Конструктор автоматизаций"
      className="h-screen min-h-0 overflow-hidden bg-[color:var(--lf-bg-app)]"
    >
      <CanvasPane
        sessionState={state}
        canvasFailure={canvasFailure}
        tokenRef={tokenRef}
        onRetry={handleRetry}
        onAuthFailure={handleAuthFailure}
        onMounted={handleMounted}
      />
      <div className="sr-only">
        Проект {projectId}, автоматизация {automationId}
      </div>
    </section>
  );
}

function CanvasPane({
  sessionState,
  canvasFailure,
  tokenRef,
  onRetry,
  onAuthFailure,
  onMounted,
}: {
  readonly sessionState: ReturnType<typeof useActivepiecesSession>["state"];
  readonly canvasFailure: ReturnType<typeof buildCanvasFailure> | null;
  readonly tokenRef: React.MutableRefObject<string | null>;
  readonly onRetry: () => void;
  readonly onAuthFailure: (reason: CanvasRecoveryReason) => void;
  readonly onMounted: () => void;
}) {
  if (canvasFailure) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <BuilderUnavailableState
          response={canvasFailure}
          message={canvasFailure.message}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (
    sessionState.phase === "auth_loading" ||
    sessionState.phase === "idle" ||
    sessionState.phase === "loading"
  ) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <QueryState
          title="Открываем конструктор автоматизаций"
          description={
            sessionState.message ??
            "Готовим защищённую сессию конструктора автоматизаций."
          }
        />
      </div>
    );
  }

  if (sessionState.phase !== "available") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <BuilderUnavailableState
          response={sessionState.response}
          message={sessionState.message}
          onRetry={onRetry}
        />
      </div>
    );
  }

  return (
    <ActivepiecesCanvasWrapper
      key={`${sessionState.session.flowBinding.automationId ?? "automation"}:${
        sessionState.session.flowBinding.activepiecesFlowId ?? "flow"
      }`}
      session={sessionState.session}
      tokenRef={tokenRef}
      onMounted={onMounted}
      onAuthFailure={onAuthFailure}
    />
  );
}

function buildCanvasFailure(
  readinessCode: "FLOW_BINDING_MISSING" | "AP_IFRAME_NAVIGATION_FAILED",
) {
  return {
    status: "unavailable" as const,
    readinessCode,
    jwtToken: null,
    expiresAt: null,
    role: null,
    message:
      "Automation Canvas could not confirm access to the ActivePieces project. LexFrame stopped the raw embed error and prepared a controlled retry path.",
    fallback: {
      showBuilderUnavailableState: true,
      allowLexframeCanvasReserve: false,
      allowRunsTab: true,
      allowSettingsTab: true,
      allowDiagnosticsTab: true,
    },
    diagnostics: {
      traceId: null,
      safeToShow: true,
    },
  };
}
