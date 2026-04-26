import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface PinnedDataRow {
  readonly node_id: string;
  readonly output_key: string;
  readonly output_schema_version: string;
  readonly output_hash: string;
  readonly classification: string;
  readonly is_active: boolean;
  readonly redacted_payload: Record<string, unknown> | null;
}

@Injectable()
export class CanvasPinnedDataService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActivePinnedNodeIds(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly workflow: LexFrameWorkflowV2;
  }): Promise<readonly string[]> {
    const rows = await this.listActivePinnedData(input);
    const stale = rows.filter((row) => isPinnedRowStale(input.workflow, row));
    if (stale.length > 0) {
      await this.markRowsInactive({
        access: input.access,
        automationId: input.automationId,
        draftVersionId: input.draftVersionId,
        rows: stale,
      });
    }
    return rows
      .filter((row) => !isPinnedRowStale(input.workflow, row))
      .map((row) => row.node_id);
  }

  async listActivePinnedData(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly workflow: LexFrameWorkflowV2;
  }): Promise<readonly PinnedDataRow[]> {
    const workspaceId = requireWorkspaceId(input.access);
    const result = await this.databaseService.query<PinnedDataRow>(
      `
        select
          pd.node_id,
          pd.output_key,
          pd.output_schema_version,
          pd.output_hash,
          pd.classification,
          pd.is_active,
          sd.redacted_payload
        from app.automation_canvas_pinned_data pd
        left join app.automation_canvas_sample_data sd
          on sd.id = pd.pinned_sample_data_id
        where pd.workspace_id = $1
          and pd.installed_automation_id = $2
          and pd.draft_version_id = $3
          and pd.is_active = true
          and (pd.expires_at is null or pd.expires_at > timezone('utc', now()))
      `,
      [workspaceId, input.automationId, input.draftVersionId],
    );
    return result.rows;
  }

  hashPayload(payload: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async markRowsInactive(input: {
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftVersionId: string;
    readonly rows: readonly PinnedDataRow[];
  }) {
    if (input.rows.length === 0) {
      return;
    }
    const workspaceId = requireWorkspaceId(input.access);
    const keys = input.rows.map((row) => `${row.node_id}:${row.output_key}`);
    await this.databaseService.query(
      `
        update app.automation_canvas_pinned_data
        set is_active = false
        where workspace_id = $1
          and installed_automation_id = $2
          and draft_version_id = $3
          and (node_id || ':' || output_key) = any($4::text[])
      `,
      [workspaceId, input.automationId, input.draftVersionId, keys],
    );
  }
}

function isPinnedRowStale(workflow: LexFrameWorkflowV2, row: PinnedDataRow) {
  const node = workflow.nodes.find((item) => item.id === row.node_id);
  const output = node?.outputs.find((item) => item.key === row.output_key);
  if (!node || !output) {
    return true;
  }
  const schemaVersion = node.module_schema_hash ?? node.module_version ?? '1';
  return row.output_schema_version !== schemaVersion;
}
