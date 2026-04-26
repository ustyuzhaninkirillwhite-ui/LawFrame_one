import type { LexFrameWorkflowV2, WorkflowNode } from '@lexframe/contracts';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  canonicalizeWorkflowV2,
  stableStringify,
} from '../canvas/canvas-canonical';

@Injectable()
export class WorkflowNormalizerService {
  normalize(workflow: LexFrameWorkflowV2): LexFrameWorkflowV2 {
    const canonical = canonicalizeWorkflowV2(workflow);
    return {
      ...canonical,
      nodes: [...canonical.nodes].sort(compareNodes),
      edges: [...canonical.edges].sort((left, right) =>
        stableStringify(edgeHashInput(left)).localeCompare(
          stableStringify(edgeHashInput(right)),
        ),
      ),
      variables: [...canonical.variables].sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
      inputs: [...canonical.inputs].sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
      workflow_inputs: [...(canonical.workflow_inputs ?? [])].sort(
        (left, right) => left.key.localeCompare(right.key),
      ),
      outputs: [...canonical.outputs].sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
      workflow_outputs: [...(canonical.workflow_outputs ?? [])].sort(
        (left, right) => left.key.localeCompare(right.key),
      ),
    };
  }

  computeSourceWorkflowHash(workflow: LexFrameWorkflowV2): string {
    const normalized = this.normalize(workflow);
    return hashJson({
      schema_version: normalized.schema_version,
      id: normalized.id,
      workspace_id: normalized.workspace_id,
      project_id: normalized.project_id ?? null,
      automation_id: normalized.automation_id,
      draft_version_id: normalized.draft_version_id,
      published_version_id: normalized.published_version_id ?? null,
      metadata: {
        title: normalized.metadata.title,
        description: normalized.metadata.description ?? null,
        canvas_mode: normalized.metadata.canvas_mode,
        status: normalized.metadata.status,
      },
      workflow_inputs: normalized.inputs,
      workflow_outputs: normalized.outputs,
      nodes: normalized.nodes.map(nodeHashInput),
      edges: normalized.edges.map(edgeHashInput),
      variables: normalized.variables,
      secrets_policy: normalized.secrets_policy ?? null,
      data_contracts: normalized.data_contracts ?? {},
      policies: normalized.policies ?? null,
    });
  }

  computeNodeHash(node: WorkflowNode): string {
    return hashJson(nodeHashInput(node));
  }

  stableStepSuffix(value: unknown): string {
    return hashJson(value).slice(0, 8);
  }
}

function compareNodes(left: WorkflowNode, right: WorkflowNode) {
  const priority = (node: WorkflowNode) => {
    if (node.type === 'trigger') {
      return 0;
    }
    if (node.type === 'end') {
      return 2;
    }
    return 1;
  };
  return (
    priority(left) - priority(right) ||
    (left.module_code ?? left.block_code ?? '').localeCompare(
      right.module_code ?? right.block_code ?? '',
    ) ||
    left.id.localeCompare(right.id)
  );
}

function nodeHashInput(node: WorkflowNode) {
  return {
    id: node.id,
    type: node.type,
    node_type: node.node_type ?? node.type,
    block_code: node.block_code,
    module_code: node.module_code ?? null,
    module_version: node.module_version ?? null,
    module_schema_hash: node.module_schema_hash ?? null,
    trigger_kind: node.trigger_kind ?? null,
    config: node.config,
    inputs: node.inputs,
    outputs: node.outputs,
    input_bindings: node.input_bindings ?? [],
    policies: node.policies ?? node.policy,
    runtime_mapping: node.runtime_mapping,
    lifecycle: node.lifecycle ?? null,
    disabled: node.disabled ?? false,
  };
}

function edgeHashInput(edge: LexFrameWorkflowV2['edges'][number]) {
  return {
    id: edge.id,
    type: edge.edge_type ?? edge.type,
    source_node_id: edge.source_node_id,
    source_port_id: edge.source_port_id ?? edge.source_handle ?? null,
    target_node_id: edge.target_node_id,
    target_port_id: edge.target_port_id ?? edge.target_handle ?? null,
    condition: edge.condition ?? null,
    data_mappings: edge.data_mappings ?? edge.data_mapping ?? [],
    validation_state: edge.validation_state ?? 'valid',
  };
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
