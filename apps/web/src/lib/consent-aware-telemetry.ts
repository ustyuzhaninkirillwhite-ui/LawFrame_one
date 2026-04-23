"use client";

import type { EventDefinition, ProductEventCaptureRequest } from "@lexframe/contracts";
import {
  eventCatalogByName,
  eventPayloadDenylist,
} from "@lexframe/contracts";
import { getPublicEnv } from "@/lib/browser-auth";

export const ANALYTICS_CONSENT_STORAGE_KEY = "lexframe.analytics-consent";
const ANALYTICS_SESSION_STORAGE_KEY = "lexframe.analytics-session";

export interface ClientTelemetryContext {
  readonly traceId: string;
  readonly actorId: string;
  readonly workspaceId: string;
  readonly accessToken?: string | null;
}

function findEventDefinition(event: string) {
  return eventCatalogByName[event];
}

function sanitizePayload(
  definition: EventDefinition,
  payload: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (value === undefined) {
        return false;
      }

      if (definition.denylistFields.includes(key)) {
        return false;
      }

      if (eventPayloadDenylist.includes(key as (typeof eventPayloadDenylist)[number])) {
        return false;
      }

      return true;
    }),
  );
}

function getClientSessionId() {
  if (typeof window === "undefined") {
    return "server-render";
  }

  const existing = window.localStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.localStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, next);
  return next;
}

async function postCaptureEvent(
  envelope: ProductEventCaptureRequest,
  accessToken?: string | null,
) {
  try {
    const env = getPublicEnv();
    await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/events/capture`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-workspace-id": envelope.workspaceId,
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(envelope),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[lexframe:telemetry:capture-failed]", error);
    }
  }
}

export function hasAnalyticsConsent() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "granted";
}

export function emitConsentAwareTelemetry(
  event: string,
  context: ClientTelemetryContext,
  payload: Record<string, unknown>,
) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) {
    return null;
  }

  const definition = findEventDefinition(event);

  if (!definition || !definition.allowedSources.includes("frontend")) {
    return null;
  }

  const sanitizedPayload = sanitizePayload(definition, payload);
  const properties = { ...sanitizedPayload };
  const resourceType =
    typeof properties.resourceType === "string" ? properties.resourceType : null;
  const resourceId =
    typeof properties.resourceId === "string" ? properties.resourceId : null;
  const processInstanceId =
    typeof properties.processInstanceId === "string"
      ? properties.processInstanceId
      : null;
  const runId = typeof properties.runId === "string" ? properties.runId : null;

  delete properties.resourceType;
  delete properties.resourceId;
  delete properties.processInstanceId;
  delete properties.runId;

  const envelope = createTelemetryEnvelope(definition, {
    traceId: context.traceId,
    workspaceId: context.workspaceId,
    resourceType,
    resourceId,
    processInstanceId,
    runId,
    properties,
  });

  window.dispatchEvent(
    new CustomEvent("lexframe.telemetry", {
      detail: envelope,
    }),
  );

  void postCaptureEvent(envelope, context.accessToken);

  if (process.env.NODE_ENV !== "production") {
    console.info("[lexframe:telemetry]", envelope);
  }

  return envelope;
}

function createTelemetryEnvelope(
  definition: EventDefinition,
  envelope: {
    readonly traceId: string;
    readonly workspaceId: string;
    readonly resourceType: string | null;
    readonly resourceId: string | null;
    readonly processInstanceId: string | null;
    readonly runId: string | null;
    readonly properties: Record<string, unknown>;
  },
): ProductEventCaptureRequest {
  return {
    eventName: definition.event,
    eventTime: new Date().toISOString(),
    sessionId: getClientSessionId(),
    traceId: envelope.traceId,
    workspaceId: envelope.workspaceId,
    resourceType: envelope.resourceType,
    resourceId: envelope.resourceId,
    processInstanceId: envelope.processInstanceId,
    runId: envelope.runId,
    properties: envelope.properties,
    clientEventId: window.crypto.randomUUID(),
    source: "frontend",
  };
}
