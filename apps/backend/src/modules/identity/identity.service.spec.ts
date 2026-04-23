import type { WorkspaceSummary } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { IdentityService } from './identity.service';

type QueryResult<T> = {
  readonly rows: readonly T[];
};

describe('IdentityService', () => {
  const baseActor: AuthenticatedActor = {
    id: 'usr_stage1_owner',
    email: 'owner@lexframe.local',
    fullName: 'Owner User',
    emailConfirmedAt: '2026-04-21T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_stage1_owner',
  };

  const workspace: WorkspaceSummary = {
    id: 'ws_stage1_main',
    slug: 'stage1-main',
    name: 'Stage 1 Main',
    status: 'active',
    role: 'owner',
  };

  const accessContext: AccessContext = {
    activeWorkspace: workspace,
    roles: ['owner'],
    permissions: [
      'workspace.read',
      'workspace.switch',
      'workspace.member.update_role',
      'audit.read',
    ],
  };

  const profileRow = {
    id: baseActor.id,
    email: baseActor.email,
    full_name: baseActor.fullName,
    default_workspace_id: null,
    onboarding_status: 'new' as const,
    locale: 'ru',
    timezone: 'Europe/Berlin',
  };

  function createService() {
    const sessionRow = {
      id: baseActor.sessionId,
      user_id: baseActor.id,
      workspace_id: null,
      created_at: '2026-04-22T09:00:00.000Z',
      last_seen_at: '2026-04-22T09:00:00.000Z',
      device_label: 'Owner User session',
      auth_provider: 'dev',
      mfa_level: baseActor.assuranceLevel,
      risk_score: 0,
      revoked_at: null,
      revoked_reason: null,
    };
    const databaseService = {
      query: jest.fn((sql: string): Promise<QueryResult<typeof profileRow>> => {
        if (sql.includes('insert into app.profiles')) {
          return Promise.resolve({
            rows: [profileRow],
          });
        }

        return Promise.resolve({
          rows: [],
        });
      }),
      one: jest.fn((sql: string) => {
        if (sql.includes('insert into app.user_sessions')) {
          return Promise.resolve(sessionRow);
        }

        return Promise.resolve(null);
      }),
    };

    const authorizationService = {
      listWorkspacesForUser: jest.fn<
        Promise<readonly WorkspaceSummary[]>,
        [string]
      >(),
      getWorkspaceAccess: jest.fn<
        Promise<AccessContext | null>,
        [string, string]
      >(),
    };

    const auditService = {
      record: jest.fn(),
    };

    return {
      service: new IdentityService(
        databaseService as never,
        authorizationService as never,
        auditService as never,
      ),
      databaseService,
      authorizationService,
      auditService,
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.LEXFRAME_REQUIRE_MFA_FOR_ADMIN_ACTIONS = '0';
  });

  it('returns email_unconfirmed when the actor has not confirmed email', async () => {
    const { service, authorizationService } = createService();

    const result = await service.getSessionContext(
      {
        ...baseActor,
        emailConfirmedAt: null,
      },
      'req_email_pending',
    );

    expect(result.state).toBe('email_unconfirmed');
    expect(result.activeWorkspace).toBeNull();
    expect(result.actor?.onboardingStatus).toBe('email_unconfirmed');
    expect(authorizationService.listWorkspacesForUser).not.toHaveBeenCalled();
  });

  it('returns needs_workspace when the actor has no memberships yet', async () => {
    const { service, authorizationService } = createService();
    authorizationService.listWorkspacesForUser.mockResolvedValue([]);

    const result = await service.getSessionContext(
      baseActor,
      'req_needs_workspace',
    );

    expect(result.state).toBe('needs_workspace');
    expect(result.workspaces).toHaveLength(0);
    expect(result.permissions).toHaveLength(0);
    expect(result.actor?.onboardingStatus).toBe('new');
  });

  it('returns needs_mfa for privileged actors when MFA is required', async () => {
    process.env.LEXFRAME_REQUIRE_MFA_FOR_ADMIN_ACTIONS = '1';

    const { service, authorizationService } = createService();
    authorizationService.listWorkspacesForUser.mockResolvedValue([workspace]);
    authorizationService.getWorkspaceAccess.mockResolvedValue(accessContext);

    const result = await service.getSessionContext(baseActor, 'req_needs_mfa');

    expect(result.state).toBe('needs_mfa');
    expect(result.activeWorkspace?.id).toBe(workspace.id);
    expect(result.roles).toEqual(['owner']);
    expect(result.permissions).toContain('workspace.member.update_role');
  });
});
