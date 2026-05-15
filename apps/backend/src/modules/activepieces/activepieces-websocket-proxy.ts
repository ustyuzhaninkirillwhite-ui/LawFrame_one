import type { IncomingMessage, Server } from 'node:http';
import { createConnection } from 'node:net';
import type { Duplex } from 'node:stream';
import { connect as createTlsConnection } from 'node:tls';

type ActivepiecesSocketProxyEnv = {
  readonly ACTIVEPIECES_BASE_URL: string;
};

type ActivepiecesSocketProxyLogger = {
  readonly warn?: (message: string, meta?: Record<string, unknown>) => void;
};

export function installActivepiecesWebSocketProxy(
  server: Server,
  env: ActivepiecesSocketProxyEnv,
  logger: ActivepiecesSocketProxyLogger = {},
) {
  server.on('upgrade', (request, socket, head) => {
    if (!isActivepiecesSocketUpgradePath(request.url ?? '')) {
      return;
    }

    proxyActivepiecesSocketUpgrade(request, socket, head, env, logger);
  });
}

export function isActivepiecesSocketUpgradePath(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'http://lexframe.local');
    return (
      parsed.pathname === '/api/socket.io' ||
      parsed.pathname.startsWith('/api/socket.io/') ||
      parsed.pathname === '/socket.io' ||
      parsed.pathname.startsWith('/socket.io/')
    );
  } catch {
    return false;
  }
}

export function buildActivepiecesUpgradeRequest(
  request: IncomingMessage,
  upstream: URL,
) {
  const path = request.url || '/api/socket.io/';
  const headers = Object.entries(request.headers)
    .filter(([name, value]) => {
      return value !== undefined && name.toLowerCase() !== 'host';
    })
    .flatMap(([name, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.map((entry) => `${name}: ${entry}`);
    });

  headers.unshift(`Host: ${upstream.host}`);

  return [
    `${request.method || 'GET'} ${path} HTTP/${request.httpVersion || '1.1'}`,
    ...headers,
    '',
    '',
  ].join('\r\n');
}

function proxyActivepiecesSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  env: ActivepiecesSocketProxyEnv,
  logger: ActivepiecesSocketProxyLogger,
) {
  let upstream: URL;
  try {
    upstream = new URL(env.ACTIVEPIECES_BASE_URL);
  } catch {
    socket.destroy();
    return;
  }

  const port = Number(upstream.port || (upstream.protocol === 'https:' ? 443 : 80));
  const upstreamSocket =
    upstream.protocol === 'https:'
      ? createTlsConnection({
          host: upstream.hostname,
          port,
          servername: upstream.hostname,
        })
      : createConnection({
          host: upstream.hostname,
          port,
        });

  upstreamSocket.once('connect', () => {
    upstreamSocket.write(buildActivepiecesUpgradeRequest(request, upstream));
    if (head.length > 0) {
      upstreamSocket.write(head);
    }
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstreamSocket.once('error', (error: Error) => {
    logger.warn?.('ActivePieces websocket proxy failed', {
      path: request.url,
      reason: error instanceof Error ? error.message : String(error),
    });
    socket.destroy();
  });

  socket.once('error', () => {
    upstreamSocket.destroy();
  });
}
