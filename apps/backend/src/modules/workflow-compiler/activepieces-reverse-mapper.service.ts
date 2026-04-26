import type {
  CanvasNodeType,
  CompileIssue,
  LexFrameWorkflowV2,
  PermissionCode,
  RuntimeGraph,
  RuntimeGraphNode,
  RuntimeImportability,
  WorkflowDiffItem,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createWorkflowNode } from '../canvas/canvas-model';
import { stableStringify } from '../canvas/canvas-canonical';

export interface ReverseMappingResult {
  readonly workflow: LexFrameWorkflowV2;
  readonly importability: RuntimeImportability;
  readonly issues: readonly CompileIssue[];
  readonly unknownNodes: readonly RuntimeGraphNode[];
  readonly requiresReview: readonly WorkflowDiffItem[];
  readonly policyBlocks: readonly WorkflowDiffItem[];
  readonly mappedRuntimeNodeIds: readonly string[];
  readonly skippedRuntimeNodeIds: readonly string[];
}

interface MappingContext {
  readonly permissions: readonly PermissionCode[];
}

interface KnownPieceMapping {
  readonly nodeType: CanvasNodeType;
  readonly moduleCode: string | null;
  readonly blockCode?: string | null;
  readonly triggerKind?: string | null;
}

const KNOWN_LEXFRAME_PIECES: Record<string, KnownPieceMapping> = {
  '@lexframe/piece-canvas-trigger': {
    nodeType: 'trigger',
    moduleCode: null,
    blockCode: 'manual_start',
    triggerKind: 'manual_start',
  },
  '@lexframe/piece-legal-module': {
    nodeType: 'legalAction',
    moduleCode: 'case_material_analysis',
  },
  '@lexframe/piece-legal-search': {
    nodeType: 'legalAction',
    moduleCode: 'case_law_search',
  },
  '@lexframe/piece-ai-gateway': {
    nodeType: 'aiAction',
    moduleCode: 'ai_gateway',
  },
  '@lexframe/piece-approval': {
    nodeType: 'approval',
    moduleCode: 'approval_gate',
  },
  '@lexframe/piece-delivery': {
    nodeType: 'delivery',
    moduleCode: 'delivery_email',
  },
  '@lexframe/piece-error-policy': {
    nodeType: 'errorHandler',
    moduleCode: 'error_policy',
  },
  '@lexframe/piece-runtime-state': {
    nodeType: 'storage',
    moduleCode: 'runtime_state',
  },
};

