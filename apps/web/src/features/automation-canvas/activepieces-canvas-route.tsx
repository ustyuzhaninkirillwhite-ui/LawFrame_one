"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QueryState } from "@/components/stage3-shared";
import { Button } from "@/components/ui/button";
import {
  ActivepiecesBackgroundCanvasViewport,
  useActivepiecesBackgroundCanvas,
} from "./activepieces-background-canvas-provider";
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
  const backgroundCanvas = useActivepiecesBackgroundCanvas();
  const useBackgroundCanvas =
    backgroundCanvas.activeProjectId === projectId &&
    backgroundCanvas.activeAutomationId === automationId &&
    backgroundCanvas.state.phase !== "idle";
  const session = useActivepiecesSession({
    projectId,
    automationId,
    enabled: !useBackgroundCanvas,
  });
  const { apiClient, clearToken, requestSession, state, tokenRef } = session;
  const recoveryRetriesRef = React.useRef(0);
  const [canvasFailure, setCanvasFailure] =
    React.useState<ReturnType<typeof buildCanvasFailure> | null>(null);
  const [runState, setRunState] = React.useState<{
    readonly status: "idle" | "running" | "success" | "error";
    readonly message: string | null;
  }>({ status: "idle", message: null });
  const runPendingRef = React.useRef(false);
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

  const handleStartDryRun = React.useCallback(() => {
    if (runPendingRef.current) {
      return;
    }

    runPendingRef.current = true;
    setRunState({ status: "running", message: "Запускаем dry-run..." });
    void apiClient
      .startAutomationRun(automationId, {
        mode: "dry_run",
        idempotencyKey: `canvas-run:${automationId}:${Date.now()}`,
      })
      .then((response) => {
        setRunState({
          status: "success",
          message: `Запуск создан: ${response.runId} (${response.status})`,
        });
      })
      .catch((error) => {
        setRunState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось запустить automation dry-run.",
        });
      })
      .finally(() => {
        runPendingRef.current = false;
      });
  }, [apiClient, automationId]);

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
      <div className="absolute right-5 top-5 z-20 flex max-w-[min(520px,calc(100%-2.5rem))] flex-wrap items-center justify-end gap-2 rounded-[18px] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-card)]/90 p-2 text-sm shadow-[var(--lf-shadow-card)] backdrop-blur">
        {runState.message ? (
          <span
            className={
              runState.status === "error"
                ? "text-[color:var(--lf-danger)]"
                : "text-[color:var(--lf-text-secondary)]"
            }
          >
            {runState.message}
          </span>
        ) : null}
        <Button
          type="button"
          disabled={runState.status === "running"}
          onClick={handleStartDryRun}
        >
          {runState.status === "running" ? "Запускаем..." : "Запустить dry-run"}
        </Button>
      </div>
      {useBackgroundCanvas ? (
        <BackgroundCanvasPane canvas={backgroundCanvas} />
      ) : (
        <CanvasPane
          sessionState={state}
          canvasFailure={canvasFailure}
          tokenRef={tokenRef}
          onRetry={handleRetry}
          onAuthFailure={handleAuthFailure}
          onMounted={handleMounted}
        />
      )}
      <div className="sr-only">
        Проект {projectId}, автоматизация {automationId}
      </div>
    </section>
  );
}

function BackgroundCanvasPane({
  canvas,
}: {
  readonly canvas: ReturnType<typeof useActivepiecesBackgroundCanvas>;
}) {
  if (canvas.state.phase === "available") {
    return (
      <ActivepiecesBackgroundCanvasViewport className="h-full min-h-0 w-full" />
    );
  }

  if (canvas.state.phase === "unavailable") {
    const failure = buildCanvasFailure(
      "FLOW_BINDING_MISSING",
      canvas.state.message ??
        "Конструктор автоматизаций временно недоступен. Повторите попытку.",
    );
    return (
      <div className="flex h-full items-center justify-center p-6">
        <BuilderUnavailableState
          response={failure}
          message={failure.message}
          onRetry={canvas.retry}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <QueryState
        title="Открываем конструктор автоматизаций"
        description={
          canvas.state.message ??
          "Готовим защищённую сессию конструктора автоматизаций."
        }
      />
    </div>
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
  message = "Конструктор автоматизаций временно недоступен. LexFrame подготовил безопасный путь повтора.",
) {
  return {
    status: "unavailable" as const,
    readinessCode,
    jwtToken: null,
    expiresAt: null,
    role: null,
    message,
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
