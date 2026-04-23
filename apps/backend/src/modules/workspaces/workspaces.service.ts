import type {
  CreateWorkspaceInvitationRequest,
  CreateWorkspaceRequest,
  RoleCode,
  SessionContext,
  UpdateWorkspaceMemberRoleRequest,
  UpdateWorkspaceRequest,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { RateLimitService } from '../../common/services/rate-limit.service';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { DatabaseService } from '../database/database.service';
import { IdentityService } from '../identity/identity.service';

interface WorkspaceRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: WorkspaceSummary['status'];
  readonly role_code?: RoleCode;
}

interface WorkspaceMemberRow {
  readonly id: string;
  readonly auth_user_id: string;
  readonly email: string;
  readonly full_name: string | null;
  readonly role_code: RoleCode;
  readonly status: WorkspaceMember['status'];
  readonly created_at: string;
  readonly last_active_at: string | null;
}

interface WorkspaceInvitationRow {
  readonly id: string;
  readonly email: string;
  readonly role_code: RoleCode;
  readonly status: 'pending' | 'accepted' | 'revoked' | 'expired';
  readonly expires_at: string;
  readonly created_at: string;
  readonly accepted_at: string | null;
  readonly revoked_at: string | null;
  readonly invitation_token_hash?: string;
  readonly workspace_id?: string;
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly databaseService: DatabaseService,
    private readonly identityService: IdentityService,
    private readonly auditService: AuditService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  list(actor: AuthenticatedActor) {
    return this.authorizationService.listWorkspacesForUser(actor.id);
  }

