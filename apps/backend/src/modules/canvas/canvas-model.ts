import type {
  CanvasHandleCode,
  CanvasNodeType,
  LexFrameWorkflowV2,
  WorkflowEdge,
  WorkflowHandle,
  WorkflowNode,
} from '@lexframe/contracts';
import { findCanvasBlockDefinition } from '@lexframe/workflow-dsl';
import dagre from 'dagre';
import { handlesWithDataPorts, normalizeDataField } from './canvas-io-utils';

export const DEFAULT_NODE_WIDTH = 288;
export const DEFAULT_NODE_HEIGHT = 104;

const inputHandle: WorkflowHandle = {
  code: 'main_input',
  label: 'Input',
  direction: 'input',
  kind: 'control_in',
  edge_types: ['control_flow'],
};

const outputHandle: WorkflowHandle = {
  code: 'main_output',
  label: 'Next',
  direction: 'output',
  kind: 'control_out',
  edge_types: ['control_flow'],
};

export function getDefaultHandles(
  type: CanvasNodeType,
): readonly WorkflowHandle[] {
  if (type === 'trigger') {
    return [outputHandle];
  }

  if (type === 'end' || type === 'note' || type === 'group') {
    return [inputHandle];
  }

  if (type === 'condition') {
    return [
      inputHandle,
      controlOutput('true_branch', 'Yes', 'condition_true_out'),
      controlOutput('false_branch', 'No', 'condition_false_out'),
      errorOutput(),
    ];
  }

  if (type === 'approval') {
    return [
      inputHandle,
      {
        code: 'approved',
        label: 'Approved',
        direction: 'output',
        kind: 'approval_approved_out',
        edge_types: ['approval_flow'],
      },
      {
        code: 'rejected',
        label: 'Rejected',
        direction: 'output',
        kind: 'approval_rejected_out',
        edge_types: ['approval_flow'],
      },
      {
        code: 'changes_requested',
        label: 'Changes requested',
        direction: 'output',
        kind: 'approval_rejected_out',
        edge_types: ['approval_flow'],
      },
      errorOutput(),
    ];
  }

  if (type === 'loop') {
    return [
      inputHandle,
      {
        code: 'loop_item',
        label: 'Item',
        direction: 'output',
        kind: 'loop_item_out',
        edge_types: ['loop_flow'],
      },
      {
        code: 'after_loop',
        label: 'Done',
        direction: 'output',
        kind: 'loop_done_out',
        edge_types: ['loop_flow'],
      },
      errorOutput(),
    ];
  }

  if (type === 'merge') {
    return [
      {
        code: 'merge_a',
        label: 'Branch A',
        direction: 'input',
        kind: 'merge_in',
        edge_types: ['control_flow'],
      },
      {
        code: 'merge_b',
        label: 'Branch B',
        direction: 'input',
        kind: 'merge_in',
        edge_types: ['control_flow'],
      },
      outputHandle,
    ];
  }

  if (type === 'errorHandler') {
    return [
      {
        code: 'error_input',
        label: 'Error',
        direction: 'input',
        kind: 'error_in',
        edge_types: ['error_flow'],
      },
      controlOutput('retry', 'Retry'),
      controlOutput('fallback', 'Fallback'),
      controlOutput('stop', 'Stop'),
      controlOutput('notify', 'Notify'),
    ];
  }

  return [inputHandle, outputHandle, errorOutput()];
}

