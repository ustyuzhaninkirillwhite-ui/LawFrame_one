import type {
  CanvasEdgeType,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  WorkflowEdge,
  WorkflowCanonicalEdgeType,
  WorkflowHandle,
  WorkflowInputPort,
  WorkflowNode,
  WorkflowOutputPort,
  WorkflowPolicyBlock,
  WorkflowSecretsPolicy,
} from '@lexframe/contracts';

export function canonicalizeWorkflowV2(
  workflow: LexFrameWorkflowV2,
): LexFrameWorkflowV2 {
  const input = workflow as LexFrameWorkflowV2 & {
    readonly workflow_inputs?: LexFrameWorkflowV2['inputs'];
    readonly workflow_outputs?: LexFrameWorkflowV2['outputs'];
  };
  const sourceMetadata = (workflow.metadata ??
    {}) as LexFrameWorkflowV2['metadata'] & {
    readonly name?: string;
  };
  const metadata = {
    title:
      sourceMetadata.title ??
      sourceMetadata.name ??
      workflow.id ??
      'Untitled workflow',
    description: sourceMetadata.description ?? null,
    status: sourceMetadata.status ?? 'draft',
    canvas_mode:
      sourceMetadata.canvas_mode ?? workflow.layout?.mode ?? 'guided_vertical',
  };
  const updatedAt =
    workflow.updated_at ?? workflow.created_at ?? '1970-01-01T00:00:00.000Z';
  const workflowInputs =
    input.workflow_inputs && input.workflow_inputs.length > 0
      ? input.workflow_inputs
      : (input.inputs ?? []);
  const workflowOutputs =
    input.workflow_outputs && input.workflow_outputs.length > 0
      ? input.workflow_outputs
      : (input.outputs ?? []);
  const validation =
    workflow.validation_state ?? workflow.validation ?? emptyValidation();
  const canvasLayout =
    workflow.canvas_layout ??
    ({
      layout_version: '1.0',
      mode: workflow.layout?.mode ?? metadata.canvas_mode,
      updated_at: workflow.layout?.updated_at ?? updatedAt,
      nodes: Object.fromEntries(
        (workflow.nodes ?? []).map((node) => [
          node.id,
          node.canvas ?? node.layout,
        ]),
      ),
    } satisfies NonNullable<LexFrameWorkflowV2['canvas_layout']>);
  const runtimeProjection = {
    ...workflow.runtime_projection,
    status: workflow.runtime_projection?.status ?? 'not_compiled',
    can_compile: workflow.runtime_projection?.can_compile ?? false,
    can_run: workflow.runtime_projection?.can_run ?? false,
    activepieces_flow_id:
      workflow.runtime_projection?.activepieces_flow_id ?? null,
    compile_preview_id: workflow.runtime_projection?.compile_preview_id ?? null,
    sync_hash: workflow.runtime_projection?.sync_hash ?? null,
    warnings: workflow.runtime_projection?.warnings ?? [],
  } satisfies LexFrameWorkflowV2['runtime_projection'];

  return {
    ...workflow,
    metadata,
    revision_counter: workflow.revision_counter ?? 0,
    published_version_id: workflow.published_version_id ?? null,
    created_at: workflow.created_at ?? updatedAt,
    updated_at: updatedAt,
    workflow_inputs: workflowInputs,
    workflow_outputs: workflowOutputs,
    inputs: workflowInputs,
    outputs: workflowOutputs,
    nodes: workflow.nodes.map(canonicalizeNode),
    edges: workflow.edges.map(canonicalizeEdge),
    variables: Array.isArray(workflow.variables) ? workflow.variables : [],
    secrets_policy: workflow.secrets_policy ?? defaultSecretsPolicy(),
    data_contracts: workflow.data_contracts ?? {},
    policies: workflow.policies ?? defaultWorkflowPolicy(),
    validation_state: validation,
    validation,
    runtime_projection: runtimeProjection,
    canvas_layout: canvasLayout,
    layout: {
      mode: canvasLayout.mode,
      updated_at:
        canvasLayout.updated_at ?? workflow.layout?.updated_at ?? null,
    },
  };
}

