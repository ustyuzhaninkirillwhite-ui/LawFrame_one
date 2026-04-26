import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { CanvasTestArtifactSummary } from '@lexframe/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';

interface ArtifactRow {
  readonly id: string;
  readonly node_id: string;
  readonly blob_type: CanvasTestArtifactSummary['blob_type'];
  readonly classification: string;
  readonly redacted_payload: Record<string, unknown> | null;
  readonly retention_until: string;
  readonly created_at: string;
}

@Injectable()
export class CanvasTestArtifactService {
  constructor(private readonly databaseService: DatabaseService) {}

  async storeRedactedBlob(input: {
    readonly workspaceId: string;
    readonly testRunId: string;
    readonly nodeId: string;
    readonly blobType: CanvasTestArtifactSummary['blob_type'];
    readonly classification: string;
    readonly redactedPayload: Record<string, unknown>;
  }): Promise<string> {
    const id = randomUUID();
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(input.redactedPayload))
      .digest('hex');
    await this.databaseService.query(
      `
        insert into app.automation_canvas_test_data_blobs (
          id,
          workspace_id,
          test_run_id,
          node_id,
          blob_type,
          classification,
          payload_hash,
          redacted_payload,
          retention_until
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, timezone('utc', now()) + interval '30 days')
      `,
      [
        id,
        input.workspaceId,
        input.testRunId,
        input.nodeId,
        input.blobType,
        input.classification,
        payloadHash,
        JSON.stringify(input.redactedPayload),
      ],
    );
    return id;
  }

  async listArtifacts(
    _actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    testRunId: string,
  ): Promise<readonly CanvasTestArtifactSummary[]> {
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<ArtifactRow>(
      `
        select
          b.id,
          b.node_id,
          b.blob_type,
          b.classification,
          b.redacted_payload,
          b.retention_until,
          b.created_at
        from app.automation_canvas_test_data_blobs b
        join app.automation_canvas_test_runs r
          on r.id = b.test_run_id
        where b.workspace_id = $1
          and r.installed_automation_id = $2
          and b.test_run_id = $3
        order by b.created_at asc
      `,
      [workspaceId, automationId, testRunId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      node_id: row.node_id,
      blob_type: row.blob_type,
      classification: row.classification,
      redacted_payload: row.redacted_payload,
      retention_until: row.retention_until,
      created_at: row.created_at,
    }));
  }
}
