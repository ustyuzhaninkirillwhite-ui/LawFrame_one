import { ActivepiecesController } from './activepieces.controller';

jest.mock('../../common/guards/auth.guard', () => ({
  AuthGuard: class AuthGuard {},
}));
jest.mock('../../common/guards/permission.guard', () => ({
  PermissionGuard: class PermissionGuard {},
}));
jest.mock('../../common/guards/workspace-context.guard', () => ({
  WorkspaceContextGuard: class WorkspaceContextGuard {},
}));
jest.mock('./activepieces.service', () => ({
  ActivepiecesService: class ActivepiecesService {},
}));

describe('ActivepiecesController runtime proxy', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('proxies ActivePieces socket.io API paths through the runtime upstream', async () => {
    process.env.ACTIVEPIECES_BASE_URL = 'http://activepieces-app:80';
    process.env.ACTIVEPIECES_PUBLIC_URL = 'http://127.0.0.1:3104';

    const fetchMock = jest.fn(async () => {
      return new Response(Buffer.from('ok'), {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    const reply = createReply();
    const controller = new ActivepiecesController({} as never);

    await controller.proxyActivepiecesApiSocketIoRoot(
      {
        method: 'GET',
        url: '/api/socket.io/?EIO=4&transport=websocket',
        headers: {},
        body: undefined,
      } as never,
      reply,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://activepieces-app:80/api/socket.io/?EIO=4&transport=websocket',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    );
    expect(reply.statusCode).toBe(200);
    expect(reply.payload?.toString('utf8')).toBe('ok');
  });
});

function createReply() {
  const reply = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    payload: null as string | Buffer | null,
    code(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    header(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    type(contentType: string) {
      this.headers['content-type'] = contentType;
      return this;
    },
    send(payload: string | Buffer) {
      this.payload = payload;
      return payload;
    },
  };
  return reply;
}
