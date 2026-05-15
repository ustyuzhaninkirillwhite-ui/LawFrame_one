"use client";

import type { ApiClient } from "@lexframe/api-client";
import type { SessionContext } from "@lexframe/contracts";
import { createApiClient } from "@lexframe/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import * as React from "react";
import {
  clearStoredDevAccessToken,
  createDevAccessToken,
  getAccessTokenFromSession,
  getBrowserSupabaseClient,
  getPublicEnv,
  isDemoAuthMode,
  readStoredDevAccessToken,
  storeDevAccessToken,
} from "@/lib/browser-auth";

interface SessionBridge {
  readonly apiClient: ApiClient;
  readonly authMode: "demo" | "supabase";
  readonly authPending: boolean;
  readonly sessionContext: SessionContext;
  readonly accessToken: string | null;
  readonly reauthToken: string | null;
  readonly signIn: (input: {
    readonly email: string;
    readonly password: string;
    readonly fullName?: string;
  }) => Promise<void>;
  readonly signUp: (input: {
    readonly email: string;
    readonly password: string;
    readonly fullName?: string;
  }) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly switchWorkspace: (workspaceId: string) => Promise<void>;
  readonly refreshSessionContext: () => Promise<void>;
  readonly setReauthToken: (token: string | null) => void;
  readonly clearReauthToken: () => void;
  readonly setSessionContext: React.Dispatch<React.SetStateAction<SessionContext>>;
}

const SessionBridgeContext = React.createContext<SessionBridge | null>(null);

