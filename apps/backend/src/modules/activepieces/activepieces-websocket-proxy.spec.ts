import type { IncomingMessage } from 'node:http';
import {
  buildActivepiecesUpgradeRequest,
  isActivepiecesSocketUpgradePath,
} from './activepieces-websocket-proxy';

describe('activepieces websocket proxy helpers', () => {
  it('recognizes ActivePieces socket.io upgrade paths only', () => {
    expect(
      isActivepiecesSocketUpgradePath('/api/socket.io/?EIO=4&transport=websocket'),
    ).toBe(true);
    expect(
      isActivepiecesSocketUpgradePath('/socket.io/?EIO=4&transport=websocket'),
    ).toBe(true);
    expect(isActivepiecesSocketUpgradePath('/api/v1/flows')).toBe(false);
    expect(isActivepiecesSocketUpgradePath('/chat')).toBe(false);
  });

  it('forwards websocket upgrade requests to the ActivePieces upstream host', () => {
    const request = {
      method: 'GET',
      url: '/api/socket.io/?EIO=4&transport=websocket',
      httpVersion: '1.1',
      headers: {
        host: '127.0.0.1:3104',
        upgrade: 'websocket',
        connection: 'Upgrade',
        'sec-websocket-key': 'test-key',
      },
    } as unknown as IncomingMessage;

    const rawRequest = buildActivepiecesUpgradeRequest(
      request,
      new URL('http://activepieces-app:80'),
    );

    expect(rawRequest).toContain(
      'GET /api/socket.io/?EIO=4&transport=websocket HTTP/1.1',
    );
    expect(rawRequest).toContain('Host: activepieces-app');
    expect(rawRequest).toContain('upgrade: websocket');
    expect(rawRequest).not.toContain('Host: 127.0.0.1:3104');
  });
});
