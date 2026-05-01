import type { ActivepiecesSessionRole } from '@lexframe/contracts';
import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
export class ActivepiecesIdentityBridge {
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
            app.activepieces_project_bindings.ap_project_id,
            excluded.ap_project_id
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
}
