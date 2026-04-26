import type { AiProvider } from '@lexframe/contracts';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';

export interface StructuredAiRequest<T> {
  readonly provider: AiProvider;
  readonly model: string;
  readonly prompt: string;
  readonly schemaId: string;
  readonly fallback: T;
  readonly jsonSchema?: {
    readonly name: string;
    readonly schema: Record<string, unknown>;
    readonly strict?: boolean;
  };
  readonly tools?: readonly {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  }[];
  readonly maxToolCalls?: number;
  readonly traceId?: string | null;
}

export interface StructuredAiResponse<T> {
  readonly provider: AiProvider;
  readonly model: string;
  readonly output: T;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly usedFallback: boolean;
}

export interface AiProviderAdapter {
  readonly provider: AiProvider;
  readonly supports: {
    readonly structuredOutputs: boolean;
    readonly functionCalling: boolean;
    readonly webSearch: boolean;
    readonly zeroDataRetention: boolean | 'enterprise_only';
  };
  generateStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>>;
}

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{
    readonly message?: {
      readonly content?:
        | string
        | ReadonlyArray<{
            readonly type?: string;
            readonly text?: string;
          }>;
    };
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function buildFallbackResponse<T>(
  provider: AiProvider,
  request: StructuredAiRequest<T>,
  startedAt: number,
): StructuredAiResponse<T> {
  return {
    provider,
    model: request.model,
    output: request.fallback,
    inputTokens: estimateTokens(request.prompt),
    outputTokens: estimateTokens(JSON.stringify(request.fallback)),
    latencyMs: Date.now() - startedAt,
    usedFallback: true,
  };
}

async function requestOpenAiCompatibleStructuredOutput<T>(input: {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly endpoint: string;
  readonly request: StructuredAiRequest<T>;
}): Promise<StructuredAiResponse<T>> {
  const startedAt = Date.now();

  try {
    const response = await fetch(input.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.request.model,
        temperature: 0,
        response_format: input.request.jsonSchema
          ? {
              type: 'json_schema',
              json_schema: {
                name: input.request.jsonSchema.name,
                strict: input.request.jsonSchema.strict ?? true,
                schema: input.request.jsonSchema.schema,
              },
            }
          : {
              type: 'json_object',
            },
        tools: input.request.tools?.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice:
          input.request.tools && input.request.tools.length > 0
            ? 'auto'
            : undefined,
        messages: [
          {
            role: 'system',
            content:
              'Return valid JSON only. Preserve the exact top-level shape from the reference JSON and do not add markdown fences.',
          },
          {
            role: 'user',
            content: [
              `schema_id=${input.request.schemaId}`,
              `planner_prompt=${input.request.prompt}`,
              `reference_json=${JSON.stringify(input.request.fallback)}`,
            ].join('\n\n'),
          },
        ],
      }),
    });

    if (!response.ok) {
      return buildFallbackResponse(input.provider, input.request, startedAt);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = coerceCompletionContent(payload);

    if (!content) {
      return buildFallbackResponse(input.provider, input.request, startedAt);
    }

    const output = parseJsonPayload<T>(content);
    const promptTokens =
      payload.usage?.prompt_tokens ?? estimateTokens(input.request.prompt);
    const completionTokens =
      payload.usage?.completion_tokens ??
      estimateTokens(JSON.stringify(output));

    return {
      provider: input.provider,
      model: input.request.model,
      output,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      latencyMs: Date.now() - startedAt,
      usedFallback: false,
    };
  } catch {
    return buildFallbackResponse(input.provider, input.request, startedAt);
  }
}

@Injectable()
export class LocalMockAdapter implements AiProviderAdapter {
  readonly provider = 'local' as const;
  readonly supports = {
    structuredOutputs: true,
    functionCalling: false,
    webSearch: false,
    zeroDataRetention: true,
  } as const;

  generateStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>> {
    return Promise.resolve(
      buildFallbackResponse(this.provider, request, Date.now()),
    );
  }
}

@Injectable()
export class XAiAdapter implements AiProviderAdapter {
  readonly provider = 'xai' as const;
  readonly supports = {
    structuredOutputs: true,
    functionCalling: true,
    webSearch: true,
    zeroDataRetention: 'enterprise_only' as const,
  };
  private readonly env = loadServerEnv();

  async generateStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>> {
    if (!isConfiguredSecret(this.env.XAI_API_KEY)) {
      return buildFallbackResponse(this.provider, request, Date.now());
    }

    return requestOpenAiCompatibleStructuredOutput({
      provider: this.provider,
      apiKey: this.env.XAI_API_KEY,
      endpoint: 'https://api.x.ai/v1/chat/completions',
      request,
    });
  }
}

@Injectable()
export class CometApiAdapter implements AiProviderAdapter {
  readonly provider = 'cometapi' as const;
  readonly supports = {
    structuredOutputs: true,
    functionCalling: false,
    webSearch: false,
    zeroDataRetention: false,
  };
  private readonly env = loadServerEnv();

  async generateStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>> {
    if (!isConfiguredSecret(this.env.COMETAPI_API_KEY)) {
      return buildFallbackResponse(this.provider, request, Date.now());
    }

    return requestOpenAiCompatibleStructuredOutput({
      provider: this.provider,
      apiKey: this.env.COMETAPI_API_KEY,
      endpoint: 'https://api.cometapi.com/v1/chat/completions',
      request,
    });
  }
}

@Injectable()
export class AiProviderRegistry {
  private readonly registry = new Map<AiProvider, AiProviderAdapter>();

  constructor(
    localMockAdapter: LocalMockAdapter,
    xAiAdapter: XAiAdapter,
    cometApiAdapter: CometApiAdapter,
  ) {
    this.registry.set(localMockAdapter.provider, localMockAdapter);
    this.registry.set(xAiAdapter.provider, xAiAdapter);
    this.registry.set(cometApiAdapter.provider, cometApiAdapter);
  }

  get(provider: AiProvider) {
    const adapter = this.registry.get(provider);

    if (!adapter) {
      throw new Error(`Unknown AI provider adapter: ${provider}`);
    }

    return adapter;
  }

  listProviders() {
    return [...this.registry.keys()];
  }
}

function isConfiguredSecret(value: string) {
  return !value.startsWith('stage0_') && !value.startsWith('replace_with_');
}

function coerceCompletionContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];

    for (const part of content) {
      const text = part?.text;
      textParts.push(typeof text === 'string' ? text : '');
    }

    return textParts.join('\n').trim();
  }

  return '';
}

function parseJsonPayload<T>(value: string): T {
  const trimmed = value.trim();
  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');

  if (objectStart === -1 || objectEnd === -1 || objectEnd < objectStart) {
    throw new Error('No JSON object found in provider response.');
  }

  const parsed: unknown = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
  return parsed as T;
}
