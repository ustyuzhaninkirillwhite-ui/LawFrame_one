import type {
  CanvasOperation,
  CanvasOperationPreviewResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { CanvasOperationService } from '../canvas/canvas-operation.service';

const MAX_PATCH_OPERATIONS = 20;

@Injectable()
export class CanvasPatchValidator {
  constructor(private readonly operationService: CanvasOperationService) {}

  async validate(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly draftId: string;
    readonly baseWorkflowHash: string;
    readonly operations: readonly CanvasOperation[];
  }): Promise<CanvasOperationPreviewResponse> {
    this.validateSyntax(input.operations);
    return this.operationService.previewOperations(
      input.actor,
      input.access,
      input.automationId,
      {
        draft_id: input.draftId,
        base_hash: input.baseWorkflowHash,
        operations: input.operations,
      },
    );
  }

  validateSyntax(operations: readonly CanvasOperation[]) {
    if (operations.length > MAX_PATCH_OPERATIONS) {
      throw new AppHttpException(
        'AI_PATCH_SCHEMA_INVALID',
        400,
        'Canvas AI patch exceeds the maximum operation count.',
      );
    }

    for (const operation of operations) {
      if (!operation.client_operation_id || !operation.operation_type) {
        throw new AppHttpException(
          'AI_PATCH_SCHEMA_INVALID',
          400,
          'Canvas AI patch operation is missing required identifiers.',
        );
      }
      if (!isRecord(operation.operation_payload)) {
        throw new AppHttpException(
          'AI_PATCH_SCHEMA_INVALID',
          400,
          'Canvas AI patch operation payload must be an object.',
        );
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
