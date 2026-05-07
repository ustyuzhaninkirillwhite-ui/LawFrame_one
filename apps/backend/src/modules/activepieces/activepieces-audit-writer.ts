import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { ActivepiecesSessionRequestMeta } from './activepieces-session.types';

@Injectable()
export class ActivepiecesAuditWriter {
  constructor(private readonly auditService: AuditService) {}

  async record(input: {
    readonly actor: AuthenticatedActor | null;
    readonly workspaceId: string | null;
    readonly automationId?: string | null;
    readonly sessionId?: string | null;
    readonly action: string;
    readonly result: 'success' | 'error' | 'denied';
    readonly reasonCode?: string | null;
    readonly meta: ActivepiecesSessionRequestMeta;
    readonly metadata?: Record<string, unknown>;
  }) {
    const activepiecesEmbedSessionId = input.sessionId ?? null;

    await this.auditService.record({
      actorUserId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: input.automationId ? 'installed_automation' : null,
      entityId: input.automationId ?? null,
      result: input.result,
      reasonCode: input.reasonCode ?? null,
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      eventCategory: 'activepieces.session',
      sessionId: input.actor?.sessionId ?? null,
      dataClass: 'internal',
      redactionApplied: true,
      redactionSummary: {
        rawJwtStored: false,
        secretsStored: false,
      },
      metadata: redactMetadata({
        ...(activepiecesEmbedSessionId ? { activepiecesEmbedSessionId } : {}),
        ...(input.metadata ?? {}),
      }),
    });
  }
}

function redactMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      redacted[key] = '[redacted]';
      continue;
    }

    if (Array.isArray(nested)) {
      redacted[key] = nested.map((entry) => redactMetadataValue(entry));
      continue;
    }

    if (typeof nested === 'object' && nested !== null) {
      redacted[key] = redactMetadata(nested as Record<string, unknown>);
      continue;
    }

    redacted[key] = nested;
  }

  return redacted;
}

function redactMetadataValue(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    return redactMetadata(value as Record<string, unknown>);
  }

  return value;
}

function isSensitiveKey(key: string) {
  return /token|jwt|secret|api[_-]?key|signing[_-]?key|credential|password/i.test(
    key,
  );
}
