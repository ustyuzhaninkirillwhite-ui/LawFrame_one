import type {
  CanvasVersionCompareResponse,
  LexFrameWorkflowV2,
  WorkflowDiffItem,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

interface CompareInput {
  readonly automationId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly fromWorkflow: LexFrameWorkflowV2;
  readonly toWorkflow: LexFrameWorkflowV2;
}

@Injectable()
export class CanvasVersionDiffService {
  compare(input: CompareInput): CanvasVersionCompareResponse {
    const graph: WorkflowDiffItem[] = [];
    const config: WorkflowDiffItem[] = [];
    const bindings: WorkflowDiffItem[] = [];
    const legalPolicy: WorkflowDiffItem[] = [];
    const runtime: WorkflowDiffItem[] = [];
    const ux: WorkflowDiffItem[] = [];

    const fromNodes = new Map(
      input.fromWorkflow.nodes.map((node) => [node.id, node]),
    );
    const toNodes = new Map(
      input.toWorkflow.nodes.map((node) => [node.id, node]),
    );
    for (const [nodeId, toNode] of toNodes) {
      const fromNode = fromNodes.get(nodeId);
      if (!fromNode) {
        graph.push(
          diffItem(
            'node_added',
            'info',
            nodeId,
            'Node added',
            toNode.display_name,
            null,
            summarizeNode(toNode),
          ),
        );
        continue;
      }
      if (stableJson(fromNode.config) !== stableJson(toNode.config)) {
        config.push(
          diffItem(
            'node_config_changed',
            'requires_review',
            nodeId,
            'Node config changed',
            toNode.display_name,
            fromNode.config,
            toNode.config,
          ),
        );
      }
      if (
        stableJson(fromNode.input_bindings ?? []) !==
        stableJson(toNode.input_bindings ?? [])
      ) {
        bindings.push(
          diffItem(
            'binding_changed',
            'requires_review',
            nodeId,
            'Input bindings changed',
            toNode.display_name,
            fromNode.input_bindings ?? [],
            toNode.input_bindings ?? [],
          ),
        );
      }
      if (
        stableJson(fromNode.policy ?? fromNode.policies ?? {}) !==
        stableJson(toNode.policy ?? toNode.policies ?? {})
      ) {
        legalPolicy.push(
          diffItem(
            'policy_violation',
            'requires_review',
            nodeId,
            'Policy changed',
            toNode.display_name,
            fromNode.policy ?? fromNode.policies ?? {},
            toNode.policy ?? toNode.policies ?? {},
          ),
        );
      }
      if (
        stableJson(fromNode.runtime_mapping) !==
        stableJson(toNode.runtime_mapping)
      ) {
        runtime.push(
          diffItem(
            'piece_version_changed',
            'requires_review',
            nodeId,
            'Runtime mapping changed',
            toNode.display_name,
            fromNode.runtime_mapping,
            toNode.runtime_mapping,
          ),
        );
      }
      if (
        fromNode.display_name !== toNode.display_name ||
        fromNode.description !== toNode.description
      ) {
        ux.push(
          diffItem(
            'node_config_changed',
            'info',
            nodeId,
            'Node label changed',
            `${fromNode.display_name} -> ${toNode.display_name}`,
            {
              display_name: fromNode.display_name,
              description: fromNode.description,
            },
            {
              display_name: toNode.display_name,
              description: toNode.description,
            },
          ),
        );
      }
    }

    for (const [nodeId, fromNode] of fromNodes) {
      if (!toNodes.has(nodeId)) {
        graph.push(
          diffItem(
            'node_removed',
            'requires_review',
            nodeId,
            'Node removed',
            fromNode.display_name,
            summarizeNode(fromNode),
            null,
          ),
        );
      }
    }

    const fromEdges = new Map(
      input.fromWorkflow.edges.map((edge) => [edge.id, edge]),
    );
    const toEdges = new Map(
      input.toWorkflow.edges.map((edge) => [edge.id, edge]),
    );
    for (const [edgeId, edge] of toEdges) {
      if (!fromEdges.has(edgeId)) {
        graph.push(
          diffItem(
            'edge_added',
            'info',
            null,
            'Edge added',
            edge.id,
            null,
            edge,
          ),
        );
      }
    }
    for (const [edgeId, edge] of fromEdges) {
      if (!toEdges.has(edgeId)) {
        graph.push(
          diffItem(
            'edge_removed',
            'requires_review',
            null,
            'Edge removed',
            edge.id,
            edge,
            null,
          ),
        );
      }
    }

    const summary = {
      added_nodes: graph.filter((item) => item.type === 'node_added').length,
      removed_nodes: graph.filter((item) => item.type === 'node_removed')
        .length,
      changed_nodes: config.length + ux.length,
      changed_bindings: bindings.length,
      policy_changes: legalPolicy.length,
      runtime_changes: runtime.length,
    };

    return {
      automation_id: input.automationId,
      from_version_id: input.fromId,
      to_version_id: input.toId,
      human_summary: buildHumanSummary(summary),
      technical_patch: {
        graph,
        config,
        bindings,
        legal_policy: legalPolicy,
        runtime,
        ux,
      },
      summary,
    };
  }
}

function diffItem(
  type: WorkflowDiffItem['type'],
  severity: WorkflowDiffItem['severity'],
  nodeId: string | null,
  title: string,
  message: string,
  before: unknown,
  after: unknown,
): WorkflowDiffItem {
  return {
    id: `${type}:${nodeId ?? message}`,
    type,
    severity,
    node_id: nodeId,
    title,
    message,
    before,
    after,
    effect:
      severity === 'requires_review'
        ? 'Review before publish or rollback.'
        : null,
    recommended_action:
      severity === 'requires_review'
        ? 'Compare runtime and policy impact.'
        : null,
  };
}

function summarizeNode(node: WorkflowNode) {
  return {
    id: node.id,
    type: node.type,
    display_name: node.display_name,
    module_code: node.module_code ?? node.block_code,
  };
}

function buildHumanSummary(summary: CanvasVersionCompareResponse['summary']) {
  const lines = [
    summary.added_nodes > 0 ? `${summary.added_nodes} node(s) added.` : null,
    summary.removed_nodes > 0
      ? `${summary.removed_nodes} node(s) removed.`
      : null,
    summary.changed_nodes > 0
      ? `${summary.changed_nodes} node label/config change(s).`
      : null,
    summary.changed_bindings > 0
      ? `${summary.changed_bindings} data binding change(s).`
      : null,
    summary.policy_changes > 0
      ? `${summary.policy_changes} legal/policy change(s).`
      : null,
    summary.runtime_changes > 0
      ? `${summary.runtime_changes} runtime mapping change(s).`
      : null,
  ].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines : ['No semantic Canvas changes detected.'];
}

function stableJson(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortValue(nested)]),
  );
}
