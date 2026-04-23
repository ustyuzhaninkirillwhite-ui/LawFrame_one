import type {
  CreateReauthChallengeRequest,
  ReauthChallenge,
  SecurityAccountState,
  SecuritySessionSummary,
  SessionContext,
  WorkspaceSecuritySettings,
  WorkspaceSecuritySettingsUpdateRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { DatabaseService } from '../database/database.service';

interface ProfileRow {
  readonly id: string;
  readonly email: string;
  readonly full_name: string | null;
  readonly default_workspace_id: string | null;
  readonly onboarding_status: 'new' | 'email_unconfirmed' | 'ready';
  readonly locale: string;
  readonly timezone: string;
}

interface WorkspaceAiPolicyRow {
  readonly ai_enabled: boolean;
}

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly workspace_id: string | null;
  readonly created_at: string;
  readonly last_seen_at: string;
  readonly device_label: string | null;
  readonly auth_provider: string | null;
  readonly mfa_level: string | null;
  readonly risk_score: string | number;
  readonly revoked_at: string | null;
  readonly revoked_reason: string | null;
}

interface WorkspaceSecuritySettingsRow {
  readonly workspace_id: string;
  readonly require_mfa_for_admins: boolean;
  readonly require_mfa_for_all: boolean;
  readonly allowed_email_domains: readonly string[] | null;
  readonly sso_required: boolean;
  readonly session_max_age_minutes: number;
  readonly idle_timeout_minutes: number;
  readonly allow_personal_api_tokens: boolean;
  readonly ai_sensitive_data_allowed: boolean;
  readonly external_delivery_requires_approval: boolean;
}

interface ReauthChallengeRow {
  readonly id: string;
  readonly challenge_type: 'password' | 'mfa' | 'sso';
  readonly reason: string;
  readonly expires_at: string;
  readonly verified_at: string | null;
  readonly token_hash: string | null;
  readonly status: 'pending' | 'verified' | 'expired' | 'cancelled';
}

