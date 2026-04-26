import type {
  CanvasHandleCode,
  CanvasInsertPosition,
  LexFrameWorkflowV2,
  WorkflowEdge,
  WorkflowNode,
} from '@lexframe/contracts';
import type { CanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';

@Injectable()
export class CanvasNodeFactory {
  createFromModule(input: {
    readonly workflow: LexFrameWorkflowV2;
    readonly block: CanvasBlockDefinition;
    readonly insert: {
      readonly position: CanvasInsertPosition;
      readonly source_node_id?: string | null;
      readonly target_node_id?: string | null;
      readonly source_handle?: CanvasHandleCode | null;
      readonly target_handle?: CanvasHandleCode | null;
    };
    readonly initialConfig?: Record<string, unknown>;
    readonly moduleVersion?: string | null;
  }): {
    readonly node: WorkflowNode;
    readonly edges: readonly WorkflowEdge[];
    readonly deletedEdgeIds: readonly string[];
  } {
    const insertion = resolveInsertion(input.workflow, input.insert);
    const anchor = insertion.source ?? insertion.target;
    const node = {
      ...createWorkflowNode({
        id: nextNodeId(input.workflow, input.block.code),
        type: input.block.nodeType,
        blockCode: input.block.code,
        displayName: input.block.displayName,
        description: input.block.shortDescription,
        moduleCode: input.block.moduleCode ?? null,
        triggerKind: input.block.kind === 'trigger' ? input.block.code : null,
        x: (anchor?.layout.x ?? 160) + (insertion.target ? 0 : 240),
        y: insertion.target
          ? Math.round(
              ((insertion.source?.layout.y ?? 160) +
                insertion.target.layout.y) /
                2,
            )
          : (anchor?.layout.y ?? 160) + 150,
      }),
      module_version: input.moduleVersion ?? '1.0.0',
      config: {
        ...input.block.defaultConfig,
        ...(input.initialConfig ?? {}),
      },
    };
    const edges: WorkflowEdge[] = [];

    if (insertion.source) {
      const sourceHandle = outputHandleForNode(
        insertion.source,
        insertion.sourceHandle,
      );
      edges.push(
        createWorkflowEdge({
          source: insertion.source.id,
          target: node.id,
          sourceHandle,
          targetHandle: 'main_input',
          type: edgeTypeForHandle(sourceHandle),
        }),
      );
    }

    if (insertion.target) {
      const sourceHandle = outputHandleForNode(node, 'main_output');
      edges.push(
        createWorkflowEdge({
          source: node.id,
          target: insertion.target.id,
          sourceHandle,
          targetHandle: insertion.targetHandle,
          type: edgeTypeForHandle(sourceHandle),
        }),
      );
    }

    return {
      node,
      edges,
      deletedEdgeIds: insertion.deletedEdgeId ? [insertion.deletedEdgeId] : [],
    };
  }
}

function resolveInsertion(
  workflow: LexFrameWorkflowV2,
  insert: {
    readonly position: CanvasInsertPosition;
    readonly source_node_id?: string | null;
    readonly target_node_id?: string | null;
    readonly source_handle?: CanvasHandleCode | null;
    readonly target_handle?: CanvasHandleCode | null;
  },
) {
  const source = insert.source_node_id
    ? workflow.nodes.find((node) => node.id === insert.source_node_id)
    : null;
  const target = insert.target_node_id
    ? workflow.nodes.find((node) => node.id === insert.target_node_id)
    : null;

  if (insert.position === 'workflow_start') {
    return {
      source: null,
      target: workflow.nodes.find((node) => node.type !== 'note') ?? null,
      sourceHandle: 'main_output' as CanvasHandleCode,
      targetHandle: 'main_input' as CanvasHandleCode,
      deletedEdgeId: null,
    };
  }

  if (source && target) {
    const existing = workflow.edges.find(
      (edge) =>
        edge.source_node_id === source.id && edge.target_node_id === target.id,
    );
    return {
      source,
      target,
      sourceHandle:
        insert.source_handle ?? existing?.source_handle ?? 'main_output',
      targetHandle:
        insert.target_handle ?? existing?.target_handle ?? 'main_input',
      deletedEdgeId: existing?.id ?? null,
    };
  }

  if (insert.position === 'before_node' && target) {
    const incoming = workflow.edges.find(
      (edge) => edge.target_node_id === target.id,
    );
    const incomingSource = incoming
      ? workflow.nodes.find((node) => node.id === incoming.source_node_id)
      : null;
    return {
      source: incomingSource ?? null,
      target,
      sourceHandle: incoming?.source_handle ?? 'main_output',
      targetHandle:
        insert.target_handle ?? incoming?.target_handle ?? 'main_input',
      deletedEdgeId: incoming?.id ?? null,
    };
  }

  if (insert.position === 'workflow_end') {
    const end = workflow.nodes.find((node) => node.type === 'end') ?? null;
    const incomingToEnd = end
      ? workflow.edges.find((edge) => edge.target_node_id === end.id)
      : null;
    const inferredSource =
      source ??
      (incomingToEnd
        ? workflow.nodes.find(
            (node) => node.id === incomingToEnd.source_node_id,
          )
        : workflow.nodes
            .filter((node) => node.type !== 'end' && node.type !== 'note')
            .at(-1)) ??
      null;
    return {
      source: inferredSource,
      target: end,
      sourceHandle:
        insert.source_handle ?? incomingToEnd?.source_handle ?? 'main_output',
      targetHandle: incomingToEnd?.target_handle ?? 'main_input',
      deletedEdgeId: incomingToEnd?.id ?? null,
    };
  }

  return {
    source,
    target,
    sourceHandle: sourceHandleForPosition(
      insert.position,
      insert.source_handle,
    ),
    targetHandle: insert.target_handle ?? 'main_input',
    deletedEdgeId: null,
  };
}

function sourceHandleForPosition(
  position: CanvasInsertPosition,
  requested?: CanvasHandleCode | null,
): CanvasHandleCode {
  if (requested) {
    return requested;
  }
  if (position === 'branch_true') {
    return 'true_branch';
  }
  if (position === 'branch_false') {
    return 'false_branch';
  }
  if (position === 'loop_body') {
    return 'loop_item';
  }
  if (position === 'approval_after') {
    return 'approved';
  }
  if (position === 'error_handler') {
    return 'error_output';
  }
  return 'main_output';
}

function outputHandleForNode(
  node: WorkflowNode,
  requested: CanvasHandleCode,
): CanvasHandleCode {
  if (
    node.handles.some(
      (handle) => handle.direction === 'output' && handle.code === requested,
    )
  ) {
    return requested;
  }

  const preferred = ['main_output', 'sent', 'approved', 'after_loop', 'true_branch'];
  const fallback =
    preferred
      .map((code) => node.handles.find(
        (handle) => handle.direction === 'output' && handle.code === code,
      ))
      .find(Boolean) ??
    node.handles.find((handle) => handle.direction === 'output');

  return (fallback?.code ?? requested) as CanvasHandleCode;
}

function edgeTypeForHandle(handle: CanvasHandleCode): WorkflowEdge['type'] {
  if (handle === 'error_output' || handle === 'out:error') {
    return 'error';
  }
  if (
    handle === 'approved' ||
    handle === 'rejected' ||
    handle === 'changes_requested'
  ) {
    return 'approval';
  }
  if (handle === 'loop_item' || handle === 'after_loop') {
    return 'loop';
  }
  return 'control';
}

function nextNodeId(workflow: LexFrameWorkflowV2, blockCode: string) {
  const slug = blockCode.replace(/[^a-zA-Z0-9_]+/g, '_');
  let counter = workflow.nodes.length + 1;
  let candidate = `${slug}_${counter}`;
  while (workflow.nodes.some((node) => node.id === candidate)) {
    counter += 1;
    candidate = `${slug}_${counter}`;
  }
  return candidate;
}
