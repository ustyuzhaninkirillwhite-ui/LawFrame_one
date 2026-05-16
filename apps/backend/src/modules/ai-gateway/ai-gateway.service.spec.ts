import type {
  AccessContext,
  AiPolicyContext,
} from '../../common/types/lexframe-request';
import { AIGatewayService } from './ai-gateway.service';
import { SecretString } from '../local-owner-key-vault/secret-string';

describe('AIGatewayService AI provider routing', () => {
  const originalEnv = {
    AI_PROVIDER_MODE: process.env.AI_PROVIDER_MODE,
    LEXFRAME_AI_TEST_FORCE_COMETAPI:
      process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI,
    LEXFRAME_AI_TEST_MODEL: process.env.LEXFRAME_AI_TEST_MODEL,
  };

  const access: AccessContext = {
    activeWorkspace: {
      id: 'ws_ai_route_test',
      slug: 'ai-route-test',
      name: 'AI Route Test',
      role: 'owner',
      status: 'active',
    },
    roles: ['owner'],
    permissions: [],
  };

  const policy: AiPolicyContext = {
    aiEnabled: true,
    allowConfidential: true,
    allowLegalSecret: false,
    cometapiPublicEnabled: true,
    plaintextOptIn: false,
    sensitiveLogging: false,
    monthlyBudgetUsd: 50,
    requestsPerMinuteLimit: 20,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv('AI_PROVIDER_MODE', originalEnv.AI_PROVIDER_MODE);
    restoreEnv(
      'LEXFRAME_AI_TEST_FORCE_COMETAPI',
      originalEnv.LEXFRAME_AI_TEST_FORCE_COMETAPI,
    );
    restoreEnv('LEXFRAME_AI_TEST_MODEL', originalEnv.LEXFRAME_AI_TEST_MODEL);
  });

  it('forces controlled-real test routes through CometAPI Grok', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '1';
    process.env.LEXFRAME_AI_TEST_MODEL = 'grok-4-1-fast-non-reasoning';
    const service = createService(policy);

    const route = await service.planStructuredRoute({
      access,
      classification: 'public',
      taskType: 'workflow_planning',
      hasDocuments: true,
    });

    expect(route).toEqual(
      expect.objectContaining({
        blocked: false,
        route: 'cometapi',
        provider: 'cometapi',
        model: 'grok-4-1-fast-non-reasoning',
        routeReason: 'test_force_cometapi_route',
      }),
    );
  });

  it('keeps mock mode on local mock routing without the test flag', async () => {
    process.env.AI_PROVIDER_MODE = 'mock';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '0';
    const service = createService(policy);

    const route = await service.planStructuredRoute({
      access,
      classification: 'public',
      taskType: 'workflow_planning',
      hasDocuments: true,
    });

    expect(route).toEqual(
      expect.objectContaining({
        blocked: false,
        route: 'local_mock',
        provider: 'local',
        model: 'local-mock',
        routeReason: 'provider_mode_mock',
      }),
    );
  });

  it('uses saved workspace AI preferences for route planning when not in mock mode', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '0';
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        modelId: 'grok-4-1-fast-non-reasoning',
        baseUrl: 'https://api.cometapi.com/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:workspace',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: 'decision_workspace_ai',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };
    const service = createService(policy, { routeGroupResolver });

    const route = await service.planStructuredRoute({
      access,
      classification: 'public',
      taskType: 'clarification',
      hasDocuments: false,
    });

    expect(route).toEqual(
      expect.objectContaining({
        blocked: false,
        route: 'default_chat',
        provider: 'cometapi',
        model: 'grok-4-1-fast-non-reasoning',
        routeReason: 'workspace_preference:default_chat',
      }),
    );
    expect(routeGroupResolver.resolveEffectivePolicy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_ai_route_test',
        routeCode: 'default_chat',
      }),
    );
  });

  it('does not let the controlled-real test force route override saved workspace AI preferences', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '1';
    process.env.LEXFRAME_AI_TEST_MODEL = 'grok-4-1-fast-non-reasoning';
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        modelId: 'deepseek-v4-pro',
        baseUrl: 'https://api.cometapi.com/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:workspace',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: 'decision_workspace_ai',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };
    const service = createService(policy, { routeGroupResolver });

    const route = await service.planStructuredRoute({
      access,
      classification: 'public',
      taskType: 'clarification',
      hasDocuments: false,
    });

    expect(route).toEqual(
      expect.objectContaining({
        blocked: false,
        route: 'default_chat',
        provider: 'cometapi',
        model: 'deepseek-v4-pro',
        routeReason: 'workspace_preference:default_chat',
        providerConnectionId: 'conn_workspace_ai',
      }),
    );
    expect(route.routeReason).not.toBe('test_force_cometapi_route');
  });

  it('passes the saved workspace secret into structured provider calls', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '0';
    const providerResponse = {
      provider: 'cometapi',
      model: 'grok-4-1-fast-non-reasoning',
      output: { ok: true },
      inputTokens: 3,
      outputTokens: 2,
      latencyMs: 25,
      usedFallback: false,
    };
    const adapter = {
      generateStructured: jest.fn().mockResolvedValue(providerResponse),
    };
    const aiProviderRegistry = {
      get: jest.fn().mockReturnValue(adapter),
      listProviders: jest.fn().mockReturnValue(['local', 'xai', 'cometapi']),
    };
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        modelId: 'grok-4-1-fast-non-reasoning',
        baseUrl: 'https://api.cometapi.com/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:workspace',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: 'decision_workspace_ai',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };
    const aiSecretService = {
      resolveProviderCallSecret: jest.fn().mockResolvedValue({
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'grok-4-1-fast-non-reasoning',
        secretRefId: 'secret_ref_001',
        fingerprint: 'sha256:workspace',
        apiKey: new SecretString('sk-workspace-runtime-key'),
      }),
      markProviderConnectionUsed: jest.fn(),
    };
    const service = createService(policy, {
      aiProviderRegistry,
      routeGroupResolver,
      aiSecretService,
    });

    await service.generateStructured({
      access,
      classification: 'public',
      taskType: 'clarification',
      hasDocuments: false,
      prompt: 'Return {"ok":true}.',
      schemaId: 'test.schema',
      fallback: { ok: false },
    });

    expect(aiSecretService.resolveProviderCallSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_ai_route_test',
        providerConnectionId: 'conn_workspace_ai',
      }),
    );
    expect(adapter.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'cometapi',
        model: 'grok-4-1-fast-non-reasoning',
        runtimeConnection: expect.objectContaining({
          providerConnectionId: 'conn_workspace_ai',
          baseUrl: 'https://api.cometapi.com/v1',
          fingerprint: 'sha256:workspace',
        }),
      }),
    );
  });

  it('passes the saved workspace secret into live chat streaming provider calls', async () => {
    process.env.AI_PROVIDER_MODE = 'controlled-real';
    process.env.LEXFRAME_AI_TEST_FORCE_COMETAPI = '0';
    const providerResponse = {
      ok: true,
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      text: '9.8 is greater than 9.11.',
      latencyMs: 25,
      contentChunkCount: 1,
      reasoningChunkCount: 1,
      status: 200,
      errorClass: null,
      requestDescriptor: {
        provider: 'cometapi',
        compatibility: 'openai_chat_completions',
        method: 'POST',
        endpointPath: '/chat/completions',
        baseUrlHost: 'api.cometapi.com',
        baseUrlPath: '/v1',
        model: 'deepseek-v4-pro',
        bodyKeys: [
          'model',
          'messages',
          'stream',
          'max_tokens',
          'reasoning_effort',
          'thinking',
        ],
        hasAuthorizationHeader: true,
        secretFingerprint: 'sha256:workspace',
        stream: true,
        maxTokens: 256,
        reasoningEffort: 'high',
        thinkingEnabled: true,
      },
    };
    const adapter = {
      generateStructured: jest.fn(),
      streamChatCompletion: jest.fn().mockResolvedValue(providerResponse),
    };
    const aiProviderRegistry = {
      get: jest.fn().mockReturnValue(adapter),
      listProviders: jest.fn().mockReturnValue(['local', 'xai', 'cometapi']),
    };
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        modelId: 'deepseek-v4-pro',
        baseUrl: 'https://api.cometapi.com/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:workspace',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: true,
        policyDecisionId: 'decision_workspace_ai',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };
    const aiSecretService = {
      resolveProviderCallSecret: jest.fn().mockResolvedValue({
        providerConnectionId: 'conn_workspace_ai',
        providerCode: 'cometapi',
        baseUrl: 'https://api.cometapi.com/v1',
        modelId: 'deepseek-v4-pro',
        secretRefId: 'secret_ref_001',
        fingerprint: 'sha256:workspace',
        apiKey: new SecretString('sk-workspace-runtime-key'),
      }),
      markProviderConnectionUsed: jest.fn(),
    };
    const service = createService(policy, {
      aiProviderRegistry,
      routeGroupResolver,
      aiSecretService,
    });

    const result = await service.streamChatCompletion({
      access,
      classification: 'internal',
      taskType: 'clarification',
      hasDocuments: false,
      route: 'default_chat',
      actorUserId: 'user_001',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content:
            'Which number is greater, 9.11 or 9.8? Answer with one sentence.',
        },
      ],
      maxTokens: 256,
      reasoningEffort: 'high',
      thinking: { type: 'enabled' },
      traceId: 'trace-chat-stream',
    });

    expect(result.response).toBe(providerResponse);
    expect(aiSecretService.resolveProviderCallSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_ai_route_test',
        providerConnectionId: 'conn_workspace_ai',
      }),
    );
    expect(adapter.streamChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'cometapi',
        model: 'deepseek-v4-pro',
        maxTokens: 256,
        reasoningEffort: 'high',
        thinking: { type: 'enabled' },
        runtimeConnection: expect.objectContaining({
          providerConnectionId: 'conn_workspace_ai',
          baseUrl: 'https://api.cometapi.com/v1',
          fingerprint: 'sha256:workspace',
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('sk-workspace-runtime-key');
  });
});

function createService(
  policy: AiPolicyContext,
  overrides: {
    readonly aiProviderRegistry?: unknown;
    readonly routeGroupResolver?: unknown;
    readonly aiSecretService?: unknown;
  } = {},
) {
  const aiPolicyService = {
    getWorkspacePolicy: jest.fn().mockResolvedValue(policy),
  };
  const aiProviderRegistry = overrides.aiProviderRegistry ?? {
    get: jest.fn(),
    listProviders: jest.fn().mockReturnValue(['local', 'xai', 'cometapi']),
  };

  return new AIGatewayService(
    {} as never,
    {} as never,
    aiPolicyService as never,
    aiProviderRegistry as never,
    {
      resolveKey: jest.fn(),
    } as never,
    {
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
          errors: [],
        },
        keys: {
          total: 0,
          enabled: 0,
          disabled: 0,
          routes: [],
        },
        warnings: [],
      }),
    } as never,
    undefined,
    overrides.routeGroupResolver as never,
    overrides.aiSecretService as never,
  );
}

function restoreEnv(
  key:
    | 'AI_PROVIDER_MODE'
    | 'LEXFRAME_AI_TEST_FORCE_COMETAPI'
    | 'LEXFRAME_AI_TEST_MODEL',
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
