import type {
  CanvasCompatibilityCheckResponse,
  CanvasHandleCode,
  CanvasInsertPosition,
  LexFrameWorkflowV2,
  ModuleRequirement,
  ValidationIssue,
  WorkflowEdge,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import type { CanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { validateCanvasConnection } from '@lexframe/workflow-dsl';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';

@Injectable()
export class CanvasModuleCompatibilityService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  check(input: {
    readonly access: AccessContext;
    readonly workflow: LexFrameWorkflowV2;
    readonly block: CanvasBlockDefinition;
    readonly insert: CanvasInsertRequest;
  }): CanvasCompatibilityCheckResponse {
    const missingRequirements: ModuleRequirement[] = [];
    const warnings: ValidationIssue[] = [];

    if (input.block.kind === 'trigger') {
      const triggerExists = input.workflow.nodes.some(
        (node) => node.type === 'trigger',
      );
      if (input.insert.position !== 'workflow_start' || triggerExists) {
        return denied(
          'TRIGGER_POSITION_INVALID',
          'Стартовый блок можно добавить только в начало сценария.',
        );
      }
    }

    if (
      input.workflow.metadata.canvas_mode === 'guided_vertical' &&
      input.insert.position === 'workflow_start' &&
      input.workflow.nodes.length > 0 &&
      input.block.kind !== 'trigger'
    ) {
      return denied(
        'DISCONNECTED_NODE_BLOCKED',
        'В обычном режиме нельзя создавать disconnected node.',
      );
    }

    if (
      input.block.kind === 'end' &&
      input.insert.position !== 'workflow_end'
    ) {
      return denied(
        'END_POSITION_INVALID',
        'Завершающий блок можно добавить только в конец ветки.',
      );
    }

    if (
      input.block.kind === 'merge' &&
      countBranchSources(input.workflow) < 2
    ) {
      return denied(
        'MERGE_REQUIRES_BRANCHES',
        'Объединение веток требует минимум две входящие ветки.',
      );
    }

    if (
      input.block.kind === 'delivery' &&
      !hasPreviousDocumentOutput(input.workflow, input.insert.source_node_id)
    ) {
      missingRequirements.push({
        kind: 'step_output',
        code: `${input.block.code}:document_output`,
        label: 'Документ для доставки',
        required: true,
        status: 'missing',
        reason:
          'Доставка возможна только после шага, который создаёт документ.',
      });
      return {
        allowed: false,
        reason_code: 'DELIVERY_REQUIRES_DOCUMENT',
        human_reason:
          'Этот блок можно добавить только после шага, который создаёт документ.',
        warnings,
        missing_requirements: missingRequirements,
      };
    }

    const connectionResult = this.validateNeighborConnection(input);
    if (!connectionResult.allowed) {
      return denied(
        'INCOMPATIBLE_INSERT_POSITION',
        connectionResult.reason ??
          'Модуль нельзя вставить в выбранную позицию.',
      );
    }

    if (input.block.policies.requiresApproval) {
      warnings.push(
        warning(
          input.block.code,
          'approval_recommended',
          'Требуется согласование',
          'Перед выполнением этого блока нужен approval gate.',
        ),
      );
    }

    return {
      allowed: true,
      reason_code: null,
      human_reason: null,
      warnings,
      missing_requirements: missingRequirements,
    };
  }

  private validateNeighborConnection(input: {
    readonly access: AccessContext;
    readonly workflow: LexFrameWorkflowV2;
    readonly block: CanvasBlockDefinition;
    readonly insert: CanvasInsertRequest;
  }) {
    const source = input.insert.source_node_id
      ? input.workflow.nodes.find(
          (node) => node.id === input.insert.source_node_id,
        )
      : null;
    if (!source || input.block.kind === 'trigger') {
      return { allowed: true, reason: null };
    }

    const sourceBlockCode =
      source.block_code ??
      source.module_code ??
      source.trigger_kind ??
      source.id;
    const sourceBlock = this.registry.getBlockType(
      sourceBlockCode,
      input.access,
    );
    return validateCanvasConnection({
      sourceBlock,
      sourceHandle: (input.insert.source_handle ?? 'main_output') as never,
      targetBlock: input.block,
      targetHandle: (input.insert.target_handle ?? 'main_input') as never,
      edgeType: 'control_flow',
      hasApprovalPath: hasApprovalBefore(input.workflow, source.id),
    });
  }
}

export interface CanvasInsertRequest {
  readonly position: CanvasInsertPosition;
  readonly source_node_id?: string | null;
  readonly target_node_id?: string | null;
  readonly source_handle?: CanvasHandleCode | null;
  readonly target_handle?: CanvasHandleCode | null;
}

export function edgeForInsert(input: {
  readonly workflow: LexFrameWorkflowV2;
  readonly sourceNodeId?: string | null;
  readonly targetNodeId?: string | null;
}): WorkflowEdge | null {
  if (input.sourceNodeId && input.targetNodeId) {
    return (
      input.workflow.edges.find(
        (edge) =>
          edge.source_node_id === input.sourceNodeId &&
          edge.target_node_id === input.targetNodeId,
      ) ?? null
    );
  }
  return null;
}

function denied(
  reasonCode: string,
  humanReason: string,
): CanvasCompatibilityCheckResponse {
  return {
    allowed: false,
    reason_code: reasonCode,
    human_reason: humanReason,
    warnings: [],
    missing_requirements: [],
  };
}

function warning(
  nodeId: string,
  code: string,
  title: string,
  message: string,
): ValidationIssue {
  return {
    id: `module:${code}:${nodeId}`,
    severity: 'warning',
    scope: 'node',
    code,
    title,
    message,
    affected_node_id: nodeId,
    affected_edge_id: null,
    affected_binding_id: null,
    affected_input_key: null,
    suggested_fix: null,
    suggested_transform: null,
  };
}

function countBranchSources(workflow: LexFrameWorkflowV2) {
  return workflow.nodes.filter((node) => node.type === 'condition').length;
}

function hasPreviousDocumentOutput(
  workflow: LexFrameWorkflowV2,
  sourceNodeId?: string | null,
) {
  const sourceIndex = sourceNodeId
    ? workflow.nodes.findIndex((node) => node.id === sourceNodeId)
    : workflow.nodes.length - 1;
  return workflow.nodes
    .slice(0, sourceIndex + 1)
    .some((node) =>
      node.outputs.some((output) =>
        [
          'document_draft',
          'document_id',
          'document_version_id',
          'generated_document',
        ].includes(String(output.data_type ?? output.type ?? output.key)),
      ),
    );
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  const reverseEdges = new Map<string, readonly string[]>();
  for (const edge of workflow.edges) {
    reverseEdges.set(edge.target_node_id, [
      ...(reverseEdges.get(edge.target_node_id) ?? []),
      edge.source_node_id,
    ]);
  }
  const visited = new Set<string>();
  const queue = [targetNodeId, ...(reverseEdges.get(targetNodeId) ?? [])];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    const node = workflow.nodes.find((item) => item.id === nodeId);
    if (node?.type === 'approval') {
      return true;
    }
    queue.push(...(reverseEdges.get(nodeId) ?? []));
  }
  return false;
}
