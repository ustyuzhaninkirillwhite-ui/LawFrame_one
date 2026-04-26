import type { CanvasRuntimeMapping } from '@lexframe/workflow-dsl';
import { previewCanvasBlockRuntimeMapping } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import type { AccessContext } from '../../common/types/lexframe-request';

@Injectable()
export class CanvasBlockRuntimeMappingService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  previewBlock(input: {
    readonly access: AccessContext;
    readonly blockCode: string;
  }): CanvasRuntimeMapping {
    const block = this.registry.getBlockType(input.blockCode, input.access);

    return previewCanvasBlockRuntimeMapping(block);
  }

  testBlock(input: {
    readonly access: AccessContext;
    readonly blockCode: string;
  }) {
    const block = this.registry.getBlockType(input.blockCode, input.access);

    return {
      status: block.runtime.supportsStepTest ? 'ready' : 'blocked',
      blockCode: block.code,
      supportsStepTest: block.runtime.supportsStepTest,
      dryRunOnly: true,
      runtime: previewCanvasBlockRuntimeMapping(block),
      note: 'Stage 16.2 test-block is a safe contract preview and does not execute external actions.',
    };
  }
}
