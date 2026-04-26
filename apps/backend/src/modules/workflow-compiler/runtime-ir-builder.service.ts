import type {
  CompilerMode,
  LexFrameWorkflowV2,
  RuntimeConnectionRequirement,
  RuntimeErrorPolicy,
  RuntimeIR,
  RuntimeIRStep,
  RuntimeInputBinding,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { defaultWorkflowPolicy } from '../canvas/canvas-canonical';
import { WorkflowNormalizerService } from './workflow-normalizer.service';
import {
  TARGET_RUNTIME,
  WORKFLOW_COMPILER_VERSION,
} from './workflow-compiler.types';

interface BuildInput {
  readonly workflow: LexFrameWorkflowV2;
  readonly sourceHash: string;
  readonly mode: CompilerMode;
  readonly generatedAt: string;
  readonly topologicalOrder: readonly string[];
  readonly connectionRequirements: readonly RuntimeConnectionRequirement[];
}

@Injectable()
export class RuntimeIRBuilder {
  constructor(private readonly normalizer: WorkflowNormalizerService) {}

  build(input: BuildInput): RuntimeIR {
    const nodesById = new Map(
      input.workflow.nodes.map((node) => [node.id, node]),
    );
    const orderedNodes = input.topologicalOrder
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is WorkflowNode => Boolean(node))
      .filter(
        (node) =>
          !node.disabled && node.type !== 'note' && node.type !== 'group',
      );
    const generatedSteps = orderedNodes.flatMap((node, index) =>
      this.expandNode(node, index),
    );
    const trigger =
      generatedSteps.find((step) => step.runtime_kind === 'piece_trigger') ??
      generatedSteps.find((step) => step.source_node_type === 'trigger') ??
      null;
    const steps = generatedSteps.filter(
      (step) => step.ir_step_id !== trigger?.ir_step_id,
    );

    return {
      ir_version: '1.0',
      source_workflow_version_id: input.workflow.draft_version_id,
      source_hash: input.sourceHash,
      runtime: TARGET_RUNTIME,
      trigger,
      steps,
      branches: this.buildBranches(input.workflow),
      edges: input.workflow.edges.map((edge) => ({
        id: edge.id,
        type: edge.edge_type ?? edge.type,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        condition: edge.condition ?? null,
      })),
      variables: input.workflow.variables,
      connection_requirements: input.connectionRequirements,
      policies: input.workflow.policies ?? defaultWorkflowPolicy(),
      metadata: {
        workspace_id: input.workflow.workspace_id,
        automation_id: input.workflow.automation_id,
        compile_mode: input.mode,
        generated_at: input.generatedAt,
        compiler_version: WORKFLOW_COMPILER_VERSION,
      },
    };
  }

  private expandNode(
    node: WorkflowNode,
    index: number,
  ): readonly RuntimeIRStep[] {
    switch (node.type) {
      case 'trigger':
        return [
          this.baseStep(node, index, 'trigger', 'piece_trigger', 'start', {
            piece: {
              name:
                node.runtime_mapping.activepieces_piece ??
                '@lexframe/piece-canvas-trigger',
              version: exactVersion(node),
              trigger_name:
                node.runtime_mapping.activepieces_action ??
                node.trigger_kind ??
                'manual_start',
              action_name: null,
            },
          }),
        ];
      case 'approval':
        return [
          this.baseStep(
            node,
            index,
            'approval',
            'piece_action',
            'create_task',
            {
              piece: lexframePiece(
                '@lexframe/piece-approval',
                'create_approval_task',
              ),
            },
          ),
          this.baseStep(node, index, 'approval', 'waitpoint', 'wait_decision', {
            piece: lexframePiece(
              '@activepieces/piece-flow-control',
              'wait_for_approval',
            ),
          }),
          this.baseStep(
            node,
            index,
            'approval',
            'piece_action',
            'read_decision',
            {
              piece: lexframePiece(
                '@lexframe/piece-approval',
                'read_approval_decision',
              ),
            },
          ),
        ];
      case 'delivery':
        return [
          this.baseStep(node, index, 'delivery', 'piece_action', 'preview', {
            piece: lexframePiece(
              '@lexframe/piece-delivery',
              'preview_delivery',
            ),
          }),
          this.baseStep(
            node,
            index,
            'delivery',
            'piece_action',
            'approval_task',
            {
              piece: lexframePiece(
                '@lexframe/piece-approval',
                'create_approval_task',
              ),
            },
          ),
          this.baseStep(node, index, 'delivery', 'waitpoint', 'wait_decision', {
            piece: lexframePiece(
              '@activepieces/piece-flow-control',
              'wait_for_approval',
            ),
          }),
          this.baseStep(
            node,
            index,
            'delivery',
            'piece_action',
            'read_decision',
            {
              piece: lexframePiece(
                '@lexframe/piece-approval',
                'read_approval_decision',
              ),
            },
          ),
          this.baseStep(node, index, 'delivery', 'piece_action', 'send', {
            piece: lexframePiece('@lexframe/piece-delivery', 'send_delivery'),
          }),
          this.baseStep(node, index, 'delivery', 'piece_action', 'audit', {
            piece: lexframePiece(
              '@lexframe/piece-delivery',
              'record_delivery_audit',
            ),
          }),
        ];
      case 'aiAction':
        return [
          this.baseStep(
            node,
            index,
            'ai_action',
            'piece_action',
            'ai_gateway',
            {
              piece: lexframePiece(
                '@lexframe/piece-ai-gateway',
                'run_ai_gateway',
              ),
            },
          ),
        ];
      case 'condition':
        return [
          this.baseStep(node, index, 'condition', 'router', 'route', {
            piece: lexframePiece(
              '@activepieces/piece-flow-control',
              'evaluate_condition',
            ),
          }),
        ];
      case 'loop':
        return [
          this.baseStep(node, index, 'loop', 'loop', 'loop', {
            piece: lexframePiece(
              '@activepieces/piece-flow-control',
              'loop_on_items',
            ),
          }),
        ];
      case 'errorHandler':
        return [
          this.baseStep(
            node,
            index,
            'error_handler',
            'piece_action',
            'handle_error',
            {
              piece: lexframePiece(
                '@lexframe/piece-error-policy',
                'report_failure',
              ),
            },
          ),
        ];
      case 'end':
        return [
          this.baseStep(node, index, 'end', 'internal_callback', 'complete', {
            piece: lexframePiece(
              '@lexframe/piece-runtime-state',
              'complete_run',
            ),
          }),
        ];
      default:
        return [
          this.baseStep(
            node,
            index,
            sourceNodeType(node),
            'piece_action',
            'execute',
            {
              piece: resolveNodePiece(node),
            },
          ),
        ];
    }
  }

  private baseStep(
    node: WorkflowNode,
    index: number,
    sourceNodeType: RuntimeIRStep['source_node_type'],
    runtimeKind: RuntimeIRStep['runtime_kind'],
    phase: string,
    options: {
      readonly piece: NonNullable<RuntimeIRStep['piece']>;
    },
  ): RuntimeIRStep {
    const irStepId = this.stepId(node, index, phase);
    return {
      ir_step_id: irStepId,
      source_node_id: node.id,
      source_node_type: sourceNodeType,
      display_name:
        phase === 'execute' || phase === 'start'
          ? node.display_name
          : `${node.display_name}: ${phase.replace(/_/g, ' ')}`,
      runtime_kind: runtimeKind,
      piece: options.piece,
      props: {
        ...redactUnsafeRuntimeProps(node.config),
        lexframe: {
          node_id: node.id,
          module_code: node.module_code ?? node.block_code,
          module_version:
            node.module_version ?? node.module_ref?.module_version ?? null,
          phase,
        },
        bindings: this.compileBindings(node),
      },
      input_bindings: this.compileBindings(node),
      output_contract: {
        fields: node.outputs,
      },
      policy: {
        data_classification:
          node.policy.data_classification ?? 'workspace_internal',
        external_action:
          node.policy.external_action ?? node.type === 'delivery',
        requires_approval:
          node.policy.approval_required ??
          (node.type === 'approval' || node.type === 'delivery'),
        allow_in_dry_run:
          node.policy.can_run_in_dry_run ?? node.type !== 'delivery',
        redaction_required:
          node.policy.ai_policy?.require_redaction === true ||
          node.policy.data_classification === 'legal_secret',
      },
      error_policy: resolveErrorPolicy(node),
    };
  }

  private stepId(node: WorkflowNode, index: number, phase: string) {
    const prefix = sanitizeStepName(
      node.module_code ?? node.block_code ?? node.type,
    );
    const suffix = this.normalizer.stableStepSuffix({
      node_id: node.id,
      phase,
      index,
    });
    return `lf_${String(index).padStart(3, '0')}_${prefix}_${phase}_${suffix}`;
  }

  private compileBindings(node: WorkflowNode): readonly RuntimeInputBinding[] {
    return (node.input_bindings ?? []).map((binding, index) => {
      const prop =
        binding.target?.input_key ?? binding.targetInputKey ?? `input_${index}`;
      const source = redactRuntimeSource(binding.source);
      return {
        prop,
        source,
        expression: expressionFromSource(binding.source),
        policy: {
          reference_only:
            binding.source.type === 'document' ||
            binding.source.type === 'connection' ||
            binding.source.type === 'secret_ref',
          redaction_required:
            binding.source.type === 'secret_ref' ||
            binding.source.type === 'document',
        },
      };
    });
  }

  private buildBranches(workflow: LexFrameWorkflowV2): readonly unknown[] {
    return workflow.edges
      .filter((edge) => Boolean(edge.condition))
      .map((edge) => ({
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        condition: edge.condition,
      }));
  }
}