@Injectable()
export class ActivepiecesReverseMapperService {
  map(input: {
    readonly workflow: LexFrameWorkflowV2;
    readonly runtimeGraph: RuntimeGraph;
    readonly context: MappingContext;
  }): ReverseMappingResult {
    const permissions = new Set(input.context.permissions);
    const nodesById = new Map(
      input.workflow.nodes.map((node) => [node.id, node]),
    );
    const mappedRuntimeNodeIds: string[] = [];
    const skippedRuntimeNodeIds: string[] = [];
    const unknownNodes: RuntimeGraphNode[] = [];
    const requiresReview: WorkflowDiffItem[] = [];
    const policyBlocks: WorkflowDiffItem[] = [];
    const nextNodes = [...input.workflow.nodes];
    const existingIds = new Set(nextNodes.map((node) => node.id));

    for (const runtimeNode of input.runtimeGraph.nodes) {
      const securityItem = classifyRuntimeSecurity(
        runtimeNode,
        input.runtimeGraph,
      );
      if (securityItem) {
        if (securityItem.severity === 'policy_block') {
          policyBlocks.push(securityItem);
        } else {
          requiresReview.push(securityItem);
        }
      }

      if (runtimeNode.runtimeType === 'NOTE') {
        skippedRuntimeNodeIds.push(runtimeNode.runtimeNodeId);
        continue;
      }

      const sourceNodeId = sourceNodeIdFrom(runtimeNode);
      const knownMapping = knownPieceMapping(runtimeNode);
      const existing =
        (sourceNodeId ? nodesById.get(sourceNodeId) : null) ??
        findNodeByRuntimeMapping(nextNodes, runtimeNode);

      if (runtimeNode.runtimeType === 'CODE') {
        const item = diffItem(runtimeNode, {
          type: 'policy_violation',
          severity: permissions.has('canvas.runtime.import_code_step')
            ? 'requires_review'
            : 'policy_block',
          title: 'Code step in Activepieces',
          message:
            'Runtime contains a code step. It is not imported into a normal LexFrame draft.',
          recommended_action:
            'Replace the code step with a LexFrame module or resolve it through admin review.',
        });
        if (item.severity === 'policy_block') {
          policyBlocks.push(item);
        } else {
          requiresReview.push(item);
        }
        skippedRuntimeNodeIds.push(runtimeNode.runtimeNodeId);
        continue;
      }

      if (!knownMapping && !existing) {
        const item = diffItem(runtimeNode, {
          type: 'unknown_runtime_node_added',
          severity: permissions.has('canvas.runtime.import_unknown_step')
            ? 'requires_review'
            : 'policy_block',
          title: 'Unknown runtime step',
          message: `${runtimeNode.displayName} is not mapped to a LexFrame module.`,
          recommended_action:
            'Register a reverse mapping for this piece before importing.',
        });
        unknownNodes.push(runtimeNode);
        if (item.severity === 'policy_block') {
          policyBlocks.push(item);
        } else {
          requiresReview.push(item);
        }
        skippedRuntimeNodeIds.push(runtimeNode.runtimeNodeId);
        continue;
      }

      if (existing) {
        const index = nextNodes.findIndex((node) => node.id === existing.id);
        nextNodes[index] = updateExistingNode(existing, runtimeNode);
        mappedRuntimeNodeIds.push(runtimeNode.runtimeNodeId);
        continue;
      }

      if (knownMapping) {
        const node = createMappedNode({
          runtimeNode,
          mapping: knownMapping,
          index: nextNodes.length,
          existingIds,
        });
        nextNodes.push(node);
        existingIds.add(node.id);
        mappedRuntimeNodeIds.push(runtimeNode.runtimeNodeId);
      }
    }

    const workflow = withRuntimeImportMetadata(input.workflow, nextNodes);
    const importability = classifyImportability(
      policyBlocks,
      unknownNodes,
      requiresReview,
      mappedRuntimeNodeIds,
    );

    return {
      workflow,
      importability,
      issues: issuesFromBlocks(policyBlocks, unknownNodes),
      unknownNodes,
      requiresReview,
      policyBlocks,
      mappedRuntimeNodeIds,
      skippedRuntimeNodeIds,
    };
  }
}

function updateExistingNode(
  node: WorkflowNode,
  runtimeNode: RuntimeGraphNode,
): WorkflowNode {
  const nextConfig = {
    ...node.config,
    ...pickConfig(runtimeNode.input),
    runtime_piece_version: runtimeNode.pieceVersion ?? null,
  };
  return {
    ...node,
    display_name: runtimeNode.displayName || node.display_name,
    config: nextConfig,
    input_bindings: runtimeInputBindings(runtimeNode, node.id),
    runtime_mapping: {
      ...node.runtime_mapping,
      provider: node.runtime_mapping.provider ?? 'activepieces',
      activepieces_piece:
        runtimeNode.pieceName ??
        node.runtime_mapping.activepieces_piece ??
        null,
      activepieces_action:
        runtimeNode.actionName ??
        runtimeNode.triggerName ??
        node.runtime_mapping.activepieces_action ??
        null,
      warnings: [
        ...(node.runtime_mapping.warnings ?? []),
        ...(runtimeNode.pieceVersion
          ? [`Activepieces piece version: ${runtimeNode.pieceVersion}`]
          : []),
      ],
    },
  };
}

function createMappedNode(input: {
  readonly runtimeNode: RuntimeGraphNode;
  readonly mapping: KnownPieceMapping;
  readonly index: number;
  readonly existingIds: Set<string>;
}): WorkflowNode {
  const moduleCode =
    moduleCodeFromInput(input.runtimeNode) ?? input.mapping.moduleCode;
  const baseId =
    sourceNodeIdFrom(input.runtimeNode) ??
    `${moduleCode ?? input.mapping.blockCode ?? 'runtime'}_${hashShort(
      input.runtimeNode.runtimeNodeId,
    )}`;
  const id = uniqueId(baseId, input.existingIds);
  const node = createWorkflowNode({
    id,
    type: input.mapping.nodeType,
    blockCode: input.mapping.blockCode ?? moduleCode,
    displayName: input.runtimeNode.displayName,
    description: 'Imported from Activepieces runtime.',
    moduleCode,
    triggerKind: input.mapping.triggerKind ?? null,
    x: 96,
    y: 120 + input.index * 140,
  });
  return updateExistingNode(node, input.runtimeNode);
}

