import type { CanvasModuleSummary } from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import type {
  CanvasBlockDefinition,
  CanvasPolicyEvaluation,
} from '@lexframe/workflow-dsl';
import {
  evaluateCanvasBlockPolicy,
  findCanvasBlockDefinition,
  getCanvasBlockDefinitions,
} from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';

@Injectable()
export class CanvasBlockRegistryService {
  listBlockTypes(access: AccessContext): readonly CanvasBlockDefinition[] {
    return getCanvasBlockDefinitions().map((block) =>
      this.withAccessState(block, access),
    );
  }

  getBlockType(code: string, access: AccessContext): CanvasBlockDefinition {
    const block = findCanvasBlockDefinition(code);
    if (!block) {
      throw new AppHttpException(
        'MODULE_NOT_FOUND',
        404,
        `Canvas block type was not found: ${code}.`,
      );
    }

    return this.withAccessState(block, access);
  }

  getBlockSchema(code: string, access: AccessContext) {
    const block = this.getBlockType(code, access);

    return {
      code: block.code,
      kind: block.kind,
      inputSchema: block.inputSchema,
      outputSchema: block.outputSchema,
      configSchema: block.configSchema,
      handles: block.handles,
      validationRules: block.validationRules,
    };
  }

  listCanvasModules(access: AccessContext): readonly CanvasModuleSummary[] {
    return this.listBlockTypes(access).map((block) => ({
      code: block.code,
      label: block.displayName,
      category: moduleCategory(block),
      description: block.shortDescription,
      node_type: block.nodeType,
      icon: block.uiSchema.icon,
      disabled: !block.enabled,
      disabled_reason: block.disabledReason ?? null,
    }));
  }

  evaluatePolicy(
    block: CanvasBlockDefinition,
    access: AccessContext,
    input: { readonly hasApprovalPath?: boolean } = {},
  ): CanvasPolicyEvaluation {
    return evaluateCanvasBlockPolicy({
      block,
      roleCodes: access.roles,
      permissions: access.permissions,
      hasApprovalPath: input.hasApprovalPath,
    });
  }

  private withAccessState(
    block: CanvasBlockDefinition,
    access: AccessContext,
  ): CanvasBlockDefinition {
    const evaluation = this.evaluatePolicy(block, access);
    if (evaluation.status !== 'blocked') {
      return block;
    }

    return {
      ...block,
      enabled: false,
      disabledReason:
        evaluation.blocks[0]?.message ??
        block.disabledReason ??
        'Blocked by policy.',
    };
  }
}

function moduleCategory(
  block: CanvasBlockDefinition,
): CanvasModuleSummary['category'] {
  switch (block.category) {
    case 'start_trigger':
      return 'trigger';
    case 'legal_action':
      return 'legal';
    case 'ai_action':
      return 'ai';
    case 'document_data_input':
      return 'data';
    case 'loop_batch':
      return 'loop';
    case 'human_approval':
      return 'approval';
    case 'wait_pause':
      return 'wait';
    case 'storage_artifact':
      return 'storage';
    case 'subworkflow':
      return 'subworkflow';
    case 'error_handler':
      return 'error';
    case 'note_group':
      return 'note';
    case 'end_output':
      return 'output';
    case 'merge':
      return 'merge';
    default:
      return 'control';
  }
}
