import type { AiProvider } from '@lexframe/contracts';
import type {
  KeyResolverResult,
  SafeLocalKeyRoute,
} from '../local-owner-key-vault/local-owner-key-vault.types';
import type { SecretString } from '../local-owner-key-vault/secret-string';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface RuntimeProviderConnectionCredential {
  readonly providerConnectionId: string;
  readonly baseUrl: string;
  readonly apiKey: SecretString;
  readonly fingerprint: string | null;
  readonly secretRefId?: string | null;
}

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
  readonly localOwnerKey?: KeyResolverResult | null;
  readonly runtimeConnection?: RuntimeProviderConnectionCredential | null;
}

export interface StructuredAiResponse<T> {
  readonly provider: AiProvider;
  readonly model: string;
  readonly output: T;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly usedFallback: boolean;
  readonly localOwnerKey?: Pick<
    SafeLocalKeyRoute,
    'key_id' | 'provider' | 'model' | 'fingerprint'
  > & {
    readonly purpose: KeyResolverResult['purpose'];
    readonly route: string;
  };
}

export interface ChatCompletionMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatCompletionRequestDescriptor {
  readonly provider: AiProvider;
  readonly compatibility: 'openai_chat_completions';
  readonly method: 'POST';
  readonly endpointPath: '/chat/completions';
  readonly baseUrlHost: string;
  readonly baseUrlPath: string;
  readonly model: string;
  readonly bodyKeys: readonly string[];
  readonly hasAuthorizationHeader: boolean;
  readonly authorizationScheme: 'Bearer';
  readonly secretFingerprint: string | null;
  readonly sourceTokenFingerprint: string | null;
  readonly outgoingHeaderTokenFingerprint: string | null;
  readonly fingerprintsMatch: boolean;
  readonly outgoingHeaderLength: number;
  readonly stream: boolean;
  readonly maxTokens: number;
  readonly reasoningEffort: string;
  readonly thinkingEnabled: boolean;
}

export interface ChatCompletionStreamRequest {
  readonly provider: AiProvider;
  readonly model: string;
  readonly messages: readonly ChatCompletionMessage[];
  readonly maxTokens: number;
  readonly reasoningEffort: string;
  readonly thinking?: { readonly type: 'enabled' | 'disabled' };
  readonly traceId?: string | null;
  readonly localOwnerKey?: KeyResolverResult | null;
  readonly runtimeConnection?: RuntimeProviderConnectionCredential | null;
}

export interface ChatCompletionStreamResponse {
  readonly ok: boolean;
  readonly provider: AiProvider;
  readonly model: string;
  readonly text: string;
  readonly latencyMs: number;
  readonly contentChunkCount: number;
  readonly reasoningChunkCount: number;
  readonly attemptCount: number;
  readonly retryReason: string | null;
  readonly status: number | null;
  readonly errorClass: string | null;
  readonly requestDescriptor: ChatCompletionRequestDescriptor;
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
  streamChatCompletion(
    request: ChatCompletionStreamRequest,
  ): Promise<ChatCompletionStreamResponse>;
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

const TRANSIENT_STATUS_CODES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504,
]);

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
    ...(request.localOwnerKey
      ? { localOwnerKey: toSafeLocalOwnerKey(request.localOwnerKey) }
      : {}),
  };
}

