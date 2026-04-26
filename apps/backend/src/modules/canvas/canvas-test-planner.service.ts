import type {
  CanvasTestMode,
  CanvasTestRunRequest,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  ValidationIssue,
  WorkflowEdge,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';

export interface CanvasExecutionPlan {
  readonly mode: CanvasTestMode;
  readonly targetNodeId: string | null;
  readonly targetBranchId: string | null;
  readonly nodes: readonly WorkflowNode[];
  readonly usesPinnedData: boolean;
  readonly blocked: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}

@Injectable()
export class CanvasTestPlanner {
  buildPlan(input: {
    readonly workflow: LexFrameWorkflowV2;
    readonly validation: CanvasValidationSummary;
    readonly request: CanvasTestRunRequest;
    readonly pinnedNodeIds: readonly string[];
  }): CanvasExecutionPlan {
    const targetNodeId = input.request.target_node_id ?? null;
    const targetBranchId = input.request.target_branch_id ?? null;
    const mode = input.request.mode;
    const nodes = nodesForMode({
      workflow: input.workflow,
      mode,
      targetNodeId,
    });
    const relevantIssues = filterIssuesForMode({
      validation: input.validation,
      mode,
      targetNodeId,
    });
    const unsupportedIssues = nodes.flatMap((node) =>
      unsupportedIssuesForNode(node, mode),
    );
    const issues = [...relevantIssues, ...unsupportedIssues];
    const blocking = issues.filter(
      (issue) =>
        issue.severity === 'error' || issue.severity === 'policy_block',
    );

    return {
      mode,
      targetNodeId,
      targetBranchId,
      nodes,
      usesPinnedData: nodes.some((node) =>
        input.pinnedNodeIds.includes(node.id),
      ),
      blocked:
        blocking.length > 0 ||
        (mode !== 'validation_only' && !input.validation.can_test),
      issues,
      warnings: issues.filter((issue) => issue.severity === 'warning'),
    };
  }
}

function nodesForMode(input: {
  readonly workflow: LexFrameWorkflowV2;
  readonly mode: CanvasTestMode;
  readonly targetNodeId: string | null;
}): readonly WorkflowNode[] {
  if (input.mode === 'validation_only') {
    return [];
  }
  if (input.mode === 'dry_run_full') {
    return topologicalNodes(input.workflow);
  }

  const targetNode = findTargetNode(input.workflow, input.targetNodeId);
  if (
    input.mode === 'test_selected_step' ||
    input.mode === 'test_until_selected_step'
  ) {
    return upstreamSlice(input.workflow, targetNode.id);
  }
  return [targetNode];
}

function findTargetNode(
  workflow: LexFrameWorkflowV2,
  targetNodeId: string | null,
) {
  if (!targetNodeId) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'target_node_id is required for this Canvas test mode.',
    );
  }
  const node = workflow.nodes.find((item) => item.id === targetNodeId);
  if (!node) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      404,
      'Canvas test target node was not found.',
    );
  }
  return node;
}

function upstreamSlice(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  const upstreamIds = new Set<string>();
  collectUpstream(workflow.edges, targetNodeId, upstreamIds);
  upstreamIds.add(targetNodeId);
  return topologicalNodes(workflow).filter((node) => upstreamIds.has(node.id));
}

function collectUpstream(
  edges: readonly WorkflowEdge[],
  nodeId: string,
  output: Set<string>,
) {
  for (const edge of edges) {
    if (edge.target_node_id !== nodeId || output.has(edge.source_node_id)) {
      continue;
    }
    output.add(edge.source_node_id);
    collectUpstream(edges, edge.source_node_id, output);
  }
}

function topologicalNodes(workflow: LexFrameWorkflowV2) {
  const nodes = [...workflow.nodes];
  return nodes.sort((left, right) => {
    const leftY = left.layout?.y ?? 0;
    const rightY = right.layout?.y ?? 0;
    if (leftY !== rightY) {
      return leftY - rightY;
    }
    const leftX = left.layout?.x ?? 0;
    const rightX = right.layout?.x ?? 0;
    if (leftX !== rightX) {
      return leftX - rightX;
    }
    return left.id.localeCompare(right.id);
  });
}

function filterIssuesForMode(input: {
  readonly validation: CanvasValidationSummary;
  readonly mode: CanvasTestMode;
  readonly targetNodeId: string | null;
}) {
  const blockTarget = blockTargetForMode(input.mode);
  return input.validation.issues.filter((issue) => {
    if (
      input.targetNodeId &&
      issue.affected_node_id &&
      issue.affected_node_id !== input.targetNodeId
    ) {
      return false;
    }
    return issue.blocks?.includes(blockTarget) || issue.severity !== 'info';
  });
}

function blockTargetForMode(mode: CanvasTestMode) {
  if (mode === 'dry_run_full') {
    return 'test_flow' as const;
  }
  return 'test_step' as const;
}

function unsupportedIssuesForNode(
  node: WorkflowNode,
  mode: CanvasTestMode,
): readonly ValidationIssue[] {
  if (mode === 'dry_run_full') {
    return [];
  }
  const supportsStep =
    node.runtime_mapping.supports_step_test ??
    node.runtime_mapping.supports_partial_execution ??
    true;
  if (supportsStep) {
    return [];
  }
  return [
    {
      id: `unsupported_${node.id}`,
      severity: 'warning',
      category: 'runtime',
      scope: 'node',
      code: 'RUNTIME_MAPPING_MISSING',
      title: 'Step test support is not declared',
      message:
        'This step does not declare step-test support. Canvas will use a safe simulated result.',
      affected_node_id: node.id,
      blocks: [],
    },
  ];
}
