"use client";

import * as React from "react";
import { QueryState } from "@/components/stage3-shared";
import { ActivepiecesCanvasWrapper } from "./activepieces-canvas-wrapper";
import { BuilderUnavailableState } from "./builder-unavailable-state";
import { useActivepiecesSession } from "./use-activepieces-session";

export function ActivepiecesCanvasRoute({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const session = useActivepiecesSession({ projectId, automationId });
  const safeSession =
    session.state.phase === "available" ? session.state.session : null;

  const handleAuthFailure = React.useCallback(() => {
    session.clearToken();
    void session.requestSession("refresh");
  }, [session]);

  const handleMounted = React.useCallback(() => {
    if (!safeSession) {
      return;
    }

    void session.apiClient
      .initializeActivepiecesSession({
        sessionId: safeSession.sessionId,
      })
      .then(() => {
        session.clearToken();
      });
  }, [safeSession, session]);

  return (
    <section
      aria-label="Конструктор автоматизаций"
      className="h-screen min-h-0 overflow-hidden bg-[color:var(--lf-bg-app)]"
    >
      <CanvasPane
        sessionState={session.state}
        tokenRef={session.tokenRef}
        onRetry={() => void session.requestSession("retry")}
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
  tokenRef,
  onRetry,
  onAuthFailure,
  onMounted,
}: {
  readonly sessionState: ReturnType<typeof useActivepiecesSession>["state"];
  readonly tokenRef: React.MutableRefObject<string | null>;
  readonly onRetry: () => void;
  readonly onAuthFailure: () => void;
  readonly onMounted: () => void;
}) {
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
      key={sessionState.session.sessionId}
      session={sessionState.session}
      tokenRef={tokenRef}
      onMounted={onMounted}
      onAuthFailure={onAuthFailure}
    />
  );
}
