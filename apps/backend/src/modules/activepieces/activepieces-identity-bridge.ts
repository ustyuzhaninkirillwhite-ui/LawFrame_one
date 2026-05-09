import type { ActivepiecesSessionRole } from '@lexframe/contracts';
import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type {
  ActivepiecesInstalledAutomationForSession,
  ActivepiecesPiecesPolicy,
  ActivepiecesProjectBindingForSession,
  ActivepiecesUserBindingForSession,
} from './activepieces-session.types';

interface ProjectBindingRow {
  readonly id: string;
  readonly external_project_id: string;
  readonly ap_project_id: string | null;
}

interface UserBindingRow {
  readonly id: string;
  readonly external_user_id: string;
  readonly ap_user_id: string | null;
  readonly role: ActivepiecesSessionRole;
}

@Injectable()
export class ActivepiecesIdentityBridge implements OnModuleDestroy {
  private readonly env = loadServerEnv();
  private apPool: Pool | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  buildExternalProjectId(workspaceId: string) {
    return `lex_ws_${workspaceId}`;
  }

  buildExternalUserId(userId: string) {
    return `lex_user_${userId}`;
  }

  async ensureProjectBinding(input: {
    readonly workspaceId: string;
    readonly actor: AuthenticatedActor;
    readonly automation: ActivepiecesInstalledAutomationForSession;
    readonly piecesPolicy: ActivepiecesPiecesPolicy;
    readonly routeProjectId: string;
  }): Promise<ActivepiecesProjectBindingForSession> {
    const externalProjectId = this.buildExternalProjectId(input.workspaceId);
    const row = await this.databaseService.one<ProjectBindingRow>(
      `
        insert into app.activepieces_project_bindings (
          id,
          workspace_id,
          external_project_id,
          ap_project_id,
          project_id,
          display_name,
          status,
          pieces_filter_type,
          pieces_policy_hash,
          created_by_user_id,
          last_read_back_at,
          last_session_trace_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'provisioned',
          'ALLOWED',
          $7,
          $8,
          timezone('utc', now()),
          null
        )
        on conflict (workspace_id) do update
        set
          external_project_id = excluded.external_project_id,
          ap_project_id = coalesce(
            excluded.ap_project_id,
            app.activepieces_project_bindings.ap_project_id
          ),
          project_id = excluded.project_id,
          display_name = excluded.display_name,
          status = 'provisioned',
          pieces_filter_type = 'ALLOWED',
          pieces_policy_hash = excluded.pieces_policy_hash,
          last_read_back_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning id, external_project_id, ap_project_id
      `,
      [
        randomUUID(),
        input.workspaceId,
        externalProjectId,
        input.automation.runtime_project_id,
        input.routeProjectId,
        `${input.automation.title} runtime`,
        input.piecesPolicy.policyHash,
        input.actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PROJECT_ACCESS_DENIED',
        500,
        'Activepieces project binding was not created.',
      );
    }

    return {
      id: row.id,
      externalProjectId: row.external_project_id,
      activepiecesProjectId:
        row.ap_project_id ?? input.automation.runtime_project_id ?? null,
    };
  }

