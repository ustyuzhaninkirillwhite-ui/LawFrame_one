import {
  CometApiAdapter,
  type StructuredAiRequest,
} from './ai-provider.adapters';

describe('CometApiAdapter', () => {
  const originalEnv = {
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
