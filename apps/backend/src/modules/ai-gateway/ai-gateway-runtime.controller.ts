import { AppHttpException } from '../../common/errors/app-http.exception';
import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  RuntimeScopedTokenService,
  type ScopedRuntimeTokenClaims,
} from '../runtime/runtime-scoped-token.service';
import { AIGatewayService } from './ai-gateway.service';

export interface RuntimeAiGatewayActionRequest {
  readonly runId: string;
  readonly stepId: string;
  readonly prompt: string;
  readonly provider?: 'xai' | 'cometapi' | 'local';
  readonly routeId?: string | null;
  readonly inputRefs?: Record<string, unknown>;
}

export interface ActivepiecesAiGatewayTestRequest {
  readonly workspaceId?: string;
  readonly automationId?: string;
  readonly runId: string;
  readonly apProjectId?: string;
  readonly apFlowId?: string;
  readonly apFlowVersionId?: string;
  readonly stepName: string;
  readonly taskType: string;
  readonly provider?: 'xai' | 'openai_compatible' | 'cometapi' | 'local';
  readonly routeId?: string | null;
  readonly input: {
    readonly mode?: string;
    readonly testPrompt?: string | null;
    readonly classification?: string | null;
    readonly inputRefs?: Record<string, unknown>;
  };
  readonly outputPolicy: {
    readonly returnRawProviderResponse: false;
    readonly createArtifact: boolean;
  };
}

export interface ActivepiecesRuntimeCallbackRequest {
  readonly workspaceId?: string;
  readonly automationId?: string;
  readonly runId: string;
  readonly apProjectId?: string;
  readonly apFlowId?: string;
  readonly apFlowVersionId?: string;
  readonly stepName: string;
  readonly externalEventId?: string | null;
  readonly status?: string | null;
  readonly artifact?: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
}

@Controller()
export class AiGatewayRuntimeController {
  constructor(
    private readonly aiGatewayService: AIGatewayService,
    private readonly runtimeScopedTokenService: RuntimeScopedTokenService,
  ) {}

  @Post('workflow-runtime/ai-gateway/actions/analyze')
  @HttpCode(200)
  executeAnalyzeAction(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    return this.aiGatewayService.executeRuntimeAiGatewayAction(
      authorization,
      parseRuntimeAiGatewayActionRequest(body),
    );
  }

  @Post('runtime/activepieces/ai-gateway/actions/test')
  @HttpCode(200)
  executeActivepiecesTestAction(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-lexframe-trace-id') traceId: string | undefined,
    @Body() body: unknown,
  ) {
    const input = parseActivepiecesAiGatewayTestRequest(body);
    const claims = this.verifyScopedToken(authorization, {
      requiredScope: 'runtime.ai.invoke',
      purpose: 'activepieces_ai_gateway_action',
      expectedRunId: input.runId,
      expectedWorkspaceId: input.workspaceId,
      expectedAutomationId: input.automationId,
      expectedFlowId: input.apFlowId,
      expectedStepName: input.stepName,
    });

    return this.aiGatewayService.executeActivepiecesRuntimeTestAction(
      claims,
      input,
      traceId?.trim() || null,
    );
  }

  @Post('runtime/activepieces/callback')
  @HttpCode(200)
  handleActivepiecesRuntimeCallback(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const input = parseActivepiecesRuntimeCallbackRequest(body);
    const claims = this.verifyScopedToken(authorization, {
      requiredAnyScope: ['runtime.callback.write', 'artifact.create'],
      expectedRunId: input.runId,
      expectedWorkspaceId: input.workspaceId,
      expectedAutomationId: input.automationId,
      expectedFlowId: input.apFlowId,
      expectedStepName: input.stepName,
    });

    return this.aiGatewayService.handleActivepiecesRuntimeCallback(
      claims,
      input,
    );
  }

  private verifyScopedToken(
    authorization: string | undefined,
    input: Omit<
      Parameters<RuntimeScopedTokenService['verify']>[0],
      'token'
    >,
  ): ScopedRuntimeTokenClaims {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new AppHttpException(
        'AUTH_REQUIRED',
        401,
        'Scoped runtime authorization token is required.',
      );
    }

    return this.runtimeScopedTokenService.verify({
      ...input,
      token,
    });
  }
}

function parseRuntimeAiGatewayActionRequest(
  body: unknown,
): RuntimeAiGatewayActionRequest {
  const value = asRecord(body);

  return {
    runId: expectString(
      value.run_id ?? value.runId,
      'Runtime run id is required.',
    ),
    stepId: expectString(
      value.step_id ?? value.stepId,
      'Runtime step id is required.',
    ),
    prompt: expectString(value.prompt, 'Runtime AI prompt is required.'),
    ...(isProvider(value.provider) ? { provider: value.provider } : {}),
    ...(typeof (value.route_id ?? value.routeId) === 'string'
      ? { routeId: String(value.route_id ?? value.routeId).trim() || null }
      : {}),
    ...(isRecordOrUndefined(value.input_refs ?? value.inputRefs)
      ? {
          inputRefs: (value.input_refs ?? value.inputRefs) as Record<
            string,
            unknown
          >,
        }
      : {}),
  };
}

