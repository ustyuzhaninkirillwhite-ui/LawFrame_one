import type {
  DeviceRegistrationRequest,
  NotificationListQuery,
  NotificationListResponse,
  NotificationSummary,
  RegisteredDevice,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { LiveEventsService } from '../realtime/live-events.service';

interface NotificationRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly user_id: string | null;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly severity: NotificationSummary['severity'];
  readonly priority: NotificationSummary['priority'];
  readonly action_url: string | null;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly read_at: string | null;
  readonly created_at: string;
}

interface DeviceRow {
  readonly id: string;
  readonly device_type: RegisteredDevice['deviceType'];
  readonly device_token: string;
  readonly metadata: Record<string, unknown> | null;
  readonly last_registered_at: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async list(
    access: AccessContext,
    actorUserId: string,
    query: NotificationListQuery = {},
  ): Promise<NotificationListResponse> {
    const limit = clampLimit(query.limit ?? 25, 5, 100);
    const values: unknown[] = [access.activeWorkspace!.id, actorUserId];
    const conditions = [
      `workspace_id = $1`,
      `(user_id = $2 or user_id is null)`,
    ];

    if (query.cursor) {
      values.push(query.cursor);
      conditions.push(`created_at < $${values.length}`);
    }

    if (query.status === 'unread') {
      conditions.push('read_at is null');
    } else if (query.status === 'read') {
      conditions.push('read_at is not null');
    }

    if (query.type) {
      values.push(query.type);
      conditions.push(`type = $${values.length}`);
    }

    values.push(limit + 1);
    const result = await this.databaseService.query<NotificationRow>(
      `
        select
          id,
          workspace_id,
          user_id,
          type,
          title,
          body,
          severity,
          priority,
          action_url,
          entity_type,
          entity_id,
          metadata,
          read_at,
          created_at
        from app.notifications
        where ${conditions.join(' and ')}
        order by created_at desc, id desc
        limit $${values.length}
      `,
      values,
    );

    const unreadCount = await this.countUnread(access, actorUserId);
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit).map(mapNotificationRow);

    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.createdAt ?? null : null,
      unreadCount,
    };
  }

  async countUnread(access: AccessContext, actorUserId: string) {
    const row = await this.databaseService.one<{ readonly unread_count: string }>(
      `
        select count(*)::text as unread_count
        from app.notifications
        where workspace_id = $1
          and (user_id = $2 or user_id is null)
          and read_at is null
      `,
      [access.activeWorkspace!.id, actorUserId],
    );

    return Number(row?.unread_count ?? '0');
  }

  async markRead(
    access: AccessContext,
    actorUserId: string,
    notificationId: string,
  ): Promise<NotificationSummary> {
    const row = await this.databaseService.one<NotificationRow>(
      `
        update app.notifications
        set
          read_at = coalesce(read_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and (user_id = $3 or user_id is null)
        returning
          id,
          workspace_id,
          user_id,
          type,
          title,
          body,
          severity,
          priority,
          action_url,
          entity_type,
          entity_id,
          metadata,
          read_at,
          created_at
      `,
      [notificationId, access.activeWorkspace!.id, actorUserId],
    );

    if (!row) {
      throw new AppHttpException(
        'NOTIFICATION_NOT_FOUND',
        404,
        'Notification was not found.',
      );
    }

    const notification = mapNotificationRow(row);
    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      userId: row.user_id ?? actorUserId,
      topics: buildNotificationTopics(access.activeWorkspace!.id, row.user_id ?? actorUserId),
      eventType: 'notification.updated',
      entityType: 'notification',
      entityId: notification.id,
      payload: { notification },
    });

    return notification;
  }

  async markAllRead(access: AccessContext, actorUserId: string) {
    const result = await this.databaseService.query<NotificationRow>(
      `
        update app.notifications
        set
          read_at = coalesce(read_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and (user_id = $2 or user_id is null)
          and read_at is null
        returning
          id,
          workspace_id,
          user_id,
          type,
          title,
          body,
          severity,
          priority,
          action_url,
          entity_type,
          entity_id,
          metadata,
          read_at,
          created_at
      `,
      [access.activeWorkspace!.id, actorUserId],
    );

    for (const row of result.rows) {
      await this.liveEventsService.recordEvent({
        workspaceId: access.activeWorkspace!.id,
        userId: row.user_id ?? actorUserId,
        topics: buildNotificationTopics(
          access.activeWorkspace!.id,
          row.user_id ?? actorUserId,
        ),
        eventType: 'notification.updated',
        entityType: 'notification',
        entityId: row.id,
        payload: { notification: mapNotificationRow(row) },
      });
    }

    return {
      status: 'ok' as const,
      updatedCount: result.rowCount ?? result.rows.length,
    };
  }

  async create(input: {
    readonly workspaceId: string;
    readonly userId?: string | null;
    readonly type: string;
    readonly title: string;
    readonly body: string;
    readonly severity?: NotificationSummary['severity'];
    readonly priority?: NotificationSummary['priority'];
    readonly actionUrl?: string | null;
    readonly entityType?: string | null;
    readonly entityId?: string | null;
    readonly metadata?: Record<string, unknown>;
    readonly dedupeKey?: string | null;
  }) {
    if (input.dedupeKey) {
      const existing = await this.databaseService.one<NotificationRow>(
        `
          select
            id,
            workspace_id,
            user_id,
            type,
            title,
            body,
            severity,
            priority,
            action_url,
            entity_type,
            entity_id,
            metadata,
            read_at,
            created_at
          from app.notifications
          where workspace_id = $1
            and coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              coalesce($2, '00000000-0000-0000-0000-000000000000'::uuid)
            and dedupe_key = $3
          limit 1
        `,
        [input.workspaceId, input.userId ?? null, input.dedupeKey],
      );

      if (existing) {
        return mapNotificationRow(existing);
      }
    }

    const row = await this.databaseService.one<NotificationRow>(
      `
        insert into app.notifications (
          id,
          workspace_id,
          user_id,
          type,
          title,
          body,
          severity,
          priority,
          action_url,
          entity_type,
          entity_id,
          metadata,
          dedupe_key
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
        returning
          id,
          workspace_id,
          user_id,
          type,
          title,
          body,
          severity,
          priority,
          action_url,
          entity_type,
          entity_id,
          metadata,
          read_at,
          created_at
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.userId ?? null,
        input.type,
        input.title,
        input.body,
        input.severity ?? 'info',
        input.priority ?? 'normal',
        input.actionUrl ?? deriveActionUrl(input.entityType ?? null, input.entityId ?? null),
        input.entityType ?? null,
        input.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.dedupeKey ?? null,
      ],
    );

    const notification = row ? mapNotificationRow(row) : null;

    if (notification) {
      await this.liveEventsService.recordEvent({
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        topics: buildNotificationTopics(input.workspaceId, input.userId ?? null),
        eventType: 'notification.created',
        entityType: 'notification',
        entityId: notification.id,
        payload: { notification },
      });
    }

    return notification;
  }

  async registerDevice(
    actorUserId: string,
    workspaceId: string,
    input: DeviceRegistrationRequest,
  ): Promise<RegisteredDevice> {
    await this.databaseService.query(
      `
        insert into app.notification_preferences (
          user_id
        )
        values ($1)
        on conflict (user_id) do nothing
      `,
      [actorUserId],
    );

    const row = await this.databaseService.one<DeviceRow>(
      `
        insert into app.device_tokens (
          user_id,
          workspace_id,
          device_type,
          device_token,
          metadata
        )
        values ($1, $2, $3, $4, $5::jsonb)
        on conflict (user_id, device_token) do update
        set
          workspace_id = excluded.workspace_id,
          device_type = excluded.device_type,
          metadata = excluded.metadata,
          last_registered_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning
          id,
          device_type,
          device_token,
          metadata,
          last_registered_at
      `,
      [
        actorUserId,
        workspaceId,
        input.deviceType,
        input.deviceToken,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        500,
        'Device token was not registered.',
      );
    }

    return {
      id: row.id,
      deviceType: row.device_type,
      deviceToken: row.device_token,
      metadata: row.metadata ?? {},
      lastRegisteredAt: row.last_registered_at,
    };
  }

  async removeDevice(actorUserId: string, deviceId: string) {
    const result = await this.databaseService.query(
      `
        delete from app.device_tokens
        where id = $1
          and user_id = $2
      `,
      [deviceId, actorUserId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppHttpException(
        'NOTIFICATION_NOT_FOUND',
        404,
        'Device token was not found.',
      );
    }

    return {
      status: 'removed' as const,
    };
  }
}

function mapNotificationRow(row: NotificationRow): NotificationSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: row.severity,
    priority: row.priority,
    actionUrl: row.action_url,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function buildNotificationTopics(workspaceId: string, userId: string | null) {
  return [
    `workspace:${workspaceId}:dashboard`,
    ...(userId ? [`user:${userId}:notifications`] : []),
  ];
}

function deriveActionUrl(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) {
    return null;
  }

  switch (entityType) {
    case 'workflow_run':
      return `/runs/${entityId}`;
    case 'approval_task':
      return '/approvals';
    case 'delivery_request':
      return '/approvals';
    case 'recommendation':
      return '/recommendations';
    case 'document':
    case 'run_artifact':
      return `/documents/${entityId}`;
    default:
      return null;
  }
}

function clampLimit(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
