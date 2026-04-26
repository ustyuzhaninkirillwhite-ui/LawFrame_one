import type {
  LexFrameWorkflowV2,
  RequiredConnection,
  RequiredPiece,
  RuntimePolicyWarning,
  RuntimeProjectionOutput,
  UnsupportedNode,
  WorkflowNode,
} from '@lexframe/contracts';
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  canonicalWorkflowHashInput,
  canonicalizeWorkflowV2,
  stableStringify,
} from './canvas-canonical';

@Injectable()
export class CanvasRuntimeProjectionService {
  preview(workflow: LexFrameWorkflowV2): RuntimeProjectionOutput {
    const canonical = canonicalizeWorkflowV2(workflow);
    const requiredPieces = collectRequiredPieces(canonical.nodes);
    const requiredConnections = collectRequiredConnections(canonical.nodes);
    const unsupportedNodes = collectUnsupportedNodes(canonical.nodes);
    const policyWarnings = collectPolicyWarnings(canonical);
    const activepiecesFlow = buildActivepiecesPreviewFlow(canonical);
    const projectionHash = createHash('sha256')
      .update(
        stableStringify({
          workflow: canonicalWorkflowHashInput(canonical),
          required_pieces: requiredPieces,
          required_connections: requiredConnections,
          unsupported_nodes: unsupportedNodes,
          policy_warnings: policyWarnings,
          activepieces_flow: activepiecesFlow,
        }),
      )
      .digest('hex');

    return {
      provider: 'activepieces',
      activepieces_flow: activepiecesFlow,
      required_pieces: requiredPieces,
      required_connections: requiredConnections,
      unsupported_nodes: unsupportedNodes,
      policy_warnings: policyWarnings,
      projection_hash: projectionHash,
      can_compile:
        canonical.validation_state?.can_compile === true &&
        unsupportedNodes.length === 0,
    };
  }
}

function collectRequiredPieces(
  nodes: readonly WorkflowNode[],
): readonly RequiredPiece[] {
  const byPackage = new Map<string, Set<string>>();
  for (const node of nodes) {
    const packageName = node.runtime_mapping.activepieces_piece;
    if (!packageName) {
      continue;
    }
    if (!byPackage.has(packageName)) {
      byPackage.set(packageName, new Set());
    }
    byPackage.get(packageName)!.add(node.id);
  }

  return [...byPackage.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([package_name, nodeIds]) => ({
      package_name,
      version: null,
      node_ids: [...nodeIds].sort(),
    }));
}

function collectRequiredConnections(
  nodes: readonly WorkflowNode[],
): readonly RequiredConnection[] {
  const byConnection = new Map<string, Set<string>>();
  for (const node of nodes) {
    for (const binding of node.input_bindings ?? []) {
      const connectionId =
        binding.source.type === 'connection'
          ? binding.source.connection_id
          : null;
      if (!connectionId) {
        continue;
      }
      if (!byConnection.has(connectionId)) {
        byConnection.set(connectionId, new Set());
      }
      byConnection.get(connectionId)!.add(node.id);
    }
  }

  return [...byConnection.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([connection_id, nodeIds]) => ({
      connection_id,
      node_ids: [...nodeIds].sort(),
    }));
}

function collectUnsupportedNodes(
  nodes: readonly WorkflowNode[],
): readonly UnsupportedNode[] {
  return nodes
    .filter((node) => node.type !== 'note' && node.type !== 'group')
    .flatMap((node) => {
      if (node.runtime_mapping.can_compile === false) {
        return [
          {
            node_id: node.id,
            reason: 'Node runtime mapping is marked as non-compilable.',
          },
        ];
      }
      if (
        node.runtime_mapping.provider === undefined &&
        !['trigger', 'end'].includes(node.type)
      ) {
        return [
          {
            node_id: node.id,
            reason: 'Node has no runtime provider mapping.',
          },
        ];
      }
      return [];
    });
}

function collectPolicyWarnings(
  workflow: LexFrameWorkflowV2,
): readonly RuntimePolicyWarning[] {
  return (workflow.validation_state?.issues ?? workflow.validation.issues)
    .filter(
      (issue) =>
        issue.severity === 'policy_block' ||
        issue.scope === 'runtime' ||
        issue.severity === 'warning',
    )
    .map((issue) => ({
      code: issue.code,
      message: issue.message,
      node_id: issue.affected_node_id ?? null,
    }));
}

function buildActivepiecesPreviewFlow(workflow: LexFrameWorkflowV2) {
  const executableNodes = workflow.nodes.filter(
    (node) => node.type !== 'note' && node.type !== 'group',
  );
  const trigger =
    executableNodes.find((node) => node.type === 'trigger') ??
    executableNodes[0] ??
    null;

  return {
    schemaVersion: '20',
    displayName: workflow.metadata.title,
    trigger: trigger ? nodeToRuntimeStep(trigger) : null,
    steps: executableNodes
      .filter((node) => node.id !== trigger?.id)
      .map(nodeToRuntimeStep),
    connections: collectRequiredConnections(workflow.nodes),
    canvas: {
      workflow_id: workflow.id,
      draft_version_id: workflow.draft_version_id,
      revision_counter: workflow.revision_counter ?? 0,
    },
  };
}

function nodeToRuntimeStep(node: WorkflowNode) {
  return {
    id: node.id,
    type: node.type,
    displayName: node.display_name,
    moduleCode: node.module_code ?? node.block_code,
    provider: node.runtime_mapping.provider ?? 'none',
    pieceName: node.runtime_mapping.activepieces_piece ?? null,
    actionName: node.runtime_mapping.activepieces_action ?? null,
    internalRoute: node.runtime_mapping.internal_route ?? null,
    inputBindings: (node.input_bindings ?? []).map((binding) => ({
      id: binding.id ?? null,
      target: binding.target,
      source: redactRuntimeSource(binding.source),
      transform: binding.transform ?? null,
      fallback: binding.fallback ?? null,
    })),
    outputKeys: node.outputs.map((output) => output.key),
  };
}

function redactRuntimeSource(source: unknown): unknown {
  if (!isRecord(source)) {
    return source;
  }
  if (source.type === 'secret_ref') {
    return { type: 'secret_ref', secret_ref: '[redacted]' };
  }
  if (source.type === 'connection') {
    return { ...source, provider_key: undefined, value: undefined };
  }
  if (source.type === 'literal') {
    return { type: 'literal', data_type: source.data_type ?? null };
  }
  return Object.fromEntries(
    Object.entries(source)
      .filter(
        ([key]) =>
          ![
            'value',
            'raw_payload',
            'rawPayload',
            'document_text',
            'documentText',
            'signed_url',
            'signedUrl',
            'provider_key',
            'providerKey',
          ].includes(key),
      )
      .map(([key, value]) => [key, redactRuntimeSource(value)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
