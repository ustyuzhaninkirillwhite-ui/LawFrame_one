import type {
  AutomationBlueprint,
  AutomationBlueprintStepKind,
} from '@lexframe/contracts';
import type {
  CanvasBlockKind,
  CanvasEdgeType,
  CanvasNodeType,
} from '@lexframe/workflow-dsl';
import {
  findCanvasBlockDefinition,
  nodeTypeForBlockKind,
} from '@lexframe/workflow-dsl';
import type {
  LexFrameWorkflowV2,
  WorkflowEdge,
  WorkflowNode,
  WorkflowPolicyBlock,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

export interface CanvasDraftConversionInput {
  readonly automationId: string;
  readonly draftVersionId: string;
  readonly now?: string;
}

export type Stage20WorkflowDraft = LexFrameWorkflowV2 & {
  readonly policies: WorkflowPolicyBlock & {
    readonly source_blueprint_id: string;
    readonly source_intent_id: string;
  };
};

@Injectable()
export class AutomationBlueprintCanvasConverterService {
  toWorkflowDraft(
    blueprint: AutomationBlueprint,
    input: CanvasDraftConversionInput,
  ): Stage20WorkflowDraft {
    const now = input.now ?? new Date().toISOString();
    const validation = {
      status: 'valid_with_warnings' as const,
      errors_count: 0,
      warnings_count: blueprint.validationSummary.warnings.length,
      policy_blocks_count: blueprint.validationSummary.policyBlocks.length,
      issues: [],
      summary: {
        errors: 0,
        warnings: blueprint.validationSummary.warnings.length,
        policy_blocks: blueprint.validationSummary.policyBlocks.length,
        suggestions: 0,
      },
      capabilities: {
        can_save: true,
        can_test: false,
        can_compile: true,
        can_publish: false,
        can_run: false,
        can_sync: false,
      },
      can_save: true,
      can_test: false,
      can_publish: false,
      can_compile: true,
      can_run: false,
      can_sync: false,
    };
    const nodes = blueprint.steps.map((step, index) =>
      toWorkflowNode(step, index),
    );

    return {
      schema_version: '2.0',
      id: `workflow_${blueprint.id}`,
      workspace_id: blueprint.workspaceId,
      project_id: blueprint.projectId ?? null,
      automation_id: input.automationId,
      draft_version_id: input.draftVersionId,
      published_version_id: null,
      revision_counter: 1,
      metadata: {
        title: blueprint.title,
        description: blueprint.summary,
        status: 'draft',
        canvas_mode: 'guided_vertical',
      },
      workflow_inputs: blueprint.workflowInputs.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        data_type: field.type,
        required: field.required,
        classification: field.classification,
      })),
      workflow_outputs: blueprint.workflowOutputs.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        data_type: field.type,
        required: field.required,
        classification: field.classification,
      })),
      inputs: blueprint.workflowInputs.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        data_type: field.type,
        required: field.required,
        classification: field.classification,
      })),
      outputs: blueprint.workflowOutputs.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        data_type: field.type,
        required: field.required,
        classification: field.classification,
      })),
      nodes,
      edges: blueprint.edges.map(
        (edge): WorkflowEdge => ({
          id: edge.id,
          type: edgeType(edge.kind),
          edge_type: edgeType(edge.kind),
          source_node_id: edge.sourceStepId,
          source_handle: edge.kind === 'approval' ? 'approved' : 'main_output',
          target_node_id: edge.targetStepId,
          target_handle: 'main_input',
          label: edge.label ?? null,
          validation_state: 'valid',
        }),
      ),
      variables: [],
      secrets_policy: {
        frontend_exposure: 'forbidden',
        secret_sources: ['connection_ref_only', 'secret_ref_only'],
      },
      data_contracts: Object.fromEntries(
        blueprint.workflowOutputs.map((field) => [
          field.key,
          {
            key: field.key,
            data_type: field.type,
            classification: field.classification,
          },
        ]),
      ),
      policies: {
        external_delivery_requires_approval: true,
        ai_sensitive_data_policy: 'secure_route_or_block',
        raw_execution_data_policy: 'metadata_only',
        pinned_data_policy: 'draft_test_only',
        secret_frontend_exposure: 'forbidden',
        custom_expression_policy: 'forbidden',
        source_blueprint_id: blueprint.id,
        source_intent_id: blueprint.intentId,
      },
      validation_state: validation,
      validation,
      runtime_projection: {
        status: 'compile_required',
        can_compile: true,
        can_run: false,
        warnings: [],
      },
      canvas_layout: {
        mode: 'guided_vertical',
        updated_at: now,
        nodes: Object.fromEntries(nodes.map((node) => [node.id, node.layout])),
      },
      layout: {
        mode: 'guided_vertical',
        updated_at: now,
      },
      created_at: now,
      updated_at: now,
    };
  }
}

