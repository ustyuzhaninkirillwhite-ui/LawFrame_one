"use client";

import {
  ApiClientError,
  type ApiClient,
} from "@lexframe/api-client";
import type {
  ActivepiecesCanvasReadinessResponse,
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

type SessionRequestReason =
  | "initial"
  | "background_readiness"
  | "recover"
  | "retry"
  | "invalid_access";

type CachedActivepiecesSession = {
  readonly safeSession: SafeActivepiecesSession;
  readonly jwtToken: string;
  readonly expiresAtMs: number;
  readonly readinessVersion: string | null;
};

const SESSION_REUSE_BUFFER_MS = 15_000;
const activepiecesSessionCache = new Map<string, CachedActivepiecesSession>();

export function useActivepiecesSession({
  projectId,
  automationId,
  enabled = true,
}: {
  readonly projectId: string;
  readonly automationId: string;
  readonly enabled?: boolean;
}) {
  const { apiClient, authPending, sessionContext } = useSessionBridge();
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;
  const sessionCacheKey = workspaceId
    ? createCanvasSessionCacheKey(workspaceId, projectId, automationId)
    : null;
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
    if (sessionCacheKey) {
      activepiecesSessionCache.delete(sessionCacheKey);
    }
  }, [sessionCacheKey]);

  const requestSession = React.useCallback(
    async (reason: SessionRequestReason = "initial") => {
      if (!enabled) {
        if (reason !== "background_readiness") {
          setState({
            phase: "idle",
            session: null,
            response: null,
            message: null,
            code: null,
          });
        }
        return null;
      }

      if (reason === "background_readiness") {
        if (authPending || !workspaceId) {
          return null;
        }

        try {
          return await apiClient.getActivepiecesCanvasReadiness({
            projectId,
            automationId,
          });
        } catch {
          return null;
        }
      }

      if (
        reason === "invalid_access" ||
        reason === "recover" ||
        reason === "retry"
      ) {
        tokenRef.current = null;
      }
      if (
        (reason === "invalid_access" ||
          reason === "recover" ||
          reason === "retry") &&
        sessionCacheKey
      ) {
        activepiecesSessionCache.delete(sessionCacheKey);
      }

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
          reason === "recover"
            ? "Обновляем защищённую сессию конструктора."
            : "Готовим защищённую сессию конструктора.",
        code: null,
      });

      try {
        const readiness = await apiClient.getActivepiecesCanvasReadiness({
          projectId,
          automationId,
        });

        if (readiness.status !== "ready" && readiness.status !== "repaired") {
          const failure = buildFailureFromReadiness(readiness);
          setState({
            phase: failure.status === "blocked" ? "blocked" : "unavailable",
            session: null,
            response: failure,
            message: failure.message,
            code: failure.readinessCode,
          });
          return failure;
        }

        if (reason === "initial" && sessionCacheKey) {
          const cached = readCachedSession(sessionCacheKey);
          if (
            cached &&
            cached.readinessVersion === (readiness.readinessVersion ?? null)
          ) {
            tokenRef.current = cached.jwtToken;
            setState({
              phase: "available",
              session: cached.safeSession,
              response: cached.safeSession,
              message: null,
              code: cached.safeSession.readinessCode,
            });
            return cached.safeSession;
          }
        }

        const response = await apiClient.createActivepiecesSession({
          workspaceId,
          projectId,
          automationId,
          purpose: "automation_canvas",
          clientRoute: `/app/projects/${projectId}/automations/${automationId}/automation`,
          modePreference: "auto",
          returnBuilderConfig: true,
          clientTraceId: createClientTraceId(),
          idempotencyKey: reason === "initial" ? sessionCacheKey : null,
        });

        if (isAvailableSession(response)) {
          tokenRef.current = response.jwtToken;
          const safeSession = stabilizeSessionContainer(
            redactSession(response),
            sessionCacheKey,
            response.openCheck?.readinessVersion ??
              readiness.readinessVersion ??
              null,
          );
          if (sessionCacheKey) {
            activepiecesSessionCache.set(sessionCacheKey, {
              safeSession,
              jwtToken: response.jwtToken,
              expiresAtMs: new Date(response.expiresAt).getTime(),
              readinessVersion:
                response.openCheck?.readinessVersion ??
                readiness.readinessVersion ??
                null,
            });
          }
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
    [
      apiClient,
      authPending,
      automationId,
      enabled,
      projectId,
      sessionCacheKey,
      workspaceId,
    ],
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void requestSession("initial");
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [requestSession]);

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

function stabilizeSessionContainer(
  session: SafeActivepiecesSession,
  cacheKey: string | null,
  readinessVersion: string | null,
): SafeActivepiecesSession {
  void readinessVersion;
  if (!cacheKey) {
    return session;
  }

  const containerId = stableContainerId(cacheKey);
  return {
    ...session,
    sdkConfig: {
      ...session.sdkConfig,
      containerId,
      embedding: {
        ...session.sdkConfig.embedding,
        containerId,
      },
    },
  };
}

function buildFailureFromReadiness(
  readiness: ActivepiecesCanvasReadinessResponse,
): ActivepiecesSessionFailureResponse {
  const response = {
    readinessCode: readiness.readinessCode,
    jwtToken: null,
    expiresAt: null,
    role: null,
    message:
      readiness.message ??
      "Конструктор автоматизаций временно недоступен.",
    fallback: {
      showBuilderUnavailableState: true,
      allowLexframeCanvasReserve: true,
      allowRunsTab: true,
      allowSettingsTab: true,
      allowDiagnosticsTab: true,
    },
    openCheck: readiness,
    diagnostics: {
      traceId: null,
      safeToShow: true,
    },
  };

  if (readiness.status === "unavailable") {
    return {
      status: "unavailable",
      ...response,
    };
  }

  return {
    status: "blocked",
    ...response,
  };
}

function createCanvasSessionCacheKey(
  workspaceId: string,
  projectId: string,
  automationId: string,
) {
  return `canvas:${workspaceId}:${projectId}:${automationId}`;
}

function readCachedSession(cacheKey: string) {
  const cached = activepiecesSessionCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAtMs - SESSION_REUSE_BUFFER_MS <= Date.now()) {
    activepiecesSessionCache.delete(cacheKey);
    return null;
  }

  return cached;
}

function stableContainerId(cacheKey: string) {
  return `activepieces-canvas-${cacheKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
    case "ACTIVEPIECES_VERSION_MISMATCH":
      return "ACTIVEPIECES_VERSION_MISMATCH";
    case "AP_PROJECT_MISSING":
      return "AP_PROJECT_MISSING";
    case "AP_USER_MISSING":
      return "AP_USER_MISSING";
    case "AP_PROJECT_MEMBERSHIP_MISSING":
      return "AP_PROJECT_MEMBERSHIP_MISSING";
    case "AP_FLOW_MISSING":
      return "AP_FLOW_MISSING";
    case "AP_FLOW_PROJECT_MISMATCH":
      return "AP_FLOW_PROJECT_MISMATCH";
    case "AP_MANAGED_AUTH_FAILED":
      return "AP_MANAGED_AUTH_FAILED";
    case "AP_WEBSOCKET_UNAVAILABLE":
      return "AP_WEBSOCKET_UNAVAILABLE";
    case "AP_IFRAME_NAVIGATION_FAILED":
      return "AP_IFRAME_NAVIGATION_FAILED";
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
    code === "AP_WEBSOCKET_UNAVAILABLE" ||
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