@Injectable()
export class IdentityService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async bootstrap(
    actor: AuthenticatedActor,
    requestId: string | null,
    traceId: string | null,
  ) {
    await this.upsertProfile(actor);

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: null,
      action: 'auth.profile_bootstrapped',
      result: 'success',
      requestId,
      traceId,
      metadata: {
        emailConfirmed: Boolean(actor.emailConfirmedAt),
      },
    });

    return {
      status: 'ok' as const,
    };
  }

  async getSessionContext(
    actor: AuthenticatedActor,
    requestId: string,
    preferredWorkspaceId?: string,
  ): Promise<SessionContext> {
    const existingSession = await this.ensureSessionAvailable(actor);
    const profile = await this.upsertProfile(actor);
    const actorSummary = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      locale: profile.locale,
      timezone: profile.timezone,
      onboardingStatus: profile.onboarding_status,
    } as const;

    if (!actor.emailConfirmedAt) {
      await this.setOnboardingStatus(actor.id, 'email_unconfirmed');
      return {
        state: 'email_unconfirmed',
        requestId,
        actor: {
          ...actorSummary,
          onboardingStatus: 'email_unconfirmed',
        },
        activeWorkspace: null,
        workspaces: [],
        roles: [],
        permissions: [],
        featureFlags: this.getFeatureFlags(),
        dataPolicy: await this.getDataPolicy(),
        security: this.buildSecurityState(null, actor, existingSession, []),
      };
    }

    const workspaces = await this.authorizationService.listWorkspacesForUser(
      actor.id,
    );

    if (workspaces.length === 0) {
      await this.setOnboardingStatus(actor.id, 'new');
      return {
        state: 'needs_workspace',
        requestId,
        actor: {
          ...actorSummary,
          onboardingStatus: 'new',
        },
        activeWorkspace: null,
        workspaces,
        roles: [],
        permissions: [],
        featureFlags: this.getFeatureFlags(),
        dataPolicy: await this.getDataPolicy(),
        security: this.buildSecurityState(null, actor, existingSession, []),
      };
    }

    const activeWorkspace =
      this.pickWorkspace(
        workspaces,
        preferredWorkspaceId ?? profile.default_workspace_id ?? undefined,
      ) ?? workspaces[0];

    if (!activeWorkspace) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Workspace access is not available for the current actor.',
      );
    }

    const access = await this.authorizationService.getWorkspaceAccess(
      actor.id,
      activeWorkspace.id,
    );

    if (!access) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Requested workspace is not accessible.',
      );
    }

    await this.ensureDefaultWorkspace(actor.id, access.activeWorkspace.id);
    await this.setOnboardingStatus(actor.id, 'ready');
    const sessionRow = await this.upsertSession(
      actor,
      access.activeWorkspace.id,
      access.roles,
    );
    const settings = await this.getWorkspaceSecuritySettingsInternal(
      access.activeWorkspace.id,
    );

    const needsMfa =
      this.requiresMfaForAccess(settings, access.permissions, actor);

    return {
      state: needsMfa ? 'needs_mfa' : 'ready',
      requestId,
      actor: {
        ...actorSummary,
        onboardingStatus: 'ready',
      },
      activeWorkspace: access.activeWorkspace,
      workspaces,
      roles: access.roles,
      permissions: access.permissions,
      featureFlags: this.getFeatureFlags(),
      dataPolicy: await this.getDataPolicy(access.activeWorkspace.id),
      security: this.buildSecurityState(
        settings,
        actor,
        sessionRow,
        access.permissions,
      ),
    };
  }

  async resolveAccessContext(
    actor: AuthenticatedActor,
    preferredWorkspaceId?: string,
  ): Promise<AccessContext | null> {
    await this.ensureSessionAvailable(actor);
    const profile = await this.upsertProfile(actor);
    const workspaces = await this.authorizationService.listWorkspacesForUser(
      actor.id,
    );
    const candidateWorkspace =
      this.pickWorkspace(
        workspaces,
        preferredWorkspaceId ?? profile.default_workspace_id ?? undefined,
      ) ?? workspaces[0];

    if (!candidateWorkspace) {
      return null;
    }

    return this.authorizationService.getWorkspaceAccess(
      actor.id,
      candidateWorkspace.id,
    );
  }

  async getSecurityAccount(
    actor: AuthenticatedActor,
    preferredWorkspaceId?: string,
  ): Promise<SecurityAccountState> {
    const access = await this.resolveAccessContext(actor, preferredWorkspaceId);
    const session = await this.ensureSessionAvailable(actor);
    const settings = access?.activeWorkspace?.id
      ? await this.getWorkspaceSecuritySettingsInternal(access.activeWorkspace.id)
      : null;
    const activeSessionCount = await this.countActiveSessions(actor.id);

    return {
      userId: actor.id,
      email: actor.email,
      emailConfirmed: Boolean(actor.emailConfirmedAt),
      assuranceLevel: actor.assuranceLevel,
      mfaRequiredForAdminActions: this.requiresMfaForAccess(
        settings,
        access?.permissions ?? [],
        actor,
      ),
      currentRoles: access?.roles ?? [],
      activeSessionCount,
      ssoRequired: settings?.sso_required ?? false,
      sessionRisk: this.resolveRiskLevel(Number(session.risk_score ?? 0)),
    };
  }

  async listSecuritySessions(
    actor: AuthenticatedActor,
    access: AccessContext | null,
  ): Promise<readonly SecuritySessionSummary[]> {
    const canReadWorkspaceSessions = Boolean(
      access?.permissions.includes('session.read'),
    );
    const result = await this.databaseService.query<SessionRow>(
      `
        select
          id,
          user_id,
          workspace_id,
          created_at,
          last_seen_at,
          device_label,
          auth_provider,
          mfa_level,
          risk_score,
          revoked_at,
          revoked_reason
        from app.user_sessions
        where user_id = $1
          or ($2::uuid is not null and workspace_id = $2 and $3 = true)
        order by last_seen_at desc
      `,
      [actor.id, access?.activeWorkspace?.id ?? null, canReadWorkspaceSessions],
    );

    return result.rows.map((row) => this.mapSessionRow(row));
  }

  async revokeSession(
    actor: AuthenticatedActor,
    access: AccessContext,
    sessionId: string,
    reason: string | null,
    requestId: string | null,
    traceId: string | null,
  ): Promise<{ readonly status: 'revoked' }> {
    const row = await this.databaseService.one<SessionRow>(
      `
        update app.user_sessions
        set
          revoked_at = timezone('utc', now()),
          revoked_reason = $2
        where id = $1
          and (
            user_id = $3
            or workspace_id = $4
          )
        returning
          id,
          user_id,
          workspace_id,
          created_at,
          last_seen_at,
          device_label,
          auth_provider,
          mfa_level,
          risk_score,
          revoked_at,
          revoked_reason
      `,
      [sessionId, reason ?? 'revoked_by_admin', actor.id, access.activeWorkspace?.id],
    );

    if (!row) {
      throw new AppHttpException(
        'SESSION_INVALID',
        404,
        'Security session was not found.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'auth.session_revoked',
      entityType: 'user_session',
      entityId: sessionId,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'auth',
      sessionId: actor.sessionId,
      metadata: {
        reason: row.revoked_reason,
      },
    });

    return { status: 'revoked' };
  }

  async revokeAllSessionsForUser(
    actor: AuthenticatedActor,
    access: AccessContext,
    userId: string,
    reason: string | null,
    requestId: string | null,
    traceId: string | null,
  ): Promise<{ readonly status: 'revoked'; readonly updatedCount: number }> {
    const result = await this.databaseService.query(
      `
        update app.user_sessions
        set
          revoked_at = timezone('utc', now()),
          revoked_reason = $3
        where user_id = $1
          and ($2::uuid is null or workspace_id = $2)
          and revoked_at is null
      `,
      [userId, access.activeWorkspace?.id ?? null, reason ?? 'revoked_all_by_admin'],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'auth.session_revoke_all',
      entityType: 'profile',
      entityId: userId,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'auth',
      sessionId: actor.sessionId,
      metadata: {
        updatedCount: result.rowCount ?? 0,
      },
    });

    return {
      status: 'revoked',
      updatedCount: result.rowCount ?? 0,
    };
  }

  async getWorkspaceSecuritySettings(
    workspaceId: string,
  ): Promise<WorkspaceSecuritySettings> {
    const row = await this.getWorkspaceSecuritySettingsInternal(workspaceId);
    return this.mapWorkspaceSecuritySettings(row, workspaceId);
  }

  async updateWorkspaceSecuritySettings(
    actor: AuthenticatedActor,
    workspaceId: string,
    input: WorkspaceSecuritySettingsUpdateRequest,
    requestId: string | null,
    traceId: string | null,
  ): Promise<WorkspaceSecuritySettings> {
    const current = await this.getWorkspaceSecuritySettingsInternal(workspaceId);
    const row = await this.databaseService.one<WorkspaceSecuritySettingsRow>(
      `
        insert into app.workspace_security_settings (
          workspace_id,
          require_mfa_for_admins,
          require_mfa_for_all,
          allowed_email_domains,
          sso_required,
          session_max_age_minutes,
          idle_timeout_minutes,
          allow_personal_api_tokens,
          ai_sensitive_data_allowed,
          external_delivery_requires_approval
        )
        values ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10)
        on conflict (workspace_id) do update
        set
          require_mfa_for_admins = excluded.require_mfa_for_admins,
          require_mfa_for_all = excluded.require_mfa_for_all,
          allowed_email_domains = excluded.allowed_email_domains,
          sso_required = excluded.sso_required,
          session_max_age_minutes = excluded.session_max_age_minutes,
          idle_timeout_minutes = excluded.idle_timeout_minutes,
          allow_personal_api_tokens = excluded.allow_personal_api_tokens,
          ai_sensitive_data_allowed = excluded.ai_sensitive_data_allowed,
          external_delivery_requires_approval = excluded.external_delivery_requires_approval,
          updated_at = timezone('utc', now())
        returning
          workspace_id,
          require_mfa_for_admins,
          require_mfa_for_all,
          allowed_email_domains,
          sso_required,
          session_max_age_minutes,
          idle_timeout_minutes,
          allow_personal_api_tokens,
          ai_sensitive_data_allowed,
          external_delivery_requires_approval
      `,
      [
        workspaceId,
        input.requireMfaForAdmins ?? current?.require_mfa_for_admins ?? true,
        input.requireMfaForAll ?? current?.require_mfa_for_all ?? false,
        [...(input.allowedEmailDomains ?? current?.allowed_email_domains ?? [])],
        input.ssoRequired ?? current?.sso_required ?? false,
        input.sessionMaxAgeMinutes ??
          current?.session_max_age_minutes ??
          this.env.LEXFRAME_DEFAULT_SESSION_MAX_AGE_MINUTES,
        input.idleTimeoutMinutes ??
          current?.idle_timeout_minutes ??
          this.env.LEXFRAME_DEFAULT_IDLE_TIMEOUT_MINUTES,
        input.allowPersonalApiTokens ??
          current?.allow_personal_api_tokens ??
          false,
        input.aiSensitiveDataAllowed ??
          current?.ai_sensitive_data_allowed ??
          false,
        input.externalDeliveryRequiresApproval ??
          current?.external_delivery_requires_approval ??
          true,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Workspace security settings update did not return a row.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'security.policy_changed',
      entityType: 'workspace_security_settings',
      entityId: workspaceId,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'admin',
      sessionId: actor.sessionId,
      metadata: {
        updatedFields: Object.keys(input),
      },
    });

    return this.mapWorkspaceSecuritySettings(row, workspaceId);
  }

  async createReauthChallenge(
    actor: AuthenticatedActor,
    access: AccessContext | null,
    input: CreateReauthChallengeRequest,
  ): Promise<ReauthChallenge> {
    const challenge = await this.databaseService.one<ReauthChallengeRow>(
      `
        insert into app.reauth_challenges (
          user_id,
          workspace_id,
          session_id,
          challenge_type,
          reason,
          expires_at
        )
        values ($1, $2, $3, $4, $5, timezone('utc', now()) + interval '15 minutes')
        returning
          id,
          challenge_type,
          reason,
          expires_at,
          verified_at,
          token_hash,
          status
      `,
      [
        actor.id,
        access?.activeWorkspace?.id ?? null,
        actor.sessionId,
        input.challengeType ?? (actor.assuranceLevel === 'aal2' ? 'mfa' : 'password'),
        input.reason,
      ],
    );

    if (!challenge) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Reauth challenge could not be created.',
      );
    }

    return this.mapReauthChallenge(challenge, null);
  }

  async verifyReauthChallenge(
    actor: AuthenticatedActor,
    challengeId: string,
    verificationCode: string,
  ): Promise<ReauthChallenge> {
    if (verificationCode.trim().length === 0) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Verification code is required.',
      );
    }

    const token = `${actor.sessionId}.${challengeId}.${Date.now()}`;
    const row = await this.databaseService.one<ReauthChallengeRow>(
      `
        update app.reauth_challenges
        set
          status = 'verified',
          token_hash = md5($3),
          verified_at = timezone('utc', now())
        where id = $1
          and user_id = $2
          and status = 'pending'
          and expires_at > timezone('utc', now())
        returning
          id,
          challenge_type,
          reason,
          expires_at,
          verified_at,
          token_hash,
          status
      `,
      [challengeId, actor.id, token],
    );

    if (!row) {
      throw new AppHttpException(
        'REAUTH_REQUIRED',
        403,
        'Reauthentication challenge is invalid or expired.',
      );
    }

    return this.mapReauthChallenge(row, token);
  }

  async validateReauthToken(
    actor: AuthenticatedActor,
    token: string,
  ): Promise<boolean> {
    const row = await this.databaseService.one<{ readonly ok: boolean }>(
      `
        select exists(
          select 1
          from app.reauth_challenges
          where user_id = $1
            and session_id = $2
            and status = 'verified'
            and token_hash = md5($3)
            and expires_at > timezone('utc', now())
        ) as ok
      `,
      [actor.id, actor.sessionId, token],
    );

    return Boolean(row?.ok);
  }

  private async upsertProfile(actor: AuthenticatedActor): Promise<ProfileRow> {
    await this.ensureAuthUser(actor);

    const result = await this.databaseService.query<ProfileRow>(
      `
        insert into app.profiles (
          id,
          email,
          full_name,
          onboarding_status,
          locale,
          timezone
        )
        values ($1, $2, $3, $4, 'ru', 'Europe/Berlin')
        on conflict (id) do update
        set
          email = excluded.email,
          full_name = excluded.full_name,
          updated_at = timezone('utc', now())
        returning
          id,
          email,
          full_name,
          default_workspace_id,
          onboarding_status,
          locale,
          timezone
      `,
      [
        actor.id,
        actor.email,
        actor.fullName,
        actor.emailConfirmedAt ? 'new' : 'email_unconfirmed',
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Profile provisioning did not return a profile row.',
      );
    }

    return row;
  }

  private async ensureAuthUser(actor: AuthenticatedActor): Promise<void> {
    await this.databaseService.query(
      `
        insert into auth.users (
          id,
          email,
          raw_user_meta_data,
          email_confirmed_at,
          created_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3::jsonb,
          $4::timestamptz,
          timezone('utc', now()),
          timezone('utc', now())
        )
        on conflict (id) do update
        set
          email = excluded.email,
          raw_user_meta_data = auth.users.raw_user_meta_data || excluded.raw_user_meta_data,
          email_confirmed_at = coalesce(
            excluded.email_confirmed_at,
            auth.users.email_confirmed_at
          ),
          updated_at = timezone('utc', now())
      `,
      [
        actor.id,
        actor.email,
        JSON.stringify({
          full_name: actor.fullName,
        }),
        actor.emailConfirmedAt,
      ],
    );
  }

  private async ensureSessionAvailable(
    actor: AuthenticatedActor,
  ): Promise<SessionRow> {
    const session = await this.upsertSession(actor, null, []);

    if (session.revoked_at) {
      throw new AppHttpException(
        'SESSION_INVALID',
        401,
        'Session has been revoked.',
      );
    }

    return session;
  }

  private async upsertSession(
    actor: AuthenticatedActor,
    workspaceId: string | null,
    roles: readonly string[],
  ): Promise<SessionRow> {
    const row = await this.databaseService.one<SessionRow>(
      `
        insert into app.user_sessions (
          id,
          user_id,
          workspace_id,
          device_label,
          auth_provider,
          mfa_level,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        on conflict (id) do update
        set
          workspace_id = excluded.workspace_id,
          last_seen_at = timezone('utc', now()),
          auth_provider = excluded.auth_provider,
          mfa_level = excluded.mfa_level,
          metadata = app.user_sessions.metadata || excluded.metadata
        returning
          id,
          user_id,
          workspace_id,
          created_at,
          last_seen_at,
          device_label,
          auth_provider,
          mfa_level,
          risk_score,
          revoked_at,
          revoked_reason
      `,
      [
        actor.sessionId,
        actor.id,
        workspaceId,
        actor.fullName ? `${actor.fullName} session` : 'browser session',
        actor.accessToken.startsWith('dev.') ? 'dev' : 'supabase',
        actor.assuranceLevel,
        JSON.stringify({
          roles,
        }),
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        500,
        'Session registry upsert did not return a row.',
      );
    }

    return row;
  }

  private async ensureDefaultWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        update app.profiles
        set
          default_workspace_id = $2,
          updated_at = timezone('utc', now())
        where id = $1
          and default_workspace_id is distinct from $2
      `,
      [userId, workspaceId],
    );
  }

  private async setOnboardingStatus(
    userId: string,
    onboardingStatus: ProfileRow['onboarding_status'],
  ): Promise<void> {
    await this.databaseService.query(
      `
        update app.profiles
        set
          onboarding_status = $2,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [userId, onboardingStatus],
    );
  }

  private pickWorkspace(
    workspaces: SessionContext['workspaces'],
    preferredWorkspaceId?: string,
  ) {
    if (!preferredWorkspaceId) {
      return null;
    }

    return (
      workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ??
      null
    );
  }

  private getFeatureFlags(): readonly string[] {
    return [
      'stage1.multi-tenant-foundation',
      'stage1.workspace-rbac',
      'stage1.audit-preview',
      'stage5.ai-gateway',
      'stage5.ai-chat',
      'stage5.workflow-drafts',
      'stage11.security-control-plane',
    ];
  }

  private async getDataPolicy(workspaceId?: string | null) {
    if (!workspaceId) {
      return {
        aiAllowed: false,
        directSupabaseRead: false,
        externalDeliveryRequiresApproval: true,
      } as const;
    }

    const result = await this.databaseService.query<WorkspaceAiPolicyRow>(
      `
        select ai_enabled
        from app.workspace_ai_policies
        where workspace_id = $1
      `,
      [workspaceId],
    );
    const row = result.rows[0];

    return {
      aiAllowed: row?.ai_enabled ?? true,
      directSupabaseRead: false,
      externalDeliveryRequiresApproval: true,
    } as const;
  }

  private async getWorkspaceSecuritySettingsInternal(
    workspaceId: string,
  ): Promise<WorkspaceSecuritySettingsRow | null> {
    return this.databaseService.one<WorkspaceSecuritySettingsRow>(
      `
        select
          workspace_id,
          require_mfa_for_admins,
          require_mfa_for_all,
          allowed_email_domains,
          sso_required,
          session_max_age_minutes,
          idle_timeout_minutes,
          allow_personal_api_tokens,
          ai_sensitive_data_allowed,
          external_delivery_requires_approval
        from app.workspace_security_settings
        where workspace_id = $1
        limit 1
      `,
      [workspaceId],
    );
  }

  private requiresMfaForAccess(
    settings: WorkspaceSecuritySettingsRow | null,
    permissions: readonly string[],
    actor: AuthenticatedActor,
  ): boolean {
    const requiresByRole =
      settings?.require_mfa_for_all ||
      (settings?.require_mfa_for_admins !== false &&
        permissions.some((permission) =>
          [
            'workspace.member.update_role',
            'workspace.member.remove',
            'workspace.security.manage',
            'audit.read',
            'audit.export',
            'secret.rotate',
          ].includes(permission),
        )) ||
      this.env.LEXFRAME_REQUIRE_MFA_FOR_ADMIN_ACTIONS === '1';

    return Boolean(requiresByRole && actor.assuranceLevel !== 'aal2');
  }

  private buildSecurityState(
    settings: WorkspaceSecuritySettingsRow | null,
    actor: AuthenticatedActor,
    session: SessionRow,
    permissions: readonly string[],
  ): SessionContext['security'] {
    return {
      mfaRequired: this.requiresMfaForAccess(settings, permissions, actor),
      ssoRequired: settings?.sso_required ?? false,
      sessionRisk: this.resolveRiskLevel(Number(session.risk_score ?? 0)),
      adminActionsRequireReauth:
        this.env.LEXFRAME_REQUIRE_REAUTH_FOR_ADMIN_ACTIONS === '1',
      aiSensitiveDataPolicy: settings?.ai_sensitive_data_allowed
        ? 'allow'
        : this.env.LEXFRAME_AI_SENSITIVE_DATA_POLICY,
      externalDeliveryRequiresApproval:
        settings?.external_delivery_requires_approval ?? true,
    };
  }

  private resolveRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 70) {
      return 'high';
    }

    if (score >= 30) {
      return 'medium';
    }

    return 'low';
  }

  private async countActiveSessions(userId: string): Promise<number> {
    const row = await this.databaseService.one<{ readonly total: string | number }>(
      `
        select count(*) as total
        from app.user_sessions
        where user_id = $1
          and revoked_at is null
      `,
      [userId],
    );

    return Number(row?.total ?? 0);
  }

  private mapSessionRow(row: SessionRow): SecuritySessionSummary {
    const riskScore = Number(row.risk_score ?? 0);
    return {
      id: row.id,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      deviceLabel: row.device_label,
      authProvider: row.auth_provider,
      mfaLevel: row.mfa_level,
      riskScore,
      riskLevel: this.resolveRiskLevel(riskScore),
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
    };
  }

  private mapWorkspaceSecuritySettings(
    row: WorkspaceSecuritySettingsRow | null,
    workspaceId: string,
  ): WorkspaceSecuritySettings {
    return {
      workspaceId,
      requireMfaForAdmins: row?.require_mfa_for_admins ?? true,
      requireMfaForAll: row?.require_mfa_for_all ?? false,
      allowedEmailDomains: row?.allowed_email_domains ?? [],
      ssoRequired: row?.sso_required ?? false,
      sessionMaxAgeMinutes:
        row?.session_max_age_minutes ??
        this.env.LEXFRAME_DEFAULT_SESSION_MAX_AGE_MINUTES,
      idleTimeoutMinutes:
        row?.idle_timeout_minutes ??
        this.env.LEXFRAME_DEFAULT_IDLE_TIMEOUT_MINUTES,
      allowPersonalApiTokens: row?.allow_personal_api_tokens ?? false,
      aiSensitiveDataAllowed: row?.ai_sensitive_data_allowed ?? false,
      externalDeliveryRequiresApproval:
        row?.external_delivery_requires_approval ?? true,
    };
  }

  private mapReauthChallenge(
    row: ReauthChallengeRow,
    token: string | null,
  ): ReauthChallenge {
    return {
      id: row.id,
      challengeType: row.challenge_type,
      reason: row.reason,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at,
      token,
    };
  }
}
