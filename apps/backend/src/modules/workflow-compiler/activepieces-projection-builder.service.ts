import type {
  ActivepiecesProjectionSummary,
  LexFrameWorkflowV2,
  RuntimeIR,
  RuntimeIRStep,
  RuntimePieceVersionRequirement,
} from '@lexframe/contracts';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { stableStringify } from '../canvas/canvas-canonical';
import {
  activepiecesStepName,
  type ActivepiecesFlowProjection,
  type ActivepiecesStepProjection,
  type RuntimeStepMappingDraft,
} from './workflow-compiler.types';
import { WorkflowNormalizerService } from './workflow-normalizer.service';

interface BuildProjectionInput {
  readonly workflow: LexFrameWorkflowV2;
  readonly runtimeIr: RuntimeIR;
  readonly projectId?: string | null;
  readonly flowId?: string | null;
  readonly flowVersionId?: string | null;
}

@Injectable()
export class ActivepiecesProjectionBuilder {
  constructor(private readonly normalizer: WorkflowNormalizerService) {}

  build(input: BuildProjectionInput): {
    readonly projection: ActivepiecesFlowProjection;
    readonly projectionHash: string;
    readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
    readonly summary: ActivepiecesProjectionSummary;
    readonly stepMappings: readonly RuntimeStepMappingDraft[];
  } {
    const stepMappings = this.buildStepMappings(
      input.workflow,
      input.runtimeIr,
    );
    const projection: ActivepiecesFlowProjection = {
      schemaVersion: '20',
      displayName: input.workflow.metadata.title,
      trigger: input.runtimeIr.trigger
        ? this.toActivepiecesStep(input.runtimeIr.trigger)
        : null,
      actions: input.runtimeIr.steps.map((step) =>
        this.toActivepiecesStep(step),
      ),
      branches: input.runtimeIr.branches,
      notes: this.buildNotes(input.runtimeIr),
      metadata: {
        managedBy: 'lexframe',
        compilerVersion: input.runtimeIr.metadata.compiler_version,
        workspaceId: input.workflow.workspace_id,
        automationId: input.workflow.automation_id,
        workflowId: input.workflow.id,
        draftVersionId: input.workflow.draft_version_id,
        sourceWorkflowHash: input.runtimeIr.source_hash,
        generatedAt: input.runtimeIr.metadata.generated_at,
        canonicalRunState: 'lexframe',
        stepMappings,
      },
    };
    const projectionHash = hashProjection(projection);
    const requiredPieces = collectRequiredPieces(input.runtimeIr);

    return {
      projection,
      projectionHash,
      requiredPieces,
      stepMappings,
      summary: {
        project_id: input.projectId ?? null,
        flow_id: input.flowId ?? null,
        flow_version_id: input.flowVersionId ?? null,
        sync_hash: projectionHash,
        generated_steps_count:
          input.runtimeIr.steps.length + (input.runtimeIr.trigger ? 1 : 0),
        required_pieces: requiredPieces,
        required_connections: input.runtimeIr.connection_requirements,
      },
    };
  }

  private toActivepiecesStep(step: RuntimeIRStep): ActivepiecesStepProjection {
    const type = activepiecesType(step);
    return {
      name: activepiecesStepName(step),
      displayName: step.display_name,
      type,
      settings: {
        ...(step.piece
          ? {
              pieceName: step.piece.name,
              pieceVersion: step.piece.version,
              actionName: step.piece.action_name ?? null,
              triggerName: step.piece.trigger_name ?? null,
            }
          : {}),
        input: {
          ...step.props,
          _lexframe_policy: step.policy,
          _lexframe_error_policy: step.error_policy,
        },
      },
      valid: true,
      metadata: {
        lexframeSourceNodeId: step.source_node_id,
        lexframeSourceNodeType: step.source_node_type,
        runtimeKind: step.runtime_kind,
      },
    };
  }

  private buildStepMappings(
    workflow: LexFrameWorkflowV2,
    runtimeIr: RuntimeIR,
  ): readonly RuntimeStepMappingDraft[] {
    const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const steps = [
      ...(runtimeIr.trigger ? [runtimeIr.trigger] : []),
      ...runtimeIr.steps,
    ];
    return steps.map((step) => {
      const node = nodesById.get(step.source_node_id);
      return {
        source_node_id: step.source_node_id,
        source_node_hash: node
          ? this.normalizer.computeNodeHash(node)
          : this.normalizer.stableStepSuffix(step.source_node_id),
        ir_step_id: step.ir_step_id,
        activepieces_step_name: activepiecesStepName(step),
        activepieces_step_display_name: step.display_name,
        piece_name: step.piece?.name ?? null,
        piece_version: step.piece?.version ?? null,
        action_name:
          step.piece?.action_name ?? step.piece?.trigger_name ?? null,
      };
    });
  }

  private buildNotes(runtimeIr: RuntimeIR): readonly unknown[] {
    return [
      {
        type: 'lexframe_compile_metadata',
        sourceHash: runtimeIr.source_hash,
        compilerVersion: runtimeIr.metadata.compiler_version,
        generatedAt: runtimeIr.metadata.generated_at,
      },
    ];
  }
}

function collectRequiredPieces(
  runtimeIr: RuntimeIR,
): readonly RuntimePieceVersionRequirement[] {
  const steps = [
    ...(runtimeIr.trigger ? [runtimeIr.trigger] : []),
    ...runtimeIr.steps,
  ];
  const byPiece = new Map<string, RuntimePieceVersionRequirement>();
  for (const step of steps) {
    if (!step.piece) {
      continue;
    }
    const key = `${step.piece.name}@${step.piece.version}:${
      step.piece.action_name ?? step.piece.trigger_name ?? ''
    }`;
    const existing = byPiece.get(key);
    byPiece.set(key, {
      piece_name: step.piece.name,
      piece_version: step.piece.version,
      action_name: step.piece.action_name ?? null,
      trigger_name: step.piece.trigger_name ?? null,
      source_node_ids: [
        ...new Set([...(existing?.source_node_ids ?? []), step.source_node_id]),
      ].sort(),
      status: existing?.status ?? 'available',
    });
  }
  return [...byPiece.values()].sort((left, right) =>
    `${left.piece_name}:${left.action_name ?? left.trigger_name ?? ''}`.localeCompare(
      `${right.piece_name}:${right.action_name ?? right.trigger_name ?? ''}`,
    ),
  );
}

function activepiecesType(
  step: RuntimeIRStep,
): ActivepiecesStepProjection['type'] {
  switch (step.runtime_kind) {
    case 'piece_trigger':
      return 'PIECE_TRIGGER';
    case 'router':
    case 'branch':
      return 'ROUTER';
    case 'loop':
      return 'LOOP';
    case 'note':
      return 'NOTE';
    default:
      return 'PIECE';
  }
}

export function hashProjection(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