  async get(
    actor: AuthenticatedActor,
    workspaceId: string,
  ): Promise<WorkspaceSummary> {
    const workspaces = await this.authorizationService.listWorkspacesForUser(
      actor.id,
    );
    const workspace =
      workspaces.find((candidate) => candidate.id === workspaceId) ?? null;

    if (!workspace) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Workspace is not accessible.',
      );
    }

    return workspace;
  }

  async create(
    actor: AuthenticatedActor,
    input: CreateWorkspaceRequest,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<WorkspaceSummary> {
    const name = input.name.trim();

    if (!name) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Workspace name is required.',
      );
    }

    const slug = this.slugify(input.slug ?? input.name);

    try {
      const workspace =
        await this.databaseService.transaction<WorkspaceSummary>(
          async (client) => {
            const createdWorkspace = await client.query<WorkspaceRow>(
              `
            insert into app.workspaces (
              id,
              slug,
              name,
              status,
              created_by_user_id
            )
            values ($1, $2, $3, 'active', $4)
            returning id, slug, name, status
          `,
              [randomUUID(), slug, name, actor.id],
            );

            const workspaceRow = createdWorkspace.rows[0];

            if (!workspaceRow) {
              throw new AppHttpException(
                'READINESS_GATE_BLOCKED',
                500,
                'Workspace insert did not return a row.',
              );
            }

            await client.query(
              `
            insert into app.workspace_members (
              id,
              workspace_id,
              auth_user_id,
              role_code,
              status
            )
            values ($1, $2, $3, 'owner', 'active')
          `,
              [randomUUID(), workspaceRow.id, actor.id],
            );

            await client.query(
              `
            update app.profiles
            set
              default_workspace_id = $2,
              onboarding_status = 'ready',
              updated_at = timezone('utc', now())
            where id = $1
          `,
              [actor.id, workspaceRow.id],
            );

            return {
              id: workspaceRow.id,
              slug: workspaceRow.slug,
              name: workspaceRow.name,
              status: workspaceRow.status,
              role: 'owner',
            };
          },
        );

      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId: workspace.id,
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace.id,
        result: 'success',
        requestId: requestMeta.requestId,
        traceId: requestMeta.traceId,
        metadata: {
          slug: workspace.slug,
        },
      });

      return workspace;
    } catch (error) {
      if (error instanceof AppHttpException) {
        throw error;
      }

      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Workspace slug must be unique.',
        {
          slug,
        },
      );
    }
  }

  async update(
    actor: AuthenticatedActor,
    access: AccessContext,
    workspaceId: string,
    input: UpdateWorkspaceRequest,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<WorkspaceSummary> {
    const patchName = input.name?.trim() || access.activeWorkspace?.name;
    const patchStatus =
      input.status ?? access.activeWorkspace?.status ?? 'active';

    const row = await this.databaseService.one<WorkspaceRow>(
      `
        update app.workspaces
        set
          name = $2,
          status = $3,
          updated_at = timezone('utc', now())
        where id = $1
          and deleted_at is null
        returning id, slug, name, status
      `,
      [workspaceId, patchName, patchStatus],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Workspace is not accessible.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.updated',
      entityType: 'workspace',
      entityId: workspaceId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        status: patchStatus,
      },
    });

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      role: access.activeWorkspace?.role ?? 'owner',
    };
  }

  async switchWorkspace(
    actor: AuthenticatedActor,
    workspaceId: string,
    requestMeta: {
      readonly requestId: string;
      readonly traceId: string | null;
    },
  ): Promise<SessionContext> {
    const access = await this.authorizationService.getWorkspaceAccess(
      actor.id,
      workspaceId,
    );

    if (!access) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Requested workspace is not accessible.',
      );
    }

    await this.databaseService.query(
      `
        update app.profiles
        set
          default_workspace_id = $2,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [actor.id, workspaceId],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.switched',
      entityType: 'workspace',
      entityId: workspaceId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
    });

    return this.identityService.getSessionContext(
      actor,
      requestMeta.requestId,
      workspaceId,
    );
  }

  async listMembers(workspaceId: string): Promise<readonly WorkspaceMember[]> {
    const result = await this.databaseService.query<WorkspaceMemberRow>(
      `
        select
          wm.id,
          wm.auth_user_id,
          p.email,
          p.full_name,
          wm.role_code,
          wm.status,
          wm.created_at,
          wm.last_active_at
        from app.workspace_members wm
        inner join app.profiles p
          on p.id = wm.auth_user_id
        where wm.workspace_id = $1
          and wm.deleted_at is null
        order by wm.created_at asc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.auth_user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role_code,
      status: row.status,
      joinedAt: row.created_at,
      lastActiveAt: row.last_active_at,
    }));
  }

  async changeMemberRole(
    actor: AuthenticatedActor,
    access: AccessContext,
    workspaceId: string,
    memberId: string,
    input: UpdateWorkspaceMemberRoleRequest,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<WorkspaceMember> {
    this.rateLimitService.assertWithinLimit(
      `role-change:${actor.id}:${workspaceId}`,
      5,
      60_000,
    );

    this.assertAssignableRole(
      access.activeWorkspace?.role ?? 'viewer',
      input.role,
    );

    const current = await this.databaseService.one<WorkspaceMemberRow>(
      `
        select
          wm.id,
          wm.auth_user_id,
          p.email,
          p.full_name,
          wm.role_code,
          wm.status,
          wm.created_at,
          wm.last_active_at
        from app.workspace_members wm
        inner join app.profiles p
          on p.id = wm.auth_user_id
        where wm.workspace_id = $1
          and wm.id = $2
          and wm.deleted_at is null
      `,
      [workspaceId, memberId],
    );

    if (!current) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Workspace member was not found.',
      );
    }

    await this.assertOwnerRetention(workspaceId, current.role_code, input.role);

    const updated = await this.databaseService.one<WorkspaceMemberRow>(
      `
        update app.workspace_members
        set
          role_code = $3,
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        returning
          id,
          auth_user_id,
          (select email from app.profiles where id = auth_user_id) as email,
          (select full_name from app.profiles where id = auth_user_id) as full_name,
          role_code,
          status,
          created_at,
          last_active_at
      `,
      [workspaceId, memberId, input.role],
    );

    if (!updated) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Role update failed to return a member row.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.member.role_changed',
      entityType: 'workspace_member',
      entityId: memberId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        previousRole: current.role_code,
        nextRole: input.role,
      },
    });

    return {
      id: updated.id,
      userId: updated.auth_user_id,
      email: updated.email,
      fullName: updated.full_name,
      role: updated.role_code,
      status: updated.status,
      joinedAt: updated.created_at,
      lastActiveAt: updated.last_active_at,
    };
  }

  async removeMember(
    actor: AuthenticatedActor,
    access: AccessContext,
    workspaceId: string,
    memberId: string,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<{ readonly status: 'removed' }> {
    this.rateLimitService.assertWithinLimit(
      `member-remove:${actor.id}:${workspaceId}`,
      5,
      60_000,
    );

    const current = await this.databaseService.one<WorkspaceMemberRow>(
      `
        select
          wm.id,
          wm.auth_user_id,
          p.email,
          p.full_name,
          wm.role_code,
          wm.status,
          wm.created_at,
          wm.last_active_at
        from app.workspace_members wm
        inner join app.profiles p
          on p.id = wm.auth_user_id
        where wm.workspace_id = $1
          and wm.id = $2
          and wm.deleted_at is null
      `,
      [workspaceId, memberId],
    );

    if (!current) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Workspace member was not found.',
      );
    }

    await this.assertOwnerRetention(workspaceId, current.role_code, 'removed');

    await this.databaseService.query(
      `
        update app.workspace_members
        set
          status = 'removed',
          deleted_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [workspaceId, memberId],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.member.removed',
      entityType: 'workspace_member',
      entityId: memberId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        removedUserId: current.auth_user_id,
        actorRole: access.activeWorkspace?.role ?? null,
      },
    });

    return {
      status: 'removed',
    };
  }

  async createInvitation(
    actor: AuthenticatedActor,
    access: AccessContext,
    workspaceId: string,
    input: CreateWorkspaceInvitationRequest,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
    appBaseUrl: string,
  ): Promise<WorkspaceInvitation> {
    this.rateLimitService.assertWithinLimit(
      `workspace-invite:${actor.id}:${workspaceId}`,
      10,
      60_000,
    );

    const normalizedEmail = input.email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Invitation email is required.',
      );
    }

    this.assertAssignableRole(
      access.activeWorkspace?.role ?? 'viewer',
      input.role,
    );

    const rawToken = randomBytes(24).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresInDays = Math.min(Math.max(input.expiresInDays ?? 7, 1), 30);

    const row = await this.databaseService.one<WorkspaceInvitationRow>(
      `
        insert into app.workspace_invitations (
          id,
          workspace_id,
          email,
          role_code,
          status,
          invitation_token_hash,
          expires_at,
          created_by_user_id
        )
        values (
          $1,
          $2,
          $3,
          $4,
          'pending',
          $5,
          timezone('utc', now()) + make_interval(days => $6),
          $7
        )
        returning
          id,
          email,
          role_code,
          status,
          expires_at,
          created_at,
          accepted_at,
          revoked_at
      `,
      [
        randomUUID(),
        workspaceId,
        normalizedEmail,
        input.role,
        tokenHash,
        expiresInDays,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Invitation creation did not return a row.',
      );
    }

    const acceptUrl = `${appBaseUrl.replace(/\/$/, '')}/invite/${rawToken}`;

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.invitation.created',
      entityType: 'workspace_invitation',
      entityId: row.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        invitedEmail: normalizedEmail,
        role: input.role,
        actorRole: access.activeWorkspace?.role ?? null,
      },
    });

    return {
      id: row.id,
      email: row.email,
      role: row.role_code,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      revokedAt: row.revoked_at,
      deliveryMode: 'mock',
      deliveryPreview: {
        acceptToken: rawToken,
        acceptUrl,
      },
    };
  }

  async listInvitations(
    workspaceId: string,
  ): Promise<readonly WorkspaceInvitation[]> {
    const result = await this.databaseService.query<WorkspaceInvitationRow>(
      `
        select
          id,
          email,
          role_code,
          case
            when status = 'pending' and expires_at < timezone('utc', now()) then 'expired'
            else status
          end as status,
          expires_at,
          created_at,
          accepted_at,
          revoked_at
        from app.workspace_invitations
        where workspace_id = $1
          and deleted_at is null
        order by created_at desc
      `,
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role_code,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      revokedAt: row.revoked_at,
      deliveryMode: 'mock',
    }));
  }

  async revokeInvitation(
    actor: AuthenticatedActor,
    workspaceId: string,
    invitationId: string,
    requestMeta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
  ): Promise<{ readonly status: 'revoked' }> {
    const row = await this.databaseService.one<WorkspaceInvitationRow>(
      `
        update app.workspace_invitations
        set
          status = 'revoked',
          revoked_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
          and deleted_at is null
        returning id
      `,
      [workspaceId, invitationId],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Workspace invitation was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'workspace.invitation.revoked',
      entityType: 'workspace_invitation',
      entityId: invitationId,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
    });

    return {
      status: 'revoked',
    };
  }

  async acceptInvitation(
    actor: AuthenticatedActor,
    token: string,
    requestMeta: {
      readonly requestId: string;
      readonly traceId: string | null;
    },
  ): Promise<SessionContext> {
    const invitation = await this.databaseService.one<WorkspaceInvitationRow>(
      `
        select
          id,
          workspace_id,
          email,
          role_code,
          status,
          invitation_token_hash,
          expires_at,
          created_at,
          accepted_at,
          revoked_at
        from app.workspace_invitations
        where invitation_token_hash = $1
          and deleted_at is null
      `,
      [this.hashToken(token)],
    );

    if (!invitation) {
      throw new AppHttpException(
        'INVITATION_INVALID',
        404,
        'Invitation token is invalid.',
      );
    }

    if (invitation.status !== 'pending') {
      throw new AppHttpException(
        'INVITATION_INVALID',
        400,
        'Invitation is no longer pending.',
      );
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await this.databaseService.query(
        `
          update app.workspace_invitations
          set
            status = 'expired',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [invitation.id],
      );

      throw new AppHttpException(
        'INVITATION_EXPIRED',
        410,
        'Invitation token has expired.',
      );
    }

    if (invitation.email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Invitation email does not match the authenticated actor.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.workspace_invitations
          set
            status = 'accepted',
            accepted_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [invitation.id],
      );

      await client.query(
        `
          insert into app.workspace_members (
            id,
            workspace_id,
            auth_user_id,
            role_code,
            status
          )
          values ($1, $2, $3, $4, 'active')
          on conflict (workspace_id, auth_user_id) do update
          set
            role_code = excluded.role_code,
            status = 'active',
            deleted_at = null,
            updated_at = timezone('utc', now())
        `,
        [randomUUID(), invitation.workspace_id, actor.id, invitation.role_code],
      );

      await client.query(
        `
          update app.profiles
          set
            default_workspace_id = coalesce(default_workspace_id, $2),
            onboarding_status = 'ready',
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [actor.id, invitation.workspace_id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: invitation.workspace_id ?? null,
      action: 'workspace.invitation.accepted',
      entityType: 'workspace_invitation',
      entityId: invitation.id,
      result: 'success',
      requestId: requestMeta.requestId,
      traceId: requestMeta.traceId,
      metadata: {
        role: invitation.role_code,
      },
    });

    return this.identityService.getSessionContext(
      actor,
      requestMeta.requestId,
      invitation.workspace_id,
    );
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private slugify(value: string): string {
    const normalized = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || `workspace-${randomUUID().slice(0, 8)}`;
  }

  private assertAssignableRole(actorRole: RoleCode, nextRole: RoleCode): void {
    const allowMatrix: Record<RoleCode, readonly RoleCode[]> = {
      owner: [
        'owner',
        'admin',
        'lawyer',
        'assistant',
        'viewer',
        'security_admin',
        'billing_admin',
      ],
      admin: ['lawyer', 'assistant', 'viewer'],
      lawyer: [],
      assistant: [],
      viewer: [],
      security_admin: [],
      billing_admin: [],
    };

    if (!allowMatrix[actorRole].includes(nextRole)) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Actor cannot assign the requested role.',
        {
          actorRole,
          requestedRole: nextRole,
        },
      );
    }
  }

  private async assertOwnerRetention(
    workspaceId: string,
    currentRole: RoleCode,
    nextRole: RoleCode | 'removed',
  ): Promise<void> {
    if (currentRole !== 'owner' || nextRole === 'owner') {
      return;
    }

    const row = await this.databaseService.one<{
      readonly owner_count: string;
    }>(
      `
        select count(*)::text as owner_count
        from app.workspace_members
        where workspace_id = $1
          and role_code = 'owner'
          and status = 'active'
          and deleted_at is null
      `,
      [workspaceId],
    );

    const ownerCount = Number(row?.owner_count ?? '0');

    if (ownerCount <= 1) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        409,
        'Workspace must retain at least one owner.',
      );
    }
  }
}