async function requestOpenAiCompatibleStructuredOutput<T>(input: {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly endpoint: string;
  readonly request: StructuredAiRequest<T>;
  readonly timeoutMs?: number;
  readonly retryCount?: number;
}): Promise<StructuredAiResponse<T>> {
  const startedAt = Date.now();
  const maxAttempts = Math.max(1, (input.retryCount ?? 0) + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeoutMs ?? 90_000,
    );

    try {
      const response = await fetch(input.endpoint, {
        method: 'POST',
        signal: controller.signal,
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
        if (
          attempt < maxAttempts &&
          TRANSIENT_STATUS_CODES.has(response.status)
        ) {
          continue;
        }
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
        ...(input.request.localOwnerKey
          ? { localOwnerKey: toSafeLocalOwnerKey(input.request.localOwnerKey) }
          : {}),
      };
    } catch {
      if (attempt < maxAttempts) {
        continue;
      }
      return buildFallbackResponse(input.provider, input.request, startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  return buildFallbackResponse(input.provider, input.request, startedAt);
}

async function requestOpenAiCompatibleChatStream(input: {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly secretFingerprint: string | null;
  readonly request: ChatCompletionStreamRequest;
  readonly timeoutMs?: number;
}): Promise<ChatCompletionStreamResponse> {
  const startedAt = Date.now();
  const endpoint = `${normalizeOpenAiBaseUrl(input.baseUrl)}/chat/completions`;
  const sourceTokenFingerprint = fingerprintProviderSecret(input.apiKey);
  let attemptCount = 1;
  let retryReason: string | null = null;

  const first = await requestOpenAiCompatibleChatStreamAttempt({
    ...input,
    endpoint,
    sourceTokenFingerprint,
    maxTokens: input.request.maxTokens,
    reasoningEffort: input.request.reasoningEffort,
    thinking: input.request.thinking ?? { type: 'enabled' as const },
  });
  let final = first;
  let contentChunkCount = first.contentChunkCount;
  let reasoningChunkCount = first.reasoningChunkCount;

  if (
    !first.ok &&
    first.status === 200 &&
    first.errorClass === 'PROVIDER_EMPTY_RESPONSE'
  ) {
    retryReason = 'PROVIDER_EMPTY_RESPONSE';
    attemptCount = 2;
    const retry = await requestOpenAiCompatibleChatStreamAttempt({
      ...input,
      endpoint,
      sourceTokenFingerprint,
      maxTokens: 768,
      reasoningEffort: 'low',
      thinking: { type: 'disabled' as const },
    });
    final = retry;
    contentChunkCount += retry.contentChunkCount;
    reasoningChunkCount += retry.reasoningChunkCount;
  }

  return {
    ok: final.ok,
    provider: input.provider,
    model: input.request.model,
    text: final.text,
    latencyMs: Date.now() - startedAt,
    contentChunkCount,
    reasoningChunkCount,
    attemptCount,
    retryReason,
    status: final.status,
    errorClass: final.errorClass,
    requestDescriptor: final.requestDescriptor,
  };
}

async function requestOpenAiCompatibleChatStreamAttempt(input: {
  readonly provider: AiProvider;
  readonly apiKey: string;
  readonly endpoint: string;
  readonly secretFingerprint: string | null;
  readonly sourceTokenFingerprint: string;
  readonly request: ChatCompletionStreamRequest;
  readonly maxTokens: number;
  readonly reasoningEffort: string;
  readonly thinking: { readonly type: 'enabled' | 'disabled' };
  readonly timeoutMs?: number;
}): Promise<{
  readonly ok: boolean;
  readonly text: string;
  readonly contentChunkCount: number;
  readonly reasoningChunkCount: number;
  readonly status: number | null;
  readonly errorClass: string | null;
  readonly requestDescriptor: ChatCompletionRequestDescriptor;
}> {
  const descriptor = buildChatCompletionDescriptor({
    provider: input.provider,
    endpoint: input.endpoint,
    model: input.request.model,
    secretFingerprint: input.secretFingerprint,
    sourceTokenFingerprint: input.sourceTokenFingerprint,
    outgoingHeaderTokenFingerprint: input.sourceTokenFingerprint,
    outgoingHeaderLength: input.apiKey.length,
    maxTokens: input.maxTokens,
    reasoningEffort: input.reasoningEffort,
    thinkingEnabled: input.thinking.type === 'enabled',
  });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 90_000,
  );

  try {
    const body = {
      model: input.request.model,
      messages: input.request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: true,
      max_tokens: input.maxTokens,
      reasoning_effort: input.reasoningEffort,
      thinking: input.thinking,
    };
    const response = await fetch(input.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return {
        ok: false,
        text: '',
        contentChunkCount: 0,
        reasoningChunkCount: 0,
        status: response.status,
        errorClass: classifyProviderError(response.status, responseBody),
        requestDescriptor: descriptor,
      };
    }

    const streamText = await response.text();
    const parsed = parseOpenAiCompatibleSse(streamText);
    const text = parsed.text.trim();

    return {
      ok: text.length > 0,
      text,
      contentChunkCount: parsed.contentChunkCount,
      reasoningChunkCount: parsed.reasoningChunkCount,
      status: response.status,
      errorClass: text.length > 0 ? null : 'PROVIDER_EMPTY_RESPONSE',
      requestDescriptor: descriptor,
    };
  } catch {
    return {
      ok: false,
      text: '',
      contentChunkCount: 0,
      reasoningChunkCount: 0,
      status: null,
      errorClass: 'PROVIDER_NETWORK_ERROR',
      requestDescriptor: descriptor,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOpenAiBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '');
}

function buildChatCompletionDescriptor(input: {
  readonly provider: AiProvider;
  readonly endpoint: string;
  readonly model: string;
  readonly secretFingerprint: string | null;
  readonly sourceTokenFingerprint: string | null;
  readonly outgoingHeaderTokenFingerprint: string | null;
  readonly outgoingHeaderLength: number;
  readonly maxTokens: number;
  readonly reasoningEffort: string;
  readonly thinkingEnabled: boolean;
}): ChatCompletionRequestDescriptor {
  const url = new URL(input.endpoint);
  const basePath = url.pathname.replace(/\/chat\/completions$/i, '') || '/';

  return {
    provider: input.provider,
    compatibility: 'openai_chat_completions',
    method: 'POST',
    endpointPath: '/chat/completions',
    baseUrlHost: url.host,
    baseUrlPath: basePath,
    model: input.model,
    bodyKeys: [
      'model',
      'messages',
      'stream',
      'max_tokens',
      'reasoning_effort',
      'thinking',
    ],
    hasAuthorizationHeader: true,
    authorizationScheme: 'Bearer',
    secretFingerprint: input.secretFingerprint,
    sourceTokenFingerprint: input.sourceTokenFingerprint,
    outgoingHeaderTokenFingerprint: input.outgoingHeaderTokenFingerprint,
    fingerprintsMatch:
      input.sourceTokenFingerprint !== null &&
      input.sourceTokenFingerprint === input.outgoingHeaderTokenFingerprint,
    outgoingHeaderLength: input.outgoingHeaderLength,
    stream: true,
    maxTokens: input.maxTokens,
    reasoningEffort: input.reasoningEffort,
    thinkingEnabled: input.thinkingEnabled,
  };
}

function fingerprintProviderSecret(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

function parseOpenAiCompatibleSse(value: string) {
  let text = '';
  let contentChunkCount = 0;
  let reasoningChunkCount = 0;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) {
      continue;
    }

    const data = line.slice('data:'.length).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    let payload: {
      readonly choices?: readonly {
        readonly delta?: Record<string, unknown>;
        readonly message?: { readonly content?: unknown };
        readonly text?: unknown;
      }[];
    };

    try {
      payload = JSON.parse(data) as typeof payload;
    } catch {
      continue;
    }

    for (const choice of payload.choices ?? []) {
      const delta = choice.delta ?? {};
      const content = [
        delta.content,
        delta.text,
        delta.output_text,
        choice.message?.content,
        choice.text,
      ]
        .map(coerceStreamText)
        .join('');
      if (content) {
        text += content;
        contentChunkCount += 1;
      }
      if (coerceReasoningText(delta)) {
        reasoningChunkCount += 1;
      }
    }
  }

  return { text, contentChunkCount, reasoningChunkCount };
}

function coerceStreamText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part !== 'object' || part === null) {
          return '';
        }
        const record = part as { readonly text?: unknown };
        return typeof record.text === 'string' ? record.text : '';
      })
      .join('');
  }

  return '';
}

