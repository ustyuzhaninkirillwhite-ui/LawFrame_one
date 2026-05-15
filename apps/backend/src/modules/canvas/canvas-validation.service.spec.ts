import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';
import { CanvasValidationService } from './canvas-validation.service';

describe('CanvasValidationService', () => {
  const service = new CanvasValidationService();

  it('accepts the initial trigger to end workflow', () => {
    const workflow = makeWorkflow();

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('valid');
    expect(result.can_compile).toBe(true);
  });

  it('rejects self-loop connections', () => {
    const workflow = {
      ...makeWorkflow(),
      edges: [
        createWorkflowEdge({
          source: 'trigger_manual_start',
          target: 'trigger_manual_start',
        }),
      ],
    };

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('invalid');
    expect(
      result.issues.some(
        (issue) => issue.code === 'WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE',
      ),
    ).toBe(true);
  });

  it('blocks delivery without an approval gate', () => {
    const base = makeWorkflow();
    const delivery = createWorkflowNode({
      id: 'email_delivery',
      type: 'delivery',
      displayName: 'Доставка',
      moduleCode: 'email_delivery',
      x: 160,
      y: 220,
    });
    const workflow = {
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

    const result = service.validateWorkflow(workflow);

    expect(result.policy_blocks_count).toBe(1);
    expect(result.can_run).toBe(false);
  });

  it('rejects disconnected control-flow nodes', () => {
    const base = makeWorkflow();
    const note = createWorkflowNode({
      id: 'legal_action_orphan',
      type: 'legalAction',
      displayName: 'Orphan action',
      x: 420,
      y: 220,
    });
    const workflow = {
      ...base,
      nodes: [...base.nodes, note],
    };

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('invalid');
    expect(result.errors_count).toBeGreaterThanOrEqual(1);
    expect(
      result.issues.some(
        (issue) => issue.code === 'WF_STRUCTURE_004_NO_DISCONNECTED_NODE',
      ),
    ).toBe(true);
  });

  it('reports required step inputs without bindings', () => {
    const workflow = workflowWithAction({
      inputs: [
        {
          key: 'claim_text',
          label: 'Claim text',
          data_type: 'string',
          type: 'string',
          required: true,
          classification: 'workspace_internal',
        },
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('invalid');
    expect(
      result.issues.some(
        (issue) => issue.code === 'WF_TYPE_001_REQUIRED_INPUT_MISSING',
      ),
    ).toBe(true);
  });

  it('accepts workflow input bindings with compatible types', () => {
    const workflow = workflowWithAction({
      workflowInputs: [
        {
          key: 'claim_text',
          label: 'Claim text',
          data_type: 'string',
          type: 'string',
          required: true,
          classification: 'workspace_internal',
        },
      ],
      inputs: [
        {
          key: 'claim_text',
          label: 'Claim text',
          data_type: 'string',
          type: 'string',
          required: true,
          classification: 'workspace_internal',
        },
      ],
      bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'claim_text',
          },
          source: {
            type: 'workflow_input',
            input_key: 'claim_text',
          },
        },
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('valid');
    expect(result.can_compile).toBe(true);
  });

  it('blocks incompatible binding types and suggests repair when possible', () => {
    const workflow = workflowWithAction({
      workflowInputs: [
        {
          key: 'documents',
          label: 'Documents',
          data_type: 'document_ref[]',
          type: 'document_ref[]',
          required: true,
          classification: 'client_material',
        },
      ],
      inputs: [
        {
          key: 'document',
          label: 'Document',
          data_type: 'document_ref',
          type: 'document_ref',
          required: true,
          classification: 'client_material',
        },
      ],
      bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'document',
          },
          source: {
            type: 'workflow_input',
            input_key: 'documents',
          },
        },
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(result.status).toBe('invalid');
    expect(
      result.issues.some(
        (issue) =>
          issue.code === 'WF_TYPE_006_ARRAY_TO_SCALAR_WITHOUT_TRANSFORM' &&
          issue.suggested_transform === 'pick_one',
      ),
    ).toBe(true);
  });

  it('policy-blocks secret refs exposed as strings', () => {
    const workflow = workflowWithAction({
      inputs: [
        {
          key: 'api_key',
          label: 'API key',
          data_type: 'string',
          type: 'string',
          required: true,
          classification: 'secret',
        },
      ],
      bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'api_key',
          },
          source: {
            type: 'secret_ref',
            secret_ref: 'secret_api_key',
          },
        },
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(result.policy_blocks_count).toBe(1);
    expect(result.can_compile).toBe(false);
  });

  it('blocks direct AI provider nodes that bypass the LexFrame AI Gateway', () => {
    const base = makeWorkflow();
    const aiNode = {
      ...createWorkflowNode({
        id: 'ai_direct_provider',
        type: 'aiAction',
        displayName: 'Direct provider call',
        x: 160,
        y: 180,
      }),
      runtime_mapping: {
        provider: 'openai' as never,
        can_compile: true,
      },
    };
    const workflow = {
      ...base,
      nodes: [base.nodes[0]!, aiNode, base.nodes[1]!],
      edges: [
        createWorkflowEdge({
          source: 'trigger_manual_start',
          target: aiNode.id,
        }),
        createWorkflowEdge({
          source: aiNode.id,
          target: 'end_success',
        }),
      ],
    };

    const result = service.validateWorkflow(workflow);

    expect(result.policy_blocks_count).toBeGreaterThanOrEqual(1);
    expect(result.can_run).toBe(false);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === 'WF_POLICY_002_AI_ROUTE_FORBIDDEN_FOR_DATA_CLASS',
      ),
    ).toBe(true);
  });

  it('blocks cross-workspace document references before compile or run', () => {
    const workflow = workflowWithAction({
      inputs: [
        {
          key: 'document',
          label: 'Document',
          data_type: 'document_ref',
          type: 'document_ref',
          required: true,
          classification: 'client_material',
        },
      ],
      bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'document',
          },
          source: {
            type: 'document',
            document_id: 'doc_other_workspace',
            workspace_id: 'workspace_other',
          },
        } as never,
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(result.policy_blocks_count).toBeGreaterThanOrEqual(1);
    expect(result.can_compile).toBe(false);
    expect(
      result.issues.some(
        (issue) => issue.code === 'WF_POLICY_004_CROSS_WORKSPACE_REFERENCE',
      ),
    ).toBe(true);
  });

  it('keeps downstream bindings stale when a source node is removed', () => {
    const workflow = workflowWithAction({
      inputs: [
        {
          key: 'facts',
          label: 'Facts',
          data_type: 'case_fact_set',
          type: 'case_fact_set',
          required: true,
          classification: 'workspace_internal',
        },
      ],
      bindings: [
        {
          target: {
            node_id: 'legal_action',
            input_key: 'facts',
          },
          source: {
            type: 'step_output',
            node_id: 'deleted_source',
            output_key: 'facts',
          },
        },
      ],
    });

    const result = service.validateWorkflow(workflow);

    expect(
      result.issues.some(
        (issue) => issue.code === 'WF_TYPE_002_OUTPUT_NOT_FOUND',
      ),
    ).toBe(true);
    expect(result.can_publish).toBe(false);
  });
});

function makeWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    displayName: 'Запуск вручную',
    description: 'Workflow finished successfully.',
    x: 160,
    y: 60,
  });
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    description: 'Workflow finished successfully.',
    displayName: 'Сценарий завершён',
    x: 160,
    y: 220,
  });

  return {
    schema_version: '2.0',
    id: 'wf_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'Test workflow',
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

function workflowWithAction(input: {
  readonly workflowInputs?: LexFrameWorkflowV2['inputs'];
  readonly inputs: LexFrameWorkflowV2['nodes'][number]['inputs'];
  readonly bindings?: NonNullable<
    LexFrameWorkflowV2['nodes'][number]['input_bindings']
  >;
}): LexFrameWorkflowV2 {
  const base = makeWorkflow();
  const action = {
    ...createWorkflowNode({
      id: 'legal_action',
      type: 'legalAction',
      displayName: 'Legal action',
      x: 160,
      y: 180,
    }),
    inputs: input.inputs,
    input_bindings: input.bindings ?? [],
  };

  return {
    ...base,
    inputs: input.workflowInputs ?? [],
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