function buildUnauthenticatedContext(): SessionContext {
  return {
    state: "unauthenticated",
    requestId: "browser-local",
    actor: null,
    activeWorkspace: null,
    workspaces: [],
    roles: [],
    permissions: [],
    featureFlags: [],
    dataPolicy: {
      aiAllowed: false,
      directSupabaseRead: false,
      externalDeliveryRequiresApproval: true,
    },
    security: {
      mfaRequired: false,
      ssoRequired: false,
      sessionRisk: "low",
      adminActionsRequireReauth: true,
      aiSensitiveDataPolicy: "block",
      externalDeliveryRequiresApproval: true,
    },
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const env = React.useMemo(() => getPublicEnv(), []);
  const authMode = isDemoAuthMode() ? "demo" : "supabase";
  const queryClient = useQueryClient();
  const [authPending, setAuthPending] = React.useState(true);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [reauthToken, setReauthTokenState] = React.useState<string | null>(null);
  const [sessionContext, setSessionContext] = React.useState<SessionContext>(
    buildUnauthenticatedContext(),
  );
  const activeWorkspaceId = sessionContext.activeWorkspace?.id ?? null;
  const loadGenerationRef = React.useRef(0);
  const demoRecoveryAttemptsRef = React.useRef(0);

  const createScopedApiClient = React.useCallback(
    (token: string | null | undefined, workspaceId: string | null | undefined) =>
      createApiClient({
        baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
        getAccessToken: () => token ?? null,
        getWorkspaceId: () => workspaceId ?? null,
        getReauthToken: () => reauthToken,
      }),
    [env.NEXT_PUBLIC_API_BASE_URL, reauthToken],
  );

  const apiClient = React.useMemo(
    () => createScopedApiClient(accessToken, activeWorkspaceId),
    [accessToken, activeWorkspaceId, createScopedApiClient],
  );

  const resetToUnauthenticated = React.useCallback(() => {
    setAccessToken(null);
    setReauthTokenState(null);
    setSessionContext(buildUnauthenticatedContext());
    queryClient.clear();
  }, [queryClient]);

  const loadSessionContext = React.useCallback(
    async (token: string | null, workspaceId: string | null) => {
      const generation = (loadGenerationRef.current += 1);
      if (!token) {
        resetToUnauthenticated();
        setAuthPending(false);
        return;
      }

      const scopedApiClient = createScopedApiClient(token, workspaceId);
      setAuthPending(true);

      try {
        await scopedApiClient.bootstrapAuth();
        const nextContext = await scopedApiClient.getSessionContext();
        if (generation !== loadGenerationRef.current) {
          return;
        }
        setSessionContext(nextContext);
        demoRecoveryAttemptsRef.current = 0;
      } catch {
        if (generation !== loadGenerationRef.current) {
          return;
        }
        resetToUnauthenticated();
      } finally {
        if (generation === loadGenerationRef.current) {
          setAuthPending(false);
        }
      }
    },
    [createScopedApiClient, resetToUnauthenticated],
  );

  const refreshSessionContext = React.useCallback(async () => {
    await loadSessionContext(accessToken, activeWorkspaceId);
  }, [accessToken, activeWorkspaceId, loadSessionContext]);

  const hydrateFromSupabaseSession = React.useCallback(
    async (session: Session | null) => {
      const token = getAccessTokenFromSession(session);
      setAccessToken(token);

      if (!token) {
        resetToUnauthenticated();
        setAuthPending(false);
        return;
      }

      await loadSessionContext(token, null);
    },
    [loadSessionContext, resetToUnauthenticated],
  );

  React.useEffect(() => {
    let disposed = false;

    async function initialize() {
      if (authMode === "demo") {
        const storedToken = readStoredDevAccessToken();
        setAccessToken(storedToken);

        if (!storedToken) {
          if (!disposed) {
            setAuthPending(false);
          }
          return;
        }

        if (!disposed) {
          await loadSessionContext(storedToken, null);
        }

        return;
      }

      const supabase = getBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!disposed) {
        await hydrateFromSupabaseSession(session);
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void hydrateFromSupabaseSession(nextSession);
      });

      return () => {
        subscription.unsubscribe();
      };
    }

    let cleanup: (() => void) | undefined;
    void initialize().then((nextCleanup) => {
      cleanup = nextCleanup;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [authMode, hydrateFromSupabaseSession, loadSessionContext]);

  React.useEffect(() => {
    if (authMode !== "demo") {
      return;
    }

    const recoverStoredDemoSession = () => {
      const storedToken = readStoredDevAccessToken();
      if (!storedToken) {
        return;
      }
      if (!authPending && sessionContext.state !== "unauthenticated") {
        return;
      }
      if (demoRecoveryAttemptsRef.current >= 3) {
        return;
      }

      demoRecoveryAttemptsRef.current += 1;
      setAccessToken(storedToken);
      void loadSessionContext(storedToken, activeWorkspaceId);
    };

    const watchdogId = authPending
      ? window.setTimeout(recoverStoredDemoSession, 1500)
      : null;
    window.addEventListener("pageshow", recoverStoredDemoSession);
    window.addEventListener("popstate", recoverStoredDemoSession);

    return () => {
      if (watchdogId !== null) {
        window.clearTimeout(watchdogId);
      }
      window.removeEventListener("pageshow", recoverStoredDemoSession);
      window.removeEventListener("popstate", recoverStoredDemoSession);
    };
  }, [
    activeWorkspaceId,
    authMode,
    authPending,
    loadSessionContext,
    sessionContext.state,
  ]);

  const signIn = React.useCallback<SessionBridge["signIn"]>(
    async (input) => {
      if (authMode === "demo") {
        const token = await createDevAccessToken(input);
        storeDevAccessToken(token);
        setAccessToken(token);
        await loadSessionContext(token, null);
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw error;
      }
    },
    [authMode, loadSessionContext],
  );

  const signUp = React.useCallback<SessionBridge["signUp"]>(
    async (input) => {
      if (authMode === "demo") {
        const token = await createDevAccessToken(input);
        storeDevAccessToken(token);
        setAccessToken(token);
        await loadSessionContext(token, null);
        return;
      }

      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      await hydrateFromSupabaseSession(session);
    },
    [authMode, hydrateFromSupabaseSession, loadSessionContext],
  );

  const signOut = React.useCallback(async () => {
    if (authMode === "demo") {
      clearStoredDevAccessToken();
      resetToUnauthenticated();
      return;
    }

    const supabase = getBrowserSupabaseClient();
    await supabase.auth.signOut();
    resetToUnauthenticated();
  }, [authMode, resetToUnauthenticated]);

  const setReauthToken = React.useCallback((token: string | null) => {
    setReauthTokenState(token);
  }, []);

  const clearReauthToken = React.useCallback(() => {
    setReauthTokenState(null);
  }, []);

  const switchWorkspace = React.useCallback<SessionBridge["switchWorkspace"]>(
    async (workspaceId) => {
      const nextContext = await apiClient.switchWorkspace({ workspaceId });
      setSessionContext(nextContext);
      await queryClient.invalidateQueries();
    },
    [apiClient, queryClient],
  );

  const value = React.useMemo<SessionBridge>(
    () => ({
      apiClient,
      authMode,
      authPending,
      sessionContext,
      accessToken,
      reauthToken,
      signIn,
      signUp,
      signOut,
      switchWorkspace,
      refreshSessionContext,
      setReauthToken,
      clearReauthToken,
      setSessionContext,
    }),
    [
      accessToken,
      apiClient,
      authMode,
      authPending,
      clearReauthToken,
      refreshSessionContext,
      reauthToken,
      sessionContext,
      setReauthToken,
      signIn,
      signOut,
      signUp,
      switchWorkspace,
    ],
  );

  return (
    <SessionBridgeContext.Provider value={value}>
      {children}
    </SessionBridgeContext.Provider>
  );
}

export function useSessionBridge() {
  const context = React.useContext(SessionBridgeContext);

  if (!context) {
    throw new Error("useSessionBridge must be used inside SessionProvider");
  }

  return context;
}