  async ensureUserBinding(input: {
    readonly workspaceId: string;
    readonly actor: AuthenticatedActor;
    readonly role: ActivepiecesSessionRole;
  }): Promise<ActivepiecesUserBindingForSession> {
    const externalUserId = this.buildExternalUserId(input.actor.id);
    const row = await this.databaseService.one<UserBindingRow>(
      `
        insert into app.activepieces_user_bindings (
          id,
          workspace_id,
          auth_user_id,
          external_user_id,
          role,
          last_login_at,
          last_session_trace_id
        )
        values ($1, $2, $3, $4, $5, timezone('utc', now()), null)
        on conflict (workspace_id, auth_user_id) do update
        set
          external_user_id = excluded.external_user_id,
          role = excluded.role,
          last_login_at = timezone('utc', now()),
          last_token_issued_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning id, external_user_id, ap_user_id, role
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.actor.id,
        externalUserId,
        input.role,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        500,
        'Activepieces user binding was not created.',
      );
    }

    return {
      id: row.id,
      externalUserId: row.external_user_id,
      activepiecesUserId: row.ap_user_id,
      activepiecesRole: row.role,
    };
  }

  async ensureProjectMembership(input: {
    readonly workspaceId: string;
    readonly projectBinding: ActivepiecesProjectBindingForSession;
    readonly userBinding: ActivepiecesUserBindingForSession;
    readonly role: ActivepiecesSessionRole;
    readonly traceId: string | null;
  }): Promise<void> {
    const pool = this.getActivepiecesPool();
    const client = await pool.connect();
    try {
      const project = await this.resolveActivepiecesProject(client, {
        activepiecesProjectId: input.projectBinding.activepiecesProjectId,
        externalProjectId: input.projectBinding.externalProjectId,
      });
      const user = await this.resolveActivepiecesUser(client, {
        activepiecesUserId: input.userBinding.activepiecesUserId,
        externalUserId: input.userBinding.externalUserId,
      });
      const platformId =
        project.platformId ?? user.platformId ?? STAGE17_ACTIVEPIECES_PLATFORM_ID;
      const projectRoleId = await this.resolveProjectRoleId(client, {
        platformId,
        role: input.role,
      });

      await client.query(
        `
          insert into project_member (
            id,
            "projectId",
            "platformId",
            "userId",
            "projectRoleId"
          )
          values ($1, $2, $3, $4, $5)
          on conflict ("projectId", "userId", "platformId") do update
          set
            "projectRoleId" = excluded."projectRoleId",
            updated = now()
        `,
        [
          idFrom('lfm', `${project.id}:${user.id}:${platformId}`),
          project.id,
          platformId,
          user.id,
          projectRoleId,
        ],
      );

      await this.databaseService.query(
        `
          update app.activepieces_project_bindings
          set
            ap_project_id = $3,
            last_read_back_at = timezone('utc', now()),
            last_session_trace_id = $4,
            updated_at = timezone('utc', now())
          where workspace_id = $1
            and id = $2
        `,
        [
          input.workspaceId,
          input.projectBinding.id,
          project.id,
          input.traceId,
        ],
      );
      await this.databaseService.query(
        `
          update app.activepieces_user_bindings
          set
            ap_user_id = $3,
            last_read_back_at = timezone('utc', now()),
            last_session_trace_id = $4,
            updated_at = timezone('utc', now())
          where workspace_id = $1
            and id = $2
        `,
        [input.workspaceId, input.userBinding.id, user.id, input.traceId],
      );
    } catch (error) {
      if (error instanceof AppHttpException) {
        throw error;
      }

      throw new AppHttpException(
        'ACTIVEPIECES_UNAVAILABLE',
        503,
        'Activepieces project membership could not be verified.',
        {
          reason: error instanceof Error ? error.message : 'unknown',
        },
      );
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.apPool?.end();
  }

  private async resolveActivepiecesProject(
    client: PoolClient,
    input: {
      readonly activepiecesProjectId: string | null;
      readonly externalProjectId: string;
    },
  ): Promise<{ readonly id: string; readonly platformId: string | null }> {
    const result = await client.query<{
      readonly id: string;
      readonly platformId: string | null;
    }>(
      `
        select id, "platformId" as "platformId"
        from project
        where id = $1
           or "externalId" = $2
        order by case when id = $1 then 0 else 1 end, created asc
        limit 1
      `,
      [input.activepiecesProjectId, input.externalProjectId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'ACTIVEPIECES_UNAVAILABLE',
        503,
        'Activepieces project was not found during membership preflight.',
      );
    }
    return row;
  }

  private async resolveActivepiecesUser(
    client: PoolClient,
    input: {
      readonly activepiecesUserId: string | null;
      readonly externalUserId: string;
    },
  ): Promise<{ readonly id: string; readonly platformId: string | null }> {
    const result = await client.query<{
      readonly id: string;
      readonly platformId: string | null;
    }>(
      `
        select id, "platformId" as "platformId"
        from "user"
        where id = $1
           or "externalId" = $2
        order by case when id = $1 then 0 else 1 end, created asc
        limit 1
      `,
      [input.activepiecesUserId, input.externalUserId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'ACTIVEPIECES_UNAVAILABLE',
        503,
        'Activepieces user was not found during membership preflight.',
      );
    }
    return row;
  }

  private async resolveProjectRoleId(
    client: PoolClient,
    input: {
      readonly platformId: string;
      readonly role: ActivepiecesSessionRole;
    },
  ) {
    const roleName =
      input.role === 'VIEWER'
        ? 'Viewer'
        : input.role === 'EDITOR'
          ? 'Editor'
          : 'Admin';
    const result = await client.query<{ readonly id: string }>(
      `
        select id
        from project_role
        where name = $1
          and ("platformId" = $2 or "platformId" is null)
        order by case when "platformId" = $2 then 0 else 1 end, created asc
        limit 1
      `,
      [roleName, input.platformId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppHttpException(
        'ACTIVEPIECES_UNAVAILABLE',
        503,
        'Activepieces project role was not found during membership preflight.',
        {
          role: roleName,
        },
      );
    }
    return row.id;
  }

  private getActivepiecesPool() {
    if (this.apPool) {
      return this.apPool;
    }

    this.apPool = new Pool({
      host: this.env.ACTIVEPIECES_POSTGRES_HOST,
      port: this.env.ACTIVEPIECES_POSTGRES_PORT,
      database: this.env.ACTIVEPIECES_POSTGRES_DATABASE,
      user: this.env.ACTIVEPIECES_POSTGRES_USERNAME,
      password: readSecret(
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD,
        this.env.ACTIVEPIECES_POSTGRES_PASSWORD_FILE,
      ),
    });
    return this.apPool;
  }
}

const STAGE17_ACTIVEPIECES_PLATFORM_ID = 'lfstg17platform000001';

function idFrom(prefix: string, value: string) {
  return `${prefix}${createHash('sha256').update(value).digest('hex')}`.slice(
    0,
    21,
  );
}

function readSecret(envValue: string, filePath: string) {
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return envValue;
}
