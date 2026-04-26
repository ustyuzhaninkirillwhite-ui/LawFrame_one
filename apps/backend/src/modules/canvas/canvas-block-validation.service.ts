import type { AccessContext } from '../../common/types/lexframe-request';
import type {
  CanvasBlockValidationResult,
  StepInputBinding,
} from '@lexframe/workflow-dsl';
import { validateCanvasBlock } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';

@Injectable()
export class CanvasBlockValidationService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  validateBlock(input: {
    readonly access: AccessContext;
    readonly blockCode: string;
    readonly targetNodeId?: string;
    readonly config?: Record<string, unknown>;
    readonly bindings?: readonly StepInputBinding[];
    readonly hasApprovalPath?: boolean;
  }): CanvasBlockValidationResult {
    const block = this.registry.getBlockType(input.blockCode, input.access);

    return validateCanvasBlock({
      block,
      targetNodeId: input.targetNodeId,
      config: input.config,
      bindings: input.bindings,
      roleCodes: input.access.roles,
      permissions: input.access.permissions,
      hasApprovalPath: input.hasApprovalPath,
    });
  }
}