function toWorkflowNode(
  step: AutomationBlueprint['steps'][number],
  index: number,
): WorkflowNode {
  const blockKind = blockKindFor(step.kind);
  const blockCode = blockCodeFor(step.kind, step.moduleCode);
  const block = findCanvasBlockDefinition(blockCode);
  const nodeType: CanvasNodeType =
    block?.nodeType ?? nodeTypeForBlockKind(blockKind);

  return {
    id: step.id,
    type: nodeType,
    node_type: nodeType,
    block_code: blockCode,
    display_name: step.title,
    description: step.description,
    module_ref: step.moduleCode
      ? {
          module_code: step.moduleCode,
          module_version: step.moduleVersion ?? null,
          status: 'published',
        }
      : null,
    module_code: step.moduleCode ?? null,
    module_version: step.moduleVersion ?? null,
    module_status: step.moduleCode ? 'published' : null,
    handles: [
      ...(step.kind === 'trigger'
        ? []
        : [
            {
              code: 'main_input' as const,
              label: 'Input',
              direction: 'input' as const,
              edge_types: ['control_flow' as const],
            },
          ]),
      ...(step.kind === 'end'
        ? []
        : [
            {
              code: 'main_output' as const,
              label: 'Next',
              direction: 'output' as const,
              edge_types: ['control_flow' as const],
            },
          ]),
    ],
    inputs: step.inputRequirements.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      data_type: field.type,
      required: field.required,
      classification: field.classification,
    })),
    outputs: step.outputDefinitions.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      data_type: field.type,
      required: field.required,
      classification: field.classification,
    })),
    bindings: {},
    input_bindings: [],
    config: step.config,
    policy: {
      approval_required: step.policy.requiresApproval,
      external_action: step.policy.externalAction,
      ai_action: step.kind === 'ai_action',
      data_classification: step.policy.dataClassification,
      risk_level: step.policy.riskLevel,
      can_use_documents: ['document_input', 'legal_action'].includes(step.kind),
      can_run_in_dry_run: !step.policy.externalAction,
      can_be_published_as_template: true,
      required_permissions: ['canvas.edit'],
      ai_policy:
        step.kind === 'ai_action'
          ? {
              uses_ai: true,
              allowed_routes: ['automation_planner_high', 'agent_general'],
              require_redaction: true,
              structured_output_required: true,
            }
          : undefined,
    },
    runtime_mapping: {
      module_code: step.moduleCode ?? null,
      provider:
        step.runtimeMapping?.provider === 'lexframe_canvas'
          ? 'internal_worker'
          : step.runtimeMapping?.provider,
      activepieces_piece: step.runtimeMapping?.pieceName ?? null,
      activepieces_action: step.runtimeMapping?.actionName ?? null,
      can_compile: true,
      supports_step_test: false,
      supports_partial_execution: false,
      supports_pinned_data: false,
      warnings: [],
    },
    layout: {
      x: 80,
      y: 80 + index * 160,
      width: 320,
      height: 96,
    },
    canvas: {
      x: 80,
      y: 80 + index * 160,
      width: 320,
      height: 96,
    },
    lifecycle: { status: 'draft' },
  };
}

function blockKindFor(kind: AutomationBlueprintStepKind): CanvasBlockKind {
  if (kind === 'router') {
    return 'condition';
  }
  return kind;
}

function blockCodeFor(
  kind: AutomationBlueprintStepKind,
  moduleCode?: string | null,
) {
  if (kind === 'trigger') return 'manual_start';
  if (kind === 'document_input') return 'select_documents';
  if (kind === 'ai_action') return 'ai_gateway_action';
  if (kind === 'approval') return 'approval_gate';
  if (kind === 'delivery') return 'delivery_step';
  if (kind === 'storage') return 'store_artifact';
  if (kind === 'end') return 'end';
  if (kind === 'note') return 'note';
  return moduleCode ?? kind;
}

function edgeType(
  kind: AutomationBlueprint['edges'][number]['kind'],
): CanvasEdgeType {
  if (kind === 'data') return 'data_flow';
  if (kind === 'approval') return 'approval_flow';
  if (kind === 'error') return 'error_flow';
  if (kind === 'loop') return 'loop_flow';
  if (kind === 'annotation') return 'annotation_link';
  return 'control_flow';
}