function resolveNodePiece(
  node: WorkflowNode,
): NonNullable<RuntimeIRStep['piece']> {
  const pieceName =
    node.runtime_mapping.activepieces_piece &&
    !isDirectAiPiece(node.runtime_mapping.activepieces_piece)
      ? node.runtime_mapping.activepieces_piece
      : '@lexframe/piece-legal-module';
  return {
    name: pieceName,
    version: exactVersion(node),
    action_name:
      node.runtime_mapping.activepieces_action ??
      actionNameFromModule(node.module_code ?? node.block_code),
    trigger_name: null,
  };
}

function lexframePiece(
  name: string,
  actionName: string,
): NonNullable<RuntimeIRStep['piece']> {
  return {
    name,
    version: '0.1.0',
    action_name: actionName,
    trigger_name: null,
  };
}

function exactVersion(node: WorkflowNode) {
  const configured = readString(node.config.activepieces_piece_version);
  if (configured) {
    return configured;
  }
  const moduleVersion = node.module_version ?? node.module_ref?.module_version;
  if (moduleVersion && /^\d+\.\d+\.\d+/.test(moduleVersion)) {
    return moduleVersion;
  }
  return '0.1.0';
}

function actionNameFromModule(moduleCode: string) {
  const normalized = moduleCode.split('.').filter(Boolean).join('_');
  return normalized.length > 0 ? normalized : 'execute';
}

