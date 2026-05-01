"use client";

import {
  ApiClientError,
  type ApiClient,
} from "@lexframe/api-client";
import type {
  ActivepiecesSessionReadyResponse,
  ActivepiecesSessionResponse,
  AutomationCanvasReadinessCode,
} from "@lexframe/contracts";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";

export type SafeActivepiecesSession = Omit<
  ActivepiecesSessionReadyResponse,
  "jwtToken"
>;

export type ActivepiecesSessionFailureResponse = Exclude<
  ActivepiecesSessionResponse,
  ActivepiecesSessionReadyResponse
>;

export type SafeActivepiecesSessionResponse =
  | SafeActivepiecesSession
  | ActivepiecesSessionFailureResponse;

export type ActivepiecesCanvasSessionState =
  | {
      readonly phase: "auth_loading" | "idle" | "loading";
      readonly session: null;
      readonly response: null;
      readonly message: string | null;
      readonly code: AutomationCanvasReadinessCode | null;
    }
  | {
      readonly phase: "available";
      readonly session: SafeActivepiecesSession;
      readonly response: SafeActivepiecesSession;
      readonly message: string | null;
      readonly code: AutomationCanvasReadinessCode;
    }
  | {
      readonly phase: "blocked" | "unavailable" | "error";
      readonly session: null;
      readonly response: ActivepiecesSessionFailureResponse | null;
      readonly message: string;
      readonly code: AutomationCanvasReadinessCode | null;
    };

