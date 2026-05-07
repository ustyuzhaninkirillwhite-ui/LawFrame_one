import type {
  RuntimeBindingDto,
  RuntimeSnapshotSource,
} from '@lexframe/contracts';
import type { PoolClient, QueryResultRow } from 'pg';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type {
  ActivepiecesFlowProjection,
  RuntimeBindingRow,
  RuntimeStepMappingDraft,
} from './workflow-compiler.types';

type Queryable = Pick<PoolClient, 'query'> | DatabaseService;

interface PersistSyncSuccessInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly sourceTemplateVersionId: string | null;
  readonly automationVersionId: string | null;
  readonly runtimeProjectionId?: string | null;
  readonly projectId: string;
  readonly flowId: string;
  readonly flowVersionId: string | null;
  readonly sourceWorkflowHash: string;
  readonly runtimeHash: string;
  readonly compileReportId: string;
  readonly projectionHash: string;
  readonly projection: ActivepiecesFlowProjection;
  readonly snapshot: unknown;
  readonly normalizedSnapshot: unknown;
  readonly stepMappings: readonly RuntimeStepMappingDraft[];
  readonly actorId: string;
  readonly idempotencyKey: string | null;
  readonly traceId: string | null;
}

@Injectable()
export class RuntimeBindingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getBinding(
    workspaceId: string,
    automationId: string,
  ): Promise<RuntimeBindingRow | null> {
    return this.databaseService.one<RuntimeBindingRow>(
      `
        select
          id,
          workspace_id,
          installed_automation_id,
          automation_version_id,
          runtime_projection_id,
          runtime,
          external_project_id,
          external_flow_id,
          activepieces_flow_version_id,
          status,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          last_compile_report_id,
          last_synced_at,
          last_checked_at,
          projection,
          active
        from app.automation_runtime_bindings
        where workspace_id = $1
          and installed_automation_id = $2
        limit 1
      `,
      [workspaceId, automationId],
    );
  }

  toDto(row: RuntimeBindingRow | null): RuntimeBindingDto | null {
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      automation_id: row.installed_automation_id,
      automation_version_id: row.automation_version_id,
      runtime_projection_id: row.runtime_projection_id,
      runtime: row.runtime,
      activepieces_project_id: row.external_project_id,
      activepieces_flow_id: row.external_flow_id,
      activepieces_flow_version_id: row.activepieces_flow_version_id,
      status: mapBindingStatus(row.status),
      active: row.active ?? true,
      source_workflow_hash: row.source_workflow_hash,
      runtime_hash: row.runtime_hash,
      last_synced_hash: row.last_synced_hash,
      last_compile_report_id: row.last_compile_report_id,
      last_synced_at: row.last_synced_at,
      last_checked_at: row.last_checked_at,
    };
  }

  async findCompletedSyncEvent(input: {
    readonly workspaceId: string;
    readonly automationId: string;
    readonly idempotencyKey: string | null | undefined;
  }): Promise<{ readonly after_runtime_hash: string | null } | null> {
    if (!input.idempotencyKey) {
      return null;
    }
    return this.databaseService.one<{
      readonly after_runtime_hash: string | null;
    }>(
      `
        select after_runtime_hash
        from app.automation_runtime_sync_events
        where workspace_id = $1
          and automation_id = $2
          and event_type = 'runtime_sync'
          and idempotency_key = $3
          and status = 'completed'
        order by created_at desc
        limit 1
      `,
      [input.workspaceId, input.automationId, input.idempotencyKey],
    );
  }

  async recordSyncEvent(input: {
    readonly workspaceId: string;
    readonly automationId: string;
    readonly runtimeBindingId?: string | null;
    readonly eventType: string;
    readonly status: string;
    readonly compileReportId?: string | null;
    readonly beforeRuntimeHash?: string | null;
    readonly afterRuntimeHash?: string | null;
    readonly sourceWorkflowHash?: string | null;
    readonly idempotencyKey?: string | null;
    readonly errorCode?: string | null;
    readonly errorMessage?: string | null;
    readonly actorId?: string | null;
    readonly traceId: string | null;
  }) {
    await this.databaseService.query(
      `
        insert into app.automation_runtime_sync_events (
          id,
          workspace_id,
          automation_id,
          runtime_binding_id,
          event_type,
          status,
          compile_report_id,
          before_runtime_hash,
          after_runtime_hash,
          source_workflow_hash,
          idempotency_key,
          error_code,
          error_message,
          actor_id,
          trace_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        on conflict (workspace_id, automation_id, event_type, idempotency_key)
        do update set
          status = excluded.status,
          runtime_binding_id = excluded.runtime_binding_id,
          compile_report_id = excluded.compile_report_id,
          before_runtime_hash = excluded.before_runtime_hash,
          after_runtime_hash = excluded.after_runtime_hash,
          source_workflow_hash = excluded.source_workflow_hash,
          error_code = excluded.error_code,
          error_message = excluded.error_message
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.automationId,
        input.runtimeBindingId ?? null,
        input.eventType,
        input.status,
        input.compileReportId ?? null,
        input.beforeRuntimeHash ?? null,
        input.afterRuntimeHash ?? null,
        input.sourceWorkflowHash ?? null,
        input.idempotencyKey ?? null,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        input.actorId ?? null,
        input.traceId ?? randomUUID(),
      ],
    );
  }

  async persistSyncSuccess(
    input: PersistSyncSuccessInput,
  ): Promise<RuntimeBindingRow> {
    return this.databaseService.transaction(async (client) => {
      const binding = await this.upsertBinding(client, input);
      const snapshotId = await this.insertSnapshot(client, binding.id, input);
      await this.upsertStage17FlowBinding(
        client,
        binding.id,
        snapshotId,
        input,
      );
      await this.markSyncedSnapshot(client, binding.id, snapshotId, input);
      await this.replaceStepMappings(client, binding.id, input);
      await this.updateInstalledAutomation(client, input);
      await this.insertSyncEvent(client, binding.id, input);
      return binding;
    });
  }

  async saveManualSnapshot(input: {
    readonly workspaceId: string;
    readonly binding: RuntimeBindingRow;
    readonly flowVersionId: string | null;
    readonly snapshot: unknown;
    readonly normalizedSnapshot: unknown;
    readonly snapshotHash: string;
    readonly actorId: string | null;
    readonly source?: RuntimeSnapshotSource;
  }): Promise<string> {
    return this.databaseService.transaction(async (client) => {
      const snapshotId = randomUUID();
      await this.runQuery(client, this.snapshotSql(), [
        snapshotId,
        input.workspaceId,
        input.binding.id,
        input.binding.external_flow_id,
        input.flowVersionId,
        JSON.stringify(input.snapshot),
        JSON.stringify(input.normalizedSnapshot),
        input.snapshotHash,
        input.source ?? 'manual_pull',
        input.actorId,
        input.binding.installed_automation_id,
        input.binding.external_project_id,
        input.binding.runtime_hash,
        input.binding.last_synced_hash,
      ]);
      await this.runQuery(
        client,
        `
          update app.automation_runtime_bindings
          set
            runtime_hash = $3,
            last_runtime_snapshot_id = $5,
            activepieces_flow_version_id = coalesce($4, activepieces_flow_version_id),
            last_checked_at = timezone('utc', now()),
            status = case
              when last_synced_hash = $3 then 'synced'
              else 'runtime_modified'
            end,
            runtime_modified_at = case
              when last_synced_hash = $3 then runtime_modified_at
              else timezone('utc', now())
            end,
            runtime_modified_by = case
              when last_synced_hash = $3 then runtime_modified_by
              else $6
            end,
            updated_at = timezone('utc', now())
          where workspace_id = $1
            and id = $2
        `,
        [
          input.workspaceId,
          input.binding.id,
          input.snapshotHash,
          input.flowVersionId,
          snapshotId,
          input.actorId,
        ],
      );
      return snapshotId;
    });
  }

  private async upsertBinding(
    client: PoolClient,
    input: PersistSyncSuccessInput,
  ) {
    const id = randomUUID();
    const result = await this.runQuery<RuntimeBindingRow>(
      client,
      `
        insert into app.automation_runtime_bindings (
          id,
          installed_automation_id,
          workspace_id,
          source_template_version_id,
          automation_version_id,
          runtime_projection_id,
          runtime,
          external_project_id,
          external_flow_id,
          activepieces_flow_version_id,
          sync_hash,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          last_compile_report_id,
          projection_version,
          projection,
          status,
          last_error,
          last_synced_at,
          last_checked_at,
          active
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'activepieces',
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $12,
          $13,
          'v2',
          $14::jsonb,
          'synced',
          null,
          timezone('utc', now()),
          timezone('utc', now()),
          true
        )
        on conflict (installed_automation_id) do update
        set
          source_template_version_id = excluded.source_template_version_id,
          automation_version_id = excluded.automation_version_id,
          runtime_projection_id = excluded.runtime_projection_id,
          runtime = excluded.runtime,
          external_project_id = excluded.external_project_id,
          external_flow_id = excluded.external_flow_id,
          activepieces_flow_version_id = excluded.activepieces_flow_version_id,
          sync_hash = excluded.sync_hash,
          source_workflow_hash = excluded.source_workflow_hash,
          runtime_hash = excluded.runtime_hash,
          last_synced_hash = excluded.last_synced_hash,
          last_compile_report_id = excluded.last_compile_report_id,
          projection_version = excluded.projection_version,
          projection = excluded.projection,
          status = 'synced',
          active = true,
          last_error = null,
          last_synced_at = timezone('utc', now()),
          last_checked_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning
          id,
          workspace_id,
          installed_automation_id,
          automation_version_id,
          runtime_projection_id,
          runtime,
          external_project_id,
          external_flow_id,
          activepieces_flow_version_id,
          status,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          last_compile_report_id,
          last_synced_at,
          last_checked_at,
          projection,
          active
      `,
      [
        id,
        input.automationId,
        input.workspaceId,
        input.sourceTemplateVersionId,
        input.automationVersionId,
        input.runtimeProjectionId ?? null,
        input.projectId,
        input.flowId,
        input.flowVersionId,
        input.projectionHash,
        input.sourceWorkflowHash,
        input.runtimeHash,
        input.compileReportId,
        JSON.stringify(input.projection),
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Runtime binding upsert did not return a row.');
    }
    return row;
  }

  private async insertSnapshot(
    client: PoolClient,
    runtimeBindingId: string,
    input: PersistSyncSuccessInput,
  ): Promise<string> {
    const snapshotId = randomUUID();
    await this.runQuery(client, this.snapshotSql(), [
      snapshotId,
      input.workspaceId,
      runtimeBindingId,
      input.flowId,
      input.flowVersionId,
      JSON.stringify(input.snapshot),
      JSON.stringify(input.normalizedSnapshot),
      input.runtimeHash,
      'after_sync',
      input.actorId,
      input.automationId,
      input.projectId,
      null,
      input.runtimeHash,
    ]);
    return snapshotId;
  }

  private async markSyncedSnapshot(
    client: PoolClient,
    runtimeBindingId: string,
    snapshotId: string,
    input: PersistSyncSuccessInput,
  ) {
    await this.runQuery(
      client,
      `
        update app.automation_runtime_bindings
        set
          last_synced_snapshot_id = $4,
          last_snapshot_id = $4,
          last_synced_snapshot_hash = $5,
          last_synced_workflow_hash = $6,
          last_synced_mapping_hash = $7,
          last_runtime_snapshot_id = $4,
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and installed_automation_id = $2
          and id = $3
      `,
      [
        input.workspaceId,
        input.automationId,
        runtimeBindingId,
        snapshotId,
        input.runtimeHash,
        input.sourceWorkflowHash,
        input.projectionHash,
      ],
    );
  }

  private async upsertStage17FlowBinding(
    client: PoolClient,
    runtimeBindingId: string,
    snapshotId: string,
    input: PersistSyncSuccessInput,
  ) {
    await this.runQuery(
      client,
      `
        insert into app.activepieces_flow_bindings (
          id,
          workspace_id,
          automation_id,
          automation_version_id,
          runtime_binding_id,
          ap_project_id,
          ap_flow_id,
          ap_flow_version_id,
          source_workflow_hash,
          runtime_hash,
          last_synced_hash,
          sync_status,
          last_synced_at,
          last_read_back_at,
          last_snapshot_id,
          error_code
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $10,
          'synced',
          timezone('utc', now()),
          timezone('utc', now()),
          $11,
          null
        )
        on conflict (workspace_id, automation_id) do update
        set
          automation_version_id = excluded.automation_version_id,
          runtime_binding_id = excluded.runtime_binding_id,
          ap_project_id = excluded.ap_project_id,
          ap_flow_id = excluded.ap_flow_id,
          ap_flow_version_id = excluded.ap_flow_version_id,
          source_workflow_hash = excluded.source_workflow_hash,
          runtime_hash = excluded.runtime_hash,
          last_synced_hash = excluded.last_synced_hash,
          sync_status = 'synced',
          last_synced_at = timezone('utc', now()),
          last_read_back_at = timezone('utc', now()),
          last_snapshot_id = excluded.last_snapshot_id,
          error_code = null,
          updated_at = timezone('utc', now())
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.automationId,
        input.automationVersionId,
        runtimeBindingId,
        input.projectId,
        input.flowId,
        input.flowVersionId,
        input.sourceWorkflowHash,
        input.runtimeHash,
        snapshotId,
      ],
    );

    await this.runQuery(
      client,
      `
        update app.activepieces_flow_snapshots s
        set
          flow_binding_id = fb.id,
          snapshot_kind = coalesce(snapshot_kind, 'after_update'),
          runtime_hash = coalesce(runtime_hash, snapshot_hash),
          redaction_report = coalesce(redaction_report, '{}'::jsonb),
          trace_id = coalesce(trace_id, $4)
        from app.activepieces_flow_bindings fb
        where s.id = $1
          and fb.workspace_id = $2
          and fb.automation_id = $3
      `,
      [
        snapshotId,
        input.workspaceId,
        input.automationId,
        input.traceId ?? randomUUID(),
      ],
    );
  }

  private snapshotSql() {
    return `
      insert into app.activepieces_flow_snapshots (
        id,
        workspace_id,
        runtime_binding_id,
        activepieces_flow_id,
      activepieces_flow_version_id,
      snapshot_json,
      normalized_snapshot_json,
      snapshot_hash,
      source,
      created_by,
      automation_id,
      activepieces_project_id,
      previous_snapshot_hash,
      last_synced_hash
    )
    values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
    returning id
  `;
  }

  private async replaceStepMappings(
    client: PoolClient,
    runtimeBindingId: string,
    input: PersistSyncSuccessInput,
  ) {
    await this.runQuery(
      client,
      `
        update app.runtime_step_mappings
        set mapping_status = 'removed',
            updated_at = timezone('utc', now())
        where runtime_binding_id = $1
      `,
      [runtimeBindingId],
    );

    for (const mapping of input.stepMappings) {
      await this.runQuery(
        client,
        `
          insert into app.runtime_step_mappings (
            id,
            workspace_id,
            runtime_binding_id,
            source_node_id,
            source_node_hash,
            ir_step_id,
            activepieces_step_name,
            activepieces_step_display_name,
            piece_name,
            piece_version,
            action_name,
            mapping_status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')
          on conflict (runtime_binding_id, source_node_id, activepieces_step_name)
          do update set
            source_node_hash = excluded.source_node_hash,
            ir_step_id = excluded.ir_step_id,
            activepieces_step_display_name = excluded.activepieces_step_display_name,
            piece_name = excluded.piece_name,
            piece_version = excluded.piece_version,
            action_name = excluded.action_name,
            mapping_status = 'active',
            updated_at = timezone('utc', now())
        `,
        [
          randomUUID(),
          input.workspaceId,
          runtimeBindingId,
          mapping.source_node_id,
          mapping.source_node_hash,
          mapping.ir_step_id,
          mapping.activepieces_step_name,
          mapping.activepieces_step_display_name,
          mapping.piece_name,
          mapping.piece_version,
          mapping.action_name,
        ],
      );
    }
  }

  private async updateInstalledAutomation(
    client: PoolClient,
    input: PersistSyncSuccessInput,
  ) {
    await this.runQuery(
      client,
      `
        update app.installed_automations
        set
          workflow_state = 'compiled',
          builder_state = 'ready',
          sync_state = 'synced',
          compatibility_status = 'compatible',
          runtime_project_id = $3,
          runtime_flow_id = $4,
          sync_hash = $5,
          last_synced_at = timezone('utc', now()),
          next_gate = 'Runtime synced through the LexFrame workflow compiler.',
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [
        input.workspaceId,
        input.automationId,
        input.projectId,
        input.flowId,
        input.projectionHash,
      ],
    );
  }

  private async insertSyncEvent(
    client: PoolClient,
    runtimeBindingId: string,
    input: PersistSyncSuccessInput,
  ) {
    await this.runQuery(
      client,
      `
        insert into app.automation_runtime_sync_events (
          id,
          workspace_id,
          automation_id,
          runtime_binding_id,
          event_type,
          status,
          compile_report_id,
          after_runtime_hash,
          source_workflow_hash,
          actor_id,
          idempotency_key,
          trace_id
        )
        values ($1, $2, $3, $4, 'runtime_sync', 'completed', $5, $6, $7, $8, $9, $10)
        on conflict (workspace_id, automation_id, event_type, idempotency_key)
        do update set
          status = 'completed',
          runtime_binding_id = excluded.runtime_binding_id,
          compile_report_id = excluded.compile_report_id,
          after_runtime_hash = excluded.after_runtime_hash,
          source_workflow_hash = excluded.source_workflow_hash,
          error_code = null,
          error_message = null
      `,
      [
        randomUUID(),
        input.workspaceId,
        input.automationId,
        runtimeBindingId,
        input.compileReportId,
        input.runtimeHash,
        input.sourceWorkflowHash,
        input.actorId,
        input.idempotencyKey,
        input.traceId ?? randomUUID(),
      ],
    );
  }

  private runQuery<T extends QueryResultRow = QueryResultRow>(
    queryable: Queryable,
    text: string,
    values: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[] }> {
    if (queryable instanceof DatabaseService) {
      return queryable.query<T>(text, values);
    }
    return queryable.query(text, [...values]) as unknown as Promise<{
      readonly rows: readonly T[];
    }>;
  }
}

function mapBindingStatus(status: string): RuntimeBindingDto['status'] {
  switch (status) {
    case 'not_created':
      return 'not_compiled';
    case 'pending':
      return 'compile_required';
    case 'failed':
      return 'compile_failed';
    case 'blocked_by_policy':
    case 'deprecated_piece':
    case 'missing_connection':
    case 'sync_required':
    case 'syncing':
    case 'synced':
    case 'runtime_modified':
    case 'conflict':
    case 'importable':
    case 'import_requires_review':
    case 'import_blocked_by_policy':
    case 'unknown_runtime_nodes':
    case 'runtime_unavailable':
    case 'compile_failed':
      return status;
    default:
      return 'compile_required';
  }
}
