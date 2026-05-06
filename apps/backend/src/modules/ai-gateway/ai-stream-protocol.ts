import type {
  AiGatewayErrorCode,
  AiProviderCode,
  AiRouteCode,
  LexFrameAiStreamEvent,
} from '@lexframe/contracts';

export interface Stage18RouteSnapshotInput {
  readonly routeCode: AiRouteCode;
  readonly providerCode: AiProviderCode;
  readonly model: string;
}

export function buildStage18StreamEvents(input: {
  readonly traceId: string;
  readonly requestId?: string | null;
  readonly route: Stage18RouteSnapshotInput;
  readonly text: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}): readonly LexFrameAiStreamEvent[] {
  return [
    event('message_start', input.traceId, input.requestId, {
      role: 'assistant',
    }),
    event('route_snapshot', input.traceId, input.requestId, {
      route: input.route.routeCode,
      provider: input.route.providerCode,
      model: input.route.model,
      policy_decision: 'stage18_backend_route_resolved',
      trace_id: input.traceId,
    }),
    event('text_delta', input.traceId, input.requestId, {
      text: input.text,
    }),
    event('usage', input.traceId, input.requestId, {
      input_tokens: input.usage.inputTokens,
      output_tokens: input.usage.outputTokens,
      total_tokens: input.usage.inputTokens + input.usage.outputTokens,
      source: 'gateway_estimated',
    }),
    event('message_done', input.traceId, input.requestId, {
      finish_reason: 'stop',
    }),
  ];
}

export function buildStage18StreamError(input: {
  readonly traceId: string;
  readonly requestId?: string | null;
  readonly code: AiGatewayErrorCode;
  readonly message: string;
}): LexFrameAiStreamEvent {
  return event('error', input.traceId, input.requestId, {
    code: input.code,
    message: input.message,
    trace_id: input.traceId,
  });
}

export function serializeSseEvent(eventInput: LexFrameAiStreamEvent): string {
  return `event: ${eventInput.type}\ndata: ${JSON.stringify(eventInput)}\n\n`;
}

function event(
  type: LexFrameAiStreamEvent['type'],
  traceId: string,
  requestId: string | null | undefined,
  payload: Record<string, unknown>,
): LexFrameAiStreamEvent {
  return {
    type,
    traceId,
    requestId: requestId ?? null,
    payload,
  };
}
