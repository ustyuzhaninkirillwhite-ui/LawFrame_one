import { ChatStreamService } from './chat-stream.service';

describe('ChatStreamService', () => {
  it('creates resumable LexFrame stream events without exposing raw key material', () => {
    const service = new ChatStreamService();

    const stream = service.createStreamSnapshot({
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      routeSnapshot: {
        route: 'default_chat',
        provider: 'cometapi',
        model: 'deepseek-v4-flash',
        policyDecisionId: 'policy-1',
        keyFingerprint: 'sha256:abcdef1234567890',
        traceId: 'trace-1',
      },
      text: 'Ответ по проекту.',
    });

    expect(stream.status).toBe('completed');
    expect(stream.events.map((event) => event.type)).toEqual([
      'message_start',
      'route_snapshot',
      'text_delta',
      'usage',
      'message_done',
    ]);
    expect(stream.events[1]?.payload).toMatchObject({
      route: 'default_chat',
      provider: 'cometapi',
      model: 'deepseek-v4-flash',
      keyFingerprintPrefix: 'sha256:abcdef12',
    });
    expect(JSON.stringify(stream)).not.toContain('abcdef1234567890');
    expect(JSON.stringify(stream)).not.toContain('api_key');
  });
});
