"use client";

import type { SessionContext, WorkspaceSummary } from "@lexframe/contracts";
import { sessionContextFixture } from "@lexframe/contracts";
import * as React from "react";

interface SessionContextState {
  readonly session: SessionContext;
  readonly switchWorkspace: (workspace: WorkspaceSummary["id"]) => void;
}

const SessionStateContext = React.createContext<SessionContextState | null>(null);

export function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const initial = sessionContextFixture;
  const [session, setSession] = React.useState<SessionContext>(initial);

  const switchWorkspace = React.useEffectEvent((workspaceId: string) => {
    const nextWorkspace = session.workspaces.find((workspace) => workspace.id === workspaceId);
    if (!nextWorkspace) {
      return;
    }

    React.startTransition(() => {
      setSession((current) => ({
        ...current,
        activeWorkspace: nextWorkspace,
      }));
    });
  });

  return (
    <SessionStateContext.Provider
      value={{
        session,
        switchWorkspace,
      }}
    >
      {children}
    </SessionStateContext.Provider>
  );
}

export function useMockSession() {
  const context = React.useContext(SessionStateContext);

  if (!context) {
    throw new Error("useMockSession must be used inside MockSessionProvider");
  }

  return context;
}