function coerceReasoningText(delta: Record<string, unknown>) {
  const modelExtra =
    typeof delta.model_extra === 'object' && delta.model_extra !== null
      ? (delta.model_extra as Record<string, unknown>)
      : {};
  const additionalKwargs =
    typeof delta.additional_kwargs === 'object' &&
    delta.additional_kwargs !== null
      ? (delta.additional_kwargs as Record<string, unknown>)
      : {};

  return [
    delta.reasoning_content,
    delta.reasoning,
    modelExtra.reasoning_content,
    additionalKwargs.reasoning_content,
  ].some((value) => typeof value === 'string' && value.length > 0);
}

function classifyProviderError(status: number, body: string) {
  const text = body.toLowerCase();
  if (
    status === 401 ||
    text.includes('invalid token') ||
    text.includes('unauthorized')
  ) {
    return 'PROVIDER_AUTH_INVALID_TOKEN';
  }
  if (status === 403) {
    return 'PROVIDER_AUTH_FORBIDDEN';
  }
  if (status === 404) {
    return 'PROVIDER_ENDPOINT_OR_MODEL_NOT_FOUND';
  }
  if (status === 429) {
    return 'PROVIDER_RATE_LIMITED';
  }
  if (status >= 500) {
    return 'PROVIDER_SERVER_ERROR';
  }
  return 'PROVIDER_ERROR';
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

  streamChatCompletion(
    request: ChatCompletionStreamRequest,
  ): Promise<ChatCompletionStreamResponse> {
    const descriptor = buildChatCompletionDescriptor({
      provider: this.provider,
      endpoint: 'http://local.mock/v1/chat/completions',
      model: request.model,
      secretFingerprint: null,
      sourceTokenFingerprint: null,
      outgoingHeaderTokenFingerprint: null,
      outgoingHeaderLength: 0,
      maxTokens: request.maxTokens,
      reasoningEffort: request.reasoningEffort,
      thinkingEnabled: request.thinking?.type === 'enabled',
    });

    return Promise.resolve({
      ok: false,
      provider: this.provider,
      model: request.model,
      text: '',
      latencyMs: 0,
      contentChunkCount: 0,
      reasoningChunkCount: 0,
      attemptCount: 0,
      retryReason: null,
      status: null,
      errorClass: 'PROVIDER_NOT_CONFIGURED',
      requestDescriptor: descriptor,
    });
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
    if (!request.localOwnerKey && !isConfiguredSecret(this.env.XAI_API_KEY)) {
      return buildFallbackResponse(this.provider, request, Date.now());
    }

    return requestOpenAiCompatibleStructuredOutput({
      provider: this.provider,
      apiKey:
        request.localOwnerKey?.api_key.revealForProviderCall() ??
        this.env.XAI_API_KEY,
      endpoint: 'https://api.x.ai/v1/chat/completions',
      request,
    });
  }

  streamChatCompletion(
    request: ChatCompletionStreamRequest,
  ): Promise<ChatCompletionStreamResponse> {
    const apiKey =
      request.localOwnerKey?.api_key.revealForProviderCall() ??
      this.env.XAI_API_KEY;
    return requestOpenAiCompatibleChatStream({
      provider: this.provider,
      apiKey,
      baseUrl: 'https://api.x.ai/v1',
      secretFingerprint: request.localOwnerKey?.fingerprint ?? null,
      request,
    });
  }
}

