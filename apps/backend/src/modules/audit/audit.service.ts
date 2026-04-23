import type { AuditEventSummary, AuditExportRequest } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface AuditEventRow {
  readonly id: string;
  readonly occurred_at: string;
  readonly actor_user_id: string | null;
  readonly actor_email: string | null;
  readonly workspace_id: string | null;
  readonly action: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly result: AuditEventSummary['result'];
  readonly reason_code: string | null;
  readonly request_id: string | null;
  readonly trace_id: string | null;
  readonly event_category: string | null;
  readonly session_id: string | null;
  readonly data_class: AuditEventSummary['dataClass'];
  readonly metadata: Record<string, unknown>;
}

export interface AuditRecordInput {
  readonly actorUserId: string | null;
  readonly actorEmail: string | null;
  readonly workspaceId: string | null;
  readonly action: string;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly result: AuditEventSummary['result'];
  readonly reasonCode?: string | null;
  readonly requestId?: string | null;
  readonly traceId?: string | null;
  readonly eventCategory?: string | null;
  readonly sessionId?: string | null;
  readonly dataClass?: AuditEventSummary['dataClass'];
  readonly redactionApplied?: boolean;
  readonly redactionSummary?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown>;
}

interface AuditListFilter {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly category?: string | null;
  readonly limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  describeStage0Audit() {
    return {
      auditTrail: true,
      requestIdPropagation: true,
      traceIdPropagation: true,
      deliveryRequiresApproval: true,
    };
  }

  async record(input: AuditRecordInput): Promise<void> {
    await this.databaseService.query(
      `
        insert into audit.audit_events (
          actor_user_id,
          actor_email,
          workspace_id,
          action,
          entity_type,
          entity_id,
          result,
          reason_code,
          request_id,
          trace_id,
          event_category,
          session_id,
          data_class,
          redaction_applied,
          redaction_summary,
          metadata
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15::jsonb,
          $16::jsonb
        )
      `,
      [
        input.actorUserId,
        input.actorEmail,
        input.workspaceId,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.result,
        input.reasonCode ?? null,
        input.requestId ?? null,
        input.traceId ?? null,
        input.eventCategory ?? null,
        input.sessionId ?? null,
        input.dataClass ?? null,
        input.redactionApplied ?? false,
        JSON.stringify(input.redactionSummary ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  async list(
    workspaceId: string,
    filter: AuditListFilter = {},
  ): Promise<readonly AuditEventSummary[]> {
    const conditions = ['workspace_id = $1'];
    const values: unknown[] = [workspaceId];

    if (filter.from) {
      values.push(filter.from);
      conditions.push(`occurred_at >= $${values.length}::timestamptz`);
    }

    if (filter.to) {
      values.push(filter.to);
      conditions.push(`occurred_at <= $${values.length}::timestamptz`);
    }

    if (filter.category) {
      values.push(filter.category);
      conditions.push(`event_category = $${values.length}`);
    }

    values.push(Math.max(1, Math.min(filter.limit ?? 100, 500)));
    const result = await this.databaseService.query<AuditEventRow>(
      `
        select
          id,
          occurred_at,
          actor_user_id,
          actor_email,
          workspace_id,
          action,
          entity_type,
          entity_id,
          result,
          reason_code,
          request_id,
          trace_id,
          event_category,
          session_id,
          data_class,
          metadata
        from audit.audit_events
        where ${conditions.join(' and ')}
        order by occurred_at desc
        limit $${values.length}
      `,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      workspaceId: row.workspace_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      result: row.result,
      reasonCode: row.reason_code,
      requestId: row.request_id,
      traceId: row.trace_id,
      eventCategory: row.event_category,
      sessionId: row.session_id,
      dataClass: row.data_class,
      metadata: row.metadata ?? {},
    }));
  }

  async exportEvents(workspaceId: string, input: AuditExportRequest) {
    const items = await this.list(workspaceId, {
      from: input.from ?? null,
      to: input.to ?? null,
      category: input.category ?? null,
      limit: 500,
    });
    const format = input.format ?? 'json';

    return {
      format,
      itemCount: items.length,
      content:
        format === 'jsonl'
          ? items.map((item) => JSON.stringify(item)).join('\n')
          : JSON.stringify(items, null, 2),
    };
  }
}
