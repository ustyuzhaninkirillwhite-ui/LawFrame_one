import type { EventDefinition } from "@lexframe/contracts";
import { eventCatalog } from "@lexframe/contracts";

export interface TelemetryEnvelope {
  readonly event: string;
  readonly traceId: string;
  readonly actorId: string;
  readonly workspaceId: string;
  readonly payload: Record<string, unknown>;
}

export function findEventDefinition(event: string): EventDefinition | undefined {
  return eventCatalog.find((definition) => definition.event === event);
}

export function createTelemetryEnvelope(
  definition: EventDefinition,
  envelope: Omit<TelemetryEnvelope, "event">,
): TelemetryEnvelope {
  return {
    event: definition.event,
    ...envelope,
  };
}