function withRuntimeImportMetadata(
  workflow: LexFrameWorkflowV2,
  nodes: readonly WorkflowNode[],
): LexFrameWorkflowV2 {
  const now = new Date().toISOString();
  return {
    ...workflow,
    nodes,
    revision_counter: (workflow.revision_counter ?? 0) + 1,
    metadata: {
      ...workflow.metadata,
      status: 'draft',
    },
    runtime_projection: {
      ...workflow.runtime_projection,
      status: 'sync_required',
    },
    updated_at: now,
  };
}

function sourceNodeIdFrom(runtimeNode: RuntimeGraphNode) {
  const metadata = runtimeNode.metadata ?? {};
  const input = runtimeNode.input;
  const lexframe = isRecord(input.lexframe) ? input.lexframe : {};
  return (
    nullableString(metadata.lexframeSourceNodeId) ??
    nullableString(metadata.source_node_id) ??
    nullableString(lexframe.sourceNodeId) ??
    nullableString(lexframe.source_node_id) ??
    nullableString(lexframe.node_id) ??
    nullableString(input.node_id)
  );
}

function moduleCodeFromInput(runtimeNode: RuntimeGraphNode) {
  const lexframe = isRecord(runtimeNode.input.lexframe)
    ? runtimeNode.input.lexframe
    : {};
  return (
    nullableString(lexframe.module_code) ??
    nullableString(runtimeNode.input.module_code) ??
    nullableString(runtimeNode.input.moduleCode)
  );
}

function knownPieceMapping(runtimeNode: RuntimeGraphNode) {
  const piece = runtimeNode.pieceName?.toLowerCase();
  if (!piece) {
    return null;
  }
  return KNOWN_LEXFRAME_PIECES[piece] ?? null;
}

function findNodeByRuntimeMapping(
  nodes: readonly WorkflowNode[],
  runtimeNode: RuntimeGraphNode,
) {
  return nodes.find((node) => {
    const mapping = node.runtime_mapping;
    return (
      mapping.activepieces_piece === runtimeNode.pieceName &&
      (mapping.activepieces_action === runtimeNode.actionName ||
        mapping.activepieces_action === runtimeNode.triggerName)
    );
  });
}

function classifyRuntimeSecurity(
  runtimeNode: RuntimeGraphNode,
  graph: RuntimeGraph,
): WorkflowDiffItem | null {
  const piece = String(runtimeNode.pieceName ?? '').toLowerCase();
  const action = String(
    runtimeNode.actionName ?? runtimeNode.triggerName ?? '',
  ).toLowerCase();
  const inputText = stableStringify(runtimeNode.input).toLowerCase();

  if (
    (piece.includes('openai') ||
      piece.includes('anthropic') ||
      piece.includes('gemini') ||
      piece.includes('cometapi') ||
      piece.includes('llm')) &&
    !piece.includes('lexframe') &&
    !piece.includes('ai-gateway')
  ) {
    return diffItem(runtimeNode, {
      type: 'policy_violation',
      severity: 'policy_block',
      title: 'Direct AI provider added',
      message:
        'The runtime uses an AI provider directly instead of the LexFrame AI Gateway.',
      recommended_action:
        'Replace the direct provider with the LexFrame AI Gateway piece.',
    });
  }

  if (piece.includes('supabase') && inputText.includes('service_role')) {
    return diffItem(runtimeNode, {
      type: 'policy_violation',
      severity: 'policy_block',
      title: 'Supabase service-role usage',
      message: 'The runtime appears to use a Supabase service-role credential.',
      recommended_action:
        'Move this operation behind a LexFrame backend route with scoped access.',
    });
  }

  if (piece.includes('http') && hasUnknownHttpDomain(runtimeNode.input)) {
    return diffItem(runtimeNode, {
      type: 'external_action_added',
      severity: 'requires_review',
      title: 'Unknown HTTP domain',
      message: 'The runtime calls an HTTP endpoint that is not recognized.',
      recommended_action:
        'Review the endpoint and register an approved integration mapping.',
    });
  }

  if (
    (piece.includes('email') ||
      piece.includes('gmail') ||
      piece.includes('sendgrid') ||
      action.includes('send')) &&
    !graph.nodes.some((node) =>
      String(node.pieceName ?? node.actionName ?? '')
        .toLowerCase()
        .includes('approval'),
    )
  ) {
    return diffItem(runtimeNode, {
      type: 'approval_removed',
      severity: 'policy_block',
      title: 'External delivery without approval',
      message:
        'The runtime can send externally without a LexFrame approval gate.',
      recommended_action:
        'Restore an approval step before importing or syncing.',
    });
  }

  return null;
}

