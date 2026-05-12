import { AiRouteGroupResolverService } from './ai-route-group-resolver.service';
import { AiModelRouteRegistryService } from './ai-route-registry.service';
import { DatabaseService } from '../database/database.service';
import { SELF_DECLARED_DEPS_METADATA } from '@nestjs/common/constants';

describe('Stage 21 AI route group resolver', () => {
  const originalProviderMode = process.env.AI_PROVIDER_MODE;

  afterEach(() => {
    if (originalProviderMode === undefined) {
      delete process.env.AI_PROVIDER_MODE;
    } else {
      process.env.AI_PROVIDER_MODE = originalProviderMode;
    }
  });

  it('keeps DatabaseService in runtime metadata so Nest can inject saved route preferences', () => {
    const explicitDeps = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      AiRouteGroupResolverService,
    ) as ReadonlyArray<{ readonly index: number; readonly param: unknown }>;

    expect(explicitDeps).toContainEqual({ index: 0, param: DatabaseService });
  });

  it('uses chat_ai for default chat routes and returns safe metadata only', async () => {
    const resolver = new AiRouteGroupResolverService(
      undefined as never,
      new AiModelRouteRegistryService(),
    );

    const policy = await resolver.resolveEffectivePolicy({
      workspaceId: '00000000-0000-0000-0000-000000000021',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      routeCode: 'default_chat',
      permissions: ['settings.ai.view'],
      traceId: 'trace-stage21-chat',
    });

    expect(policy).toMatchObject({
      routeGroup: 'chat_ai',
      routeCode: 'default_chat',
      providerCode: 'cometapi',
      source: 'stage18_default_route',
      hasSecret: false,
    });
    expect(JSON.stringify(policy)).not.toMatch(/apiKey|Authorization|Bearer/);
  });

  it('marks mock runtime mode as not using saved provider keys', async () => {
    process.env.AI_PROVIDER_MODE = 'mock';
    const resolver = new AiRouteGroupResolverService(
      undefined as never,
      new AiModelRouteRegistryService(),
    );

    const policy = await resolver.resolveEffectivePolicy({
      workspaceId: '00000000-0000-0000-0000-000000000021',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      routeCode: 'default_chat',
      permissions: ['settings.ai.view'],
      traceId: 'trace-stage21-chat',
    });

    expect(policy).toMatchObject({
      runtimeMode: 'mock',
      runtimeUsesSavedConnection: false,
      runtimeNotice: expect.stringContaining('AI_PROVIDER_MODE=mock'),
    });
  });

  it('uses a saved workspace chat route for runtime users with ai.chat.use but no settings management permission', async () => {
    const workspacePreference = {
      id: 'pref_001',
      route_group: 'chat_ai',
      scope_type: 'workspace',
      workspace_id: '00000000-0000-0000-0000-000000000021',
      user_id: null,
      provider_connection_id: 'provider_connection_001',
      model_id: 'deepseek-v4-pro',
      enabled: true,
      capabilities_confirmed: {
        streaming: true,
        structuredJsonSchema: true,
        jsonMode: true,
        toolCalls: true,
      },
      provider_code: 'cometapi',
      base_url: 'https://api.cometapi.com/v1',
      owner_scope: 'workspace',
      owner_user_id: null,
      secret_ref_id: 'secret_ref_001',
      secret_status: 'active',
      fingerprint: 'sha256:248197196ac16fec',
      secret_updated_at: '2026-05-09T00:00:00.000Z',
      supports_streaming: true,
      supports_json: true,
      supports_tool_calls: true,
    };
    const databaseService = {
      one: jest.fn((_sql: string, params: readonly unknown[]) =>
        Promise.resolve(params[1] === 'workspace' ? workspacePreference : null),
      ),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const resolver = new AiRouteGroupResolverService(
      databaseService as never,
      new AiModelRouteRegistryService(),
    );

    const policy = await resolver.resolveEffectivePolicy({
      workspaceId: '00000000-0000-0000-0000-000000000021',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      routeCode: 'default_chat',
      permissions: ['ai.chat.use'],
      traceId: 'trace-stage21-chat',
    });

    expect(policy).toMatchObject({
      routeGroup: 'chat_ai',
      routeCode: 'default_chat',
      source: 'workspace_preference',
      providerCode: 'cometapi',
      modelId: 'deepseek-v4-pro',
      hasSecret: true,
      runtimeUsesSavedConnection: true,
    });
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('from app.ai_route_group_preferences p'),
      ['chat_ai', 'workspace', '00000000-0000-0000-0000-000000000021', null],
    );
    expect(JSON.stringify(policy)).not.toMatch(/apiKey|Authorization|Bearer/);
  });

  it('uses automation_ai for planner routes and requires structured JSON support', async () => {
    const resolver = new AiRouteGroupResolverService(
      undefined as never,
      new AiModelRouteRegistryService(),
    );

    const policy = await resolver.resolveEffectivePolicy({
      workspaceId: '00000000-0000-0000-0000-000000000021',
      actorUserId: '00000000-0000-0000-0000-000000000001',
      routeCode: 'automation_planner_high',
      permissions: ['settings.ai.view'],
      traceId: 'trace-stage21-automation',
    });

    expect(policy).toMatchObject({
      routeGroup: 'automation_ai',
      routeCode: 'automation_planner_high',
      supportsJson: true,
      source: 'stage18_default_route',
    });
  });
});
