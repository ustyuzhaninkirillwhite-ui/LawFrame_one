import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';

jest.mock('jose', () => ({
  SignJWT: jest.fn(),
}));

import { ActivepiecesSessionService } from './activepieces-session.service';

describe('ActivepiecesSessionService', () => {
  it('returns an open_check with the verified ActivePieces project and flow', async () => {
    const databaseService = {
      one: jest
        .fn()
        .mockResolvedValueOnce({
          workspace_id: 'ws_1',
          token_ttl_seconds: 120,
          pieces_filter_type: 'ALLOWED',
          pieces_tags: [],
          incident_lock_active: false,
        })
        .mockResolvedValueOnce({
          id: 'aut_1',
          workspace_id: 'ws_1',
          template_id: 'tpl_1',
          source_template_version_id: 'tplv_1',
          title: 'Automation',
          version: '1',
          workflow_state: 'compiled',
          builder_state: 'ready',
          sync_state: 'synced',
          compatibility_status: 'compatible',
          available: true,
          workflow: {},
          active_canvas_version_id: 'apversion000000000000',
          production_disabled_at: null,
          production_disabled_reason: null,
          runtime_project_id: 'approject000000000000',
          runtime_flow_id: 'apflow000000000000000',
          sync_hash: 'stage21-activepieces-0.82-canvas-v1',
        }),
      query: jest.fn(),
    };
    const identityBridge = {
      ensureProjectBinding: jest.fn(() =>
        Promise.resolve({
          id: 'project_binding_1',
          externalProjectId: 'lex_ws_1',
          activepiecesProjectId: 'approject000000000000',
        }),
      ),
      ensureUserBinding: jest.fn(() =>
        Promise.resolve({
          id: 'user_binding_1',
          externalUserId: 'lex_user_1',
          activepiecesUserId: 'apuser000000000000000',
          activepiecesRole: 'EDITOR',
        }),
      ),
      ensureProjectMembership: jest.fn(() => Promise.resolve()),
    };
    const service = new ActivepiecesSessionService(
      databaseService as never,
      {
        mapAutomationCanvasRole: jest.fn(() => ({
          role: 'EDITOR',
          permissions: {
            can_view: true,
            can_edit: true,
            can_manage_connections: false,
            can_open_diagnostics: true,
          },
          downgradeReason: null,
        })),
      } as never,
      {
        buildAutomationCanvasPolicy: jest.fn(() => ({
          piecesFilterType: 'ALLOWED',
          piecesTags: [],
          denylistedPieces: [],
          policyHash: 'sha256:policy',
        })),
      } as never,
      identityBridge as never,
      {
        ensureStage17Canvas: jest.fn(() =>
          Promise.resolve({
            status: 'ready',
            readiness_code: 'READY',
            automation_id: 'aut_1',
            project_id: 'project_claim_001',
            route:
              '/app/projects/project_claim_001/automations/aut_1/automation',
            activepieces_project_id: 'approject000000000000',
            activepieces_flow_id: 'apflow000000000000000',
            activepieces_flow_version_id: 'apversion000000000000',
          }),
        ),
      } as never,
      {
        ensureFlowBinding: jest.fn(() =>
          Promise.resolve({
            automationId: 'aut_1',
            activepiecesProjectId: 'approject000000000000',
            activepiecesFlowId: 'apflow000000000000000',
            activepiecesFlowVersionId: 'apversion000000000000',
            syncStatus: 'synced',
            syncHash: 'stage21-activepieces-0.82-canvas-v1',
          }),
        ),
      } as never,
      {
        validate: jest.fn(() =>
          Promise.resolve({
            status: 'ready',
            reason_code: 'READY',
            readiness_code: 'READY',
            activepieces_project_id: 'approject000000000000',
            activepieces_flow_id: 'apflow000000000000000',
            activepieces_flow_version_id: 'apversion000000000000',
            readiness_version: 'readiness_1',
            activepieces_version: '0.82.0',
            embed_sdk_version: '0.9.0',
            expected_route: '/flows/apflow000000000000000',
            refresh_policy: {
              strategy: 'no_foreground_refresh',
              recover_on: ['auth', 'invalid_access', 'stuck_loading'],
            },
            repair_attempted: false,
            checked_at: '2026-05-08T10:00:00.000Z',
            checks: [],
            message: null,
          }),
        ),
        toOpenCheck: jest.fn((readiness: unknown) => readiness),
      } as never,
      {
        issue: jest.fn(() =>
          Promise.resolve({
            jwtToken: 'jwt_1',
            tokenHash: 'hash_token_1',
            jtiHash: 'hash_jti_1',
          }),
        ),
      } as never,
      {
        record: jest.fn(() => Promise.resolve()),
      } as never,
      {
        getSafeStatus: jest.fn(() => ({ status: 'ready' })),
      } as never,
    );

    const response = await service.createSession(
      actor(),
      access(),
      {
        workspaceId: 'ws_1',
        projectId: 'project_claim_001',
        automationId: 'aut_1',
        purpose: 'automation_canvas',
        clientRoute:
          '/app/projects/project_claim_001/automations/aut_1/automation',
        modePreference: 'auto',
        returnBuilderConfig: true,
        clientTraceId: 'trace_1',
      },
      {
        requestId: 'req_1',
        traceId: 'trace_1',
      },
    );

    expect(response).toMatchObject({
      status: 'ready',
      expected_route: '/flows/apflow000000000000000',
      refresh_policy: {
        strategy: 'no_foreground_refresh',
        recover_on: ['auth', 'invalid_access', 'stuck_loading'],
      },
      open_check: {
        status: 'ready',
        reason_code: 'READY',
        activepieces_project_id: 'approject000000000000',
        activepieces_flow_id: 'apflow000000000000000',
        expected_route: '/flows/apflow000000000000000',
        refresh_policy: {
          strategy: 'no_foreground_refresh',
          recover_on: ['auth', 'invalid_access', 'stuck_loading'],
        },
        repair_attempted: false,
        checked_at: expect.any(String),
      },
    });
    expect(identityBridge.ensureProjectMembership).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      projectBinding: {
        id: 'project_binding_1',
        externalProjectId: 'lex_ws_1',
        activepiecesProjectId: 'approject000000000000',
      },
      userBinding: {
        id: 'user_binding_1',
        externalUserId: 'lex_user_1',
        activepiecesUserId: 'apuser000000000000000',
        activepiecesRole: 'EDITOR',
      },
      role: 'EDITOR',
      traceId: 'trace_1',
    });
  });

  it('records iframe health without reprovisioning an ActivePieces session', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: 'sess_1',
        initialized_at: '2026-05-08T10:00:00.000Z',
        installed_automation_id: 'aut_1',
      }),
      query: jest.fn(),
    };
    const auditWriter = {
      record: jest.fn(() => Promise.resolve()),
    };
    const service = new ActivepiecesSessionService(
      databaseService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      auditWriter as never,
      {} as never,
    );

    const response = await service.recordIframeHealth(
      actor(),
      access(),
      'sess_1',
      {
        event: 'stuck_loading',
        details: {
          spinnerMs: 16_000,
        },
      },
      {
        requestId: 'req_1',
        traceId: 'trace_1',
      },
    );

    expect(response).toEqual({
      status: 'recorded',
      session_id: 'sess_1',
      event: 'stuck_loading',
      recorded_at: expect.any(String),
    });
    expect(auditWriter.record).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: 'aut_1',
        sessionId: 'sess_1',
        action: 'canvas.iframe.stuck_loading',
        result: 'error',
        reasonCode: 'AP_IFRAME_NAVIGATION_FAILED',
      }),
    );
  });
});

function actor(): AuthenticatedActor {
  return {
    id: 'user_1',
    email: 'owner@lexframe.test',
    fullName: 'Owner',
    emailConfirmedAt: '2026-05-08T10:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'access',
    sessionId: 'session_1',
  };
}

function access(): AccessContext {
  return {
    activeWorkspace: {
      id: 'ws_1',
      slug: 'workspace',
      name: 'Workspace',
      status: 'active',
      role: 'owner',
    },
    roles: ['owner'],
    permissions: ['activepieces.open_builder'],
  };
}