export function createWorkflowNode(input: {
  readonly id: string;
  readonly type: CanvasNodeType;
  readonly blockCode?: string | null;
  readonly displayName: string;
  readonly description?: string | null;
  readonly moduleCode?: string | null;
  readonly triggerKind?: string | null;
  readonly x: number;
  readonly y: number;
}): WorkflowNode {
  const block = input.blockCode
    ? findCanvasBlockDefinition(input.blockCode)
    : input.moduleCode
      ? findCanvasBlockDefinition(input.moduleCode)
      : null;
  const inputs = block
    ? block.inputs
        .map((field) =>
          normalizeDataField(field, {
            key: field.key,
            label: field.label,
            data_type: field.type,
            required: field.required,
            classification: field.classification ?? null,
            allowed_sources: field.allowedSources,
          }),
        )
        .filter((field) => field !== null)
    : [];
  const outputs = block
    ? block.outputs
        .map((field) =>
          normalizeDataField(field, {
            key: field.key,
            label: field.label,
            data_type: field.type,
            required: field.required,
            classification: field.classification ?? null,
            allowed_sources: field.allowedSources,
          }),
        )
        .filter((field) => field !== null)
    : [];
  const controlHandles = block
    ? block.handles.map((handle) => ({
        code: handle.code,
        label: handle.label,
        direction: handle.direction,
        kind: handle.kind,
        edge_types: handle.edgeTypes,
        data_type: handle.dataType ?? null,
        data_field_key: handle.dataFieldKey ?? null,
      }))
    : getDefaultHandles(input.type);

  return {
    id: input.id,
    type: input.type,
    block_code:
      input.blockCode ?? input.moduleCode ?? input.triggerKind ?? input.id,
    display_name: input.displayName,
    description: input.description ?? null,
    module_code: input.moduleCode ?? null,
    module_version: null,
    module_schema_hash: null,
    dynamic_outputs_status: 'static',
    trigger_kind: input.triggerKind ?? null,
    handles: handlesWithDataPorts(controlHandles, inputs, outputs),
    inputs,
    outputs,
    bindings: {},
    input_bindings: [],
    config: block?.defaultConfig ?? {},
    policy: {
      approval_required:
        block?.policies.requiresApproval ??
        (input.type === 'approval' ||
          input.type === 'delivery' ||
          input.moduleCode?.startsWith('document.') === true),
      external_action:
        block?.policies.isExternalAction ?? input.type === 'delivery',
      ai_action: block?.policies.canUseAi ?? input.type === 'aiAction',
      data_classification: block?.policies.dataClassification ?? null,
      risk_level: block?.policies.riskLevel,
      can_use_documents: block?.policies.canUseDocuments,
      can_run_in_dry_run: block?.policies.canRunInDryRun,
      can_be_published_as_template: block?.policies.canBePublishedAsTemplate,
      required_permissions: block?.policies.requiredPermissions,
    },
    runtime_mapping: {
      module_code: input.moduleCode ?? null,
      provider: block?.runtime.provider,
      activepieces_piece: block?.runtime.activepiecesPiece ?? null,
      activepieces_action: block?.runtime.activepiecesAction ?? null,
      internal_route: block?.runtime.internalRoute ?? null,
      can_compile: input.type !== 'note',
      supports_step_test: block?.runtime.supportsStepTest,
      supports_partial_execution: block?.runtime.supportsPartialExecution,
      supports_pinned_data: block?.runtime.supportsPinnedData,
      warnings: block?.runtime.notes ?? [],
    },
    test_state: {
      sample_data_status: 'missing',
    },
    layout: {
      x: input.x,
      y: input.y,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    },
  };
}

export function createWorkflowEdge(input: {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: CanvasHandleCode;
  readonly targetHandle?: CanvasHandleCode;
  readonly type?: WorkflowEdge['type'];
  readonly label?: string | null;
  readonly condition?: string | null;
}): WorkflowEdge {
  const sourceHandle = input.sourceHandle ?? 'main_output';
  const targetHandle = input.targetHandle ?? 'main_input';

  return {
    id: `${input.source}:${sourceHandle}:${input.target}:${targetHandle}`,
    type: input.type ?? 'control',
    source_node_id: input.source,
    source_handle: sourceHandle,
    target_node_id: input.target,
    target_handle: targetHandle,
    label: input.label ?? null,
    condition: input.condition ?? null,
    validation_state: 'valid',
  };
}

export function applyGuidedLayout(
  workflow: LexFrameWorkflowV2,
): LexFrameWorkflowV2 {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 96,
    ranksep: 96,
    marginx: 64,
    marginy: 64,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of workflow.nodes) {
    graph.setNode(node.id, {
      width: node.layout.width ?? DEFAULT_NODE_WIDTH,
      height: node.layout.height ?? DEFAULT_NODE_HEIGHT,
    });
  }

  for (const edge of workflow.edges) {
    graph.setEdge(edge.source_node_id, edge.target_node_id, {}, edge.id);
  }

  dagre.layout(graph);

  const nextNodes = workflow.nodes.map((node, index) => {
    if (node.type === 'note') {
      return {
        ...node,
        layout: {
          ...node.layout,
          x: node.layout.x ?? 520,
          y: node.layout.y ?? 80 + index * 120,
          width: node.layout.width ?? DEFAULT_NODE_WIDTH,
          height: node.layout.height ?? DEFAULT_NODE_HEIGHT,
        },
      };
    }

    const layout = graph.node(node.id) as
      | { readonly x: number; readonly y: number }
      | undefined;
    const width = node.layout.width ?? DEFAULT_NODE_WIDTH;
    const height = node.layout.height ?? DEFAULT_NODE_HEIGHT;

    return {
      ...node,
      layout: {
        ...node.layout,
        x: layout ? Math.round(layout.x - width / 2) : node.layout.x,
        y: layout ? Math.round(layout.y - height / 2) : node.layout.y,
        width,
        height,
      },
    };
  });

  return {
    ...workflow,
    nodes: nextNodes,
    layout: {
      ...workflow.layout,
      updated_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}

function controlOutput(
  code: CanvasHandleCode,
  label: string,
  kind: WorkflowHandle['kind'] = 'control_out',
): WorkflowHandle {
  return {
    code,
    label,
    direction: 'output',
    kind,
    edge_types: ['control_flow'],
  };
}

function errorOutput(): WorkflowHandle {
  return {
    code: 'error_output',
    label: 'Error',
    direction: 'output',
    kind: 'error_out',
    edge_types: ['error_flow'],
  };
}
