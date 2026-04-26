import type { CanvasLockState } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface LockRow {
  readonly id: string;
  readonly draft_version_id: string | null;
  readonly lock_type: string;
  readonly locked_by_user_id: string;
  readonly locked_by_user_email: string | null;
  readonly expires_at: string;
}

@Injectable()
export class CanvasLockService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getLockState(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    draftId?: string | null,
    lockType = 'edit',
  ): Promise<CanvasLockState> {
    const workspaceId = requireWorkspaceId(access);
    const row = await this.databaseService.one<LockRow>(
      `
        select
          acl.id,
          acl.draft_version_id,
          acl.lock_type,
          acl.locked_by_user_id,
          p.email as locked_by_user_email,
          acl.expires_at
        from app.automation_canvas_locks acl
        left join app.profiles p on p.id = acl.locked_by_user_id
        where acl.workspace_id = $1
          and acl.installed_automation_id = $2
          and acl.lock_type = $3
          and acl.released_at is null
          and ($4::uuid is null or acl.draft_version_id = $4::uuid)
        limit 1
      `,
      [workspaceId, automationId, lockType, draftId ?? null],
    );

    if (!row) {
      return {
        status: 'unlocked',
        locked: false,
        locked_by_current_user: false,
        lock_type: lockType,
      };
    }

    const expired = new Date(row.expires_at).getTime() <= Date.now();
    if (expired) {
      return {
        status: 'expired',
        locked: false,
        locked_by_current_user: false,
        lock_id: row.id,
        lock_type: row.lock_type,
        locked_by_user_id: row.locked_by_user_id,
        locked_by_user_email: row.locked_by_user_email,
        expires_at: row.expires_at,
      };
    }

    return {
      status:
        row.locked_by_user_id === actor.id ? 'locked_by_me' : 'locked_by_other',
      locked: true,
      locked_by_current_user: row.locked_by_user_id === actor.id,
      lock_id: row.id,
      lock_type: row.lock_type,
      locked_by_user_id: row.locked_by_user_id,
      locked_by_user_email: row.locked_by_user_email,
      expires_at: row.expires_at,
    };
  }

  async acquireLock(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    input: {
      readonly draftId?: string | null;
      readonly lockType?: string | null;
      readonly ttlSeconds?: number | null;
    } = {},
  ): Promise<CanvasLockState> {
    const lockType = input.lockType ?? 'edit';
    const existing = await this.getLockState(
      access,
      actor,
      automationId,
      input.draftId,
      lockType,
    );
    if (existing.status === 'locked_by_other') {
      return existing;
    }
    if (existing.status === 'locked_by_me') {
      return this.heartbeatLock(access, actor, automationId, {
        draftId: input.draftId,
        lockType,
        ttlSeconds: input.ttlSeconds,
      });
    }

    const workspaceId = requireWorkspaceId(access);
    const ttlSeconds = Math.max(30, Math.min(input.ttlSeconds ?? 120, 900));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const draftId = input.draftId ?? null;

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.automation_canvas_locks
          set released_at = timezone('utc', now()),
              updated_at = timezone('utc', now())
          where workspace_id = $1
            and installed_automation_id = $2
            and lock_type = $3
            and ($4::uuid is null or draft_version_id = $4::uuid)
            and (
              released_at is not null
              or expires_at <= timezone('utc', now())
              or locked_by_user_id = $5
            )
        `,
        [workspaceId, automationId, lockType, draftId, actor.id],
      );

      await client.query(
        `
          insert into app.automation_canvas_locks (
            id,
            workspace_id,
            installed_automation_id,
            draft_version_id,
            lock_type,
            locked_by_user_id,
            expires_at,
            heartbeat_at
          )
          values ($1, $2, $3, $4::uuid, $5, $6, $7::timestamptz, timezone('utc', now()))
        `,
        [
          randomUUID(),
          workspaceId,
          automationId,
          draftId,
          lockType,
          actor.id,
          expiresAt,
        ],
      );
    });

    return this.getLockState(
      access,
      actor,
      automationId,
      input.draftId,
      lockType,
    );
  }

  async releaseLock(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    input: {
      readonly draftId?: string | null;
      readonly lockId?: string | null;
      readonly lockType?: string | null;
    } = {},
  ): Promise<CanvasLockState> {
    const workspaceId = requireWorkspaceId(access);
    const lockType = input.lockType ?? 'edit';
    await this.databaseService.query(
      `
        update app.automation_canvas_locks
        set released_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and installed_automation_id = $2
          and locked_by_user_id = $3
          and lock_type = $4
          and released_at is null
          and ($5::uuid is null or draft_version_id = $5::uuid)
          and ($6::uuid is null or id = $6::uuid)
      `,
      [
        workspaceId,
        automationId,
        actor.id,
        lockType,
        input.draftId ?? null,
        input.lockId ?? null,
      ],
    );

    return this.getLockState(
      access,
      actor,
      automationId,
      input.draftId,
      lockType,
    );
  }

  async heartbeatLock(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    input: {
      readonly draftId?: string | null;
      readonly lockId?: string | null;
      readonly lockType?: string | null;
      readonly ttlSeconds?: number | null;
    } = {},
  ): Promise<CanvasLockState> {
    const workspaceId = requireWorkspaceId(access);
    const lockType = input.lockType ?? 'edit';
    const ttlSeconds = Math.max(30, Math.min(input.ttlSeconds ?? 120, 900));
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const result = await this.databaseService.query(
      `
        update app.automation_canvas_locks
        set heartbeat_at = timezone('utc', now()),
            expires_at = $7::timestamptz,
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and installed_automation_id = $2
          and locked_by_user_id = $3
          and lock_type = $4
          and released_at is null
          and expires_at > timezone('utc', now())
          and ($5::uuid is null or draft_version_id = $5::uuid)
          and ($6::uuid is null or id = $6::uuid)
      `,
      [
        workspaceId,
        automationId,
        actor.id,
        lockType,
        input.draftId ?? null,
        input.lockId ?? null,
        expiresAt,
      ],
    );

    if (result.rowCount === 0) {
      throw new AppHttpException(
        'CANVAS_LOCK_REQUIRED',
        423,
        'Canvas edit lock is required.',
      );
    }

    return this.getLockState(
      access,
      actor,
      automationId,
      input.draftId,
      lockType,
    );
  }

  async isLockedByOther(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    draftId?: string | null,
  ): Promise<boolean> {
    const state = await this.getLockState(access, actor, automationId, draftId);
    return state.status === 'locked_by_other';
  }

  async assertLockHeld(
    access: AccessContext,
    actor: AuthenticatedActor,
    automationId: string,
    draftId?: string | null,
  ): Promise<void> {
    const state = await this.getLockState(access, actor, automationId, draftId);
    if (state.status === 'locked_by_me') {
      return;
    }
    if (state.status === 'locked_by_other') {
      throw new AppHttpException(
        'CANVAS_LOCK_OWNED_BY_ANOTHER_USER',
        423,
        'Canvas draft is locked by another user.',
      );
    }
    throw new AppHttpException(
      'CANVAS_LOCK_REQUIRED',
      423,
      'Canvas edit lock is required.',
    );
  }
}