export function canonicalWorkflowHashInput(workflow: LexFrameWorkflowV2) {
  const canonical = canonicalizeWorkflowV2(workflow);
  return {
    schema_version: canonical.schema_version,
    id: canonical.id,
    workspace_id: canonical.workspace_id,
    project_id: canonical.project_id ?? null,
    automation_id: canonical.automation_id,
    draft_version_id: canonical.draft_version_id,
    published_version_id: canonical.published_version_id ?? null,
    revision_counter: canonical.revision_counter ?? 0,
    metadata: canonical.metadata,
    workflow_inputs: canonical.workflow_inputs ?? [],
    workflow_outputs: canonical.workflow_outputs ?? [],
    nodes: canonical.nodes.map((node) => ({
      id: node.id,
      node_type: node.node_type ?? node.type,
      block_code: node.block_code,
      display_name: node.display_name,
      description: node.description ?? null,
      module_ref: node.module_ref ?? null,
      trigger_kind: node.trigger_kind ?? null,
      input_ports: node.input_ports ?? [],
      output_ports: node.output_ports ?? [],
      inputs: node.inputs,
      outputs: node.outputs,
      input_bindings: node.input_bindings ?? [],
      config: node.config,
      policies: node.policies ?? node.policy,
      runtime_mapping: node.runtime_mapping,
      test_state: node.test_state ?? null,
      canvas: node.canvas ?? node.layout,
      lifecycle: node.lifecycle ?? null,
      disabled: node.disabled ?? false,
    })),
    edges: canonical.edges.map((edge) => ({
      id: edge.id,
      edge_type: edge.edge_type ?? toCanonicalEdgeType(edge.type),
      source_node_id: edge.source_node_id,
      source_port_id: edge.source_port_id ?? edge.source_handle,
      target_node_id: edge.target_node_id,
      target_port_id: edge.target_port_id ?? edge.target_handle,
      label: edge.label ?? null,
      condition: edge.condition ?? null,
      invalid_reason: edge.invalid_reason ?? null,
      data_mappings: edge.data_mappings ?? edge.data_mapping ?? [],
      validation_state: edge.validation_state ?? 'valid',
    })),
    variables: canonical.variables,
    secrets_policy: canonical.secrets_policy,
    data_contracts: canonical.data_contracts,
    policies: canonical.policies,
    runtime_projection: canonical.runtime_projection,
    canvas_layout: canonical.canvas_layout,
  };
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function defaultWorkflowPolicy(): WorkflowPolicyBlock {
  return {
    external_delivery_requires_approval: true,
    ai_sensitive_data_policy: 'secure_route_or_block',
    raw_execution_data_policy: 'redact_by_default',
    pinned_data_policy: 'draft_test_only',
    secret_frontend_exposure: 'forbidden',
    custom_expression_policy: 'debug_permission_required',
  };
}

export function defaultSecretsPolicy(): WorkflowSecretsPolicy {
  return {
    frontend_exposure: 'forbidden',
    secret_sources: ['connection_ref_only', 'secret_ref_only'],
  };
}

export function canonicalizeEdge(edge: WorkflowEdge): WorkflowEdge {
  const edgeType = edge.edge_type ?? toCanonicalEdgeType(edge.type);
  const sourcePort = edge.source_port_id ?? edge.source_handle;
  const targetPort = edge.target_port_id ?? edge.target_handle;
  const dataMappings =
    edge.data_mappings ??
    (edge.data_mapping as unknown as WorkflowEdge['data_mappings']) ??
    [];
  return {
    ...edge,
    type: edge.type ?? toLegacyEdgeType(edgeType),
    edge_type: edgeType,
    source_handle: sourcePort,
    source_port_id: sourcePort,
    target_handle: targetPort,
    target_port_id: targetPort,
    data_mapping:
      edge.data_mapping ??
      (dataMappings as unknown as readonly Record<string, unknown>[]),
    data_mappings: dataMappings,
    validation_state: edge.validation_state ?? 'valid',
  };
}

export function toCanonicalEdgeType(
  type: CanvasEdgeType,
): WorkflowCanonicalEdgeType {
  switch (type) {
    case 'control':
      return 'control_flow';
    case 'data':
      return 'data_flow';
    case 'error':
      return 'error_flow';
    case 'approval':
      return 'approval_flow';
    case 'loop':
      return 'loop_flow';
    case 'annotation':
      return 'annotation_link';
    case 'control_flow':
    case 'data_flow':
    case 'error_flow':
    case 'approval_flow':
    case 'loop_flow':
    case 'annotation_link':
      return type;
    default:
      return 'control_flow';
  }
}

export function toLegacyEdgeType(type: CanvasEdgeType): CanvasEdgeType {
  switch (type) {
    case 'control_flow':
      return 'control';
    case 'data_flow':
      return 'data';
    case 'error_flow':
      return 'error';
    case 'approval_flow':
      return 'approval';
    case 'loop_flow':
      return 'loop';
    case 'annotation_link':
      return 'annotation';
    default:
      return type;
  }
}

export function canonicalizeNode(node: WorkflowNode): WorkflowNode {
  const layout = node.canvas ?? node.layout;
  const policy = node.policies ?? node.policy;
  const moduleRef =
    node.module_ref ??
    (node.module_code
      ? {
          module_code: node.module_code,
          module_version: node.module_version ?? null,
          module_schema_hash: node.module_schema_hash ?? null,
          status: node.module_status ?? undefined,
        }
      : null);

  return {
    ...node,
    node_type: node.node_type ?? node.type,
    module_ref: moduleRef,
    module_code: node.module_code ?? moduleRef?.module_code ?? null,
    module_version: node.module_version ?? moduleRef?.module_version ?? null,
    module_schema_hash:
      node.module_schema_hash ?? moduleRef?.module_schema_hash ?? null,
    module_status: node.module_status ?? moduleRef?.status ?? null,
    input_ports: node.input_ports ?? handlesToInputPorts(node.handles),
    output_ports: node.output_ports ?? handlesToOutputPorts(node.handles),
    policy,
    policies: policy,
    layout,
    canvas: layout,
    lifecycle: node.lifecycle ?? {
      status: inferLifecycleStatus(node),
    },
  };
}

function handlesToInputPorts(
  handles: readonly WorkflowHandle[],
): readonly WorkflowInputPort[] {
  return handles
    .filter((handle) => handle.direction === 'input')
    .map((handle) => ({
      id: handle.code,
      label: handle.label,
      port_kind: handleKindToPortKind(handle.kind),
      accepted_edge_types: (handle.edge_types ?? ['control_flow']).map(
        toCanonicalEdgeType,
      ),
      accepted_data_types: handle.data_type ? [handle.data_type] : undefined,
      required: handle.kind === 'control_in',
      max_connections: handle.kind === 'control_in' ? 1 : undefined,
    }));
}

function handlesToOutputPorts(
  handles: readonly WorkflowHandle[],
): readonly WorkflowOutputPort[] {
  return handles
    .filter((handle) => handle.direction === 'output')
    .map((handle) => ({
      id: handle.code,
      label: handle.label,
      port_kind: handleKindToPortKind(handle.kind),
      emitted_edge_types: (handle.edge_types ?? ['control_flow']).map(
        toCanonicalEdgeType,
      ),
      emitted_data_types: handle.data_type ? [handle.data_type] : undefined,
    }));
}

function handleKindToPortKind(kind: WorkflowHandle['kind'] = 'control_out') {
  if (kind.includes('data')) {
    return 'data' as const;
  }
  if (kind.includes('error')) {
    return 'error' as const;
  }
  if (kind.includes('approval')) {
    return 'approval' as const;
  }
  if (kind.includes('loop')) {
    return 'loop' as const;
  }
  return 'control' as const;
}

function inferLifecycleStatus(node: WorkflowNode) {
  if (node.disabled) {
    return 'disabled' as const;
  }
  if ((node.inputs ?? []).some((input) => input.required)) {
    return (node.input_bindings ?? []).length > 0
      ? ('configured' as const)
      : ('needs_input' as const);
  }
  return 'configured' as const;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
}

function emptyValidation(): CanvasValidationSummary {
  return {
    status: 'valid',
    errors_count: 0,
    warnings_count: 0,
    policy_blocks_count: 0,
    issues: [],
    can_save: true,
    can_test: true,
    can_publish: true,
    can_compile: true,
    can_run: true,
    can_sync: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
