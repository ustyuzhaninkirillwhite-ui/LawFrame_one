import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  ActivepiecesFlowBindingForSession,
  ActivepiecesInstalledAutomationForSession,
  ActivepiecesProjectBindingForSession,
} from './activepieces-session.types';

interface RuntimeBindingRow {
  readonly external_project_id: string;
  readonly external_flow_id: string;
  readonly activepieces_flow_version_id: string | null;
  readonly sync_hash: string;
  readonly status: string;
}

@Injectable()
export class ActivepiecesFlowProvisioningService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureFlowBinding(input: {
    readonly workspaceId: string;
    readonly routeProjectId: string;
    readonly automation: ActivepiecesInstalledAutomationForSession;
    readonly projectBinding: ActivepiecesProjectBindingForSession;
    readonly traceId: string | null;
  }): Promise<ActivepiecesFlowBindingForSession> {
    const runtimeBinding = await this.databaseService.one<RuntimeBindingRow>(
      `
        select
          external_project_id,
          external_flow_id,
          activepieces_flow_version_id,
          sync_hash,
          status
        from app.automation_runtime_bindings
        where workspace_id = $1
          and installed_automation_id = $2
          and active = true
        limit 1
      `,
      [input.workspaceId, input.automation.id],
    );

    const activepiecesFlowId =
      runtimeBinding?.external_flow_id ?? input.automation.runtime_flow_id;
    if (!activepiecesFlowId) {
      throw new AppHttpException(
        'FLOW_BINDING_CONFLICT',
        409,
        'Activepieces Canvas requires a synced runtime flow binding.',
        {
          automationId: input.automation.id,
          projectId: input.routeProjectId,
        },
      );
    }

    const expectedProjectIds = new Set(
      [
        input.projectBinding.externalProjectId,
        input.projectBinding.activepiecesProjectId,
        input.automation.runtime_project_id,
      ].filter((value): value is string => typeof value === 'string'),
    );
    const runtimeProjectId =
      runtimeBinding?.external_project_id ??
      input.automation.runtime_project_id ??
      null;

    if (
      runtimeProjectId &&
      expectedProjectIds.size > 0 &&
      !expectedProjectIds.has(runtimeProjectId)
    ) {
      throw new AppHttpException(
        'FLOW_BINDING_CONFLICT',
        409,
        'Activepieces flow binding points to another project.',
        {
          automationId: input.automation.id,
          runtimeProjectId,
        },
      );
    }

    await this.databaseService.query(
      `
        update app.automation_runtime_bindings
        set
          activepieces_read_back_status = 'succeeded',
          last_read_back_at = timezone('utc', now()),
          last_session_trace_id = $3
        where workspace_id = $1
          and installed_automation_id = $2
      `,
      [input.workspaceId, input.automation.id, input.traceId],
    );

    return {
      automationId: input.automation.id,
      activepiecesProjectId:
        input.projectBinding.activepiecesProjectId ??
        runtimeProjectId ??
        input.projectBinding.externalProjectId,
      activepiecesFlowId,
      activepiecesFlowVersionId:
        runtimeBinding?.activepieces_flow_version_id ?? null,
      syncStatus:
        runtimeBinding?.status === 'runtime_modified'
          ? 'runtime_modified'
          : runtimeBinding?.status === 'synced' ||
              input.automation.sync_state === 'synced'
            ? 'synced'
            : 'pending_sync',
      syncHash: runtimeBinding?.sync_hash ?? input.automation.sync_hash,
    };
  }
}
