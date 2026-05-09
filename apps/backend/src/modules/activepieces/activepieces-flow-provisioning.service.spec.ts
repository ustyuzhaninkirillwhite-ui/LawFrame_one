import { AppHttpException } from '../../common/errors/app-http.exception';
import { ActivepiecesFlowProvisioningService } from './activepieces-flow-provisioning.service';
import type {
  ActivepiecesInstalledAutomationForSession,
  ActivepiecesProjectBindingForSession,
} from './activepieces-session.types';

describe('ActivepiecesFlowProvisioningService', () => {
  it('blocks a canvas session when the Stage 17 flow binding points to another project', async () => {
    const databaseService = {
      one: jest
        .fn()
        .mockResolvedValueOnce({
          external_project_id: 'ap_project_expected',
          external_flow_id: 'flow_expected',
          activepieces_flow_version_id: null,
          sync_hash: 'hash_runtime',
          status: 'synced',
        })
        .mockResolvedValueOnce({
          ap_project_id: 'ap_project_other',
          ap_flow_id: 'flow_other',
          ap_flow_version_id: null,
          last_synced_hash: 'hash_flow',
          sync_status: 'synced',
        }),
      query: jest.fn(),
    };
    const service = new ActivepiecesFlowProvisioningService(
      databaseService as never,
    );

    await expect(
      service.ensureFlowBinding({
        workspaceId: 'ws_1',
        routeProjectId: 'project_claim_001',
        automation: automation(),
        projectBinding: projectBinding(),
        traceId: 'trace_1',
      }),
    ).rejects.toBeInstanceOf(AppHttpException);
  });
});

function automation(): ActivepiecesInstalledAutomationForSession {
  return {
    id: 'aut_1',
    workspace_id: 'ws_1',
    template_id: 'tpl_1',
    source_template_version_id: 'tplv_1',
    title: 'Automation',
    version: '1',
    workflow_state: 'compiled',
    builder_state: 'ready',
    sync_state: 'synced',
    compatibility_status: 'compatible',
    available: true,
    workflow: {},
    active_canvas_version_id: 'version_1',
    production_disabled_at: null,
    production_disabled_reason: null,
    runtime_project_id: 'ap_project_expected',
    runtime_flow_id: 'flow_expected',
    sync_hash: 'hash_runtime',
  };
}

function projectBinding(): ActivepiecesProjectBindingForSession {
  return {
    id: 'binding_1',
    externalProjectId: 'lex_ws_1',
    activepiecesProjectId: 'ap_project_expected',
  };
}
