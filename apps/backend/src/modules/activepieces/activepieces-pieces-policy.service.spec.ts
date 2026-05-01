import { ActivepiecesPiecesPolicyService } from './activepieces-pieces-policy.service';

describe('ActivepiecesPiecesPolicyService', () => {
  const service = new ActivepiecesPiecesPolicyService();

  it('builds an ALLOWED allowlist policy with a stable policy hash', () => {
    const policy = service.buildAutomationCanvasPolicy({
      workspaceSecurity: {
        workspaceId: 'ws_test',
        incidentLockActive: false,
        tokenTtlSeconds: 120,
        piecesFilterType: 'ALLOWED',
        piecesTags: ['legal-core'],
      },
      automation: {
        id: 'aut_test',
        workspace_id: 'ws_test',
        template_id: 'tpl_test',
        source_template_version_id: 'tpv_test',
        title: 'Policy test',
        version: 'v1',
        workflow_state: 'compiled',
        builder_state: 'ready',
        sync_state: 'synced',
        compatibility_status: 'compatible',
        available: true,
        workflow: {
          steps: [
            { moduleCode: 'legal.research' },
            { moduleCode: 'document.generate' },
          ],
        },
        active_canvas_version_id: null,
        production_disabled_at: null,
        production_disabled_reason: null,
        runtime_project_id: 'proj_test',
        runtime_flow_id: 'flow_test',
        sync_hash: 'sync_test',
      },
    });

    expect(policy.piecesFilterType).toBe('ALLOWED');
    expect(policy.piecesTags).toEqual(
      expect.arrayContaining([
        'lexframe-core',
        'lexframe-runtime',
        'legal-core',
        'document-core',
      ]),
    );
    expect(policy.policyHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(policy.denylistedPieces).toContain('@activepieces/piece-openai');
    expect(policy.denylistedPieces).not.toContain('@activepieces/piece-http');
    expect(policy.denylistedPieces).not.toContain('@activepieces/piece-gmail');
  });

  it('rejects non-ALLOWED pieces policy values', () => {
    try {
      service.buildAutomationCanvasPolicy({
        workspaceSecurity: {
          workspaceId: 'ws_test',
          incidentLockActive: false,
          tokenTtlSeconds: 120,
          piecesFilterType: 'NONE',
          piecesTags: [],
        },
        automation: {
          id: 'aut_test',
          workspace_id: 'ws_test',
          template_id: 'tpl_test',
          source_template_version_id: 'tpv_test',
          title: 'Policy test',
          version: 'v1',
          workflow_state: 'compiled',
          builder_state: 'ready',
          sync_state: 'synced',
          compatibility_status: 'compatible',
          available: true,
          workflow: null,
          active_canvas_version_id: null,
          production_disabled_at: null,
          production_disabled_reason: null,
          runtime_project_id: 'proj_test',
          runtime_flow_id: 'flow_test',
          sync_hash: 'sync_test',
        },
      });
      throw new Error('Expected PIECES_POLICY_INVALID');
    } catch (error) {
      expect(error).toMatchObject({ code: 'PIECES_POLICY_INVALID' });
    }
  });
});
