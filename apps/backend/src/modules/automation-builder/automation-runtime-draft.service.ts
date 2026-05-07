import type {
  AutomationBlueprint,
  AutomationRuntimeDraftResponse,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  AutomationBlueprintCanvasConverterService,
  type Stage20WorkflowDraft,
} from './automation-blueprint-canvas-converter.service';
import { AutomationBlueprintValidatorService } from './automation-blueprint-validator.service';

export interface AutomationRuntimeDraftInput {
  readonly blueprint: AutomationBlueprint;
  readonly activepiecesAvailable: boolean;
  readonly mcpAvailable: boolean;
  readonly automationId?: string;
  readonly draftVersionId?: string;
  readonly createActivepiecesDraft?: (input: {
    readonly workflow: Stage20WorkflowDraft;
    readonly blueprint: AutomationBlueprint;
  }) => Promise<{
    readonly projectId: string;
    readonly flowId: string;
    readonly versionId?: string | null;
    readonly warnings?: readonly string[];
  }>;
}

@Injectable()
export class AutomationRuntimeDraftService {
  constructor(
    private readonly validator: AutomationBlueprintValidatorService,
    private readonly canvasConverter: AutomationBlueprintCanvasConverterService,
  ) {}

  async createRuntimeDraftAsync(
    input: AutomationRuntimeDraftInput,
  ): Promise<AutomationRuntimeDraftResponse> {
    const validation = this.validator.validate(input.blueprint);
    const workflow = this.canvasConverter.toWorkflowDraft(input.blueprint, {
      automationId: input.automationId ?? `automation_${input.blueprint.id}`,
      draftVersionId:
        input.draftVersionId ?? `draft_version_${input.blueprint.version}`,
    });

    if (
      validation.status === 'invalid' ||
      validation.status === 'policy_blocked'
    ) {
      return buildResponse({
        blueprint: input.blueprint,
        workflow,
        status: 'runtime_creation_blocked',
        warnings: [
          ...validation.errors.map((issue) => issue.code),
          ...validation.policyBlocks.map((issue) => issue.code),
        ],
      });
    }

    if (
      !input.activepiecesAvailable ||
      !input.mcpAvailable ||
      !input.createActivepiecesDraft
    ) {
      return buildResponse({
        blueprint: input.blueprint,
        workflow,
        status: 'runtime_creation_unavailable',
        warnings: [
          !input.activepiecesAvailable
            ? 'activepieces_unavailable'
            : 'activepieces_adapter_not_configured',
          !input.mcpAvailable ? 'mcp_unavailable' : 'mcp_not_used',
        ],
      });
    }

    const created = await input.createActivepiecesDraft({
      workflow,
      blueprint: input.blueprint,
    });

    return buildResponse({
      blueprint: input.blueprint,
      workflow,
      status: 'runtime_created',
      activepiecesProjectId: created.projectId,
      activepiecesFlowId: created.flowId,
      activepiecesVersionId: created.versionId ?? null,
      warnings: created.warnings ?? [],
    });
  }

  createRuntimeDraft(
    input: AutomationRuntimeDraftInput,
  ): AutomationRuntimeDraftResponse {
    const validation = this.validator.validate(input.blueprint);
    const workflow = this.canvasConverter.toWorkflowDraft(input.blueprint, {
      automationId: input.automationId ?? `automation_${input.blueprint.id}`,
      draftVersionId:
        input.draftVersionId ?? `draft_version_${input.blueprint.version}`,
    });

    if (
      validation.status === 'invalid' ||
      validation.status === 'policy_blocked'
    ) {
      return buildResponse({
        blueprint: input.blueprint,
        workflow,
        status: 'runtime_creation_blocked',
        warnings: [
          ...validation.errors.map((issue) => issue.code),
          ...validation.policyBlocks.map((issue) => issue.code),
        ],
      });
    }

    return buildResponse({
      blueprint: input.blueprint,
      workflow,
      status:
        input.activepiecesAvailable && input.mcpAvailable
          ? 'not_configured'
          : 'runtime_creation_unavailable',
      warnings: [
        !input.activepiecesAvailable
          ? 'activepieces_unavailable'
          : 'activepieces_adapter_not_configured',
        !input.mcpAvailable ? 'mcp_unavailable' : 'mcp_not_used',
      ],
    });
  }
}

function buildResponse(input: {
  readonly blueprint: AutomationBlueprint;
  readonly workflow: Stage20WorkflowDraft;
  readonly status: AutomationRuntimeDraftResponse['status'];
  readonly activepiecesProjectId?: string | null;
  readonly activepiecesFlowId?: string | null;
  readonly activepiecesVersionId?: string | null;
  readonly warnings: readonly string[];
}): AutomationRuntimeDraftResponse {
  return {
    blueprintId: input.blueprint.id,
    status: input.status,
    canvasDraft: {
      automationId: input.workflow.automation_id,
      draftVersionId: input.workflow.draft_version_id,
      workflow: input.workflow as unknown as Record<string, unknown>,
    },
    activepiecesProjectId: input.activepiecesProjectId ?? null,
    activepiecesFlowId: input.activepiecesFlowId ?? null,
    activepiecesVersionId: input.activepiecesVersionId ?? null,
    mcpInvocationId: null,
    evidenceHash: hashJson({
      blueprintId: input.blueprint.id,
      version: input.blueprint.version,
      workflowId: input.workflow.id,
      status: input.status,
    }),
    warnings: input.warnings,
  };
}

function hashJson(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
