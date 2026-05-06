import { buildStage18StreamEvents } from './ai-stream-protocol';

describe('Stage 18 stream protocol', () => {
  it('emits route snapshot, usage and completion events without secrets', () => {
    const events = buildStage18StreamEvents({
      traceId: 'trace_stage18_test',
      route: {
        routeCode: 'default_chat',
        providerCode: 'cometapi',
        model: 'deepseek-v4-flash',
      },
      text: 'Готово',
      usage: {
        inputTokens: 10,
        outputTokens: 3,
      },
    });

    expect(events.map((event) => event.type)).toEqual([
      'message_start',
      'route_snapshot',
      'text_delta',
      'usage',
      'message_done',
    ]);
    expect(JSON.stringify(events)).toContain('deepseek-v4-flash');
    expect(JSON.stringify(events)).not.toMatch(
      /api[_-]?key|Bearer|signedUrl|scopedRuntimeToken/i,
    );
  });
});
