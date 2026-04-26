import type {
  AuditEventSummary,
  CanvasAccessDecision,
  CanvasAuditEventSummary,
  CanvasAuditExportResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface CanvasAuditRow {
  readonly id: string;
  readonly occurred_at: string;
  readonly actor_user_id: string | null;
  readonly action: string;
  readonly entity_id: string | null;
  readonly result: 'success' | 'denied' | 'error';
  readonly reason_code: string | null;
  readonly request_id: string | null;
  readonly trace_id: string | null;
  readonly event_category: string | null;
  readonly data_class: string | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface CanvasAuditRecordInput {
  readonly actor: AuthenticatedActor;
  readonly access: AccessContext;
  readonly automationId: string;
  readonly action: string;
  readonly result: 'success' | 'denied' | 'error';
  readonly reasonCode?: string | null;
  readonly requestId?: string | null;
  readonly traceId?: string | null;
  readonly category?: string | null;
  readonly dataClass?: AuditEventSummary['dataClass'];
  readonly metadata?: Record<string, unknown>;
}

const FORBIDDEN_AUDIT_KEY =
  /(^|_)(raw|prompt|llm|output|token|api[_-]?key|private[_-]?key|password|signed[_-]?url|document[_-]?text|secret[_-]?value)($|_)/i;
const FORBIDDEN_AUDIT_VALUE =
  /(-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----|service_role|sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|X-Amz-Signature=|sig=)/;

@Injectable()
export class CanvasAuditService {
  constructor(
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
  ) {}

  async record(input: CanvasAuditRecordInput): Promise<void> {
    const metadata = sanitizeCanvasAuditMetadata(input.metadata ?? {});
    await this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.access.activeWorkspace?.id ?? null,
      action: input.action,
      entityType: 'installed_automation',
      entityId: input.automationId,
      result: input.result,
      reasonCode: input.reasonCode ?? null,
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
      eventCategory: input.category ?? inferCanvasAuditCategory(input.action),
      dataClass: input.dataClass ?? null,
      redactionApplied: true,
      redactionSummary: { mode: 'ids_hashes_and_classification_only' },
      metadata,
    });
  }

  async recordDecision(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly decision: CanvasAccessDecision;
    readonly requestId?: string | null;
    readonly traceId?: string | null;
    readonly metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.record({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      action: input.decision.audit_event,
      result: input.decision.allowed ? 'success' : 'denied',
      reasonCode: input.decision.reason_code,
      requestId: input.requestId ?? null,
      traceId: input.traceId ?? null,
      dataClass: null,
      metadata: {
        ...(input.metadata ?? {}),
        action: input.decision.action,
        resource: input.decision.resource,
        riskLevel: input.decision.risk_level,
        requiredPermissions: input.decision.required_permissions,
        redactionMode: input.decision.redaction_mode,
        requiredAction: input.decision.required_action,
        policyCodes: input.decision.policy_codes,
      },
    });
  }

  async list(
    access: AccessContext,
    automationId: string,
    input: {
      readonly from?: string | null;
      readonly to?: string | null;
      readonly limit?: number | null;
    } = {},
  ): Promise<readonly CanvasAuditEventSummary[]> {
    requirePermission(access, 'canvas.audit_read');
    const workspaceId = requireWorkspaceId(access);
    const values: unknown[] = [workspaceId, automationId];
    const conditions = [
      'workspace_id = $1',
      'entity_id = $2',
      "(action like 'canvas.%' or event_category like 'canvas.%')",
    ];
    if (input.from) {
      values.push(input.from);
      conditions.push(`occurred_at >= $${values.length}::timestamptz`);
    }
    if (input.to) {
      values.push(input.to);
      conditions.push(`occurred_at <= $${values.length}::timestamptz`);
    }
    values.push(Math.max(1, Math.min(input.limit ?? 100, 500)));
    const result = await this.databaseService.query<CanvasAuditRow>(
      `
        select
          id,
          occurred_at,
          actor_user_id,
          action,
          entity_id,
          result,
          reason_code,
          request_id,
          trace_id,
          event_category,
          data_class,
          metadata
        from audit.audit_events
        where ${conditions.join(' and ')}
        order by occurred_at desc
        limit $${values.length}
      `,
      values,
    );
    return result.rows.map(toCanvasAuditEventSummary);
  }

  async get(
    access: AccessContext,
    automationId: string,
    eventId: string,
  ): Promise<CanvasAuditEventSummary> {
    const [event] = await this.list(access, automationId, { limit: 500 });
    if (event?.id === eventId) {
      return event;
    }
    const workspaceId = requireWorkspaceId(access);
    requirePermission(access, 'canvas.audit_read');
    const result = await this.databaseService.query<CanvasAuditRow>(
      `
        select
          id,
          occurred_at,
          actor_user_id,
          action,
          entity_id,
          result,
          reason_code,
          request_id,
          trace_id,
          event_category,
          data_class,
          metadata
        from audit.audit_events
        where workspace_id = $1
          and entity_id = $2
          and id = $3
          and (action like 'canvas.%' or event_category like 'canvas.%')
        limit 1
      `,
      [workspaceId, automationId, eventId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'CANVAS_AUDIT_EVENT_NOT_FOUND',
        404,
        'Canvas audit event was not found.',
      );
    }
    return toCanvasAuditEventSummary(row);
  }

  async export(
    access: AccessContext,
    automationId: string,
    input: {
      readonly from?: string | null;
      readonly to?: string | null;
      readonly format?: 'json' | 'jsonl';
    },
  ): Promise<CanvasAuditExportResponse> {
    requirePermission(access, 'canvas.audit_export');
    const events = await this.list(access, automationId, {
      from: input.from,
      to: input.to,
      limit: 500,
    });
    const format = input.format ?? 'json';
    return {
      format,
      item_count: events.length,
      content:
        format === 'jsonl'
          ? events.map((event) => JSON.stringify(event)).join('\n')
          : JSON.stringify(events, null, 2),
    };
  }

  async hashChainStatus(access: AccessContext, automationId: string) {
    requirePermission(access, 'canvas.audit_read');
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<{
      readonly id: string;
      readonly metadata: Record<string, unknown> | null;
    }>(
      `
        select id, metadata
        from audit.audit_events
        where workspace_id = $1
          and entity_id = $2
          and (action like 'canvas.%' or event_category like 'canvas.%')
        order by occurred_at desc
        limit 1
      `,
      [workspaceId, automationId],
    );
    const latest = result.rows[0] ?? null;
    return {
      workspace_id: workspaceId,
      automation_id: automationId,
      status: latest ? 'not_available' : 'not_available',
      latest_event_id: latest?.id ?? null,
      latest_hash:
        typeof latest?.metadata?.hash === 'string'
          ? latest.metadata.hash
          : null,
    } as const;
  }
}

export function sanitizeCanvasAuditMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeValue(value, '$') as Record<string, unknown>;
}

function sanitizeValue(value: unknown, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}.${index}`));
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_AUDIT_VALUE.test(value)) {
      throw new AppHttpException(
        'CANVAS_AUDIT_PAYLOAD_FORBIDDEN',
        500,
        'Canvas audit metadata contains a forbidden secret-like value.',
        { path },
      );
    }
    return value;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_AUDIT_KEY.test(key)) {
      throw new AppHttpException(
        'CANVAS_AUDIT_PAYLOAD_FORBIDDEN',
        500,
        'Canvas audit metadata contains a forbidden raw or secret field.',
        { path: childPath },
      );
    }
    sanitized[key] = sanitizeValue(child, childPath);
  }
  return sanitized;
}

function inferCanvasAuditCategory(action: string) {
  if (action.startsWith('canvas.runtime.')) {
    return 'canvas.runtime';
  }
  if (action.startsWith('canvas.ai.')) {
    return 'canvas.ai';
  }
  if (action.startsWith('canvas.test') || action.startsWith('canvas.testing')) {
    return 'canvas.testing';
  }
  if (action.startsWith('canvas.audit.')) {
    return 'canvas.audit';
  }
  if (action.startsWith('canvas.policy.')) {
    return 'canvas.policy';
  }
  if (action.startsWith('canvas.graph.')) {
    return 'canvas.graph';
  }
  return 'canvas.lifecycle';
}

function toCanvasAuditEventSummary(
  row: CanvasAuditRow,
): CanvasAuditEventSummary {
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    action: row.action,
    category: row.event_category,
    result: row.result,
    reason_code: row.reason_code,
    actor_user_id: row.actor_user_id,
    entity_id: row.entity_id,
    data_class: row.data_class,
    request_id: row.request_id,
    trace_id: row.trace_id,
    metadata: row.metadata ?? {},
  };
}

function requirePermission(access: AccessContext, permission: string) {
  if (!access.permissions.includes(permission as never)) {
    throw new AppHttpException(
      'PERMISSION_DENIED',
      403,
      `${permission} permission is required for Canvas audit.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