@Injectable()
export class CometApiAdapter implements AiProviderAdapter {
  readonly provider = 'cometapi' as const;
  readonly supports = {
    structuredOutputs: true,
    functionCalling: true,
    webSearch: false,
    zeroDataRetention: false,
  };
  private apiKeyCursor = 0;

  async generateStructured<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>> {
    const env = loadServerEnv();
    const runtimeConnection = request.runtimeConnection ?? null;
    const fallbackApiKey =
      runtimeConnection || request.localOwnerKey ? null : this.nextApiKey(env);
    const apiKey =
      runtimeConnection?.apiKey.revealForProviderCall() ??
      request.localOwnerKey?.api_key.revealForProviderCall() ??
      fallbackApiKey;

    if (!apiKey) {
      return buildFallbackResponse(this.provider, request, Date.now());
    }

    return requestOpenAiCompatibleStructuredOutput({
      provider: this.provider,
      apiKey,
      endpoint: `${(
        runtimeConnection?.baseUrl ?? env.LEXFRAME_COMETAPI_BASE_URL
      ).replace(/\/$/, '')}/chat/completions`,
      request,
      timeoutMs: env.LEXFRAME_AI_REQUEST_TIMEOUT_MS,
      retryCount: env.LEXFRAME_AI_RETRY_COUNT,
    });
  }

  streamChatCompletion(
    request: ChatCompletionStreamRequest,
  ): Promise<ChatCompletionStreamResponse> {
    const env = loadServerEnv();
    const runtimeConnection = request.runtimeConnection ?? null;
    const fallbackApiKey =
      runtimeConnection || request.localOwnerKey ? null : this.nextApiKey(env);
    const apiKey =
      runtimeConnection?.apiKey.revealForProviderCall() ??
      request.localOwnerKey?.api_key.revealForProviderCall() ??
      fallbackApiKey;
    const baseUrl =
      runtimeConnection?.baseUrl ?? env.LEXFRAME_COMETAPI_BASE_URL;
    const fingerprint =
      runtimeConnection?.fingerprint ??
      request.localOwnerKey?.fingerprint ??
      null;

    if (!apiKey) {
      const descriptor = buildChatCompletionDescriptor({
        provider: this.provider,
        endpoint: `${normalizeOpenAiBaseUrl(baseUrl)}/chat/completions`,
        model: request.model,
        secretFingerprint: fingerprint,
        sourceTokenFingerprint: null,
        outgoingHeaderTokenFingerprint: null,
        outgoingHeaderLength: 0,
        maxTokens: request.maxTokens,
        reasoningEffort: request.reasoningEffort,
        thinkingEnabled: request.thinking?.type === 'enabled',
      });
      return Promise.resolve({
        ok: false,
        provider: this.provider,
        model: request.model,
        text: '',
        latencyMs: 0,
        contentChunkCount: 0,
        reasoningChunkCount: 0,
        attemptCount: 0,
        retryReason: null,
        status: null,
        errorClass: 'PROVIDER_NOT_CONFIGURED',
        requestDescriptor: descriptor,
      });
    }

    return requestOpenAiCompatibleChatStream({
      provider: this.provider,
      apiKey,
      baseUrl,
      secretFingerprint: fingerprint,
      request,
      timeoutMs: env.LEXFRAME_AI_REQUEST_TIMEOUT_MS,
    });
  }

  private nextApiKey(env = loadServerEnv()) {
    const apiKeys = getConfiguredCometApiKeys(env);
    if (apiKeys.length === 0) {
      return null;
    }

    const apiKey = apiKeys[this.apiKeyCursor % apiKeys.length];
    this.apiKeyCursor = (this.apiKeyCursor + 1) % apiKeys.length;

    return apiKey;
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

function getConfiguredCometApiKeys(env: ReturnType<typeof loadServerEnv>) {
  const keys = [
    ...env.COMETAPI_API_KEYS.split(/[\s,;]+/),
    env.COMETAPI_KEY,
    env.COMETAPI_API_KEY,
  ]
    .map((value) => value.trim())
    .filter(isConfiguredSecret);

  return Array.from(new Set(keys));
}

function isConfiguredSecret(value: string | undefined) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('stage0_') &&
    !value.startsWith('replace_with_')
  );
}

function toSafeLocalOwnerKey(key: KeyResolverResult) {
  return {
    key_id: key.key_id,
    provider: key.provider,
    model: key.model,
    fingerprint: key.fingerprint,
    purpose: key.purpose,
    route: key.route,
  };
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
