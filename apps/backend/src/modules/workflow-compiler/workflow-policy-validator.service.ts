import type {
  CompileIssue,
  CompileWarning,
  LexFrameWorkflowV2,
  RuntimeConnectionRequirement,
  RuntimePieceVersionRequirement,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface PieceRegistryRow {
  readonly piece_name: string;
  readonly piece_version: string;
  readonly status: RuntimePieceVersionRequirement['status'];
}

interface ValidateInput {
  readonly workflow: LexFrameWorkflowV2;
  readonly topologicalOrder: readonly string[];
  readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
  readonly requiredConnections: readonly RuntimeConnectionRequirement[];
}

@Injectable()
export class WorkflowPolicyValidator {
  constructor(private readonly databaseService: DatabaseService) {}

  async validate(input: ValidateInput): Promise<{
    readonly issues: readonly CompileIssue[];
    readonly warnings: readonly CompileWarning[];
    readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
  }> {
    const issues: CompileIssue[] = [
      ...this.validateNodePolicies(input.workflow),
      ...this.validateBindings(input.workflow, input.topologicalOrder),
      ...this.validateConnections(input.requiredConnections),
    ];
    const warnings: CompileWarning[] = [];
    const requiredPieces = await this.applyPieceRegistryStatus(
      input.requiredPieces,
    );

    for (const piece of requiredPieces) {
      if (isWildcardVersion(piece.piece_version)) {
        issues.push({
          code: 'WF_COMPILER_WILDCARD_PIECE_VERSION',
          message: `${piece.piece_name} must use an exact Activepieces piece version.`,
          severity: 'policy_block',
          details: {
            piece_name: piece.piece_name,
            piece_version: piece.piece_version,
          },
        });
      }
      if (piece.status === 'blocked') {
        issues.push({
          code: 'WF_COMPILER_FORBIDDEN_PIECE',
          message: `${piece.piece_name}@${piece.piece_version} is blocked by runtime policy.`,
          severity: 'policy_block',
          details: { piece_name: piece.piece_name },
        });
      }
      if (piece.status === 'deprecated') {
        issues.push({
          code: 'WF_COMPILER_DEPRECATED_PIECE',
          message: `${piece.piece_name}@${piece.piece_version} is deprecated and cannot be synced.`,
          severity: 'policy_block',
          details: { piece_name: piece.piece_name },
        });
      }
      if (piece.status === 'missing') {
        issues.push({
          code: 'WF_COMPILER_MISSING_PIECE',
          message: `${piece.piece_name}@${piece.piece_version} is missing from the Activepieces piece registry.`,
          severity: 'policy_block',
          details: { piece_name: piece.piece_name },
        });
      }
    }

    return { issues, warnings, requiredPieces };
  }

  private validateNodePolicies(
    workflow: LexFrameWorkflowV2,
  ): readonly CompileIssue[] {
    const issues: CompileIssue[] = [];
    for (const node of workflow.nodes) {
      if (node.disabled || node.type === 'note' || node.type === 'group') {
        continue;
      }

      if (node.runtime_mapping.can_compile === false) {
        issues.push({
          code: 'WF_COMPILER_UNSUPPORTED_NODE',
          message: `${node.display_name} is marked as not compilable.`,
          severity: 'error',
          node_id: node.id,
        });
      }

      if (usesDirectAiProvider(node)) {
        issues.push({
          code: 'WF_COMPILER_DIRECT_AI_PROVIDER_FORBIDDEN',
          message:
            'AI nodes must compile through the LexFrame AI Gateway piece.',
          severity: 'policy_block',
          node_id: node.id,
        });
      }

      if (
        (node.type === 'delivery' || node.policy.external_action === true) &&
        !hasApprovalBefore(workflow, node.id)
      ) {
        issues.push({
          code: 'WF_COMPILER_EXTERNAL_DELIVERY_REQUIRES_APPROVAL',
          message: 'External delivery must be preceded by an approval node.',
          severity: 'policy_block',
          node_id: node.id,
        });
      }

      if (
        containsRawDocumentText(node.config) ||
        containsRawDocumentText(node.input_bindings ?? [])
      ) {
        issues.push({
          code: 'WF_COMPILER_RAW_DOCUMENT_TEXT_FORBIDDEN',
          message:
            'Document data must be passed as document refs, scoped token refs and classification metadata.',
          severity: 'policy_block',
          node_id: node.id,
        });
      }

      if (containsCrossWorkspaceRef(node.config, workflow.workspace_id)) {
        issues.push({
          code: 'WF_COMPILER_CROSS_WORKSPACE_DOCUMENT_REF',
          message:
            'Runtime compile cannot use document refs from another workspace.',
          severity: 'policy_block',
          node_id: node.id,
        });
      }
    }

    return issues;
  }

  private validateBindings(
    workflow: LexFrameWorkflowV2,
    topologicalOrder: readonly string[],
  ): readonly CompileIssue[] {
    const issues: CompileIssue[] = [];
    const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const orderIndex = new Map(
      topologicalOrder.map((nodeId, index) => [nodeId, index]),
    );

    for (const node of workflow.nodes) {
      for (const binding of node.input_bindings ?? []) {
        const targetInputKey =
          binding.target?.input_key ?? binding.targetInputKey ?? null;
        const targetNodeId =
          binding.target?.node_id ?? binding.targetNodeId ?? node.id;
        const targetNode = nodesById.get(targetNodeId) ?? node;
        if (
          targetInputKey &&
          targetNode.inputs.length > 0 &&
          !targetNode.inputs.some((input) => input.key === targetInputKey)
        ) {
          issues.push({
            code: 'WF_COMPILER_BINDING_TARGET_INPUT_MISSING',
            message: `Binding target input ${targetInputKey} does not exist.`,
            severity: 'error',
            node_id: targetNode.id,
          });
        }

        const source = binding.source;
        if (source.type !== 'step_output') {
          continue;
        }

        const sourceNodeId = source.node_id ?? source.sourceNodeId;
        const sourceOutputKey = source.output_key ?? source.outputKey;
        const sourceNode = sourceNodeId ? nodesById.get(sourceNodeId) : null;
        if (!sourceNode || !sourceOutputKey) {
          issues.push({
            code: 'WF_COMPILER_BINDING_SOURCE_MISSING',
            message:
              'Step-output binding references a missing source node or output.',
            severity: 'error',
            node_id: targetNode.id,
          });
          continue;
        }

        const sourceOutput = sourceNode.outputs.find(
          (output) => output.key === sourceOutputKey,
        );
        if (!sourceOutput) {
          issues.push({
            code: 'WF_COMPILER_BINDING_SOURCE_OUTPUT_MISSING',
            message: `Source output ${sourceOutputKey} does not exist.`,
            severity: 'error',
            node_id: targetNode.id,
          });
        }

        const sourceIndex = orderIndex.get(sourceNode.id);
        const targetIndex = orderIndex.get(targetNode.id);
        if (
          sourceIndex !== undefined &&
          targetIndex !== undefined &&
          sourceIndex >= targetIndex
        ) {
          issues.push({
            code: 'WF_COMPILER_BINDING_SOURCE_NOT_AVAILABLE',
            message:
              'Binding source must be topologically available before the target step runs.',
            severity: 'error',
            node_id: targetNode.id,
            details: {
              source_node_id: sourceNode.id,
              target_node_id: targetNode.id,
            },
          });
        }
      }
    }

    return issues;
  }

  private validateConnections(
    requirements: readonly RuntimeConnectionRequirement[],
  ): readonly CompileIssue[] {
    return requirements
      .filter(
        (requirement) =>
          requirement.required && requirement.status !== 'available',
      )
      .map((requirement) => ({
        code: 'WF_COMPILER_REQUIRED_CONNECTION_MISSING',
        message: `Required ${requirement.connection_type} connection is not available.`,
        severity: 'policy_block' as const,
        node_id: requirement.source_node_id,
        details: {
          requirement_id: requirement.requirement_id,
          status: requirement.status,
        },
      }));
  }

  private async applyPieceRegistryStatus(
    pieces: readonly RuntimePieceVersionRequirement[],
  ): Promise<readonly RuntimePieceVersionRequirement[]> {
    if (pieces.length === 0) {
      return [];
    }

    const rows = await this.lookupPieceRegistry(pieces);
    const byKey = new Map(
      rows.map((row) => [`${row.piece_name}@${row.piece_version}`, row]),
    );

    return pieces.map((piece) => {
      const row = byKey.get(`${piece.piece_name}@${piece.piece_version}`);
      const fallbackStatus = isBuiltInCompilerPiece(piece.piece_name)
        ? 'available'
        : 'missing';
      return {
        ...piece,
        status: row?.status ?? fallbackStatus,
      };
    });
  }

  private async lookupPieceRegistry(
    pieces: readonly RuntimePieceVersionRequirement[],
  ): Promise<readonly PieceRegistryRow[]> {
    try {
      const result = await this.databaseService.query<PieceRegistryRow>(
        `
          select piece_name, piece_version, status
          from app.activepieces_piece_registry
          where (piece_name, piece_version) in (
            select *
            from unnest($1::text[], $2::text[])
          )
        `,
        [
          pieces.map((piece) => piece.piece_name),
          pieces.map((piece) => piece.piece_version),
        ],
      );
      return result.rows;
    } catch {
      return [];
    }
  }
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, nodeId: string) {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const reverseEdges = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const type = edge.edge_type ?? edge.type;
    if (
      type !== 'control' &&
      type !== 'control_flow' &&
      type !== 'approval' &&
      type !== 'approval_flow'
    ) {
      continue;
    }
    reverseEdges.set(edge.target_node_id, [
      ...(reverseEdges.get(edge.target_node_id) ?? []),
      edge.source_node_id,
    ]);
  }

  const visited = new Set<string>();
  const queue = [...(reverseEdges.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const node = nodesById.get(current);
    if (node?.type === 'approval') {
      return true;
    }
    queue.push(...(reverseEdges.get(current) ?? []));
  }
  return false;
}

function usesDirectAiProvider(node: WorkflowNode) {
  const pieceName = node.runtime_mapping.activepieces_piece ?? '';
  const provider = node.runtime_mapping.provider ?? null;
  const lowerPiece = pieceName.toLowerCase();
  const aiPiece =
    lowerPiece.includes('openai') ||
    lowerPiece.includes('anthropic') ||
    lowerPiece.includes('gemini') ||
    lowerPiece.includes('cometapi') ||
    lowerPiece.includes('llm');
  return (
    (node.type === 'aiAction' ||
      node.policy.ai_action === true ||
      provider === 'ai_gateway') &&
    aiPiece &&
    !lowerPiece.includes('lexframe') &&
    !lowerPiece.includes('ai-gateway')
  );
}

function containsRawDocumentText(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsRawDocumentText);
  }
  if (!isRecord(value)) {
    return false;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      normalized === 'document_text' ||
      normalized === 'documenttext' ||
      normalized === 'full_document_text' ||
      normalized === 'raw_document_text' ||
      normalized === 'body_text'
    ) {
      return true;
    }
    if (containsRawDocumentText(child)) {
      return true;
    }
  }
  return false;
}

function containsCrossWorkspaceRef(
  value: unknown,
  workspaceId: string,
): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => containsCrossWorkspaceRef(child, workspaceId));
  }
  if (!isRecord(value)) {
    return false;
  }
  const type = value.type;
  const refWorkspaceId = value.workspace_id ?? value.workspaceId;
  if (
    (type === 'document' || value.document_id || value.documentId) &&
    typeof refWorkspaceId === 'string' &&
    refWorkspaceId !== workspaceId
  ) {
    return true;
  }
  return Object.values(value).some((child) =>
    containsCrossWorkspaceRef(child, workspaceId),
  );
}

function isWildcardVersion(version: string) {
  return (
    version === '*' ||
    version === 'latest' ||
    version.startsWith('^') ||
    version.startsWith('~') ||
    version.startsWith('>') ||
    version.includes('x')
  );
}

function isBuiltInCompilerPiece(pieceName: string) {
  return (
    pieceName.startsWith('@lexframe/') ||
    pieceName === '@activepieces/piece-flow-control'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
