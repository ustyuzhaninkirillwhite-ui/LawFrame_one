import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service';

@Injectable()
export class CanvasAiTelemetryService {
  constructor(private readonly telemetryService: TelemetryService) {}

  async enqueue(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly eventName: string;
    readonly traceId?: string | null;
    readonly properties?: Record<string, unknown>;
    readonly idempotencyKey?: string | null;
  }) {
    const workspaceId = input.access.activeWorkspace?.id;
    if (!workspaceId) {
      return;
    }

    try {
      await this.telemetryService.enqueueAuthoritativeEvent({
        actorUserId: input.actor.id,
        workspaceId,
        sessionId: null,
        traceId: input.traceId ?? null,
        eventName: input.eventName,
        source: 'backend',
        eventTime: new Date().toISOString(),
        resourceType: 'automation',
        resourceId: input.automationId,
        processInstanceId: null,
        runId: null,
        properties: input.properties ?? {},
        clientEventId: null,
        idempotencyKey:
          input.idempotencyKey ??
          `${input.automationId}:${input.eventName}:${Date.now()}`,
      });
    } catch {
      // Product telemetry must not block Canvas AI.
    }
  }
}
