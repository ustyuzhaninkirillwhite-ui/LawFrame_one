import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { ActivepiecesOperation } from './workflow-compiler.types';
import type {
  ActivepiecesFlowProjection,
  ActivepiecesStepProjection,
} from './workflow-compiler.types';
import {
  ActivepiecesRuntimeClient,
  ActivepiecesRuntimeError,
} from './activepieces-runtime-client.service';

@Injectable()
export class ActivepiecesSyncService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly activepieces: ActivepiecesRuntimeClient,
  ) {}

  async ensureProjectBinding(input: {
    readonly workspaceId: string;
    readonly actor: AuthenticatedActor;
    readonly displayName: string;
  }): Promise<{
    readonly id: string;
    readonly external_project_id: string;
    readonly activepieces_project_id: string;
  }> {
    const existing = await this.databaseService.one<{
      readonly id: string;
      readonly external_project_id: string;
      readonly activepieces_project_id: string;
    }>(
      `
        select
          id,
          external_project_id,
          coalesce(ap_project_id, project_id, external_project_id) as activepieces_project_id
        from app.activepieces_project_bindings
        where workspace_id = $1
        limit 1
      `,
      [input.workspaceId],
    );
    if (existing) {
      await this.activepieces.getProject(existing.activepieces_project_id);
      return existing;
    }

    const deterministicExternalProjectId = lexFrameProjectExternalId(
      this.env.ACTIVEPIECES_PROJECT_PREFIX,
      input.workspaceId,
    );
    const remoteProject = await this.activepieces.ensureProject({
      displayName: input.displayName,
      externalId: deterministicExternalProjectId,
      metadata: {
        managedBy: 'lexframe',
        workspaceId: input.workspaceId,
      },
    });
    const id = randomUUID();
    const row = await this.databaseService.one<{
      readonly id: string;
      readonly external_project_id: string;
      readonly activepieces_project_id: string;
    }>(
      `
        insert into app.activepieces_project_bindings (
          id,
          workspace_id,
          external_project_id,
          project_id,
          ap_project_id,
          display_name,
          project_display_name,
          status,
          created_by_user_id,
          deterministic_external_project_id,
          last_synced_at
        )
        values ($1, $2, $3, $4, $4, $5, $5, 'provisioned', $6, $3, timezone('utc', now()))
        on conflict (workspace_id) do update
        set
          external_project_id = excluded.external_project_id,
          project_id = excluded.project_id,
          ap_project_id = excluded.ap_project_id,
          display_name = excluded.display_name,
          project_display_name = excluded.project_display_name,
          status = 'provisioned',
          deterministic_external_project_id = excluded.deterministic_external_project_id,
          updated_at = timezone('utc', now())
        returning
          id,
          external_project_id,
          coalesce(ap_project_id, project_id, external_project_id) as activepieces_project_id
      `,
      [
        id,
        input.workspaceId,
        deterministicExternalProjectId,
        remoteProject.id,
        input.displayName,
        input.actor.id,
      ],
    );

    return (
      row ?? {
        id,
        external_project_id: deterministicExternalProjectId,
        activepieces_project_id: remoteProject.id,
      }
    );
  }

  async ensureFlow(input: {
    readonly projectId: string;
    readonly workspaceId: string;
    readonly automationId: string;
    readonly displayName: string;
    readonly existingFlowId?: string | null;
  }): Promise<{
    readonly flowId: string;
    readonly flowVersionId: string | null;
  }> {
    const externalId = lexFrameFlowExternalId(
      input.workspaceId,
      input.automationId,
    );
    if (input.existingFlowId && isActivepiecesId(input.existingFlowId)) {
      try {
        const existing = await this.activepieces.getFlow({
          projectId: input.projectId,
          flowId: input.existingFlowId,
        });
        if (existing.projectId !== input.projectId) {
          throw new Error(
            `Activepieces flow ${input.existingFlowId} belongs to project ${existing.projectId}, expected ${input.projectId}.`,
          );
        }
        return { flowId: existing.id, flowVersionId: existing.versionId };
      } catch (error) {
        if (!isRecoverableMissingFlow(error)) {
          throw error;
        }
      }
    }

    const existingByExternalId = await this.activepieces.findFlowByExternalId(
      input.projectId,
      externalId,
    );
    if (existingByExternalId) {
      return {
        flowId: existingByExternalId.id,
        flowVersionId: existingByExternalId.versionId,
      };
    }

    const existingByLexFrameTarget =
      await this.activepieces.findFlowByLexFrameTarget({
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        automationId: input.automationId,
      });
    if (existingByLexFrameTarget) {
      return {
        flowId: existingByLexFrameTarget.id,
        flowVersionId: existingByLexFrameTarget.versionId,
      };
    }

    const created = await this.activepieces.createFlow({
      projectId: input.projectId,
      displayName: input.displayName,
      externalId,
      metadata: {
        lexframe: {
          managedBy: 'lexframe',
          workspaceId: input.workspaceId,
          automationId: input.automationId,
          target: externalId,
        },
      },
    });
    return {
      flowId: created.id,
      flowVersionId: created.versionId,
    };
  }

  async applyOperations(input: {
    readonly projectId: string;
    readonly flowId: string;
    readonly operations: readonly ActivepiecesOperation[];
    readonly publishAfterSync: boolean;
  }): Promise<{ readonly flowVersionId: string | null }> {
    let latestFlowVersionId: string | null = null;
    for (const operation of input.operations.filter(
      (item) => item.type === 'IMPORT_FLOW',
    )) {
      const projection = projectionFromOperation(operation);
      const updated = await this.activepieces.applyFlowOperation({
        projectId: input.projectId,
        flowId: input.flowId,
        operation: {
          type: 'IMPORT_FLOW',
          request: toActivepiecesImportRequest(projection),
        },
      });
      latestFlowVersionId = updated.versionId;
    }

    if (input.publishAfterSync) {
      const response = await this.activepieces.applyFlowOperation({
        projectId: input.projectId,
        flowId: input.flowId,
        operation: {
          type: 'LOCK_AND_PUBLISH',
          request: {},
        },
      });
      latestFlowVersionId =
        response.publishedVersionId ??
        response.versionId ??
        latestFlowVersionId;
    }

    return { flowVersionId: latestFlowVersionId };
  }
}

