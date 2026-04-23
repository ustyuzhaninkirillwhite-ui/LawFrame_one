"use client";

import { useCallback } from "react";
import { emitConsentAwareTelemetry } from "@/lib/consent-aware-telemetry";
import { useSessionBridge } from "@/providers/session-provider";

export function useClientTelemetry() {
  const { accessToken, sessionContext } = useSessionBridge();
  const emitTelemetry = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      const actorId = sessionContext.actor?.id;
      const workspaceId = sessionContext.activeWorkspace?.id;

      if (!actorId || !workspaceId) {
        return null;
      }

      return emitConsentAwareTelemetry(
        event,
        {
          traceId: sessionContext.requestId,
          actorId,
          workspaceId,
          accessToken,
        },
        payload,
      );
    },
    [
      accessToken,
      sessionContext.actor?.id,
      sessionContext.activeWorkspace?.id,
      sessionContext.requestId,
    ],
  );

  return emitTelemetry;
}
