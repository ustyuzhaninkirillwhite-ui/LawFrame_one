"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { getBrowserSupabaseClient } from "@/lib/browser-auth";
import { useSessionBridge } from "./session-provider";

const WORKSPACE_EVENTS = [
  "run.created",
  "run.status.updated",
  "run.step.updated",
  "run.completed",
  "run.failed",
  "artifact.created",
  "approval.created",
  "approval.updated",
  "delivery.status.updated",
  "recommendation.created",
  "notification.created",
  "notification.updated",
  "system.status.updated",
] as const;

const USER_EVENTS = ["notification.created", "notification.updated"] as const;

export function RealtimeProvider({ children }: { readonly children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { accessToken, authMode, sessionContext } = useSessionBridge();
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;
  const actorId = sessionContext.actor?.id ?? null;
  const canViewDashboard = sessionContext.permissions.includes("dashboard.view");

  const invalidateDashboardSurface = React.useCallback(() => {
    React.startTransition(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["runs", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["system-status", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["stage7-approval-tasks", workspaceId] }),
      ]);
    });
  }, [queryClient, workspaceId]);

  React.useEffect(() => {
    if (authMode === "demo" || !accessToken) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    void supabase.realtime.setAuth(accessToken);
  }, [accessToken, authMode]);

  React.useEffect(() => {
    if (
      authMode === "demo" ||
      !accessToken ||
      !workspaceId ||
      !actorId ||
      !canViewDashboard
    ) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    void supabase.realtime.setAuth(accessToken);

    const channels = [
      subscribeToTopic(
        supabase.channel(`workspace:${workspaceId}:dashboard`, {
          config: { private: true },
        }),
        WORKSPACE_EVENTS,
        invalidateDashboardSurface,
      ),
      subscribeToTopic(
        supabase.channel(`user:${actorId}:notifications`, {
          config: { private: true },
        }),
        USER_EVENTS,
        invalidateDashboardSurface,
      ),
    ];

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [
    accessToken,
    actorId,
    authMode,
    canViewDashboard,
    invalidateDashboardSurface,
    workspaceId,
  ]);

  React.useEffect(() => {
    if (!workspaceId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      invalidateDashboardSurface();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [invalidateDashboardSurface, workspaceId]);

  return <>{children}</>;
}

export function useRunRealtimeSubscription(runId?: string | null) {
  const queryClient = useQueryClient();
  const { accessToken, authMode, sessionContext } = useSessionBridge();
  const workspaceId = sessionContext.activeWorkspace?.id ?? null;
  const canViewDashboard = sessionContext.permissions.includes("dashboard.view");

  React.useEffect(() => {
    if (
      authMode === "demo" ||
      !accessToken ||
      !workspaceId ||
      !runId ||
      !canViewDashboard
    ) {
      return;
    }

    const supabase = getBrowserSupabaseClient();
    void supabase.realtime.setAuth(accessToken);

    const channel = subscribeToTopic(
      supabase.channel(`run:${runId}`, { config: { private: true } }),
      WORKSPACE_EVENTS,
      () => {
        React.startTransition(() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["run", workspaceId, runId] }),
            queryClient.invalidateQueries({ queryKey: ["run-artifacts", workspaceId, runId] }),
            queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] }),
          ]);
        });
      },
    );

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accessToken, authMode, canViewDashboard, queryClient, runId, workspaceId]);
}

function subscribeToTopic(
  channel: RealtimeChannel,
  events: readonly string[],
  onEvent: () => void,
) {
  for (const eventName of events) {
    channel.on("broadcast", { event: eventName }, () => {
      onEvent();
    });
  }

  void channel.subscribe();
  return channel;
}
