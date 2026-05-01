import type {
  AccessContext,
  AiPolicyContext,
} from '../../common/types/lexframe-request';
import { AIGatewayService } from './ai-gateway.service';

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
});

function createService(policy: AiPolicyContext) {
  const aiPolicyService = {
    getWorkspacePolicy: jest.fn().mockResolvedValue(policy),
  };
  const aiProviderRegistry = {
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