function lexFrameFlowExternalId(workspaceId: string, automationId: string) {
  return `lexframe:${workspaceId}:${automationId}`;
}

function lexFrameProjectExternalId(prefix: string, workspaceId: string) {
  return `${prefix}-${workspaceId}`;
}

function isActivepiecesId(value: string) {
  return /^[0-9a-zA-Z]{21}$/.test(value);
}

function isRecoverableMissingFlow(error: unknown) {
  const status =
    error instanceof ActivepiecesRuntimeError ? error.status : null;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 404 || /failed with 404/i.test(message)) {
    return true;
  }
  return (
    (status === 400 || /failed with 400/i.test(message)) &&
    /params\/id must match pattern|flow.*not found/i.test(message)
  );
}

function projectionFromOperation(
  operation: ActivepiecesOperation,
): ActivepiecesFlowProjection {
  const flowVersion = operation.request.flowVersion;
  if (isProjection(flowVersion)) {
    return flowVersion;
  }
  throw new Error(
    'IMPORT_FLOW operation does not contain Activepieces projection.',
  );
}

function toActivepiecesImportRequest(projection: ActivepiecesFlowProjection) {
  return {
    displayName: projection.displayName,
    schemaVersion: '1',
    trigger: buildTrigger(projection),
  };
}

function buildTrigger(projection: ActivepiecesFlowProjection) {
  const trigger = {
    type: 'EMPTY',
    name: 'trigger',
    displayName: projection.trigger?.displayName ?? 'LexFrame Trigger',
    valid: true,
    settings: {
      inputUiInfo: {},
      lexframe: {
        managedBy: 'lexframe',
        workspaceId:
          typeof projection.metadata.workspaceId === 'string'
            ? projection.metadata.workspaceId
            : null,
        automationId:
          typeof projection.metadata.automationId === 'string'
            ? projection.metadata.automationId
            : null,
        workflowId:
          typeof projection.metadata.workflowId === 'string'
            ? projection.metadata.workflowId
            : null,
        draftVersionId:
          typeof projection.metadata.draftVersionId === 'string'
            ? projection.metadata.draftVersionId
            : null,
        sourceWorkflowHash: projection.metadata.sourceWorkflowHash ?? null,
      },
    },
  } as Record<string, unknown>;
  const steps = [
    ...(projection.trigger ? [projection.trigger] : []),
    ...projection.actions,
  ];
  let previous = trigger;
  for (const step of steps.map(toCodeAction)) {
    previous.nextAction = step;
    previous = step as Record<string, unknown>;
  }
  return trigger;
}

function toCodeAction(step: ActivepiecesStepProjection) {
  return {
    type: 'CODE',
    name: step.name,
    displayName: step.displayName,
    valid: true,
    settings: {
      sourceCode: {
        packageJson: '{}',
        code: 'exports.code = async function lexframeRuntimeStep(inputs) { return { lexframe: inputs.lexframe }; };',
      },
      input: {
        lexframe: {
          runtimeKind: step.metadata.runtimeKind ?? null,
          sourceNodeId: step.metadata.lexframeSourceNodeId ?? null,
          source_node_id: step.metadata.lexframeSourceNodeId ?? null,
          node_id: step.metadata.lexframeSourceNodeId ?? null,
          sourceNodeType: step.metadata.lexframeSourceNodeType ?? null,
          pieceName: step.settings.pieceName ?? null,
          pieceVersion: step.settings.pieceVersion ?? null,
          actionName: step.settings.actionName ?? null,
          triggerName: step.settings.triggerName ?? null,
          props: step.settings.input,
        },
      },
      inputUiInfo: {},
    },
  };
}

function isProjection(value: unknown): value is ActivepiecesFlowProjection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'displayName' in value &&
    'actions' in value &&
    Array.isArray((value as { readonly actions?: unknown }).actions)
  );
}
