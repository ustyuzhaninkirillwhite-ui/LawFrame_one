import type { CanvasAiDiffSummary, CanvasOperation } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CanvasDiffService {
  buildDiff(operations: readonly CanvasOperation[]): CanvasAiDiffSummary {
    const diff: MutableDiff = {
      added_nodes: [],
      removed_nodes: [],
      changed_nodes: [],
      added_edges: [],
      removed_edges: [],
      changed_edges: [],
      binding_changes: [],
      approval_gates: [],
      policy_blocks: [],
    };

    for (const operation of operations) {
      const payload = operation.operation_payload;
      switch (operation.operation_type) {
        case 'ADD_NODE_FROM_MODULE':
        case 'ADD_NODE':
        case 'DUPLICATE_NODE':
          diff.added_nodes.push(nodeSummary(operation, payload));
          if (/approval/i.test(String(moduleCode(payload) ?? ''))) {
            diff.approval_gates.push(String(moduleCode(payload)));
          }
          break;
        case 'DELETE_NODE':
          diff.removed_nodes.push(nodeSummary(operation, payload));
          break;
        case 'UPDATE_NODE':
        case 'UPDATE_NODE_CONFIG':
        case 'UPDATE_NODE_POLICY':
        case 'MOVE_NODE':
          diff.changed_nodes.push(nodeSummary(operation, payload));
          break;
        case 'ADD_EDGE':
          diff.added_edges.push(edgeSummary(operation, payload));
          break;
        case 'DELETE_EDGE':
          diff.removed_edges.push(edgeSummary(operation, payload));
          break;
        case 'UPDATE_EDGE':
        case 'UPDATE_CONDITION':
          diff.changed_edges.push(edgeSummary(operation, payload));
          break;
        case 'UPSERT_INPUT_BINDING':
        case 'DELETE_INPUT_BINDING':
          diff.binding_changes.push({
            node_id: stringValue(payload.node_id ?? payload.nodeId),
            input_key: stringValue(payload.input_key ?? payload.inputKey),
            operation_type: operation.operation_type,
          });
          break;
        default:
          break;
      }
    }

    return diff;
  }
}

type MutableDiff = {
  -readonly [K in keyof CanvasAiDiffSummary]: CanvasAiDiffSummary[K] extends readonly (infer T)[]
    ? T[]
    : CanvasAiDiffSummary[K];
};

function nodeSummary(
  operation: CanvasOperation,
  payload: Record<string, unknown>,
) {
  const node = isRecord(payload.node) ? payload.node : {};
  return {
    node_id:
      stringValue(payload.node_id ?? payload.nodeId) ?? stringValue(node.id),
    module_code: moduleCode(payload) ?? moduleCode(node),
    display_name:
      stringValue(payload.display_name ?? payload.displayName) ??
      stringValue(node.display_name ?? node.displayName),
    operation_type: operation.operation_type,
  };
}

function edgeSummary(
  operation: CanvasOperation,
  payload: Record<string, unknown>,
) {
  const edge = isRecord(payload.edge) ? payload.edge : payload;
  return {
    edge_id: stringValue(edge.id ?? edge.edge_id ?? edge.edgeId),
    source_node_id: stringValue(edge.source_node_id ?? edge.sourceNodeId),
    target_node_id: stringValue(edge.target_node_id ?? edge.targetNodeId),
    operation_type: operation.operation_type,
  };
}

function moduleCode(payload: Record<string, unknown>) {
  return stringValue(
    payload.module_code ?? payload.moduleCode ?? payload.block_code,
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
