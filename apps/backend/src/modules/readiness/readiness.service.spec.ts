import { ReadinessService } from './readiness.service';

describe('ReadinessService', () => {
  const originalFetch = global.fetch;

  function createService(env: Record<string, string | undefined> = {}) {
    const originalEnv = {
      ...process.env,
    };
    Object.assign(process.env, env);

    const workflowsService = {
      getDraftContract: jest.fn().mockReturnValue({
        validation: {
          schemaVersion: 'stage14',
        },
      }),
    };
    const aiGatewayService = {
      getPolicySnapshot: jest.fn().mockReturnValue({
        mode: 'mock',
      }),
    };
    const auditService = {
      describeStage0Audit: jest.fn().mockReturnValue({
        transport: 'db',
      }),
    };
    const databaseService = {
      ping: jest.fn(),
      query: jest.fn(),
      one: jest.fn(),
    };
    const localOwnerKeyVaultService = {
      getSafeStatus: jest.fn().mockReturnValue({
        status: 'disabled',
        disabled: true,
        source: null,
        file: {
          exists: false,
          readable: false,
          acl_ok: false,
          path_hint: null,
        },
        schema: {
          valid: false,
          schema_version: null,
          errors: [
            {
              code: 'LOCAL_KEYS_DISABLED',
              path: '$env.LEXFRAME_LOCAL_KEYS_DISABLED',
            },
          ],
        },
        keys: {
          total: 0,
          enabled: 0,
          disabled: 0,
          routes: [],
        },
        warnings: [],
      }),
    };
    const secretsService = {
      resolveRuntimeSecret: jest.fn().mockReturnValue({
        configured: false,
        source: 'missing',
        ref: null,
        value: null,
        diagnostics: {
          configured: false,
          source: 'missing',
          value_exposed: false,
        },
      }),
    };

    const service = new ReadinessService(
      workflowsService as never,
      aiGatewayService as never,
      auditService as never,
      databaseService as never,
      localOwnerKeyVaultService as never,
      secretsService as never,
    );

    return {
      service,
      databaseService,
      workflowsService,
      aiGatewayService,
      auditService,
      localOwnerKeyVaultService,
      secretsService,
      restoreEnv() {
        process.env = originalEnv;
      },
    };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input.url;

      if (url.includes('/storage/v1/object/sign/')) {
        return new Response(
          JSON.stringify({
            signedURL:
              '/storage/v1/object/sign/documents-private/readiness-probe.txt?token=test',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      }

      if (url.includes('/api/v1/projects')) {
        return new Response(JSON.stringify({ data: [{ id: 'ap_project' }] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      if (url.includes('/_cluster/health')) {
        return new Response(JSON.stringify({ status: 'green' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      if (init?.method === 'HEAD') {
        return new Response(null, {
          status: 200,
        });
      }

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      }

      return new Response('{}', {
        status: 200,
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps local-basic contract satisfied when optional integrations are blocked', async () => {
    const result = createService({
      LEXFRAME_READINESS_PROFILE: 'local-basic',
    });
    const { service, databaseService } = result;

    databaseService.ping.mockResolvedValue(true);
    databaseService.query.mockResolvedValue({
      rows: [
        { full_name: 'app.workspaces' },
        { full_name: 'app.workspace_members' },
        { full_name: 'app.role_permissions' },
        { full_name: 'app.user_sessions' },
      ],
    });
    databaseService.one.mockResolvedValue(null);

    const summary = await service.getReadinessSummary();

    expect(summary.profile).toBe('local-basic');
    expect(summary.allowReadinessGateBlocked).toBe(true);
    expect(summary.contractSatisfied).toBe(true);
    expect(summary.serviceSummary.blocked).toBeGreaterThan(0);

    result.restoreEnv();
  });

  it('fails local-integrated when storage and activepieces stay blocked', async () => {
    const result = createService({
      LEXFRAME_READINESS_PROFILE: 'local-integrated',
      ACTIVEPIECES_SIMULATE_RUNS: '1',
      SUPABASE_SECRET_KEY: 'stage0_supabase_secret_key',
      ACTIVEPIECES_API_KEY: 'stage0_activepieces_api_key',
      ACTIVEPIECES_SIGNING_PRIVATE_KEY: 'stage0_signing_private_key',
      LEXFRAME_RUNTIME_MASTER_SECRET: 'stage4_runtime_master_secret',
    });
    const { service, databaseService } = result;

    databaseService.ping.mockResolvedValue(true);
    databaseService.query.mockImplementation((sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return {
          rows: [
            { full_name: 'app.workspaces' },
            { full_name: 'app.workspace_members' },
            { full_name: 'app.role_permissions' },
            { full_name: 'app.user_sessions' },
            { full_name: 'app.documents' },
            { full_name: 'app.document_versions' },
            { full_name: 'app.workflow_runs' },
            { full_name: 'app.approval_tasks' },
            { full_name: 'app.delivery_requests' },
            { full_name: 'app.delivery_attempts' },
          ],
        };
      }

      return {
        rows: [],
      };
    });
    databaseService.one.mockResolvedValue(null);

    const details = await service.getReadinessDetails();
    const storageStatus = details.serviceStatuses.find(
      (status) => status.service === 'supabase-storage',
    );
    const activepiecesStatus = details.serviceStatuses.find(
      (status) => status.service === 'activepieces',
    );

    expect(details.profile).toBe('local-integrated');
    expect(details.contractSatisfied).toBe(false);
    expect(storageStatus?.required).toBe(true);
    expect(storageStatus?.state).toBe('blocked');
    expect(activepiecesStatus?.state).toBe('blocked');
    expect(details.blockedReasons).toEqual(
      expect.arrayContaining([
        'SUPABASE_SECRET_KEY не настроен для выдачи подписанных ссылок.',
        'ACTIVEPIECES_API_KEY и ACTIVEPIECES_SIGNING_PRIVATE_KEY должны быть настроены.',
      ]),
    );

    result.restoreEnv();
  });

  it('keeps local-integrated contract satisfied when required probes pass', async () => {
    const result = createService({
      LEXFRAME_READINESS_PROFILE: 'local-integrated',
      ACTIVEPIECES_SIMULATE_RUNS: '0',
      SUPABASE_SECRET_KEY: 'local_supabase_storage_signing_secret',
      ACTIVEPIECES_API_KEY: 'local_activepieces_access_token',
      ACTIVEPIECES_SIGNING_PRIVATE_KEY: 'local_stage14_signing_private_key',
      LEXFRAME_RUNTIME_MASTER_SECRET: 'local_stage14_runtime_master_secret',
      LEXFRAME_APP_BASE_URL: 'http://127.0.0.1:3000',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      OPENSEARCH_URL: 'http://127.0.0.1:9200',
      OPENSEARCH_INDEX_ALIAS: 'legal_chunks_current',
      LEXFRAME_DELIVERY_TRANSPORT: 'webhook',
      LEXFRAME_DELIVERY_WEBHOOK_URL: 'http://127.0.0.1:8091/hooks/delivery',
    });
    const { service, databaseService } = result;

    databaseService.ping.mockResolvedValue(true);
    databaseService.query.mockImplementation((sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return {
          rows: [
            { full_name: 'app.workspaces' },
            { full_name: 'app.workspace_members' },
            { full_name: 'app.role_permissions' },
            { full_name: 'app.user_sessions' },
            { full_name: 'app.documents' },
            { full_name: 'app.document_versions' },
            { full_name: 'app.document_storage_objects' },
            { full_name: 'app.document_text_chunks' },
            { full_name: 'app.workflow_runs' },
            { full_name: 'app.approval_tasks' },
            { full_name: 'app.delivery_requests' },
            { full_name: 'app.delivery_attempts' },
            { full_name: 'storage.objects' },
          ],
        };
      }

      return {
        rows: [],
      };
    });
    databaseService.one.mockResolvedValue(null);

    const details = await service.getReadinessDetails();

    expect(details.profile).toBe('local-integrated');
    expect(details.contractSatisfied).toBe(true);
    expect(details.serviceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          service: 'real-ai-provider',
          required: false,
          state: 'ready',
        }),
        expect.objectContaining({
          service: 'realtime',
          required: false,
          state: 'blocked',
        }),
      ]),
    );

    result.restoreEnv();
  });

  it('reports Stage 18 default route without exposing secret values', () => {
    const result = createService({
      COMETAPI_API_KEY: 'stage0_comet_api_key',
      COMETAPI_API_KEYS: '',
      LEXFRAME_AI_DEFAULT_MODEL: 'deepseek-v4-flash',
    });
    const { service } = result;

    const readiness = service.getStage18Readiness();

    expect(readiness.defaultRoute).toEqual({
      route: 'default_chat',
      provider: 'cometapi',
      model: 'deepseek-v4-flash',
    });
    expect(readiness.checks.default_route.status).toBe('pass');
    expect(readiness.checks.reference_repos_checked).toBeDefined();
    expect(JSON.stringify(readiness)).not.toContain('stage0_comet_api_key');

    result.restoreEnv();
  });
});
