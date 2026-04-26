import type {
  CompileIssue,
  CompileWarning,
  LexFrameWorkflowV2,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowGraphValidator {
  validate(workflow: LexFrameWorkflowV2): {
    readonly issues: readonly CompileIssue[];
    readonly warnings: readonly CompileWarning[];
    readonly topologicalOrder: readonly string[];
  } {
    const issues: CompileIssue[] = [];
    const warnings: CompileWarning[] = [];
    const executableNodes = workflow.nodes.filter(
      (node) => node.type !== 'note' && node.type !== 'group' && !node.disabled,
    );
    const nodeIds = new Set(executableNodes.map((node) => node.id));
    const triggerIds = executableNodes
      .filter((node) => node.type === 'trigger')
      .map((node) => node.id);

    if (triggerIds.length === 0) {
      issues.push({
        code: 'WF_COMPILER_GRAPH_TRIGGER_REQUIRED',
        message: 'Workflow must contain a trigger node before runtime compile.',
        severity: 'error',
      });
    }
    if (triggerIds.length > 1) {
      issues.push({
        code: 'WF_COMPILER_GRAPH_MULTIPLE_TRIGGERS',
        message: 'Runtime compiler supports one primary trigger in this stage.',
        severity: 'error',
      });
    }

    const adjacency = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    for (const nodeId of nodeIds) {
      adjacency.set(nodeId, []);
      indegree.set(nodeId, 0);
    }

    for (const edge of workflow.edges.filter(isRuntimeEdge)) {
      if (
        !nodeIds.has(edge.source_node_id) ||
        !nodeIds.has(edge.target_node_id)
      ) {
        warnings.push({
          code: 'WF_COMPILER_GRAPH_EDGE_SKIPPED',
          message: 'Runtime compiler ignored an edge with a missing endpoint.',
          node_id: edge.source_node_id,
        });
        continue;
      }
      adjacency.get(edge.source_node_id)!.push(edge.target_node_id);
      indegree.set(
        edge.target_node_id,
        (indegree.get(edge.target_node_id) ?? 0) + 1,
      );
    }

    const roots =
      triggerIds.length > 0
        ? triggerIds
        : [...nodeIds].filter((id) => (indegree.get(id) ?? 0) === 0);
    const visited = new Set<string>();
    const queue = [...roots].sort();
    const order: string[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);
      order.push(nodeId);
      for (const target of [...(adjacency.get(nodeId) ?? [])].sort()) {
        const nextIndegree = Math.max((indegree.get(target) ?? 0) - 1, 0);
        indegree.set(target, nextIndegree);
        if (nextIndegree === 0) {
          queue.push(target);
          queue.sort();
        }
      }
    }

    for (const node of executableNodes) {
      if (!visited.has(node.id)) {
        issues.push({
          code: 'WF_COMPILER_GRAPH_DISCONNECTED_NODE',
          message: `${node.display_name} is not reachable from the workflow trigger.`,
          severity: 'error',
          node_id: node.id,
        });
      }
    }

    const cyclicNodes = [...indegree.entries()]
      .filter(
        ([nodeId, count]) =>
          nodeIds.has(nodeId) && count > 0 && !visited.has(nodeId),
      )
      .map(([nodeId]) => nodeId);
    if (cyclicNodes.length > 0) {
      issues.push({
        code: 'WF_COMPILER_GRAPH_ILLEGAL_CYCLE',
        message:
          'Runtime compiler detected a control-flow cycle that is not represented as a loop block.',
        severity: 'error',
        details: { node_ids: cyclicNodes },
      });
    }

    return { issues, warnings, topologicalOrder: order };
  }
}

function isRuntimeEdge(edge: LexFrameWorkflowV2['edges'][number]) {
  const type = edge.edge_type ?? edge.type;
  return (
    type === 'control' ||
    type === 'control_flow' ||
    type === 'approval' ||
    type === 'approval_flow' ||
    type === 'error' ||
    type === 'error_flow' ||
    type === 'loop' ||
    type === 'loop_flow'
  );
}
