import type {
  CreateWorkspaceInvitationRequest,
  UpdateWorkspaceMemberRoleRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  const actor: AuthenticatedActor = {
    id: 'usr_stage1_owner',
    email: 'owner@lexframe.local',
    fullName: 'Owner User',
    emailConfirmedAt: '2026-04-21T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_stage1_owner',
  };

  const access: AccessContext = {
    activeWorkspace: {
      id: 'ws_stage1_main',
      slug: 'stage1-main',
      name: 'Stage 1 Main',
      status: 'active',
      role: 'owner',
    },
    roles: ['owner'],
    permissions: [
      'workspace.invite',
      'workspace.member.update_role',
      'workspace.member.remove',
    ],
  };

  function createService() {
    const authorizationService = {
      listWorkspacesForUser: jest.fn(),
      getWorkspaceAccess: jest.fn(),
    };
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const identityService = {
      getSessionContext: jest.fn(),
    };
    const auditService = {
      record: jest.fn(),
    };
    const rateLimitService = {
      assertWithinLimit: jest.fn(),
    };

    return {
      service: new WorkspacesService(
        authorizationService as never,
        databaseService as never,
        identityService as never,
        auditService as never,
        rateLimitService as never,
      ),
      authorizationService,
      databaseService,
      identityService,
      auditService,
      rateLimitService,
    };
  }

  async function expectAppError(
    promise: Promise<unknown>,
    code: string,
    status: number,
  ) {
    try {
      await promise;
      throw new Error('Expected AppHttpException to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpException);
      expect((error as AppHttpException).code).toBe(code);
      expect((error as AppHttpException).getStatus()).toBe(status);
    }
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns mock invite preview while persisting only the token hash', async () => {
    const { service, databaseService, auditService } = createService();
    const input: CreateWorkspaceInvitationRequest = {
      email: 'Viewer@LexFrame.Local ',
      role: 'viewer',
    };

    databaseService.one.mockResolvedValue({
      id: 'inv_stage1_01',
      email: 'viewer@lexframe.local',
      role_code: 'viewer',
      status: 'pending',
      expires_at: '2026-04-28T09:00:00.000Z',
      created_at: '2026-04-21T09:00:00.000Z',
      accepted_at: null,
      revoked_at: null,
    });

    const result = await service.createInvitation(
      actor,
      access,
      access.activeWorkspace!.id,
      input,
      {
        requestId: 'req_invite',
        traceId: 'trace_invite',
      },
      'http://127.0.0.1:3000',
    );

    const [, params] = databaseService.one.mock.calls[0] as [string, unknown[]];

    expect(params[2]).toBe('viewer@lexframe.local');
    expect(params[4]).toMatch(/^[a-f0-9]{64}$/);
    expect(result.deliveryMode).toBe('mock');
    expect(result.deliveryPreview?.acceptUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:3000\/invite\//,
    );
    expect(result.deliveryPreview?.acceptToken).toBeTruthy();
    expect(params[4]).not.toBe(result.deliveryPreview?.acceptToken);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('blocks demoting the last remaining owner', async () => {
    const { service, databaseService, auditService } = createService();
    const input: UpdateWorkspaceMemberRoleRequest = {
      role: 'admin',
    };

    databaseService.one
      .mockResolvedValueOnce({
        id: 'member_owner',
        auth_user_id: actor.id,
        email: actor.email,
        full_name: actor.fullName,
        role_code: 'owner',
        status: 'active',
        created_at: '2026-04-21T09:00:00.000Z',
        last_active_at: null,
      })
      .mockResolvedValueOnce({
        owner_count: '1',
      });

    await expectAppError(
      service.changeMemberRole(
        actor,
        access,
        access.activeWorkspace!.id,
        'member_owner',
        input,
        {
          requestId: 'req_role_change',
          traceId: 'trace_role_change',
        },
      ),
      'VALIDATION_ERROR',
      409,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects invitation acceptance when the token email does not match the actor', async () => {
    const { service, databaseService, identityService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'inv_stage1_02',
      workspace_id: access.activeWorkspace!.id,
      email: 'another.user@lexframe.local',
      role_code: 'viewer',
      status: 'pending',
      invitation_token_hash: 'deadbeef',
      expires_at: '2099-04-28T09:00:00.000Z',
      created_at: '2026-04-21T09:00:00.000Z',
      accepted_at: null,
      revoked_at: null,
    });

    await expectAppError(
      service.acceptInvitation(actor, 'raw-token', {
        requestId: 'req_accept',
        traceId: 'trace_accept',
      }),
      'PERMISSION_DENIED',
      403,
    );

    expect(identityService.getSessionContext).not.toHaveBeenCalled();
  });
});
