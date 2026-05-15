import { ActivepiecesIdentityBridge } from './activepieces-identity-bridge';

describe('ActivepiecesIdentityBridge', () => {
  it('uses project owner membership for ActivePieces runtimes without project_member', async () => {
    const activepiecesClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'ap_project_1', platformId: 'platform_1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'ap_user_1', platformId: 'platform_1' }],
        })
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValueOnce({ rows: [] }),
      release: jest.fn(),
    };
    const databaseService = {
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      one: jest.fn(),
    };
    const bridge = new ActivepiecesIdentityBridge(databaseService as never, {
      getPool: () => ({
        connect: jest.fn(() => Promise.resolve(activepiecesClient)),
      }),
    } as never);

    await bridge.ensureProjectMembership({
      workspaceId: 'ws_1',
      projectBinding: {
        id: 'project_binding_1',
        externalProjectId: 'lex_ws_1',
        activepiecesProjectId: 'ap_project_1',
      },
      userBinding: {
        id: 'user_binding_1',
        externalUserId: 'lex_user_1',
        activepiecesUserId: 'ap_user_1',
        activepiecesRole: 'EDITOR',
      },
      role: 'EDITOR',
      traceId: 'trace_1',
    });

    expect(activepiecesClient.query).toHaveBeenCalledWith(
      expect.stringContaining('update project'),
      ['ap_project_1', 'ap_user_1'],
    );
    expect(
      activepiecesClient.query.mock.calls.some(([query]) =>
        String(query).includes('insert into project_member'),
      ),
    ).toBe(false);
    expect(databaseService.query).toHaveBeenCalledTimes(2);
  });
});
