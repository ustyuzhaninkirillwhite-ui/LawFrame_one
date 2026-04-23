import { loadServerEnv } from '@lexframe/config';
import type {
  DashboardEvent,
  DashboardEventListResponse,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type Queryable = Pick<PoolClient, 'query'>;

interface LiveEventRow extends QueryResultRow {
  readonly id: string;
  readonly sequence_id: string | number;
  readonly workspace_id: string | null;
  readonly user_id: string | null;
  readonly topic: string;
  readonly event_type: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly payload: Record<string, unknown> | null;
  readonly available_at: string;
  readonly published_at: string | null;
  readonly status: 'pending' | 'publishing' | 'published' | 'failed';
  readonly attempt_count: number;
  readonly last_error: string | null;
  readonly created_at: string;
}

@Injectable()
export class LiveEventsService {
  private readonly env = loadServerEnv();

  constructor(private readonly databaseService: DatabaseService) {}

  async recordEvent(input: {
    readonly workspaceId?: string | null;
    readonly userId?: string | null;
    readonly runId?: string | null;
    readonly approvalTaskId?: string | null;
    readonly topics: readonly string[];
    readonly eventType: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly payload?: Record<string, unknown>;
    readonly client?: Queryable;
  }) {
    const payload = sanitizePayload(input.payload ?? {});

    for (const topic of new Set(input.topics.filter(Boolean))) {
      await this.upsertTopicAcl(
        {
          topic,
          workspaceId: input.workspaceId ?? inferWorkspaceId(topic),
          userId: input.userId ?? inferUserId(topic),
          runId: input.runId ?? inferRunId(topic),
          approvalTaskId: input.approvalTaskId ?? null,
        },
        input.client,
      );

      await this.query(
        `
          insert into app.live_events (
            id,
            workspace_id,
            user_id,
            topic,
            event_type,
            entity_type,
            entity_id,
            payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, public.sanitize_live_payload($8::jsonb))
        `,
        [
          randomUUID(),
          input.workspaceId ?? inferWorkspaceId(topic),
          input.userId ?? inferUserId(topic),
          topic,
          input.eventType,
          input.entityType,
          input.entityId,
          JSON.stringify(payload),
        ],
        input.client,
      );
    }
  }

  async upsertTopicAcl(
    input: {
      readonly topic: string;
      readonly workspaceId?: string | null;
      readonly userId?: string | null;
      readonly runId?: string | null;
      readonly approvalTaskId?: string | null;
    },
    client?: Queryable,
  ) {
    await this.query(
      `
        insert into app.realtime_topic_acl (
          topic,
          workspace_id,
          user_id,
          run_id,
          approval_task_id
        )
        values ($1, $2, $3, $4, $5)
        on conflict (topic) do update
        set
          workspace_id = excluded.workspace_id,
          user_id = excluded.user_id,
          run_id = excluded.run_id,
          approval_task_id = excluded.approval_task_id,
          updated_at = timezone('utc', now())
      `,
      [
        input.topic,
        input.workspaceId ?? null,
        input.userId ?? null,
        input.runId ?? null,
        input.approvalTaskId ?? null,
      ],
      client,
    );
  }

  async getSnapshotVersion(workspaceId: string, userId?: string | null) {
    const row = await this.databaseService.one<{
      readonly sequence_id: string | null;
    }>(
      `
        select max(sequence_id)::text as sequence_id
        from app.live_events
        where workspace_id = $1
          or user_id = $2
      `,
      [workspaceId, userId ?? null],
    );

    return Number(row?.sequence_id ?? '0');
  }

  async listDashboardEvents(input: {
    readonly workspaceId: string;
    readonly userId: string;
    readonly sinceSequence?: number;
    readonly limit?: number;
  }): Promise<DashboardEventListResponse> {
    const workspaceTopic = `workspace:${input.workspaceId}:dashboard`;
    const userTopic = `user:${input.userId}:notifications`;
    const limit = clampLimit(input.limit ?? 100, 20, 200);
    const rows = await this.databaseService.query<LiveEventRow>(
      `
        select
          id,
          sequence_id,
          workspace_id,
          user_id,
          topic,
          event_type,
          entity_type,
          entity_id,
          payload,
          available_at,
          published_at,
          status,
          attempt_count,
          last_error,
          created_at
        from app.live_events
        where sequence_id > $1
          and topic = any($2::text[])
        order by sequence_id asc
        limit $3
      `,
      [input.sinceSequence ?? 0, [workspaceTopic, userTopic], limit],
    );

    const snapshotVersion = await this.getSnapshotVersion(
      input.workspaceId,
      input.userId,
    );
    const events = rows.rows.map(mapDashboardEventRow);

    return {
      snapshotVersion,
      events,
      nextSequence:
        events.length === limit ? (events.at(-1)?.sequenceId ?? null) : null,
    };
  }

  async claimPending(limit = 50) {
    return this.databaseService.transaction(async (client) => {
      const result = await client.query<LiveEventRow>(
        `
          with pending as (
            select id
            from app.live_events
            where status in ('pending', 'failed')
              and available_at <= timezone('utc', now())
              and attempt_count < 8
            order by sequence_id asc
            limit $1
            for update skip locked
          )
          update app.live_events live_events
          set
            status = 'publishing',
            attempt_count = live_events.attempt_count + 1,
            last_error = null
          from pending
          where live_events.id = pending.id
          returning
            live_events.id,
            live_events.sequence_id,
            live_events.workspace_id,
            live_events.user_id,
            live_events.topic,
            live_events.event_type,
            live_events.entity_type,
            live_events.entity_id,
            live_events.payload,
            live_events.available_at,
            live_events.published_at,
            live_events.status,
            live_events.attempt_count,
            live_events.last_error,
            live_events.created_at
        `,
        [limit],
      );

      return result.rows;
    });
  }

  async markPublished(id: string) {
    await this.databaseService.query(
      `
        update app.live_events
        set
          status = 'published',
          published_at = timezone('utc', now()),
          last_error = null
        where id = $1
      `,
      [id],
    );
  }

  async markFailed(id: string, error: unknown) {
    await this.databaseService.query(
      `
        update app.live_events
        set
          status = 'failed',
          last_error = $2
        where id = $1
      `,
      [id, toErrorMessage(error)],
    );
  }

  buildBroadcastPayload(event: LiveEventRow): DashboardEvent {
    return mapDashboardEventRow(event);
  }

  getBroadcastUrl() {
    return `${this.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/broadcast`;
  }

  getRealtimeApiKey() {
    return this.env.SUPABASE_SECRET_KEY;
  }

  private query<T extends QueryResultRow>(
    text: string,
    values: readonly unknown[],
    client?: Queryable,
  ) {
    if (client) {
      return client.query<T>(text, [...values]);
    }

    return this.databaseService.query<T>(text, values);
  }
}

function mapDashboardEventRow(row: LiveEventRow): DashboardEvent {
  return {
    id: row.id,
    sequenceId: Number(row.sequence_id),
    topic: row.topic,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

function sanitizePayload(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function inferWorkspaceId(topic: string) {
  if (!topic.startsWith('workspace:')) {
    return null;
  }

  return topic.split(':')[1] ?? null;
}

function inferUserId(topic: string) {
  if (!topic.startsWith('user:')) {
    return null;
  }

  return topic.split(':')[1] ?? null;
}

function inferRunId(topic: string) {
  if (!topic.startsWith('run:')) {
    return null;
  }

  return topic.split(':')[1] ?? null;
}

function clampLimit(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}
