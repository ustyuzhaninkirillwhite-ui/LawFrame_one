import { AiModelRouteRegistryService } from './ai-route-registry.service';

describe('AiModelRouteRegistryService Stage 18 defaults', () => {
  it('routes ordinary AI work through CometAPI deepseek-v4-flash', () => {
    const registry = new AiModelRouteRegistryService();

    expect(registry.getRoute('default_chat')).toMatchObject({
      routeCode: 'default_chat',
      providerConnectionId: 'owner_default_ai',
      providerCode: 'cometapi',
      model: 'deepseek-v4-flash',
      supportsStreaming: true,
      supportsJson: true,
      supportsToolCalls: true,
      visibleToUser: false,
      adminVisible: true,
      enabled: true,
    });
    expect(registry.getRoute('agent_general')).toMatchObject({
      routeCode: 'agent_general',
      providerCode: 'cometapi',
      model: 'deepseek-v4-flash',
      enabled: true,
    });
    expect(registry.getRoute('rag_legal_summary')).toMatchObject({
      routeCode: 'rag_legal_summary',
      providerCode: 'cometapi',
      model: 'deepseek-v4-flash',
      supportsToolCalls: false,
      enabled: true,
    });
  });

  it('keeps automation_planner_high backend-owned and out of defaults', () => {
    const registry = new AiModelRouteRegistryService();

    expect(registry.getDefaultRoute().routeCode).toBe('default_chat');
    expect(registry.getRoute('automation_planner_high')).toMatchObject({
      routeCode: 'automation_planner_high',
      adminVisible: true,
      visibleToUser: false,
      enabled: true,
    });
    expect(registry.getDefaultRoute().routeCode).not.toBe(
      'automation_planner_high',
    );
  });

  it('declares required route valves without raw secret values', () => {
    const registry = new AiModelRouteRegistryService();
    const valveKeys = registry
      .listValves('default_chat')
      .map((valve) => valve.key);

    expect(valveKeys).toEqual(
      expect.arrayContaining([
        'temperature',
        'max_output_tokens',
        'json_mode_enabled',
        'tool_calling_enabled',
        'context_budget_tokens',
        'redaction_required',
        'allow_external_provider_for_client_material',
        'timeout_ms',
        'retry_count',
      ]),
    );
    expect(
      registry.listValves('default_chat').filter((valve) => valve.secret),
    ).toEqual([]);
  });
});
