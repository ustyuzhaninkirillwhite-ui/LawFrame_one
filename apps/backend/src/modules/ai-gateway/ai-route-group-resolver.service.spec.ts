import { AiRouteGroupResolverService } from './ai-route-group-resolver.service';
import { AiModelRouteRegistryService } from './ai-route-registry.service';

describe('Stage 21 AI route group resolver', () => {
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
