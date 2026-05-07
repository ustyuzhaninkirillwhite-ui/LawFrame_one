import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { ActivepiecesSyncService } from './activepieces-sync.service';

describe('ActivepiecesSyncService', () => {
  const actor: AuthenticatedActor = {
    id: 'usr_stage17_owner',
    email: 'owner@lexframe.local',
    fullName: 'Owner User',
    emailConfirmedAt: '2026-04-28T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_stage17_owner',
  };

  function createService() {
    const databaseService = {
      one: jest.fn(),
    };
    const activepieces = {
      ensureProject: jest.fn(),
      getProject: jest.fn(),
    };

    return {
      service: new ActivepiecesSyncService(
        databaseService as never,
        activepieces as never,
      ),
      databaseService,
      activepieces,
    };
  }

  it('creates Stage 17-compatible project bindings with provisioned status', async () => {
    const { service, databaseService, activepieces } = createService();
    activepieces.ensureProject.mockResolvedValue({ id: 'proj_stage17' });
    databaseService.one.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'binding_stage17',
      external_project_id: 'proj_stage17',
    });

    const result = await service.ensureProjectBinding({
      workspaceId: 'ws_stage17_main',
      actor,
      displayName: 'Stage 17 automation',
    });

    expect(result).toEqual({
      id: 'binding_stage17',
      external_project_id: 'proj_stage17',
    });

    const insertSql = String(databaseService.one.mock.calls[1]?.[0] ?? '');
    expect(insertSql).toContain("'provisioned'");
    expect(insertSql).toContain("status = 'provisioned'");
    expect(insertSql).not.toContain("'active'");
  });

  it('uses a deterministic workspace external project id for project provisioning', async () => {
    const { service, databaseService, activepieces } = createService();
    activepieces.ensureProject.mockResolvedValue({ id: 'ap_project_ws_a' });
    databaseService.one.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'binding_ws_a',
      external_project_id: 'ap_project_ws_a',
    });

    const result = await service.ensureProjectBinding({
      workspaceId: 'ws_stage17_a',
      actor,
      displayName: 'Shared automation title',
    });

    expect(result).toEqual({
      id: 'binding_ws_a',
      external_project_id: 'ap_project_ws_a',
    });
    expect(activepieces.ensureProject).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Shared automation title',
        externalId: 'lf-ws_stage17_a',
        metadata: expect.objectContaining({
          managedBy: 'lexframe',
          workspaceId: 'ws_stage17_a',
        }),
      }),
    );

    const insertSql = String(databaseService.one.mock.calls[1]?.[0] ?? '');
    const insertParams = databaseService.one.mock.calls[1]?.[1] as
      | readonly unknown[]
      | undefined;
    expect(insertSql).toContain('deterministic_external_project_id');
    expect(insertParams).toContain('lf-ws_stage17_a');
  });
});
