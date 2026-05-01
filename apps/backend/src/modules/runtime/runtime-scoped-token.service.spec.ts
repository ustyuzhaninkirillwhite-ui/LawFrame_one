import { AppHttpException } from '../../common/errors/app-http.exception';
import { RuntimeScopedTokenService } from './runtime-scoped-token.service';

describe('RuntimeScopedTokenService', () => {
  const originalSecret = process.env.LEXFRAME_RUNTIME_MASTER_SECRET;

  beforeEach(() => {
    process.env.LEXFRAME_RUNTIME_MASTER_SECRET =
      'unit-runtime-secret-stage17-9';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.LEXFRAME_RUNTIME_MASTER_SECRET;
    } else {
      process.env.LEXFRAME_RUNTIME_MASTER_SECRET = originalSecret;
    }
  });

  it('issues and verifies an Activepieces AI Gateway scoped token', () => {
    const service = new RuntimeScopedTokenService();
    const issued = service.issue({
      workspaceId: 'workspace_1',
      automationId: 'automation_1',
      runId: 'run_1',
      apProjectId: 'ap_project_1',
      apFlowId: 'ap_flow_1',
      apFlowVersionId: 'ap_version_1',
      stepName: 'test_ai_gateway_route',
      purpose: 'activepieces_ai_gateway_action',
      scope: ['runtime.ai.invoke'],
      traceId: 'trace_1',
      ttlSeconds: 300,
      issuedAtSeconds: Math.floor(Date.now() / 1000),
      jti: 'jti_1',
    });

    const claims = service.verify({
      token: issued.token,
      purpose: 'activepieces_ai_gateway_action',
      requiredScope: 'runtime.ai.invoke',
      expectedRunId: 'run_1',
      expectedWorkspaceId: 'workspace_1',
      expectedAutomationId: 'automation_1',
      expectedFlowId: 'ap_flow_1',
      expectedStepName: 'test_ai_gateway_route',
    });

    expect(claims).toEqual(
      expect.objectContaining({
        workspace_id: 'workspace_1',
        automation_id: 'automation_1',
        run_id: 'run_1',
        ap_project_id: 'ap_project_1',
        ap_flow_id: 'ap_flow_1',
        ap_flow_version_id: 'ap_version_1',
        step_name: 'test_ai_gateway_route',
        purpose: 'activepieces_ai_gateway_action',
        scope: ['runtime.ai.invoke'],
        trace_id: 'trace_1',
      }),
    );
    expect(issued.tokenHash).toHaveLength(64);
    expect(issued.jtiHash).toHaveLength(64);
  });

  it('rejects expired scoped tokens', () => {
    const service = new RuntimeScopedTokenService();
    const issued = service.issue({
      workspaceId: 'workspace_1',
      automationId: 'automation_1',
      runId: 'run_1',
      apProjectId: 'ap_project_1',
      apFlowId: 'ap_flow_1',
      stepName: 'test_ai_gateway_route',
      purpose: 'activepieces_ai_gateway_action',
      scope: ['runtime.ai.invoke'],
      traceId: 'trace_1',
      ttlSeconds: 60,
      issuedAtSeconds: Math.floor(Date.now() / 1000) - 120,
      jti: 'jti_expired',
    });

    expect(() =>
      service.verify({
        token: issued.token,
        requiredScope: 'runtime.ai.invoke',
      }),
    ).toThrow(AppHttpException);
  });
});
