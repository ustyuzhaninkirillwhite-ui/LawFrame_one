import { Injectable } from '@nestjs/common';
import type {
  ActivepiecesFlowProjection,
  ActivepiecesOperation,
} from './workflow-compiler.types';

@Injectable()
export class ActivepiecesOperationsBuilder {
  buildImportPreview(input: {
    readonly flowId?: string | null;
    readonly projection: ActivepiecesFlowProjection;
    readonly projectionHash: string;
  }): readonly ActivepiecesOperation[] {
    const actionOps = input.projection.actions.map((action, index) => ({
      type: 'UPSERT_ACTION_PREVIEW',
      request: {
        index,
        name: action.name,
        displayName: action.displayName,
        pieceName: action.settings.pieceName ?? null,
        pieceVersion: action.settings.pieceVersion ?? null,
        actionName: action.settings.actionName ?? null,
      },
      metadata: {
        deterministic: true,
        syncStrategy: 'preview_patch_after_import',
      },
    }));

    return [
      {
        type: 'IMPORT_FLOW',
        request: {
          flowId: input.flowId ?? null,
          displayName: input.projection.displayName,
          flowVersion: input.projection,
          replace: true,
        },
        metadata: {
          syncStrategy: 'full_import_replace',
          strictDriftDetection: true,
          projectionHash: input.projectionHash,
        },
      },
      ...actionOps,
    ];
  }
}
