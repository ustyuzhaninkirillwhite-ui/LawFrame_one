import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';

type MockSignJwtChain = {
  setProtectedHeader(): MockSignJwtChain;
  setIssuedAt(): MockSignJwtChain;
  setIssuer(): MockSignJwtChain;
  setAudience(): MockSignJwtChain;
  setSubject(): MockSignJwtChain;
  setJti(): MockSignJwtChain;
  setExpirationTime(): MockSignJwtChain;
  sign(): Promise<string>;
};

const mockSignJwtChain: MockSignJwtChain = {
  setProtectedHeader() {
    return mockSignJwtChain;
  },
  setIssuedAt() {
    return mockSignJwtChain;
  },
  setIssuer() {
    return mockSignJwtChain;
  },
  setAudience() {
    return mockSignJwtChain;
  },
  setSubject() {
    return mockSignJwtChain;
  },
  setJti() {
    return mockSignJwtChain;
  },
  setExpirationTime() {
    return mockSignJwtChain;
  },
  sign() {
    return Promise.resolve('stage4-mock-token');
  },
};

jest.mock('jose', () => ({
  importPKCS8: jest.fn(),
  SignJWT: jest.fn(() => mockSignJwtChain),
}));
import { ActivepiecesService } from './activepieces.service';

describe('ActivepiecesService', () => {
  const originalEnv = {
    ACTIVEPIECES_API_KEY: process.env.ACTIVEPIECES_API_KEY,
    ACTIVEPIECES_SIGNING_PRIVATE_KEY:
      process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
    ACTIVEPIECES_SIMULATE_RUNS: process.env.ACTIVEPIECES_SIMULATE_RUNS,
  };

  const actor: AuthenticatedActor = {
    id: 'usr_stage4_owner',
    email: 'owner@lexframe.local',
    fullName: 'Owner User',
    emailConfirmedAt: '2026-04-23T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_stage4_owner',
  };

  const access: AccessContext = {
    activeWorkspace: {
      id: 'ws_stage4_main',
      slug: 'stage4-main',
      name: 'Stage 4 Main',
      status: 'active',
      role: 'owner',
    },
    roles: ['owner'],
    permissions: [
      'automation.read',
      'automation.run',
      'activepieces.open_builder',
      'activepieces.sync_flow',
      'document.read',
      'document.upload',
    ],
  };

  function createService() {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const auditService = {
      record: jest.fn(),
    };
    const documentsService = {
      createRunArtifact: jest.fn(),
    };
    const approvalsService = {
      createRuntimeTask: jest.fn(),
    };
    const deliveryService = {
      createRuntimeRequest: jest.fn(),
    };
    const liveEventsService = {
      recordEvent: jest.fn(),
    };
    const activepiecesSessionService = {
      createSession: jest.fn(),
      initializeSession: jest.fn(),
    };

    return {
      service: new ActivepiecesService(
        databaseService as never,
        auditService as never,
        documentsService as never,
        approvalsService as never,
        deliveryService as never,
        liveEventsService as never,
        undefined,
        undefined,
        activepiecesSessionService as never,
      ),
      databaseService,
      auditService,
      activepiecesSessionService,
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.ACTIVEPIECES_API_KEY = 'test_activepieces_api_key_12345';
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY =
      'test_activepieces_signing_key_12345';
    process.env.ACTIVEPIECES_SIMULATE_RUNS = '0';
  });

  afterAll(() => {
    process.env.ACTIVEPIECES_API_KEY = originalEnv.ACTIVEPIECES_API_KEY;
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY =
      originalEnv.ACTIVEPIECES_SIGNING_PRIVATE_KEY;
    process.env.ACTIVEPIECES_SIMULATE_RUNS =
      originalEnv.ACTIVEPIECES_SIMULATE_RUNS;
  });

  it('reports the canonical smoke preset in the integration status', async () => {
    const { service } = createService();

    jest.spyOn(service, 'getWorkspaceSecurityOverview').mockResolvedValue({
      workspaceId: access.activeWorkspace!.id,
      builderAdminAllowed: true,
      sandboxRequired: true,
      eventStreamingEnabled: true,
      signingKeyConfigured: true,
      tokenTtlSeconds: 300,
      piecesFilterType: 'allowlist',
      piecesTags: ['lexframe-core', 'legal-core', 'document-core'],
      incidentLockActive: false,
      runtimeConnections: [],
    });
    jest.spyOn(service as any, 'probeActivepiecesApi').mockResolvedValue({
      reachable: true,
      summary: 'Activepieces API preflight succeeded.',
      projectCount: 1,
    });

    const result = await service.getIntegrationStatus(access);

    expect(result.canDispatchRealRuns).toBe(true);
    expect(result.simulateRuns).toBe(false);
    expect(result.smokePresetCodes).toContain('legal-research-to-draft');
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'simulate-mode',
          state: 'ready',
        }),
        expect.objectContaining({
          code: 'pieces-policy',
          state: 'ready',
        }),
      ]),
    );
  });

  it('delegates the Stage 17.5 session bridge to the orchestration service', async () => {
    const { service, activepiecesSessionService } = createService();
    activepiecesSessionService.createSession.mockResolvedValue({
      status: 'ready',
      readiness_code: 'READY',
      session_id: 'sess_stage17',
      mode: 'iframe_embed',
      issued_at: '2026-04-28T14:03:00.000Z',
      instance_url: 'http://localhost:3100/automation-runtime',
      builder_url:
        'http://localhost:3100/automation-runtime/flows/flow_stage17',
      initial_route: '/flows/flow_stage17',
      jwt_token: 'stage17-session-token',
      expires_at: '2026-04-28T14:05:00.000Z',
      ttl_seconds: 120,
      locale: 'ru',
      brand_display_name: 'РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ',
      role: 'EDITOR',
      permissions: {
        can_view: true,
        can_edit: true,
        can_manage_connections: false,
        can_open_diagnostics: false,
      },
      pieces_policy: {
        pieces_filter_type: 'ALLOWED',
        pieces_tags: ['lexframe-core', 'legal-core'],
        policy_hash: 'sha256:policy',
      },
      sdk_config: {
        container_id: 'activepieces-canvas-sess_stage17',
        prefix: '/automation-runtime',
        locale: 'ru',
        brand_display_name: 'РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ',
        design_system: 'activepieces_like',
        navigation_sync: true,
      },
      design_system: 'activepieces_like',
      flow_binding: {
        automation_id: 'aut_stage17',
        activepieces_project_id: 'proj_stage17',
        activepieces_flow_id: 'flow_stage17',
        activepieces_flow_version_id: null,
        sync_status: 'synced',
      },
      runtime_status: {
        ap_app: 'ok',
        ap_worker: 'unknown',
        ap_db: 'unknown',
        redis: 'unknown',
      },
    });

    const result = await service.createSession(
      actor,
      access,
      {
        workspaceId: access.activeWorkspace!.id,
        projectId: 'project_claim_001',
        automationId: 'aut_stage17',
        purpose: 'automation_canvas',
        clientRoute:
          '/app/projects/project_claim_001/automations/aut_stage17/automation',
        preferredMode: 'auto',
      },
      {
        requestId: 'req_stage17',
        traceId: 'trace_stage17',
      },
    );

    expect(result).toMatchObject({
      status: 'ready',
      session_id: 'sess_stage17',
      mode: 'iframe_embed',
      instance_url: 'http://localhost:3100/automation-runtime',
      builder_url:
        'http://localhost:3100/automation-runtime/flows/flow_stage17',
      jwt_token: 'stage17-session-token',
      locale: 'ru',
      brand_display_name: expect.any(String),
      role: 'EDITOR',
      design_system: 'activepieces_like',
      flow_binding: {
        automation_id: 'aut_stage17',
        activepieces_project_id: 'proj_stage17',
        activepieces_flow_id: 'flow_stage17',
        activepieces_flow_version_id: null,
        sync_status: 'synced',
      },
    });
    expect(activepiecesSessionService.createSession).toHaveBeenCalledWith(
      actor,
      access,
      expect.objectContaining({
        automationId: 'aut_stage17',
        purpose: 'automation_canvas',
      }),
      expect.objectContaining({
        requestId: 'req_stage17',
        traceId: 'trace_stage17',
      }),
    );
  });

  it('propagates Stage 17.5 session access denial from the orchestration service', async () => {
    const { service, activepiecesSessionService } = createService();
    activepiecesSessionService.createSession.mockRejectedValue(
      Object.assign(new Error('workspace mismatch'), {
        code: 'WORKSPACE_ACCESS_DENIED',
      }),
    );

    await expect(
      service.createSession(
        actor,
        access,
        {
          workspaceId: 'ws_other',
          projectId: 'project_claim_001',
          automationId: 'aut_stage17',
          purpose: 'automation_canvas',
          clientRoute:
            '/app/projects/project_claim_001/automations/aut_stage17/automation',
        },
        {
          requestId: 'req_stage17',
          traceId: 'trace_stage17',
        },
      ),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_ACCESS_DENIED',
    });
  });

  it('reuses an existing remote project binding when local CE returns a shared project id', async () => {
    const { service, databaseService } = createService();

    databaseService.one.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'binding_shared_project',
      external_project_id: 'proj_shared_ce',
    });

    jest
      .spyOn(service as any, 'ensureRemoteProject')
      .mockResolvedValue('proj_shared_ce');

    const result = await (service as any).ensureProjectBinding(
      access.activeWorkspace!.id,
      actor,
      {
        title: 'Smoke automation',
      },
    );

    expect(result).toEqual({
      id: 'binding_shared_project',
      external_project_id: 'proj_shared_ce',
    });
    expect(databaseService.one).toHaveBeenCalledTimes(2);
  });

  it('returns activepieces-api dispatch metadata when simulation is disabled', async () => {
    const { service, databaseService, auditService } = createService();
    const client = {
      query: jest.fn(),
    };

    databaseService.transaction.mockImplementation(
      async (callback: (clientArg: unknown) => Promise<void>) =>
        callback(client),
    );
    databaseService.one
      .mockResolvedValueOnce({
        id: 'binding_1',
        installed_automation_id: 'aut_stage4_smoke',
        external_project_id: 'proj_stage4_smoke',
        external_flow_id: 'flow_stage4_smoke',
        sync_hash: 'hash_stage4_smoke',
        status: 'synced',
        last_synced_at: '2026-04-23T09:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'queued',
        trace_id: 'trace_stage4_dispatch',
      });

    jest.spyOn(service, 'getAutomationRuntimeRequirements').mockResolvedValue({
      automationId: 'aut_stage4_smoke',
      canOpenBuilder: true,
      canRun: true,
      builderState: 'ready',
      syncState: 'synced',
      runtimeProjectId: 'proj_stage4_smoke',
      runtimeFlowId: 'flow_stage4_smoke',
      missingConnections: [],
      availableConnections: [],
      requiredPieces: [],
      warnings: [],
    });
    jest.spyOn(service as any, 'getInstalledAutomation').mockResolvedValue({
      id: 'aut_stage4_smoke',
      workspace_id: access.activeWorkspace!.id,
      template_id: 'tpl_stage4_smoke',
      source_template_version_id: 'tpv_stage4_smoke',
      title: 'Smoke automation',
      version: 'v1',
      workflow_state: 'compiled',
      builder_state: 'ready',
      sync_state: 'synced',
      compatibility_status: 'compatible',
      available: true,
      disabled_reason: null,
      required_inputs: [],
      requirements: [],
      workflow: {
        steps: [
          {
            id: 'step_legal_search',
            moduleCode: 'legal.case-search',
          },
        ],
      },
      next_gate: 'ready',
      runtime_project_id: 'proj_stage4_smoke',
      runtime_flow_id: 'flow_stage4_smoke',
      sync_hash: 'hash_stage4_smoke',
      last_synced_at: '2026-04-23T09:00:00.000Z',
    });
    const assertRealDispatchReady = jest
      .spyOn(service as any, 'assertRealDispatchReady')
      .mockResolvedValue(undefined);

    const result = await service.startRun(
      actor,
      access,
      'aut_stage4_smoke',
      {
        mode: 'dry_run',
      },
      {
        requestId: 'req_stage4_dispatch',
        traceId: 'trace_stage4_dispatch',
      },
    );

    expect(assertRealDispatchReady).toHaveBeenCalledWith(access);
    expect(result.dispatchMode).toBe('activepieces-api');
    expect(result.externalRunId).toMatch(/^ap_run_/);
    expect(result.traceId).toBe('trace_stage4_dispatch');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'activepieces.run.dispatched',
        entityId: result.runId,
      }),
    );
  });
});