function parseActivepiecesAiGatewayTestRequest(
  body: unknown,
): ActivepiecesAiGatewayTestRequest {
  const value = asRecord(body);
  const input = isRecord(value.input) ? value.input : {};
  const outputPolicy = isRecord(value.output_policy ?? value.outputPolicy)
    ? ((value.output_policy ?? value.outputPolicy) as Record<string, unknown>)
    : {};

  return {
    ...(typeof value.workspace_id === 'string'
      ? { workspaceId: value.workspace_id.trim() }
      : {}),
    ...(typeof value.automation_id === 'string'
      ? { automationId: value.automation_id.trim() }
      : {}),
    runId: expectString(
      value.run_id ?? value.runId,
      'Runtime run id is required.',
    ),
    ...(typeof value.ap_project_id === 'string'
      ? { apProjectId: value.ap_project_id.trim() }
      : {}),
    ...(typeof value.ap_flow_id === 'string'
      ? { apFlowId: value.ap_flow_id.trim() }
      : {}),
    ...(typeof value.ap_flow_version_id === 'string'
      ? { apFlowVersionId: value.ap_flow_version_id.trim() }
      : {}),
    stepName: expectString(
      value.step_name ?? value.stepName,
      'Runtime step name is required.',
    ),
    taskType: expectString(
      value.task_type ?? value.taskType,
      'Runtime task type is required.',
    ),
    ...(isLocalOwnerProvider(value.provider)
      ? { provider: value.provider }
      : {}),
    ...(typeof (value.route_id ?? value.routeId) === 'string'
      ? { routeId: String(value.route_id ?? value.routeId).trim() || null }
      : {}),
    input: {
      ...(typeof input.mode === 'string' ? { mode: input.mode.trim() } : {}),
      ...(typeof (input.test_prompt ?? input.testPrompt) === 'string'
        ? {
            testPrompt:
              String(input.test_prompt ?? input.testPrompt).trim() || null,
          }
        : {}),
      ...(typeof input.classification === 'string'
        ? { classification: input.classification.trim() || null }
        : {}),
      ...(isRecord(input.input_refs ?? input.inputRefs)
        ? {
            inputRefs: (input.input_refs ?? input.inputRefs) as Record<
              string,
              unknown
            >,
          }
        : {}),
    },
    outputPolicy: {
      returnRawProviderResponse: false,
      createArtifact: outputPolicy.create_artifact !== false,
    },
  };
}

function parseActivepiecesRuntimeCallbackRequest(
  body: unknown,
): ActivepiecesRuntimeCallbackRequest {
  const value = asRecord(body);
  return {
    ...(typeof value.workspace_id === 'string'
      ? { workspaceId: value.workspace_id.trim() }
      : {}),
    ...(typeof value.automation_id === 'string'
      ? { automationId: value.automation_id.trim() }
      : {}),
    runId: expectString(
      value.run_id ?? value.runId,
      'Runtime run id is required.',
    ),
    ...(typeof value.ap_project_id === 'string'
      ? { apProjectId: value.ap_project_id.trim() }
      : {}),
    ...(typeof value.ap_flow_id === 'string'
      ? { apFlowId: value.ap_flow_id.trim() }
      : {}),
    ...(typeof value.ap_flow_version_id === 'string'
      ? { apFlowVersionId: value.ap_flow_version_id.trim() }
      : {}),
    stepName: expectString(
      value.step_name ?? value.stepName,
      'Runtime step name is required.',
    ),
    ...(typeof (value.external_event_id ?? value.externalEventId) === 'string'
      ? {
          externalEventId:
            String(value.external_event_id ?? value.externalEventId).trim() ||
            null,
        }
      : {}),
    ...(typeof value.status === 'string'
      ? { status: value.status.trim() || null }
      : {}),
    ...(isRecordOrNull(value.artifact)
      ? { artifact: value.artifact as Record<string, unknown> | null }
      : {}),
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be a JSON object.',
    );
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function isProvider(
  value: unknown,
): value is RuntimeAiGatewayActionRequest['provider'] {
  return value === 'xai' || value === 'cometapi' || value === 'local';
}

function isLocalOwnerProvider(
  value: unknown,
): value is ActivepiecesAiGatewayTestRequest['provider'] {
  return (
    value === 'xai' ||
    value === 'openai_compatible' ||
    value === 'cometapi' ||
    value === 'local'
  );
}

function isRecordOrUndefined(value: unknown) {
  return (
    value === undefined ||
    (typeof value === 'object' && value !== null && !Array.isArray(value))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecordOrNull(value: unknown) {
  return value === null || isRecord(value);
}
