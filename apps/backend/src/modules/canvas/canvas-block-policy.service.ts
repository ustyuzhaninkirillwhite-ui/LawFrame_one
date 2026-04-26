import type { AccessContext } from '../../common/types/lexframe-request';
import type {
  CanvasPolicyEvaluation,
  StepInputBinding,
} from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';

@Injectable()
export class CanvasBlockPolicyService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  evaluateBlock(input: {
    readonly blockCode: string;
    readonly access: AccessContext;
    readonly hasApprovalPath?: boolean;
  }): CanvasPolicyEvaluation {
    const block = this.registry.getBlockType(input.blockCode, input.access);

    return this.registry.evaluatePolicy(block, input.access, {
      hasApprovalPath: input.hasApprovalPath,
    });
  }

  evaluateBindings(input: {
    readonly bindings: readonly StepInputBinding[];
  }): CanvasPolicyEvaluation {
    const blocks = input.bindings
      .filter(
        (binding) =>
          binding.source.type === 'document' &&
          documentId(binding.source)?.includes('signed-url'),
      )
      .map((binding) => ({
        code: 'NO_SIGNED_URL_OUTPUT',
        message: `Binding ${binding.targetInputKey} cannot use a signed URL as source.`,
      }));

    return {
      status: blocks.length > 0 ? 'blocked' : 'allowed',
      warnings: [],
      blocks,
    };
  }
}

function documentId(source: StepInputBinding['source']) {
  if (source.type !== 'document') {
    return null;
  }
  return 'documentId' in source ? source.documentId : source.document_id;
}
