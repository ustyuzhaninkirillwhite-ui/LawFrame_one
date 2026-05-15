import { buildSafeAutomationRouteSnapshot } from './automation-builder.service';

describe('buildSafeAutomationRouteSnapshot', () => {
  it('uses a backend-owned key reference when the effective route has no raw fingerprint', () => {
    expect(
      buildSafeAutomationRouteSnapshot({
        routeCode: 'automation_planner_high',
        providerCode: 'mock',
        modelId: 'mock-automation-planner',
        fingerprint: null,
        policyDecisionId: 'policy-decision-1',
      }),
    ).toEqual({
      route: 'automation_planner_high',
      provider: 'mock',
      model: 'mock-automation-planner',
      keyFingerprint: 'server_route_ref',
      policyDecision: 'policy-decision-1',
    });
  });
});