function hasUnknownHttpDomain(input: Record<string, unknown>) {
  const urls = collectStrings(input).filter((value) =>
    /^https?:\/\//i.test(value),
  );
  return urls.some((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return (
        !host.endsWith('lexframe.local') &&
        !host.endsWith('lexframe.ai') &&
        host !== 'localhost' &&
        host !== '127.0.0.1'
      );
    } catch {
      return true;
    }
  });
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function runtimeInputBindings(runtimeNode: RuntimeGraphNode, nodeId: string) {
  const bindings = runtimeNode.input.bindings;
  if (Array.isArray(bindings)) {
    return bindings.filter(
      isRecord,
    ) as unknown as WorkflowNode['input_bindings'];
  }
  const inputBindings = runtimeNode.input.input_bindings;
  if (Array.isArray(inputBindings)) {
    return inputBindings.filter(
      isRecord,
    ) as unknown as WorkflowNode['input_bindings'];
  }
  return Object.entries(runtimeNode.input)
    .filter(([key]) => !key.startsWith('_') && key !== 'lexframe')
    .map(([key, value]) => ({
      target: {
        node_id: nodeId,
        input_key: key,
      },
      source: {
        type: 'manual_value',
        value,
      },
    })) as WorkflowNode['input_bindings'];
}

function pickConfig(input: Record<string, unknown>) {
  const excluded = new Set(['bindings', 'input_bindings', 'lexframe']);
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !excluded.has(key)),
  );
}

function classifyImportability(
  policyBlocks: readonly WorkflowDiffItem[],
  unknownNodes: readonly RuntimeGraphNode[],
  requiresReview: readonly WorkflowDiffItem[],
  mappedRuntimeNodeIds: readonly string[],
): RuntimeImportability {
  if (policyBlocks.length > 0) {
    return 'blocked_by_policy';
  }
  if (unknownNodes.length > 0 && mappedRuntimeNodeIds.length === 0) {
    return 'unmappable';
  }
  if (unknownNodes.length > 0 || requiresReview.length > 0) {
    return 'requires_review';
  }
  return mappedRuntimeNodeIds.length > 0
    ? 'fully_importable'
    : 'importable_with_warnings';
}

function issuesFromBlocks(
  policyBlocks: readonly WorkflowDiffItem[],
  unknownNodes: readonly RuntimeGraphNode[],
): readonly CompileIssue[] {
  return [
    ...policyBlocks.map((item) => ({
      code: `RUNTIME_IMPORT_${item.type.toUpperCase()}`,
      message: item.message,
      severity: 'policy_block' as const,
      node_id: item.node_id ?? null,
      details: {
        runtime_node_id: item.runtime_node_id ?? null,
        title: item.title,
      },
    })),
    ...unknownNodes.map((node) => ({
      code: 'RUNTIME_IMPORT_UNKNOWN_RUNTIME_NODE',
      message: `${node.displayName} is not mapped to a LexFrame module.`,
      severity: 'policy_block' as const,
      node_id: null,
      details: {
        runtime_node_id: node.runtimeNodeId,
        piece_name: node.pieceName ?? null,
      },
    })),
  ];
}

function diffItem(
  runtimeNode: RuntimeGraphNode,
  input: Omit<WorkflowDiffItem, 'id' | 'runtime_node_id'>,
): WorkflowDiffItem {
  return {
    id: `runtime_diff_${hashShort([runtimeNode.runtimeNodeId, input.type, input.title])}`,
    runtime_node_id: runtimeNode.runtimeNodeId,
    ...input,
    technical_details: {
      piece_name: runtimeNode.pieceName ?? null,
      action_name: runtimeNode.actionName ?? runtimeNode.triggerName ?? null,
      piece_version: runtimeNode.pieceVersion ?? null,
    },
  };
}

function uniqueId(base: string, existingIds: Set<string>) {
  const id = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  if (!existingIds.has(id)) {
    return id;
  }
  let suffix = 2;
  while (existingIds.has(`${id}_${suffix}`)) {
    suffix += 1;
  }
  return `${id}_${suffix}`;
}

function hashShort(value: unknown) {
  return createHash('sha256')
    .update(stableStringify(value))
    .digest('hex')
    .slice(0, 10);
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
