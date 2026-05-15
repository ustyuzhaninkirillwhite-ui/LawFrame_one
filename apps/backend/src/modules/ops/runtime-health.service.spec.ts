import { RuntimeHealthService } from './runtime-health.service';

describe('RuntimeHealthService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns healthy system status when storage, runtime services, real AI and mining-worker are ready', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'real_xai_key_123',
    });
    mockRuntimeFetch({ realtimeStatus: 'ok' });

    const summary = await service.getSystemStatus();

    expect(summary.overall).toBe('healthy');
    expect(summary.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'storage', status: 'healthy' }),
        expect.objectContaining({ code: 'activepieces', status: 'healthy' }),
        expect.objectContaining({ code: 'ai', status: 'healthy' }),
        expect.objectContaining({ code: 'search', status: 'healthy' }),
        expect.objectContaining({ code: 'realtime', status: 'healthy' }),
      ]),
    );
    expect(summary.summary).not.toContain('Состояние runtime объединяет');
  });

  it('blocks AI in controlled-real mode when no real provider key is configured', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'stage0_xai_api_key',
      COMETAPI_API_KEY: 'stage0_comet_api_key',
      COMETAPI_API_KEYS: '',
    });
    mockRuntimeFetch({ realtimeStatus: 'ok' });

    const summary = await service.getSystemStatus();
    const ai = summary.components.find((component) => component.code === 'ai');

    expect(summary.overall).toBe('blocked');
    expect(ai).toEqual(
      expect.objectContaining({
        status: 'blocked',
        summary: expect.stringContaining('Full-services режим требует'),
      }),
    );
  });

  it('treats saved callable chat and automation route keys as healthy without env provider keys', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'stage0_xai_api_key',
      COMETAPI_API_KEY: 'stage0_comet_api_key',
      COMETAPI_API_KEYS: '',
    });
    mockRuntimeFetch({ realtimeStatus: 'ok' });
    lastDatabaseService.query.mockResolvedValue({
      rows: [
        {
          route_group: 'chat_ai',
          provider_code: 'cometapi',
          backend: 'supabase_vault',
          backend_secret_id: 'vault_chat',
          status: 'active',
          fingerprint: 'sha256:chat',
        },
        {
          route_group: 'automation_ai',
          provider_code: 'cometapi',
          backend: 'supabase_vault',
          backend_secret_id: 'vault_automation',
          status: 'active',
          fingerprint: 'sha256:automation',
        },
      ],
    });

    const summary = await service.getSystemStatus();
    const ai = summary.components.find((component) => component.code === 'ai');

    expect(summary.overall).toBe('healthy');
    expect(ai).toEqual(
      expect.objectContaining({
        status: 'healthy',
        summary: expect.stringContaining('chat_ai'),
      }),
    );
  });

  it('degrades AI when only the chat route has a callable saved key', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'stage0_xai_api_key',
      COMETAPI_API_KEY: 'stage0_comet_api_key',
      COMETAPI_API_KEYS: '',
    });
    mockRuntimeFetch({ realtimeStatus: 'ok' });
    lastDatabaseService.query.mockResolvedValue({
      rows: [
        {
          route_group: 'chat_ai',
          provider_code: 'cometapi',
          backend: 'supabase_vault',
          backend_secret_id: 'vault_chat',
          status: 'active',
          fingerprint: 'sha256:chat',
        },
      ],
    });

    const summary = await service.getSystemStatus();
    const ai = summary.components.find((component) => component.code === 'ai');

    expect(summary.overall).toBe('degraded');
    expect(ai).toEqual(
      expect.objectContaining({
        status: 'degraded',
        summary: expect.stringContaining('automation_ai'),
      }),
    );
  });

  let lastDatabaseService: {
    ping: jest.Mock;
    query: jest.Mock;
  };

  it('maps mining-worker degraded readiness payload to degraded realtime status', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'real_xai_key_123',
    });
    mockRuntimeFetch({
      realtimeStatus: 'degraded',
      realtimeSummary: 'warming up first mining cycle',
    });

    const summary = await service.getSystemStatus();
    const realtime = summary.components.find(
      (component) => component.code === 'realtime',
    );

    expect(summary.overall).toBe('degraded');
    expect(realtime).toEqual(
      expect.objectContaining({
        status: 'degraded',
        summary: expect.stringContaining('warming up first mining cycle'),
      }),
    );
  });

  it('blocks realtime when mining-worker readiness fetch fails', async () => {
    const service = createService({
      AI_PROVIDER_MODE: 'controlled-real',
      XAI_API_KEY: 'real_xai_key_123',
    });
    mockRuntimeFetch({ realtimeError: new Error('connection refused') });

    const summary = await service.getSystemStatus();
    const realtime = summary.components.find(
      (component) => component.code === 'realtime',
    );

    expect(summary.overall).toBe('blocked');
    expect(realtime).toEqual(
      expect.objectContaining({
        status: 'blocked',
        summary: expect.stringContaining('mining-worker /health/ready'),
      }),
    );
  });

  function createService(env: Record<string, string | undefined>) {
    process.env = {
      ...originalEnv,
      ACTIVEPIECES_BASE_URL: 'http://activepieces.local',
      OPENSEARCH_URL: 'http://opensearch.local',
      LEXFRAME_MINING_WORKER_HEALTH_URL:
        'http://mining-worker.local/health/ready',
      LEXFRAME_HEALTHCHECK_TIMEOUT_MS: '2000',
      ...env,
    };

    const databaseService = {
      ping: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    lastDatabaseService = databaseService;
    const readinessService = {
      getReadinessSnapshot: jest.fn().mockResolvedValue({ gates: [] }),
    };

    return new RuntimeHealthService(
      databaseService as never,
      readinessService as never,
    );
  }

  function mockRuntimeFetch(options: {
    realtimeStatus?: 'ok' | 'degraded' | 'blocked';
    realtimeSummary?: string;
    realtimeError?: Error;
  }) {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input.url;

      if (url.includes('mining-worker.local')) {
        if (options.realtimeError) {
          return Promise.reject(options.realtimeError);
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: options.realtimeStatus ?? 'ok',
              summary: options.realtimeSummary,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }) as unknown as typeof fetch;
  }
});
