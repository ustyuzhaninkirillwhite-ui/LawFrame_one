import { ActivepiecesCanvasReadinessService } from './activepieces-canvas-readiness.service';

describe('ActivepiecesCanvasReadinessService', () => {
  it('accepts project owner membership when ActivePieces runtime has no project_member table', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ap_project_1',
              externalId: 'lex_ws_1',
              platformId: 'platform_1',
              ownerId: 'ap_user_1',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ap_user_1',
              externalId: 'lex_user_1',
              platformId: 'platform_1',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ap_flow_1',
              projectId: 'ap_project_1',
              publishedVersionId: 'ap_version_1',
              status: 'DISABLED',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'ap_version_1',
              flowId: 'ap_flow_1',
              valid: true,
              state: 'DRAFT',
            },
          ],
        }),
      release: jest.fn(),
    };
    const service = new ActivepiecesCanvasReadinessService({
      getPool: () => ({
        connect: jest.fn(() => Promise.resolve(client)),
      }),
    } as never);

    const readiness = await service.validate({
      workspaceId: 'ws_1',
      projectId: 'project_claim_001',
      automationId: 'aut_1',
      projectBinding: {
        id: 'binding_1',
        externalProjectId: 'lex_ws_1',
        activepiecesProjectId: 'ap_project_1',
      },
      userBinding: {
        id: 'user_binding_1',
        externalUserId: 'lex_user_1',
        activepiecesUserId: 'ap_user_1',
        activepiecesRole: 'EDITOR',
      },
      flowBinding: {
        automationId: 'aut_1',
        activepiecesProjectId: 'ap_project_1',
        activepiecesFlowId: 'ap_flow_1',
        activepiecesFlowVersionId: 'ap_version_1',
        syncStatus: 'synced',
        syncHash: 'hash',
      },
      repairAttempted: false,
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.reason_code).toBe('READY');
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'ap.project_owner',
          status: 'pass',
        }),
      ]),
    );
  });
});
