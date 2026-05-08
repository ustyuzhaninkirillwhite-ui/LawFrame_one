import type {
  SettingsBootstrapResponse,
  SettingsOrganizationDto,
  SettingsProfileDto,
  UpdateOrganizationSettingsRequest,
  UpdateProfileSettingsRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { redactSecrets } from './settings-redactor';

interface ProfileSettingsRow {
  readonly id: string;
  readonly email: string;
  readonly full_name: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly display_name: string | null;
  readonly locale: string;
  readonly timezone: string;
}

interface WorkspaceSettingsRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: SettingsOrganizationDto['status'];
  readonly organization_display_name: string | null;
  readonly organization_legal_name: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async bootstrap(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<SettingsBootstrapResponse> {
    const workspaceId = requireWorkspace(input.access);
    const [profile, organization] = await Promise.all([
      this.getProfile(input.actor),
      this.getOrganization(input.access),
    ]);

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.opened',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: { tabs: ['profile', 'organization', 'ai', 'diagnostics'] },
    });

    return {
      profile,
      organization,
      permissions: input.access.permissions,
      tabs: ['profile', 'organization', 'ai', 'diagnostics'],
    };
  }

  async getProfile(actor: AuthenticatedActor): Promise<SettingsProfileDto> {
    const row = await this.databaseService.one<ProfileSettingsRow>(
      `
        select
          id::text,
          email,
          full_name,
          first_name,
          last_name,
          display_name,
          locale,
          timezone
        from app.profiles
        where id = $1
        limit 1
      `,
      [actor.id],
    );

    return {
      userId: row?.id ?? actor.id,
      email: row?.email ?? actor.email,
      firstName: row?.first_name ?? null,
      lastName: row?.last_name ?? null,
      displayName: row?.display_name ?? actor.fullName ?? null,
      fullName: row?.full_name ?? actor.fullName,
      locale: row?.locale ?? 'ru',
      timezone: row?.timezone ?? 'Europe/Berlin',
    };
  }

  async updateProfile(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly request: UpdateProfileSettingsRequest;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<SettingsProfileDto> {
    const workspaceId = requireWorkspace(input.access);
    const fullName = buildFullName(input.request);
    const row = await this.databaseService.one<ProfileSettingsRow>(
      `
        update app.profiles
        set
          first_name = coalesce($2, first_name),
          last_name = coalesce($3, last_name),
          display_name = coalesce($4, display_name),
          locale = coalesce($5, locale),
          timezone = coalesce($6, timezone),
          full_name = coalesce($7, full_name),
          updated_at = timezone('utc', now())
        where id = $1
        returning
          id::text,
          email,
          full_name,
          first_name,
          last_name,
          display_name,
          locale,
          timezone
      `,
      [
        input.actor.id,
        input.request.firstName ?? null,
        input.request.lastName ?? null,
        input.request.displayName ?? null,
        input.request.locale ?? null,
        input.request.timezone ?? null,
        fullName,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PROFILE_NOT_FOUND',
        404,
        'Profile was not found.',
      );
    }

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.profile.updated',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: { updatedFields: Object.keys(input.request) },
    });

    return {
      userId: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      fullName: row.full_name,
      locale: row.locale,
      timezone: row.timezone,
    };
  }

  async getOrganization(
    access: AccessContext,
  ): Promise<SettingsOrganizationDto | null> {
    const workspace = access.activeWorkspace;
    if (!workspace) {
      return null;
    }

    const row = await this.databaseService.one<WorkspaceSettingsRow>(
      `
        select
          id::text,
          slug,
          name,
          status,
          organization_display_name,
          organization_legal_name
        from app.workspaces
        where id = $1
        limit 1
      `,
      [workspace.id],
    );

    return {
      workspaceId: row?.id ?? workspace.id,
      workspaceSlug: row?.slug ?? workspace.slug,
      workspaceName: row?.name ?? workspace.name,
      organizationDisplayName: row?.organization_display_name ?? null,
      organizationLegalName: row?.organization_legal_name ?? null,
      status: row?.status ?? workspace.status,
      role: workspace.role,
      canEditDisplayFields: access.permissions.includes(
        'settings.organization.update',
      ),
    };
  }

  async updateOrganization(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly request: UpdateOrganizationSettingsRequest;
    readonly requestId: string | null;
    readonly traceId: string | null;
  }): Promise<SettingsOrganizationDto> {
    const workspaceId = requireWorkspace(input.access);
    const row = await this.databaseService.one<WorkspaceSettingsRow>(
      `
        update app.workspaces
        set
          organization_display_name = coalesce($2, organization_display_name),
          organization_legal_name = coalesce($3, organization_legal_name),
          updated_at = timezone('utc', now())
        where id = $1
        returning
          id::text,
          slug,
          name,
          status,
          organization_display_name,
          organization_legal_name
      `,
      [
        workspaceId,
        input.request.organizationDisplayName ?? null,
        input.request.organizationLegalName ?? null,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Workspace was not found.',
      );
    }

    await this.audit({
      actor: input.actor,
      workspaceId,
      action: 'settings.organization.updated',
      result: 'success',
      requestId: input.requestId,
      traceId: input.traceId,
      metadata: { updatedFields: Object.keys(input.request) },
    });

    return {
      workspaceId: row.id,
      workspaceSlug: row.slug,
      workspaceName: row.name,
      organizationDisplayName: row.organization_display_name,
      organizationLegalName: row.organization_legal_name,
      status: row.status,
      role: input.access.activeWorkspace?.role ?? 'viewer',
      canEditDisplayFields: true,
    };
  }

  private audit(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly action: string;
    readonly result: 'success' | 'denied' | 'error';
    readonly requestId: string | null;
    readonly traceId: string | null;
    readonly metadata: Record<string, unknown>;
  }) {
    return this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: 'settings',
      entityId: input.workspaceId,
      result: input.result,
      requestId: input.requestId,
      traceId: input.traceId,
      eventCategory: 'settings',
      redactionApplied: true,
      metadata: redactSecrets(input.metadata),
    });
  }
}

function requireWorkspace(access: AccessContext): string {
  if (!access.activeWorkspace?.id) {
    throw new AppHttpException(
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
      'Workspace context is required.',
    );
  }

  return access.activeWorkspace.id;
}

function buildFullName(input: UpdateProfileSettingsRequest): string | null {
  if (input.displayName) {
    return input.displayName;
  }

  const parts = [input.firstName, input.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
