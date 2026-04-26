import type {
  CanvasConnectionValidationResult,
  CanvasEdgeType,
  CanvasHandleCode,
} from '@lexframe/workflow-dsl';
import { validateCanvasConnection } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import type { AccessContext } from '../../common/types/lexframe-request';

@Injectable()
export class CanvasConnectionPolicyService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  validateConnection(input: {
    readonly access: AccessContext;
    readonly sourceBlockCode: string;
    readonly sourceHandle: CanvasHandleCode;
    readonly targetBlockCode: string;
    readonly targetHandle: CanvasHandleCode;
    readonly edgeType?: CanvasEdgeType;
    readonly hasApprovalPath?: boolean;
  }): CanvasConnectionValidationResult {
    const sourceBlock = this.registry.getBlockType(
      input.sourceBlockCode,
      input.access,
    );
    const targetBlock = this.registry.getBlockType(
      input.targetBlockCode,
      input.access,
    );

    return validateCanvasConnection({
      sourceBlock,
      sourceHandle: input.sourceHandle,
      targetBlock,
      targetHandle: input.targetHandle,
      edgeType: input.edgeType,
      hasApprovalPath: input.hasApprovalPath,
    });
  }
}
