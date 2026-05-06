export const LEXFRAME_AI_GATEWAY_PIECE_NAME = '@lexframe/piece-ai-gateway';
export const LEXFRAME_AI_GATEWAY_PIECE_VERSION = '0.1.0-stage18.0.0';

export type LexFramePieceAiRoute = 'agent_general' | 'rag_legal_summary';

export interface LexFrameAiGatewayInputRef {
  readonly type: string;
  readonly id: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LexFrameRuntimeCallInput {
  readonly lexframeRuntimeBaseUrl: string;
  readonly scopedRuntimeToken: string;
  readonly traceId: string;
}

export interface TestAiGatewayRouteInput extends LexFrameRuntimeCallInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly runId: string;
  readonly apProjectId: string;
  readonly apFlowId: string;
  readonly apFlowVersionId?: string | null;
  readonly stepName?: string;
  readonly testPrompt?: string | null;
  readonly classification?: string | null;
  readonly inputRefs?: Record<string, unknown>;
}

export interface InvokeAiGatewayInput extends LexFrameRuntimeCallInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly runId: string;
  readonly apProjectId: string;
  readonly apFlowId: string;
  readonly apFlowVersionId?: string | null;
  readonly stepName: string;
  readonly route?: LexFramePieceAiRoute;
  readonly task: string;
  readonly taskType?: string;
  readonly classification?: string | null;
  readonly inputRefs: readonly LexFrameAiGatewayInputRef[];
  readonly outputSchema: string;
  readonly outputSchemaRef?: string | null;
}

export interface WriteCallbackArtifactInput extends LexFrameRuntimeCallInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly runId: string;
  readonly apProjectId: string;
  readonly apFlowId: string;
  readonly apFlowVersionId?: string | null;
  readonly stepName: string;
  readonly externalEventId?: string | null;
  readonly status?: string | null;
  readonly metadata: Record<string, unknown>;
  readonly artifact?: Record<string, unknown> | null;
}

export const lexframeAiGatewayPieceContract = {
  name: LEXFRAME_AI_GATEWAY_PIECE_NAME,
  version: LEXFRAME_AI_GATEWAY_PIECE_VERSION,
  actions: {
    test_ai_gateway_route: {
      endpoint: '/api/runtime/activepieces/ai-gateway/actions/test',
      acceptsProviderKeyProps: false,
      acceptsLocalKeyVaultPath: false,
      returnsRawProviderResponse: false,
    },
    invoke_ai_gateway: {
      endpoint: '/api/runtime/activepieces/ai-gateway/actions/test',
      acceptsProviderKeyProps: false,
      acceptsProviderModelProps: false,
      acceptsLocalKeyVaultPath: false,
      returnsRawProviderResponse: false,
      allowedPayloadKeys: ['route', 'task', 'input_refs', 'output_schema'],
    },
    write_callback_artifact: {
      endpoint: '/api/runtime/activepieces/callback',
      acceptsProviderKeyProps: false,
      acceptsLocalKeyVaultPath: false,
      returnsRawProviderResponse: false,
    },
  },
} as const;

export async function testAiGatewayRoute(
  input: TestAiGatewayRouteInput,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return postJson(
    input,
    '/api/runtime/activepieces/ai-gateway/actions/test',
    {
      workspace_id: input.workspaceId,
      automation_id: input.automationId,
      run_id: input.runId,
      ap_project_id: input.apProjectId,
      ap_flow_id: input.apFlowId,
      ap_flow_version_id: input.apFlowVersionId ?? undefined,
      step_name: input.stepName ?? 'test_ai_gateway_route',
      task_type: 'stage17_ai_gateway_route_test',
      input: {
        mode: 'safe_test',
        test_prompt: input.testPrompt ?? null,
        classification: input.classification ?? 'workspace_internal',
        input_refs: input.inputRefs ?? {},
      },
      output_policy: {
        return_raw_provider_response: false,
        create_artifact: true,
      },
    },
    fetchImpl,
  );
}

export async function invokeAiGateway(
  input: InvokeAiGatewayInput,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return postJson(
    input,
    '/api/runtime/activepieces/ai-gateway/actions/test',
    {
      workspace_id: input.workspaceId,
      automation_id: input.automationId,
      run_id: input.runId,
      ap_project_id: input.apProjectId,
      ap_flow_id: input.apFlowId,
      ap_flow_version_id: input.apFlowVersionId ?? undefined,
      step_name: input.stepName,
      task_type: input.taskType ?? input.task,
      ...buildInvokeAiGatewayPayload(input),
      input: {
        mode: 'ref_only',
        classification: input.classification ?? 'workspace_internal',
        input_refs: input.inputRefs,
        output_schema_ref: input.outputSchemaRef ?? input.outputSchema,
      },
      output_policy: {
        return_raw_provider_response: false,
        create_artifact: true,
      },
    },
    fetchImpl,
  );
}

export function buildInvokeAiGatewayPayload(
  input: {
    readonly route?: LexFramePieceAiRoute;
    readonly task: string;
    readonly inputRefs: readonly LexFrameAiGatewayInputRef[];
    readonly outputSchema: string;
  },
) {
  assertNoForbiddenPieceFields(input as unknown as Record<string, unknown>);
  const route = input.route ?? 'agent_general';
  if (route !== 'agent_general' && route !== 'rag_legal_summary') {
    throw new Error(`Unsupported Stage 18 AI Gateway route: ${route}`);
  }

  return {
    route,
    task: requireNonEmpty(input.task, 'task'),
    input_refs: input.inputRefs,
    output_schema: requireNonEmpty(input.outputSchema, 'outputSchema'),
  };
}

export async function writeCallbackArtifact(
  input: WriteCallbackArtifactInput,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  return postJson(
    input,
    '/api/runtime/activepieces/callback',
    {
      workspace_id: input.workspaceId,
      automation_id: input.automationId,
      run_id: input.runId,
      ap_project_id: input.apProjectId,
      ap_flow_id: input.apFlowId,
      ap_flow_version_id: input.apFlowVersionId ?? undefined,
      step_name: input.stepName,
      external_event_id: input.externalEventId ?? undefined,
      status: input.status ?? 'completed',
      metadata: input.metadata,
      artifact: input.artifact ?? null,
    },
    fetchImpl,
  );
}

async function postJson(
  input: LexFrameRuntimeCallInput,
  endpoint: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
) {
  const url = `${input.lexframeRuntimeBaseUrl.replace(/\/$/, '')}${endpoint}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.scopedRuntimeToken}`,
      'content-type': 'application/json',
      'x-lexframe-trace-id': input.traceId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      status: 'error',
      statusCode: response.status,
      body: await response.text(),
    };
  }

  return response.json();
}

function assertNoForbiddenPieceFields(input: Record<string, unknown>) {
  const forbidden = [
    'apiKey',
    'api_key',
    'provider',
    'model',
    'baseUrl',
    'base_url',
    'prompt',
  ];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw new Error(`Forbidden Stage 18 AI Gateway piece field: ${key}`);
    }
  }
}

function requireNonEmpty(value: string, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Stage 18 AI Gateway piece field is required: ${field}`);
  }

  return value.trim();
}
