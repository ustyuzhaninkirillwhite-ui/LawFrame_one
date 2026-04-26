import type {
  LexFrameWorkflowV2,
  RuntimeGraphNode,
  WorkflowDiffItem,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { stableStringify } from '../canvas/canvas-canonical';
import type { ReverseMappingResult } from './activepieces-reverse-mapper.service';

@Injectable()
export class WorkflowSemanticDiffService {
  diff(input: {
    readonly before: LexFrameWorkflowV2;
    readonly after: LexFrameWorkflowV2;
    readonly reverseMapping: ReverseMappingResult;
  }): readonly WorkflowDiffItem[] {
    const items: WorkflowDiffItem[] = [];
    const beforeById = new Map(
      input.before.nodes.map((node) => [node.id, node]),
    );
    const afterById = new Map(input.after.nodes.map((node) => [node.id, node]));

    for (const [id, node] of afterById) {
      const before = beforeById.get(id);
      if (!before) {
        items.push(
          nodeItem(node, 'node_added', 'info', {
            title: 'Workflow step added',
            message: `${node.display_name} was added from the Activepieces runtime.`,
            after: nodeSummary(node),
          }),
        );
        continue;
      }

      if (before.display_name !== node.display_name) {
        items.push(
          nodeItem(node, 'node_config_changed', 'info', {
            title: 'Step label changed',
            message: `${before.display_name} was renamed to ${node.display_name}.`,
            before: before.display_name,
            after: node.display_name,
            effect: 'Canvas display only.',
          }),
        );
      }

      if (stableStringify(before.config) !== stableStringify(node.config)) {
        items.push(
          nodeItem(node, 'node_config_changed', 'warning', {
            title: 'Step configuration changed',
            message: `${node.display_name} has runtime configuration changes.`,
            before: before.config,
            after: node.config,
            effect:
              'Inputs, prompts, delivery options or module parameters may differ.',
          }),
        );
      }

      if (
        stableStringify(before.input_bindings ?? []) !==
        stableStringify(node.input_bindings ?? [])
      ) {
        items.push(
          nodeItem(node, 'binding_changed', 'warning', {
            title: 'Input binding changed',
            message: `${node.display_name} uses different input bindings in runtime.`,
            before: before.input_bindings ?? [],
            after: node.input_bindings ?? [],
            effect: 'Data flowing into the legal step may change.',
          }),
        );
      }

      const beforePiece = before.runtime_mapping.activepieces_piece ?? null;
      const afterPiece = node.runtime_mapping.activepieces_piece ?? null;
      const beforeAction = before.runtime_mapping.activepieces_action ?? null;
      const afterAction = node.runtime_mapping.activepieces_action ?? null;
      if (beforePiece !== afterPiece || beforeAction !== afterAction) {
        items.push(
          nodeItem(node, 'piece_version_changed', 'requires_review', {
            title: 'Runtime piece mapping changed',
            message: `${node.display_name} now points to a different Activepieces piece or action.`,
            before: { piece: beforePiece, action: beforeAction },
            after: { piece: afterPiece, action: afterAction },
            recommended_action: 'Review the piece mapping before applying.',
          }),
        );
      }
    }

    for (const [id, node] of beforeById) {
      if (!afterById.has(id)) {
        items.push(
          nodeItem(node, 'node_removed', 'requires_review', {
            title: 'Workflow step removed',
            message: `${node.display_name} is no longer represented by the runtime import.`,
            before: nodeSummary(node),
            recommended_action:
              'Confirm that this legal step should be absent from the imported draft.',
          }),
        );
      }
    }

    if (
      stableStringify(input.before.edges) !== stableStringify(input.after.edges)
    ) {
      items.push({
        id: `semantic_diff_${hashShort(['edges', input.before.edges, input.after.edges])}`,
        type: 'branch_condition_changed',
        severity: 'requires_review',
        title: 'Workflow route changed',
        message:
          'The imported workflow has different routing, branch or loop structure.',
        before: input.before.edges,
        after: input.after.edges,
        effect: 'Execution order or legal decision paths may change.',
        recommended_action: 'Review the Canvas route before applying.',
      });
    }

    return dedupeDiffItems([
      ...items,
      ...input.reverseMapping.requiresReview,
      ...input.reverseMapping.policyBlocks,
      ...unknownNodeItems(input.reverseMapping.unknownNodes),
    ]);
  }
}

function unknownNodeItems(nodes: readonly RuntimeGraphNode[]) {
  return nodes.map(
    (node): WorkflowDiffItem => ({
      id: `semantic_diff_${hashShort(['unknown', node.runtimeNodeId])}`,
      type: 'unknown_runtime_node_added',
      severity: 'policy_block',
      runtime_node_id: node.runtimeNodeId,
      title: 'Unknown runtime step',
      message: `${node.displayName} is present in Activepieces but has no LexFrame mapping.`,
      after: {
        piece_name: node.pieceName ?? null,
        action_name: node.actionName ?? node.triggerName ?? null,
      },
      recommended_action:
        'Register a reverse mapping or overwrite runtime from Canvas.',
      technical_details: {
        piece_name: node.pieceName ?? null,
        action_name: node.actionName ?? node.triggerName ?? null,
        piece_version: node.pieceVersion ?? null,
      },
    }),
  );
}

function nodeItem(
  node: WorkflowNode,
  type: WorkflowDiffItem['type'],
  severity: WorkflowDiffItem['severity'],
  input: Omit<WorkflowDiffItem, 'id' | 'type' | 'severity' | 'node_id'>,
): WorkflowDiffItem {
  return {
    id: `semantic_diff_${hashShort([node.id, type, input.before, input.after])}`,
    type,
    severity,
    node_id: node.id,
    ...input,
  };
}

function nodeSummary(node: WorkflowNode) {
  return {
    id: node.id,
    type: node.type,
    display_name: node.display_name,
    module_code: node.module_code ?? node.block_code,
  };
}

function dedupeDiffItems(items: readonly WorkflowDiffItem[]) {
  const seen = new Set<string>();
  const output: WorkflowDiffItem[] = [];
  for (const item of items) {
    const key = [
      item.type,
      item.node_id ?? '',
      item.runtime_node_id ?? '',
      item.title,
    ].join(':');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }
  return output;
}

function hashShort(value: unknown) {
  return createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')
    .slice(0, 12);
}