export function useActivepiecesSession({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const { apiClient, authPending, sessionContext } = useSessionBridge();
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;
  const tokenRef = React.useRef<string | null>(null);
  const [state, setState] = React.useState<ActivepiecesCanvasSessionState>({
    phase: "idle",
    session: null,
    response: null,
    message: null,
    code: null,
  });

  const clearToken = React.useCallback(() => {
    tokenRef.current = null;
  }, []);

  const requestSession = React.useCallback(
    async (reason: "initial" | "refresh" | "retry" = "initial") => {
      clearToken();

      if (authPending) {
        setState({
          phase: "auth_loading",
          session: null,
          response: null,
          message: "Проверяем сессию LexFrame.",
          code: null,
        });
        return null;
      }

      if (!workspaceId) {
        const response = buildLocalFailureResponse(
          "blocked",
          "PERMISSION_DENIED",
          "Нет активного рабочего пространства.",
        );
        setState({
          phase: "blocked",
          session: null,
          response,
          message: response.message,
          code: response.readinessCode,
        });
        return response;
      }

      setState({
        phase: "loading",
        session: null,
        response: null,
        message:
          reason === "refresh"
            ? "Обновляем защищённую сессию конструктора."
            : "Готовим защищённую сессию конструктора.",
        code: null,
      });

      try {
        const response = await apiClient.createActivepiecesSession({
          workspaceId,
          projectId,
          automationId,
          purpose: "automation_canvas",
          clientRoute: `/app/projects/${projectId}/automations/${automationId}/automation`,
          modePreference: "auto",
          returnBuilderConfig: true,
          clientTraceId: createClientTraceId(),
          idempotencyKey: reason === "initial" ? createClientTraceId() : null,
        });

        if (isAvailableSession(response)) {
          tokenRef.current = response.jwtToken;
          const safeSession = redactSession(response);
          setState({
            phase: "available",
            session: safeSession,
            response: safeSession,
            message: null,
            code: response.readinessCode,
          });
          return safeSession;
        }

        setState({
          phase: response.status === "blocked" ? "blocked" : "unavailable",
          session: null,
          response,
          message: response.message,
          code: response.readinessCode,
        });
        return response;
      } catch (error) {
        const response = mapSessionError(error);
        setState({
          phase: response.status === "blocked" ? "blocked" : "unavailable",
          session: null,
          response,
          message: response.message,
          code: response.readinessCode,
        });
        return response;
      }
    },
    [apiClient, authPending, automationId, clearToken, projectId, workspaceId],
  );

  React.useEffect(() => {
    let disposed = false;

    const timeoutId = window.setTimeout(() => {
      void requestSession("initial").then(() => {
        if (disposed) {
          clearToken();
        }
      });
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      clearToken();
    };
  }, [clearToken, requestSession]);

  React.useEffect(() => {
    if (state.phase !== "available") {
      return;
    }

    const expiresAtMs = new Date(state.session.expiresAt).getTime();
    const refreshAtMs = Math.max(Date.now() + 5_000, expiresAtMs - 30_000);
    const refreshDelay = Math.max(0, refreshAtMs - Date.now());

    const refresh = () => {
      if (document.hidden) {
        return;
      }

      void requestSession("refresh");
    };
    const timeoutId = window.setTimeout(refresh, refreshDelay);
    const handleVisibilityChange = () => {
      if (!document.hidden && Date.now() >= refreshAtMs) {
        void requestSession("refresh");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestSession, state]);

  return {
    state,
    tokenRef,
    requestSession,
    clearToken,
    workspaceId,
    apiClient,
  };
}

function isAvailableSession(
  response: ActivepiecesSessionResponse,
): response is ActivepiecesSessionReadyResponse {
  return response.status === "ready" || response.status === "degraded";
}

function redactSession(
  session: ActivepiecesSessionReadyResponse,
): SafeActivepiecesSession {
  const { jwtToken, ...safeSession } = session;
  void jwtToken;
  return safeSession;
}

function mapSessionError(error: unknown): ActivepiecesSessionFailureResponse {
  if (error instanceof ApiClientError) {
    return buildLocalFailureResponse(
      isUnavailableError(error.code) ? "unavailable" : "blocked",
      mapErrorCode(error.code),
      error.message,
      error.requestId,
    );
  }

  return buildLocalFailureResponse(
    "unavailable",
    "SESSION_BRIDGE_UNAVAILABLE",
    error instanceof Error
      ? error.message
      : "Не удалось подготовить защищённую сессию конструктора.",
  );
}

function buildLocalFailureResponse(
  status: "blocked" | "unavailable",
  readinessCode: AutomationCanvasReadinessCode,
  message: string,
  traceId: string | null = null,
): ActivepiecesSessionFailureResponse {
  const response = {
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
      traceId,
      safeToShow: true,
    },
  };

  if (status === "blocked") {
    return {
      status: "blocked",
      ...response,
    };
  }

  return {
    status: "unavailable",
    ...response,
  };
}

function mapErrorCode(code: string | null): AutomationCanvasReadinessCode {
  switch (code) {
    case "FEATURE_DISABLED":
      return "FEATURE_DISABLED";
    case "WORKSPACE_ACCESS_DENIED":
    case "PROJECT_ACCESS_DENIED":
    case "AUTOMATION_ACCESS_DENIED":
    case "ROLE_NOT_ALLOWED":
      return "PERMISSION_DENIED";
    case "ACTIVEPIECES_RUNTIME_UNAVAILABLE":
    case "ACTIVEPIECES_UNAVAILABLE":
      return "ACTIVEPIECES_UNAVAILABLE";
    case "ACTIVEPIECES_BINDING_BROKEN":
    case "FLOW_BINDING_MISSING":
    case "READINESS_GATE_BLOCKED":
      return "FLOW_BINDING_MISSING";
    default:
      return "SESSION_BRIDGE_UNAVAILABLE";
  }
}

function isUnavailableError(code: string | null) {
  return (
    code === "ACTIVEPIECES_RUNTIME_UNAVAILABLE" ||
    code === "ACTIVEPIECES_UNAVAILABLE" ||
    code === "SESSION_BRIDGE_UNAVAILABLE" ||
    code === null
  );
}

function createClientTraceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ActivepiecesSessionApiClient = ApiClient;
