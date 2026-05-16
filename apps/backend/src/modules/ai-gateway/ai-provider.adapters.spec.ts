import {
  CometApiAdapter,
  type StructuredAiRequest,
} from './ai-provider.adapters';
import { SecretString } from '../local-owner-key-vault/secret-string';

describe('CometApiAdapter', () => {
  const originalEnv = {
    COMETAPI_KEY: process.env.COMETAPI_KEY,
    COMETAPI_API_KEY: process.env.COMETAPI_API_KEY,
    COMETAPI_API_KEYS: process.env.COMETAPI_API_KEYS,
    LEXFRAME_COMETAPI_BASE_URL: process.env.LEXFRAME_COMETAPI_BASE_URL,
    LEXFRAME_AI_DEFAULT_MODEL: process.env.LEXFRAME_AI_DEFAULT_MODEL,
  };

  const request: StructuredAiRequest<{ readonly ok: boolean }> = {
    provider: 'cometapi',
    model: 'grok-4-1-fast-non-reasoning',
    prompt: 'Return {"ok":true}.',
    schemaId: 'test.schema',
    fallback: { ok: false },
  };

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv('COMETAPI_KEY', originalEnv.COMETAPI_KEY);
    restoreEnv('COMETAPI_API_KEY', originalEnv.COMETAPI_API_KEY);
    restoreEnv('COMETAPI_API_KEYS', originalEnv.COMETAPI_API_KEYS);
    restoreEnv(
      'LEXFRAME_COMETAPI_BASE_URL',
      originalEnv.LEXFRAME_COMETAPI_BASE_URL,
    );
    restoreEnv(
      'LEXFRAME_AI_DEFAULT_MODEL',
      originalEnv.LEXFRAME_AI_DEFAULT_MODEL,
    );
  });

  it('rotates through configured CometAPI keys and de-duplicates them', async () => {
    process.env.COMETAPI_API_KEY = 'stage0_comet_api_key';
    process.env.COMETAPI_API_KEYS =
      'test_comet_key_one,test_comet_key_two,test_comet_key_one';
    const fetchMock = mockCometFetch();
    const adapter = new CometApiAdapter();

    await adapter.generateStructured(request);
    await adapter.generateStructured(request);

    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect((firstInit?.headers as Record<string, string>).authorization).toBe(
      'Bearer test_comet_key_one',
    );
    expect((secondInit?.headers as Record<string, string>).authorization).toBe(
      'Bearer test_comet_key_two',
    );
  });

  it('uses the legacy single CometAPI key when no key list is configured', async () => {
    process.env.COMETAPI_API_KEY = 'test_comet_single_key';
    process.env.COMETAPI_API_KEYS = '';
    const fetchMock = mockCometFetch();
    const adapter = new CometApiAdapter();

    const response = await adapter.generateStructured(request);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer test_comet_single_key',
    );
    expect(response).toEqual(
      expect.objectContaining({
        provider: 'cometapi',
        model: 'grok-4-1-fast-non-reasoning',
        output: { ok: true },
        usedFallback: false,
      }),
    );
  });

  it('refreshes the fallback CometAPI key instead of reusing a stale adapter cache', async () => {
    process.env.COMETAPI_KEY = 'sk-old-cache-test-key';
    process.env.COMETAPI_API_KEY = 'stage0_comet_api_key';
    process.env.COMETAPI_API_KEYS = '';
    const adapter = new CometApiAdapter();
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        [
          'data: {"choices":[{"delta":{"content":"fresh"}}]}',
          'data: [DONE]',
          '',
        ].join('\n'),
        {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        },
      ),
    );

    process.env.COMETAPI_KEY = 'sk-new-cache-test-key';
    const response = await adapter.streamChatCompletion({
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'smoke' }],
      maxTokens: 256,
      reasoningEffort: 'high',
      thinking: { type: 'enabled' },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer sk-new-cache-test-key',
    );
    expect(response.requestDescriptor.fingerprintsMatch).toBe(true);
    expect(response.requestDescriptor.outgoingHeaderLength).toBe(
      'sk-new-cache-test-key'.length,
    );
    expect(JSON.stringify(response)).not.toContain('sk-new-cache-test-key');
  });

  it('uses the Stage 18 configurable OpenAI-compatible base URL', async () => {
    process.env.COMETAPI_API_KEY = 'test_comet_single_key';
    process.env.COMETAPI_API_KEYS = '';
    process.env.LEXFRAME_COMETAPI_BASE_URL = 'https://gateway.example/v9';
    process.env.LEXFRAME_AI_DEFAULT_MODEL = 'deepseek-v4-flash';
    const fetchMock = mockCometFetch();
    const adapter = new CometApiAdapter();

    await adapter.generateStructured({
      ...request,
      model: 'deepseek-v4-flash',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://gateway.example/v9/chat/completions',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(typeof init?.body).toBe('string');
    expect(init?.body).toContain('"model":"deepseek-v4-flash"');
  });

  it('uses a workspace runtime connection key and base URL before env fallback', async () => {
    process.env.COMETAPI_API_KEY = 'test_env_key';
    process.env.COMETAPI_API_KEYS = '';
    process.env.LEXFRAME_COMETAPI_BASE_URL = 'https://env-gateway.example/v1';
    const fetchMock = mockCometFetch();
    const adapter = new CometApiAdapter();

    await adapter.generateStructured({
      ...request,
      runtimeConnection: {
        providerConnectionId: 'conn_workspace_ai',
        baseUrl: 'https://workspace-gateway.example/v2',
        apiKey: new SecretString('sk-workspace-runtime-key'),
        fingerprint: 'sha256:workspace',
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://workspace-gateway.example/v2/chat/completions',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer sk-workspace-runtime-key',
    );
    expect((init?.headers as Record<string, string>).authorization).not.toBe(
      'Bearer test_env_key',
    );
    expect(typeof init?.body).toBe('string');
    expect(init?.body).toContain('"model":"grok-4-1-fast-non-reasoning"');
    expect(init?.body).not.toContain('test_env_key');
  });

  it('streams project chat completions with CometAPI thinking parameters and safe evidence', async () => {
    process.env.COMETAPI_API_KEY = 'test_env_key';
    process.env.COMETAPI_API_KEYS = '';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        [
          'data: {"choices":[{"delta":{"reasoning_content":"compare the decimals"}}]}',
          'data: {"choices":[{"delta":{"content":"9.8 is greater "}}]}',
          'data: {"choices":[{"delta":{"model_extra":{"reasoning_content":"final check"},"content":"than 9.11."}}]}',
          'data: [DONE]',
          '',
        ].join('\n\n'),
        {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        },
      ),
    );
    const adapter = new CometApiAdapter();

    const response = await adapter.streamChatCompletion({
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        {
          role: 'user',
          content:
            'Which number is greater, 9.11 or 9.8? Answer with one sentence.',
        },
      ],
      maxTokens: 256,
      reasoningEffort: 'high',
      thinking: { type: 'enabled' },
      runtimeConnection: {
        providerConnectionId: 'conn_workspace_ai',
        baseUrl: 'https://api.cometapi.com/v1/',
        apiKey: new SecretString('sk-workspace-runtime-key'),
        fingerprint: 'sha256:workspace',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.cometapi.com/v1/chat/completions',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer sk-workspace-runtime-key',
    );
    const body = parseRequestJsonBody(init);
    expect(body).toMatchObject({
      model: 'deepseek-v4-pro',
      stream: true,
      max_tokens: 256,
      reasoning_effort: 'high',
      thinking: { type: 'enabled' },
    });
    expect(Object.keys(body)).toEqual([
      'model',
      'messages',
      'stream',
      'max_tokens',
      'reasoning_effort',
      'thinking',
    ]);
    expect(response).toMatchObject({
      ok: true,
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      text: '9.8 is greater than 9.11.',
      contentChunkCount: 2,
      reasoningChunkCount: 2,
      requestDescriptor: {
        provider: 'cometapi',
        compatibility: 'openai_chat_completions',
        method: 'POST',
        endpointPath: '/chat/completions',
        baseUrlHost: 'api.cometapi.com',
        baseUrlPath: '/v1',
        model: 'deepseek-v4-pro',
        hasAuthorizationHeader: true,
        authorizationScheme: 'Bearer',
        secretFingerprint: 'sha256:workspace',
        fingerprintsMatch: true,
        outgoingHeaderLength: 'sk-workspace-runtime-key'.length,
        stream: true,
        maxTokens: 256,
        reasoningEffort: 'high',
        thinkingEnabled: true,
      },
    });
    expect(response.requestDescriptor.sourceTokenFingerprint).toMatch(
      /^sha256:[a-f0-9]{16}$/,
    );
    expect(response.requestDescriptor.outgoingHeaderTokenFingerprint).toBe(
      response.requestDescriptor.sourceTokenFingerprint,
    );
    expect(JSON.stringify(response)).not.toContain('sk-workspace-runtime-key');
    expect(JSON.stringify(response)).not.toContain('Bearer sk-');
  });

  it('retries CometAPI chat once with visible-first parameters when the first stream has only reasoning chunks', async () => {
    process.env.COMETAPI_API_KEY = 'test_env_key';
    process.env.COMETAPI_API_KEYS = '';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          [
            'data: {"choices":[{"delta":{"reasoning_content":"thinking only"}}]}',
            'data: [DONE]',
            '',
          ].join('\n\n'),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          [
            'data: {"choices":[{"delta":{"text":"Visible "}}]}',
            'data: {"choices":[{"delta":{"output_text":"answer"}}]}',
            'data: [DONE]',
            '',
          ].join('\n\n'),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
      );
    const adapter = new CometApiAdapter();

    const response = await adapter.streamChatCompletion({
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Say visible text.' }],
      maxTokens: 256,
      reasoningEffort: 'high',
      thinking: { type: 'enabled' },
      runtimeConnection: {
        providerConnectionId: 'conn_workspace_ai',
        baseUrl: 'https://api.cometapi.com/v1',
        apiKey: new SecretString('sk-workspace-runtime-key'),
        fingerprint: 'sha256:workspace',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = parseRequestJsonBody(
      fetchMock.mock.calls[0]?.[1] as RequestInit | undefined,
    );
    const retryBody = parseRequestJsonBody(
      fetchMock.mock.calls[1]?.[1] as RequestInit | undefined,
    );

    expect(firstBody).toMatchObject({
      max_tokens: 256,
      reasoning_effort: 'high',
      thinking: { type: 'enabled' },
    });
    expect(retryBody).toMatchObject({
      max_tokens: 768,
      reasoning_effort: 'low',
      thinking: { type: 'disabled' },
    });
    expect(response).toMatchObject({
      ok: true,
      text: 'Visible answer',
      attemptCount: 2,
      retryReason: 'PROVIDER_EMPTY_RESPONSE',
      contentChunkCount: 2,
      reasoningChunkCount: 1,
      requestDescriptor: {
        maxTokens: 768,
        reasoningEffort: 'low',
        thinkingEnabled: false,
      },
    });
    expect(JSON.stringify(response)).not.toContain('sk-workspace-runtime-key');
    expect(JSON.stringify(response)).not.toContain('Bearer sk-');
  });

  it('retries OpenAI-compatible chat without reasoning-only request options when the provider rejects them', async () => {
    process.env.COMETAPI_API_KEY = 'test_env_key';
    process.env.COMETAPI_API_KEYS = '';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Unrecognized request argument supplied: thinking',
            },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          [
            'data: {"choices":[{"delta":{"content":"Recovered answer"}}]}',
            'data: [DONE]',
            '',
          ].join('\n\n'),
          {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          },
        ),
      );
    const adapter = new CometApiAdapter();

    const response = await adapter.streamChatCompletion({
      provider: 'cometapi',
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'Say visible text.' }],
      maxTokens: 256,
      reasoningEffort: 'high',
      thinking: { type: 'enabled' },
      runtimeConnection: {
        providerConnectionId: 'conn_workspace_ai',
        baseUrl: 'https://api.cometapi.com/v1',
        apiKey: new SecretString('sk-workspace-runtime-key'),
        fingerprint: 'sha256:workspace',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = parseRequestJsonBody(
      fetchMock.mock.calls[0]?.[1] as RequestInit | undefined,
    );
    const retryBody = parseRequestJsonBody(
      fetchMock.mock.calls[1]?.[1] as RequestInit | undefined,
    );

    expect(firstBody).toEqual(
      expect.objectContaining({
        reasoning_effort: 'high',
        thinking: { type: 'enabled' },
      }),
    );
    expect(retryBody).not.toHaveProperty('reasoning_effort');
    expect(retryBody).not.toHaveProperty('thinking');
    expect(response).toMatchObject({
      ok: true,
      text: 'Recovered answer',
      attemptCount: 2,
      retryReason: 'PROVIDER_UNSUPPORTED_REQUEST_OPTIONS',
      requestDescriptor: {
        bodyKeys: ['model', 'messages', 'stream', 'max_tokens'],
        reasoningEffort: 'none',
        thinkingEnabled: false,
      },
    });
    expect(JSON.stringify(response)).not.toContain('sk-workspace-runtime-key');
  });

  it('redacts provider auth failures by returning only the configured fallback', async () => {
    process.env.COMETAPI_API_KEY = 'test_env_key_12345';
    process.env.COMETAPI_API_KEYS = '';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'invalid token sk-workspace-runtime-key',
          },
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const adapter = new CometApiAdapter();

    const response = await adapter.generateStructured({
      ...request,
      runtimeConnection: {
        providerConnectionId: 'conn_workspace_ai',
        baseUrl: 'https://workspace-gateway.example/v2',
        apiKey: new SecretString('sk-workspace-runtime-key'),
        fingerprint: 'sha256:workspace',
      },
    });

    expect(response).toEqual(
      expect.objectContaining({
        provider: 'cometapi',
        model: 'grok-4-1-fast-non-reasoning',
        output: { ok: false },
        usedFallback: true,
      }),
    );
    expect(JSON.stringify(response)).not.toContain('sk-workspace-runtime-key');
  });
});

function mockCometFetch() {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: {
          prompt_tokens: 7,
          completion_tokens: 3,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    ),
  );
}

function restoreEnv(
  key:
    | 'COMETAPI_KEY'
    | 'COMETAPI_API_KEY'
    | 'COMETAPI_API_KEYS'
    | 'LEXFRAME_COMETAPI_BASE_URL'
    | 'LEXFRAME_AI_DEFAULT_MODEL',
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function parseRequestJsonBody(init: RequestInit | undefined) {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected JSON request body.');
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}
