import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';
import { CanvasRuntimeProjectionService } from './canvas-runtime-projection.service';
import { CanvasValidationService } from './canvas-validation.service';

describe('CanvasRuntimeProjectionService', () => {
  const projectionService = new CanvasRuntimeProjectionService();
  const validationService = new CanvasValidationService();

  it('builds a deterministic compile preview with pieces and connections', () => {
    const workflow = workflowWithAction({
      runtime_mapping: {
        provider: 'activepieces',
        activepieces_piece: '@activepieces/piece-webhook',
        activepieces_action: 'send',
        can_compile: true,
      },
      input_bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'connection',
          },
          source: {
            type: 'connection',
            connection_id: 'conn_123',
            display_name: 'Webhook',
          },
        },
      ],
    });
    const validation = validationService.validateWorkflow(workflow);
    const preview = projectionService.preview({
      ...workflow,
      validation,
      validation_state: validation,
    });
    const secondPreview = projectionService.preview({
      ...workflow,
      validation,
      validation_state: validation,
    });

    expect(preview.provider).toBe('activepieces');
    expect(preview.required_pieces).toEqual([
      {
        package_name: '@activepieces/piece-webhook',
        version: null,
        node_ids: ['legal_action'],
      },
    ]);
    expect(preview.required_connections).toEqual([
      {
        connection_id: 'conn_123',
        node_ids: ['legal_action'],
      },
    ]);
    expect(preview.projection_hash).toBe(secondPreview.projection_hash);
  });

  it('keeps policy blockers in preview without publishing or runtime sync', () => {
    const workflow = deliveryWithoutApprovalWorkflow();
    const validation = validationService.validateWorkflow(workflow);
    const preview = projectionService.preview({
      ...workflow,
      validation,
      validation_state: validation,
    });

    expect(preview.can_compile).toBe(true);
    expect(
      preview.policy_warnings.some(
        (warning) =>
          warning.code === 'WF_POLICY_001_EXTERNAL_ACTION_REQUIRES_APPROVAL',
      ),
    ).toBe(true);
  });
});

function baseWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    displayName: 'Manual start',
    x: 160,
    y: 60,
  });
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    displayName: 'End',
    x: 160,
    y: 360,
  });

  return {
    schema_version: '2.0',
    id: 'wf_projection_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'Projection workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes: [trigger, end],
    edges: [
      createWorkflowEdge({
        source: trigger.id,
        target: end.id,
      }),
    ],
    variables: [],
    validation: {
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
    },
    runtime_projection: {
      status: 'not_compiled',
      can_compile: false,
      can_run: false,
      warnings: [],
    },
    layout: {
      mode: 'guided_vertical',
      updated_at: now,
    },
    created_at: now,
    updated_at: now,
  };
}

function workflowWithAction(
  patch: Partial<LexFrameWorkflowV2['nodes'][number]>,
): LexFrameWorkflowV2 {
  const base = baseWorkflow();
  const action = {
    ...createWorkflowNode({
      id: 'legal_action',
      type: 'legalAction',
      displayName: 'Legal action',
      x: 160,
      y: 200,
    }),
    inputs: [
      {
        key: 'connection',
        label: 'Connection',
        data_type: 'connection_ref',
        type: 'connection_ref',
        required: true,
        classification: 'runtime_only',
      },
    ],
    ...patch,
  };

  return {
    ...base,
    nodes: [base.nodes[0]!, action, base.nodes[1]!],
    edges: [
      createWorkflowEdge({
        source: 'trigger_manual_start',
        target: action.id,
      }),
      createWorkflowEdge({
        source: action.id,
        target: 'end_success',
      }),
    ],
  };
}

function deliveryWithoutApprovalWorkflow(): LexFrameWorkflowV2 {
  const base = baseWorkflow();
  const delivery = {
    ...createWorkflowNode({
      id: 'email_delivery',
      type: 'delivery',
      displayName: 'Delivery',
      moduleCode: 'delivery.email',
      x: 160,
      y: 200,
    }),
    runtime_mapping: {
      provider: 'activepieces' as const,
      activepieces_piece: '@activepieces/piece-gmail',
      activepieces_action: 'send_email',
      can_compile: true,
    },
  };

  return {
    ...base,
    nodes: [base.nodes[0]!, delivery, base.nodes[1]!],
    edges: [
      createWorkflowEdge({
        source: 'trigger_manual_start',
        target: delivery.id,
      }),
      createWorkflowEdge({
        source: delivery.id,
        target: 'end_success',
      }),
    ],
  };
}
