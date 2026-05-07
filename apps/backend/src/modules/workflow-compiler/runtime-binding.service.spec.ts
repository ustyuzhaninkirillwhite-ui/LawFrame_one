import { RuntimeBindingService } from './runtime-binding.service';

describe('RuntimeBindingService', () => {
  function createService() {
    const client = {
      query: jest.fn(),
    };
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(
        async (callback: (clientArg: typeof client) => Promise<unknown>) =>
          callback(client),
      ),
    };

    return {
      service: new RuntimeBindingService(databaseService as never),
      databaseService,
      client,
    };
  }

  it('qualifies runtime_hash when marking Activepieces snapshots as synced', async () => {
    const { service, client } = createService();
    client.query.mockResolvedValue({ rows: [] });
    client.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'binding_stage17',
          workspace_id: 'ws_stage17',
          installed_automation_id: 'aut_stage17',
          automation_version_id: 'ver_stage17',
          runtime_projection_id: null,
          runtime: 'activepieces',
          external_project_id: 'proj_stage17',
          external_flow_id: 'flow_stage17',
          activepieces_flow_version_id: 'flow_version_stage17',
          status: 'synced',
          source_workflow_hash: 'source_hash',
          runtime_hash: 'runtime_hash',
          last_synced_hash: 'runtime_hash',
          last_compile_report_id: 'compile_report',
          last_synced_at: '2026-05-07T09:00:00.000Z',
          last_checked_at: '2026-05-07T09:00:00.000Z',
          projection: {},
          active: true,
        },
      ],
    });

    await service.persistSyncSuccess({
      workspaceId: 'ws_stage17',
      automationId: 'aut_stage17',
      sourceTemplateVersionId: 'tpl_ver_stage17',
      automationVersionId: 'ver_stage17',
      runtimeProjectionId: null,
      projectId: 'proj_stage17',
      flowId: 'flow_stage17',
      flowVersionId: 'flow_version_stage17',
      sourceWorkflowHash: 'source_hash',
      runtimeHash: 'runtime_hash',
      compileReportId: 'compile_report',
      projectionHash: 'projection_hash',
      projection: {
        schemaVersion: '20',
        displayName: 'Stage 17 flow',
        trigger: null,
        actions: [],
        branches: [],
        notes: [],
        metadata: {},
      },
      snapshot: {},
      normalizedSnapshot: {},
      stepMappings: [],
      actorId: 'usr_stage17',
      idempotencyKey: 'sync_stage17',
      traceId: 'trace_stage17',
    });

    const snapshotUpdateSql = client.query.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes('update app.activepieces_flow_snapshots s'));

    expect(snapshotUpdateSql).toContain(
      'runtime_hash = coalesce(s.runtime_hash, s.snapshot_hash)',
    );
    expect(snapshotUpdateSql).not.toContain(
      'runtime_hash = coalesce(runtime_hash, snapshot_hash)',
    );
  });
});
