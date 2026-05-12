import { AiSecretService, fingerprintSecret } from './ai-secret.service';

describe('AiSecretService provider-call resolution', () => {
  const originalBackend = process.env.LEXFRAME_AI_SECRET_BACKEND;
  const originalProviderMode = process.env.AI_PROVIDER_MODE;
  const originalCometKey = process.env.COMETAPI_KEY;
  const originalCometApiKey = process.env.COMETAPI_API_KEY;
  const originalCometApiKeys = process.env.COMETAPI_API_KEYS;
  const originalDeployEnv = process.env.LEXFRAME_DEPLOY_ENV;
  const originalEnvProfile = process.env.LEXFRAME_ENV_PROFILE;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalBackend === undefined) {
      delete process.env.LEXFRAME_AI_SECRET_BACKEND;
    } else {
      process.env.LEXFRAME_AI_SECRET_BACKEND = originalBackend;
    }
    if (originalProviderMode === undefined) {
      delete process.env.AI_PROVIDER_MODE;
    } else {
      process.env.AI_PROVIDER_MODE = originalProviderMode;
    }
    if (originalCometKey === undefined) {
      delete process.env.COMETAPI_KEY;
    } else {
      process.env.COMETAPI_KEY = originalCometKey;
    }
    if (originalCometApiKey === undefined) {
      delete process.env.COMETAPI_API_KEY;
    } else {
      process.env.COMETAPI_API_KEY = originalCometApiKey;
    }
    if (originalCometApiKeys === undefined) {
      delete process.env.COMETAPI_API_KEYS;
    } else {
      process.env.COMETAPI_API_KEYS = originalCometApiKeys;
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
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('writes Supabase Vault secrets through the local-compatible vault contract', async () => {
    process.env.LEXFRAME_AI_SECRET_BACKEND = 'supabase_vault';
    const databaseService = {
      one: jest.fn().mockResolvedValueOnce({
        vault_secret_id: 'vault_secret_001',
      }),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new AiSecretService(databaseService as never);

    const result = await service.createOrRotateSecret({
      actor: {
        id: '00000000-0000-4000-8000-000000000031',
        email: 'owner@example.test',
        fullName: 'Owner',
        emailConfirmedAt: '2026-05-09T00:00:00.000Z',
        assuranceLevel: 'aal1',
        accessToken: 'dev-token',
        sessionId: 'session_001',
      },
      workspaceId: '00000000-0000-4000-8000-000000000021',
      ownerScope: 'workspace',
      ownerUserId: null,
      providerConnectionId: 'conn_workspace_ai',
      providerCode: 'cometapi',
      apiKey: 'sk-live-provider-key',
    });

    expect(result).toMatchObject({
      backend: 'supabase_vault',
      backendSecretId: 'vault_secret_001',
      status: 'active',
    });
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('vault.create_secret'),
      expect.arrayContaining(['sk-live-provider-key']),
    );
    expect(JSON.stringify(databaseService.query.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });

  it('returns a controlled backend-unavailable error when Supabase Vault is missing', async () => {
    process.env.LEXFRAME_AI_SECRET_BACKEND = 'supabase_vault';
    const databaseService = {
      one: jest.fn().mockRejectedValueOnce(
        Object.assign(new Error('schema "vault" does not exist'), {
          code: '3F000',
        }),
      ),
      query: jest.fn(),
    };
    const service = new AiSecretService(databaseService as never);

    await expect(
      service.createOrRotateSecret({
        actor: {
          id: '00000000-0000-4000-8000-000000000031',
          email: 'owner@example.test',
          fullName: 'Owner',
          emailConfirmedAt: '2026-05-09T00:00:00.000Z',
          assuranceLevel: 'aal1',
          accessToken: 'dev-token',
          sessionId: 'session_001',
        },
        workspaceId: '00000000-0000-4000-8000-000000000021',
        ownerScope: 'workspace',
        ownerUserId: null,
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        apiKey: 'sk-live-provider-key',
      }),
    ).rejects.toMatchObject({
      code: 'AI_SECRET_BACKEND_UNAVAILABLE',
      message: expect.stringContaining('Supabase Vault'),
    });
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('allows local Docker runtime secret writes when NODE_ENV is production but deploy env is local', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LEXFRAME_ENV_PROFILE = 'local';
    process.env.LEXFRAME_DEPLOY_ENV = 'local';
    process.env.LEXFRAME_AI_SECRET_BACKEND = 'dev_mock';
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new AiSecretService(databaseService as never);

    const result = await service.createOrRotateSecret({
      actor: {
        id: '00000000-0000-4000-8000-000000000031',
        email: 'owner@example.test',
        fullName: 'Owner',
        emailConfirmedAt: '2026-05-09T00:00:00.000Z',
        assuranceLevel: 'aal1',
        accessToken: 'dev-token',
        sessionId: 'session_001',
      },
      workspaceId: '00000000-0000-4000-8000-000000000021',
      ownerScope: 'workspace',
      ownerUserId: null,
      providerConnectionId: 'conn_workspace_ai',
      providerCode: 'cometapi',
      apiKey: 'sk-live-provider-key',
    });

    expect(result).toMatchObject({
      backend: 'dev_mock',
      backendSecretId: `dev_mock:${result.secretRefId}`,
      status: 'active',
    });
    expect(JSON.stringify(databaseService.query.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });

  it('returns a SecretString for an active Supabase Vault secret without serializing key material', async () => {
    const databaseService = {
      one: jest
        .fn()
        .mockResolvedValueOnce({
          provider_connection_id: 'conn_workspace_ai',
          provider_code: 'cometapi',
          base_url: 'https://api.cometapi.com/v1',
          default_model: 'grok-4-1-fast-non-reasoning',
          secret_ref_id: 'secret_ref_001',
          backend: 'supabase_vault',
          backend_secret_id: 'vault_secret_001',
          fingerprint: 'sha256:fingerprint',
          status: 'active',
        })
        .mockResolvedValueOnce({
          decrypted_secret: 'sk-live-provider-key',
        }),
    };
    const service = new AiSecretService(databaseService as never);

    const result = await service.resolveProviderCallSecret({
      workspaceId: '00000000-0000-4000-8000-000000000021',
      providerConnectionId: 'conn_workspace_ai',
    });

    expect(result).toMatchObject({
      providerConnectionId: 'conn_workspace_ai',
      providerCode: 'cometapi',
      baseUrl: 'https://api.cometapi.com/v1',
      modelId: 'grok-4-1-fast-non-reasoning',
      secretRefId: 'secret_ref_001',
      fingerprint: 'sha256:fingerprint',
    });
    expect(result.apiKey.revealForProviderCall()).toBe('sk-live-provider-key');
    expect(() => JSON.stringify(result.apiKey)).toThrow(
      'SECRET_SERIALIZATION_FORBIDDEN',
    );
    expect(
      JSON.stringify({ ...result, apiKey: String(result.apiKey) }),
    ).not.toContain('sk-live-provider-key');
  });

  it('resolves a dev mock secret from backend-only env when fingerprint matches', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.COMETAPI_API_KEY = 'sk-live-provider-key';
    process.env.COMETAPI_API_KEYS = '';
    const databaseService = {
      one: jest.fn().mockResolvedValueOnce({
        provider_connection_id: 'conn_workspace_ai',
        provider_code: 'cometapi',
        base_url: 'https://api.cometapi.com/v1',
        default_model: 'grok-4-1-fast-non-reasoning',
        secret_ref_id: 'secret_ref_001',
        backend: 'dev_mock',
        backend_secret_id: 'dev_mock:secret_ref_001',
        fingerprint: fingerprintSecret('sk-live-provider-key'),
        status: 'active',
      }),
    };
    const service = new AiSecretService(databaseService as never);

    const result = await service.resolveProviderCallSecret({
      workspaceId: '00000000-0000-4000-8000-000000000021',
      providerConnectionId: 'conn_workspace_ai',
    });

    expect(result).toMatchObject({
      providerConnectionId: 'conn_workspace_ai',
      providerCode: 'cometapi',
      fingerprint: fingerprintSecret('sk-live-provider-key'),
    });
    expect(result.apiKey.revealForProviderCall()).toBe('sk-live-provider-key');
    expect(JSON.stringify(databaseService.one.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });

  it('resolves a dev mock secret from the backend-only COMETAPI_KEY alias when fingerprint matches', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.COMETAPI_KEY = 'sk-live-provider-key';
    process.env.COMETAPI_API_KEY = 'stage0_comet_api_key';
    process.env.COMETAPI_API_KEYS = '';
    const databaseService = {
      one: jest.fn().mockResolvedValueOnce({
        provider_connection_id: 'conn_workspace_ai',
        provider_code: 'cometapi',
        base_url: 'https://api.cometapi.com/v1',
        default_model: 'deepseek-v4-pro',
        secret_ref_id: 'secret_ref_001',
        backend: 'dev_mock',
        backend_secret_id: 'dev_mock:secret_ref_001',
        fingerprint: fingerprintSecret('sk-live-provider-key'),
        status: 'active',
      }),
    };
    const service = new AiSecretService(databaseService as never);

    const result = await service.resolveProviderCallSecret({
      workspaceId: '00000000-0000-4000-8000-000000000021',
      providerConnectionId: 'conn_workspace_ai',
    });

    expect(result).toMatchObject({
      providerConnectionId: 'conn_workspace_ai',
      providerCode: 'cometapi',
      modelId: 'deepseek-v4-pro',
      fingerprint: fingerprintSecret('sk-live-provider-key'),
    });
    expect(result.apiKey.revealForProviderCall()).toBe('sk-live-provider-key');
    expect(JSON.stringify(databaseService.one.mock.calls)).not.toContain(
      'sk-live-provider-key',
    );
  });

  it('rejects dev mock live resolution when env key fingerprint does not match', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.COMETAPI_API_KEY = 'sk-different-provider-key';
    process.env.COMETAPI_API_KEYS = '';
    const databaseService = {
      one: jest.fn().mockResolvedValueOnce({
        provider_connection_id: 'conn_workspace_ai',
        provider_code: 'cometapi',
        base_url: 'https://api.cometapi.com/v1',
        default_model: 'grok-4-1-fast-non-reasoning',
        secret_ref_id: 'secret_ref_001',
        backend: 'dev_mock',
        backend_secret_id: 'dev_mock:secret_ref_001',
        fingerprint: fingerprintSecret('sk-live-provider-key'),
        status: 'active',
      }),
    };
    const service = new AiSecretService(databaseService as never);

    await expect(
      service.resolveProviderCallSecret({
        workspaceId: '00000000-0000-4000-8000-000000000021',
        providerConnectionId: 'conn_workspace_ai',
      }),
    ).rejects.toMatchObject({ code: 'AI_SECRET_BACKEND_UNAVAILABLE' });
  });
});
