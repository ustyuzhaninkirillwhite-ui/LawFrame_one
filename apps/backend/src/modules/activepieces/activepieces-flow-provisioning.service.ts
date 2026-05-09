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

interface Stage17FlowBindingRow {
  readonly ap_project_id: string;
  readonly ap_flow_id: string | null;
  readonly ap_flow_version_id: string | null;
  readonly last_synced_hash: string | null;
  readonly sync_status: string;
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

    const stage17FlowBinding =
      await this.databaseService.one<Stage17FlowBindingRow>(
        `
          select
            ap_project_id,
            ap_flow_id,
            ap_flow_version_id,
            last_synced_hash,
            sync_status
          from app.activepieces_flow_bindings
          where workspace_id = $1
            and automation_id = $2
          limit 1
        `,
        [input.workspaceId, input.automation.id],
      );

    const activepiecesFlowId =
      stage17FlowBinding?.ap_flow_id ??
      runtimeBinding?.external_flow_id ??
      input.automation.runtime_flow_id;
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
      stage17FlowBinding?.ap_project_id ??
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

    if (
      stage17FlowBinding?.ap_project_id &&
      input.projectBinding.activepiecesProjectId &&
      stage17FlowBinding.ap_project_id !==
        input.projectBinding.activepiecesProjectId
    ) {
      throw new AppHttpException(
        'FLOW_BINDING_CONFLICT',
        409,
        'Activepieces flow binding is not owned by the current project binding.',
        {
          automationId: input.automation.id,
          flowProjectId: stage17FlowBinding.ap_project_id,
          projectBindingId: input.projectBinding.activepiecesProjectId,
        },
      );
    }

    if (
      stage17FlowBinding?.ap_flow_id &&
      runtimeBinding?.external_flow_id &&
      stage17FlowBinding.ap_flow_id !== runtimeBinding.external_flow_id
    ) {
      throw new AppHttpException(
        'FLOW_BINDING_CONFLICT',
        409,
        'Activepieces flow binding and runtime binding point to different flows.',
        {
          automationId: input.automation.id,
          flowBindingId: stage17FlowBinding.ap_flow_id,
          runtimeFlowId: runtimeBinding.external_flow_id,
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

    await this.databaseService.query(
      `
        update app.activepieces_flow_bindings
        set
          last_read_back_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and automation_id = $2
      `,
      [input.workspaceId, input.automation.id],
    );

    return {
      automationId: input.automation.id,
      activepiecesProjectId:
        runtimeProjectId ??
        input.projectBinding.activepiecesProjectId ??
        input.projectBinding.externalProjectId,
      activepiecesFlowId,
      activepiecesFlowVersionId:
        stage17FlowBinding?.ap_flow_version_id ??
        runtimeBinding?.activepieces_flow_version_id ??
        null,
      syncStatus:
        stage17FlowBinding?.sync_status === 'runtime_modified' ||
        runtimeBinding?.status === 'runtime_modified'
          ? 'runtime_modified'
          : stage17FlowBinding?.sync_status === 'synced' ||
              runtimeBinding?.status === 'synced' ||
              input.automation.sync_state === 'synced'
            ? 'synced'
            : 'pending_sync',
      syncHash:
        stage17FlowBinding?.last_synced_hash ??
        runtimeBinding?.sync_hash ??
        input.automation.sync_hash,
    };
  }
}