function sourceNodeType(node: WorkflowNode): RuntimeIRStep['source_node_type'] {
  switch (node.type) {
    case 'legalAction':
      return 'legal_action';
    case 'aiAction':
      return 'ai_action';
    case 'approval':
    case 'delivery':
    case 'condition':
    case 'loop':
    case 'merge':
    case 'wait':
    case 'trigger':
    case 'end':
      return node.type;
    case 'errorHandler':
      return 'error_handler';
    default:
      return 'system';
  }
}

function resolveErrorPolicy(node: WorkflowNode): RuntimeErrorPolicy {
  const raw = isRecord(node.config.error_policy)
    ? node.config.error_policy
    : isRecord(node.config.errorPolicy)
      ? node.config.errorPolicy
      : {};
  const mode = readString(raw.mode) ?? readString(raw.on_failure);
  return {
    on_failure:
      mode === 'go_to_error_handler' ||
      mode === 'retry_then_fail' ||
      mode === 'notify_and_stop'
        ? mode
        : 'fail_workflow',
    max_attempts:
      typeof raw.max_attempts === 'number'
        ? raw.max_attempts
        : typeof raw.retry_count === 'number'
          ? raw.retry_count + 1
          : 1,
    safe_stop: raw.safe_stop === true || node.type === 'delivery',
  };
}

function expressionFromSource(source: RuntimeInputBinding['source']) {
  if (!isRecord(source) || typeof source.type !== 'string') {
    return null;
  }
  switch (source.type) {
    case 'workflow_input': {
      const inputKey =
        readString(source.input_key) ?? readString(source.inputKey) ?? 'input';
      return `{{trigger.outputs.${inputKey}}}`;
    }
    case 'step_output': {
      const nodeId =
        readString(source.node_id) ?? readString(source.sourceNodeId) ?? 'step';
      const outputKey =
        readString(source.output_key) ??
        readString(source.outputKey) ??
        'output';
      return `{{steps.${sanitizeStepName(nodeId)}.outputs.${outputKey}}}`;
    }
    case 'system_value': {
      const key = readString(source.key) ?? 'value';
      return `{{lexframe.system.${key}}}`;
    }
    case 'document': {
      const documentId =
        readString(source.document_id) ??
        readString(source.documentId) ??
        'document';
      return `{{lexframe.documents.${documentId}.ref}}`;
    }
    case 'profile':
    case 'profile_snapshot': {
      const profileId =
        readString(source.profile_id) ??
        readString(source.profile_snapshot_id) ??
        readString(source.profileSnapshotId) ??
        'profile';
      return `{{lexframe.profiles.${profileId}.ref}}`;
    }
    case 'expression':
      return typeof source.expression === 'string' ? source.expression : null;
    default:
      return null;
  }
}

function redactUnsafeRuntimeProps(value: unknown): Record<string, unknown> {
  const redacted = redactRuntimeSource(value);
  return isRecord(redacted) ? redacted : {};
}

function redactRuntimeSource(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactRuntimeSource);
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes('secret') ||
      normalized.includes('apikey') ||
      normalized.includes('api_key') ||
      normalized.includes('token') ||
      normalized === 'document_text' ||
      normalized === 'body_text' ||
      normalized === 'signed_url'
    ) {
      next[key] = '[server_ref]';
      continue;
    }
    next[key] = redactRuntimeSource(child);
  }
  if (value.type === 'document') {
    next.access_mode = 'runtime_scoped_token';
    next.document_text = undefined;
  }
  return next;
}

function sanitizeStepName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'step'
  );
}

function isDirectAiPiece(pieceName: string) {
  const lower = pieceName.toLowerCase();
  return (
    (lower.includes('openai') ||
      lower.includes('anthropic') ||
      lower.includes('gemini') ||
      lower.includes('cometapi') ||
      lower.includes('llm')) &&
    !lower.includes('lexframe') &&
    !lower.includes('ai-gateway')
  );
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
