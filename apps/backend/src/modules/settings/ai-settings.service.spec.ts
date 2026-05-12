import { AiSettingsService } from './ai-settings.service';
import { SecretString } from '../local-owner-key-vault/secret-string';

describe('AiSettingsService provider connections', () => {
  const originalLiveTests = process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDeployEnv = process.env.LEXFRAME_DEPLOY_ENV;
  const originalEnvProfile = process.env.LEXFRAME_ENV_PROFILE;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalLiveTests === undefined) {
      delete process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS;
    } else {
      process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS = originalLiveTests;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalDeployEnv === undefined) {
      delete process.env.LEXFRAME_DEPLOY_ENV;
    } else {
      process.env.LEXFRAME_DEPLOY_ENV = originalDeployEnv;
    }
    if (originalEnvProfile === undefined) {
      delete process.env.LEXFRAME_ENV_PROFILE;
    } else {
      process.env.LEXFRAME_ENV_PROFILE = originalEnvProfile;
    }
  });

  it('creates a CometAPI provider connection without reusing one SQL parameter for text and uuid secret columns', async () => {
    const workspaceId = '00000000-0000-4000-8000-000000000021';
    const actor = {
      id: '00000000-0000-4000-8000-000000000031',
      email: 'owner@example.test',
      fullName: 'Owner',
      emailConfirmedAt: '2026-05-09T00:00:00.000Z',
      assuranceLevel: 'aal1',
      accessToken: 'dev-token',
      sessionId: 'session_001',
    } as const;
    const access = {
      activeWorkspace: {
        id: workspaceId,
        slug: 'workspace',
        name: 'Workspace',
        role: 'owner',
      },
      roles: ['owner'],
      permissions: ['settings.ai.manage_workspace'],
    } as never;

    let insertedConnectionId: string | null = null;
    let insertSql = '';
    let insertParams: readonly unknown[] = [];
    const databaseService = {
      query: jest.fn((sql: string, params: readonly unknown[]) => {
        if (sql.includes('insert into app.ai_provider_connections')) {
          insertedConnectionId = String(params[0]);
          insertSql = sql;
          insertParams = params;
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('from app.ai_provider_connections c')) {
          return Promise.resolve({
            rows: [
              {
                id: insertedConnectionId,
                workspace_id: workspaceId,
                owner_scope: 'workspace',
                owner_user_id: null,
                provider_code: 'cometapi',
                ui_label: 'cometapi grok-4-1-fast-non-reasoning',
                display_name: 'cometapi grok-4-1-fast-non-reasoning',
                base_url: 'https://api.cometapi.com/v1',
                default_model: 'grok-4-1-fast-non-reasoning',
                enabled: true,
                provider_metadata_redacted: {
                  capabilities: {
                    structuredJsonSchema: true,
                    jsonMode: true,
                    toolCalls: true,
                    streaming: true,
                  },
                },
                secret_ref_id: null,
                secret_status: null,
                secret_backend: null,
                fingerprint: null,
                secret_updated_at: null,
                last_test_status: 'not_tested',
                last_tested_at: null,
                last_used_at: null,
                created_at: '2026-05-09T00:00:00.000Z',
                updated_at: '2026-05-09T00:00:00.000Z',
              },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new AiSettingsService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { createOrRotateSecret: jest.fn() } as never,
      { resolveEffectivePolicy: jest.fn() } as never,
    );

    const connection = await service.createProviderConnection({
      actor,
      access,
      request: {
        ownerScope: 'workspace',
        routeGroup: 'chat_ai',
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'grok-4-1-fast-non-reasoning',
        capabilities: {
          structuredJsonSchema: true,
          jsonMode: true,
          toolCalls: true,
          streaming: true,
        },
      },
      requestId: 'request_001',
      traceId: 'trace_001',
    });

    expect(connection).toMatchObject({
      providerCode: 'cometapi',
      modelId: 'grok-4-1-fast-non-reasoning',
      secret: {
        hasSecret: false,
      },
    });
    expect(insertSql.replace(/\s+/g, ' ')).toContain(
      'values ($1, $2, $3, $4, $5, $6, $6, $7, $8::text, $9::uuid, true',
    );
    expect(insertParams[7]).toBe(
      `ai_provider_connection:${insertedConnectionId}:missing_secret`,
    );
    expect(insertParams[8]).toBeNull();
    expect(insertParams[9]).toEqual(['grok-4-1-fast-non-reasoning']);
  });

  it('does not treat local Docker NODE_ENV=production as a production AI base URL policy', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LEXFRAME_DEPLOY_ENV = 'local';
    process.env.LEXFRAME_ENV_PROFILE = 'local';

    const workspaceId = '00000000-0000-4000-8000-000000000021';
    const actor = {
      id: '00000000-0000-4000-8000-000000000031',
      email: 'owner@example.test',
      fullName: 'Owner',
      emailConfirmedAt: '2026-05-09T00:00:00.000Z',
      assuranceLevel: 'aal1',
      accessToken: 'dev-token',
      sessionId: 'session_001',
    } as const;
    const access = {
      activeWorkspace: {
        id: workspaceId,
        slug: 'workspace',
        name: 'Workspace',
        role: 'owner',
      },
      roles: ['owner'],
      permissions: ['settings.ai.manage_workspace'],
    } as never;
    let insertedConnectionId: string | null = null;
    const databaseService = {
      query: jest.fn((sql: string, params: readonly unknown[]) => {
        if (sql.includes('insert into app.ai_provider_connections')) {
          insertedConnectionId = String(params[0]);
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('from app.ai_provider_connections c')) {
          return Promise.resolve({
            rows: [
              {
                id: insertedConnectionId,
                workspace_id: workspaceId,
                owner_scope: 'workspace',
                owner_user_id: null,
                provider_code: 'cometapi',
                ui_label: 'cometapi grok-4-1-fast-non-reasoning',
                display_name: 'cometapi grok-4-1-fast-non-reasoning',
                base_url: 'https://stage21.local.invalid/v1',
                default_model: 'grok-4-1-fast-non-reasoning',
                enabled: true,
                provider_metadata_redacted: { capabilities: {} },
                secret_ref_id: null,
                secret_status: null,
                secret_backend: null,
                fingerprint: null,
                secret_updated_at: null,
                last_test_status: 'not_tested',
                last_tested_at: null,
                last_used_at: null,
                created_at: '2026-05-09T00:00:00.000Z',
                updated_at: '2026-05-09T00:00:00.000Z',
              },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    };
    const service = new AiSettingsService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { createOrRotateSecret: jest.fn() } as never,
      { resolveEffectivePolicy: jest.fn() } as never,
    );

    await expect(
      service.createProviderConnection({
        actor,
        access,
        request: {
          ownerScope: 'workspace',
          routeGroup: 'chat_ai',
          providerCode: 'cometapi',
          baseUrl: 'https://stage21.local.invalid/v1',
          modelId: 'grok-4-1-fast-non-reasoning',
        },
        requestId: 'request_001',
        traceId: 'trace_001',
      }),
    ).resolves.toMatchObject({
      baseUrl: 'https://stage21.local.invalid/v1',
    });
  });

  it('inserts a provider connection before writing a new secret so FK checks pass', async () => {
    const workspaceId = '00000000-0000-4000-8000-000000000021';
    const actor = {
      id: '00000000-0000-4000-8000-000000000031',
      email: 'owner@example.test',
      fullName: 'Owner',
      emailConfirmedAt: '2026-05-09T00:00:00.000Z',
      assuranceLevel: 'aal1',
      accessToken: 'dev-token',
      sessionId: 'session_001',
    } as const;
    const access = {
      activeWorkspace: {
        id: workspaceId,
        slug: 'workspace',
        name: 'Workspace',
        role: 'owner',
      },
      roles: ['owner'],
      permissions: [
        'settings.ai.manage_workspace',
        'settings.ai.secret.create_workspace',
      ],
    } as never;
    const secretRefId = '00000000-0000-4000-8000-000000000099';
    let insertedConnectionId: string | null = null;
    let insertParams: readonly unknown[] = [];
    let secretUpdateParams: readonly unknown[] = [];
    const databaseService = {
      query: jest.fn((sql: string, params: readonly unknown[]) => {
        if (sql.includes('insert into app.ai_provider_connections')) {
          insertedConnectionId = String(params[0]);
          insertParams = params;
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('set secret_ref_id = $3::uuid')) {
          secretUpdateParams = params;
          return Promise.resolve({ rows: [] });
        }

        if (sql.includes('from app.ai_provider_connections c')) {
          return Promise.resolve({
            rows: [
              {
                id: insertedConnectionId,
                workspace_id: workspaceId,
                owner_scope: 'workspace',
                owner_user_id: null,
                provider_code: 'cometapi',
                ui_label: 'cometapi grok-4-1-fast-non-reasoning',
                display_name: 'cometapi grok-4-1-fast-non-reasoning',
                base_url: 'https://api.cometapi.com/v1',
                default_model: 'grok-4-1-fast-non-reasoning',
                enabled: true,
                provider_metadata_redacted: {
                  capabilities: {
                    structuredJsonSchema: true,
                    jsonMode: true,
                    toolCalls: true,
                    streaming: true,
                  },
                },
                secret_ref_id: secretRefId,
                secret_status: 'active',
                secret_backend: 'supabase_vault',
                fingerprint: 'sha256:fingerprint',
                secret_updated_at: '2026-05-09T00:00:00.000Z',
                last_test_status: 'not_tested',
                last_tested_at: null,
                last_used_at: null,
                created_at: '2026-05-09T00:00:00.000Z',
                updated_at: '2026-05-09T00:00:00.000Z',
              },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    };
    const aiSecretService = {
      createOrRotateSecret: jest.fn().mockResolvedValue({
        secretRefId,
        backend: 'supabase_vault',
        backendSecretId: 'vault_secret_001',
        fingerprint: 'sha256:fingerprint',
        status: 'active',
        lastUpdatedAt: '2026-05-09T00:00:00.000Z',
      }),
    };
    const service = new AiSettingsService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      aiSecretService as never,
      { resolveEffectivePolicy: jest.fn() } as never,
    );

    const connection = await service.createProviderConnection({
      actor,
      access,
      request: {
        ownerScope: 'workspace',
        routeGroup: 'chat_ai',
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'grok-4-1-fast-non-reasoning',
        apiKey: 'sk-test-user-entered-key',
        capabilities: {
          structuredJsonSchema: true,
          jsonMode: true,
          toolCalls: true,
          streaming: true,
        },
      },
      requestId: 'request_001',
      traceId: 'trace_001',
    });

    expect(connection.secret).toMatchObject({
      hasSecret: true,
      fingerprint: 'sha256:fingerprint',
    });
    expect(insertParams[7]).toBe(
      `ai_provider_connection:${insertedConnectionId}:missing_secret`,
    );
    expect(insertParams[8]).toBeNull();
    expect(aiSecretService.createOrRotateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConnectionId: insertedConnectionId,
        apiKey: 'sk-test-user-entered-key',
      }),
    );
    expect(firstCallOrder(databaseService.query)).toBeLessThan(
      firstCallOrder(aiSecretService.createOrRotateSecret),
    );
    expect(secretUpdateParams).toEqual([
      insertedConnectionId,
      workspaceId,
      secretRefId,
      secretRefId,
    ]);
    expect(JSON.stringify(databaseService.query.mock.calls)).not.toContain(
      'sk-test-user-entered-key',
    );
  });

  it('uses the saved backend secret and requires visible chat stream content when testing a connection', async () => {
    process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS = '1';
    const workspaceId = '00000000-0000-4000-8000-000000000021';
    const connectionId = 'conn_workspace_ai';
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: connectionId,
        workspace_id: workspaceId,
        owner_scope: 'workspace',
        owner_user_id: null,
        provider_code: 'cometapi',
        ui_label: 'CometAPI Grok',
        display_name: 'CometAPI Grok',
        base_url: 'https://api.cometapi.com/v1',
        default_model: 'grok-4-1-fast-non-reasoning',
        enabled: true,
        provider_metadata_redacted: {
          capabilities: {
            structuredJsonSchema: true,
            jsonMode: true,
            toolCalls: true,
            streaming: true,
          },
        },
        secret_ref_id: '00000000-0000-4000-8000-000000000099',
        secret_status: 'active',
        secret_backend: 'supabase_vault',
        fingerprint: 'sha256:fingerprint',
        secret_updated_at: '2026-05-09T00:00:00.000Z',
        last_test_status: 'not_tested',
        last_tested_at: null,
        last_used_at: null,
        created_at: '2026-05-09T00:00:00.000Z',
        updated_at: '2026-05-09T00:00:00.000Z',
      }),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const aiSecretService = {
      resolveProviderCallSecret: jest.fn().mockResolvedValue({
        providerConnectionId: connectionId,
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'grok-4-1-fast-non-reasoning',
        secretRefId: '00000000-0000-4000-8000-000000000099',
        fingerprint: 'sha256:fingerprint',
        apiKey: new SecretString('sk-live-provider-key'),
      }),
      createOrRotateSecret: jest.fn(),
    };
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          [
            'data: {"choices":[{"delta":{"content":"LEXFRAME_CHAT_SMOKE_OK"}}]}',
            'data: [DONE]',
            '',
          ].join('\n\n'),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
      );
    const service = new AiSettingsService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      aiSecretService as never,
      { resolveEffectivePolicy: jest.fn() } as never,
    );

    const result = await service.testConnection({
      actor: {
        id: '00000000-0000-4000-8000-000000000031',
        email: 'owner@example.test',
        fullName: 'Owner',
        emailConfirmedAt: '2026-05-09T00:00:00.000Z',
        assuranceLevel: 'aal1',
        accessToken: 'dev-token',
        sessionId: 'session_001',
      },
      access: {
        activeWorkspace: {
          id: workspaceId,
          slug: 'workspace',
          name: 'Workspace',
          role: 'owner',
        },
        roles: ['owner'],
        permissions: [
          'settings.ai.connection.test',
          'settings.ai.manage_workspace',
        ],
      } as never,
      connectionId,
      requestId: 'request_001',
      traceId: 'trace_001',
    });

    expect(result).toMatchObject({
      status: 'success',
      errorCode: null,
    });
    expect(aiSecretService.resolveProviderCallSecret).toHaveBeenCalledWith({
      workspaceId,
      providerConnectionId: connectionId,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cometapi.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-live-provider-key',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cometapi.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer sk-live-provider-key',
          'content-type': 'application/json',
        }),
      }),
    );
    const chatProbeBody = parseRequestJsonBody(
      fetchMock.mock.calls[1]?.[1] as RequestInit | undefined,
    );
    expect(chatProbeBody).toMatchObject({
      stream: true,
      max_tokens: 768,
      reasoning_effort: 'low',
      thinking: { type: 'disabled' },
    });
    expect(JSON.stringify(databaseService.query.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });

  it('fails the live connection test when models endpoint is healthy but chat stream has no visible content', async () => {
    process.env.LEXFRAME_AI_SETTINGS_LIVE_TESTS = '1';
    const workspaceId = '00000000-0000-4000-8000-000000000021';
    const connectionId = 'conn_workspace_ai';
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: connectionId,
        workspace_id: workspaceId,
        owner_scope: 'workspace',
        owner_user_id: null,
        provider_code: 'cometapi',
        ui_label: 'CometAPI Grok',
        display_name: 'CometAPI Grok',
        base_url: 'https://api.cometapi.com/v1',
        default_model: 'deepseek-v4-pro',
        enabled: true,
        provider_metadata_redacted: {
          capabilities: { streaming: true },
        },
        secret_ref_id: '00000000-0000-4000-8000-000000000099',
        secret_status: 'active',
        secret_backend: 'supabase_vault',
        fingerprint: 'sha256:fingerprint',
        secret_updated_at: '2026-05-09T00:00:00.000Z',
        last_test_status: 'not_tested',
        last_tested_at: null,
        last_used_at: null,
        created_at: '2026-05-09T00:00:00.000Z',
        updated_at: '2026-05-09T00:00:00.000Z',
      }),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const aiSecretService = {
      resolveProviderCallSecret: jest.fn().mockResolvedValue({
        providerConnectionId: connectionId,
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'deepseek-v4-pro',
        secretRefId: '00000000-0000-4000-8000-000000000099',
        fingerprint: 'sha256:fingerprint',
        apiKey: new SecretString('sk-live-provider-key'),
      }),
      createOrRotateSecret: jest.fn(),
    };
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          [
            'data: {"choices":[{"delta":{"reasoning_content":"hidden only"}}]}',
            'data: [DONE]',
            '',
          ].join('\n\n'),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
      );
    const service = new AiSettingsService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      aiSecretService as never,
      { resolveEffectivePolicy: jest.fn() } as never,
    );

    const result = await service.testConnection({
      actor: {
        id: '00000000-0000-4000-8000-000000000031',
        email: 'owner@example.test',
        fullName: 'Owner',
        emailConfirmedAt: '2026-05-09T00:00:00.000Z',
        assuranceLevel: 'aal1',
        accessToken: 'dev-token',
        sessionId: 'session_001',
      },
      access: {
        activeWorkspace: {
          id: workspaceId,
          slug: 'workspace',
          name: 'Workspace',
          role: 'owner',
        },
        roles: ['owner'],
        permissions: [
          'settings.ai.connection.test',
          'settings.ai.manage_workspace',
        ],
      } as never,
      connectionId,
      requestId: 'request_001',
      traceId: 'trace_001',
    });

    expect(result).toMatchObject({
      status: 'failed',
      errorCode: 'AI_PROVIDER_EMPTY_RESPONSE',
    });
    expect(JSON.stringify(databaseService.query.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });
});

function parseRequestJsonBody(init: RequestInit | undefined) {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected JSON request body.');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function firstCallOrder(mock: jest.Mock): number {
  const order = mock.mock.invocationCallOrder[0];

  if (order === undefined) {
    throw new Error('Expected mock to have been called.');
  }

  return order;
}
