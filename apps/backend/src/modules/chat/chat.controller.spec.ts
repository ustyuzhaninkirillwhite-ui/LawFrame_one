import { buildSseResponseHeaders } from './chat-sse-headers';

describe('ChatController SSE response headers', () => {
  it('adds CORS headers to manual SSE responses', () => {
    expect(buildSseResponseHeaders('http://127.0.0.1:3000')).toMatchObject({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'access-control-allow-origin': 'http://127.0.0.1:3000',
      vary: 'origin',
    });
  });
});
