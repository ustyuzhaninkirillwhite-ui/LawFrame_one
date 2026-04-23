import type {
  PermissionCode,
  PermissionDefinition,
  RoleCode,
  RoleDefinition,
  WorkspaceSummary,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface WorkspaceAccessRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: WorkspaceSummary['status'];
  readonly role_code: RoleCode;
  readonly permissions: readonly PermissionCode[] | null;
}

interface WorkspaceSummaryRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: WorkspaceSummary['status'];
  readonly role_code: RoleCode;
}

interface RoleRow {
  readonly code: RoleCode;
  readonly label: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[] | null;
}

interface PermissionRow {
  readonly code: PermissionCode;
  readonly label: string;
  readonly description: string;
  readonly scope: PermissionDefinition['scope'];
  readonly high_risk: boolean;
}

@Injectable()
export class AuthorizationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listWorkspacesForUser(
    userId: string,
  ): Promise<readonly WorkspaceSummary[]> {
    const result = await this.databaseService.query<WorkspaceSummaryRow>(
      `
        select
          w.id,
          w.slug,
          w.name,
          w.status,
          wm.role_code
        from app.workspace_members wm
        inner join app.workspaces w
          on w.id = wm.workspace_id
        where wm.auth_user_id = $1
          and wm.status = 'active'
          and wm.deleted_at is null
          and w.deleted_at is null
        order by w.created_at asc
      `,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      role: row.role_code,
    }));
  }

  async getWorkspaceAccess(
    userId: string,
    workspaceId: string,
  ): Promise<{
    readonly activeWorkspace: WorkspaceSummary;
    readonly roles: readonly RoleCode[];
    readonly permissions: readonly PermissionCode[];
  } | null> {
    const row = await this.databaseService.one<WorkspaceAccessRow>(
      `
        select
          w.id,
          w.slug,
          w.name,
          w.status,
          wm.role_code,
          array_remove(array_agg(rp.permission_code order by rp.permission_code), null) as permissions
        from app.workspace_members wm
        inner join app.workspaces w
          on w.id = wm.workspace_id
        left join app.role_permissions rp
          on rp.role_code = wm.role_code
        where wm.auth_user_id = $1
          and wm.workspace_id = $2
          and wm.status = 'active'
          and wm.deleted_at is null
          and w.deleted_at is null
        group by w.id, w.slug, w.name, w.status, wm.role_code
      `,
      [userId, workspaceId],
    );

    if (!row) {
      return null;
    }

    return {
      activeWorkspace: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        role: row.role_code,
      },
      roles: [row.role_code],
      permissions: row.permissions ?? [],
    };
  }

  async hasPermission(
    userId: string,
    workspaceId: string,
    permission: PermissionCode,
  ): Promise<boolean> {
    const access = await this.getWorkspaceAccess(userId, workspaceId);
    return access ? access.permissions.includes(permission) : false;
  }

  async listRoles(): Promise<readonly RoleDefinition[]> {
    const result = await this.databaseService.query<RoleRow>(
      `
        select
          r.code,
          r.label,
          r.description,
          array_remove(array_agg(rp.permission_code order by rp.permission_code), null) as permissions
        from app.roles r
        left join app.role_permissions rp
          on rp.role_code = r.code
        group by r.code, r.label, r.description
        order by r.code asc
      `,
    );

    return result.rows.map((row) => ({
      code: row.code,
      label: row.label,
      description: row.description,
      permissions: row.permissions ?? [],
    }));
  }

  listRolesSyncFallback(): readonly RoleDefinition[] {
    return [
      {
        code: 'owner',
        label: 'Владелец',
        description: 'Полное управление рабочим пространством.',
        permissions: [],
      },
      {
        code: 'admin',
        label: 'Администратор',
        description: 'Администрирование пространства и участников.',
        permissions: [],
      },
    ];
  }

  async listPermissions(): Promise<readonly PermissionDefinition[]> {
    const result = await this.databaseService.query<PermissionRow>(
      `
        select
          code,
          label,
          description,
          scope,
          high_risk
        from app.permissions
        order by code asc
      `,
    );

    return result.rows.map((row) => ({
      code: row.code,
      label: row.label,
      description: row.description,
      scope: row.scope,
      highRisk: row.high_risk,
    }));
  }
}
