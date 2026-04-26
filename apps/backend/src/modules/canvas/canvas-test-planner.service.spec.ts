import type {
  CanvasTestRunRequest,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  WorkflowNode,
} from '@lexframe/contracts';
import { CanvasTestPlanner } from './canvas-test-planner.service';

describe('CanvasTestPlanner', () => {
  const planner = new CanvasTestPlanner();

  it('builds an upstream slice for selected step testing', () => {
    const workflow = workflowFixture();
    const plan = planner.buildPlan({
      workflow,
      validation: validValidation(),
      request: requestFixture({
        mode: 'test_selected_step',
        target_node_id: 'draft_claim',
      }),
      pinnedNodeIds: ['analyze_materials'],
    });

    expect(plan.nodes.map((node) => node.id)).toEqual([
      'start',
      'analyze_materials',
      'draft_claim',
    ]);
    expect(plan.usesPinnedData).toBe(true);
    expect(plan.blocked).toBe(false);
  });

  it('uses the full workflow for dry-run', () => {
    const workflow = workflowFixture();
    const plan = planner.buildPlan({
      workflow,
      validation: validValidation(),
      request: requestFixture({ mode: 'dry_run_full' }),
      pinnedNodeIds: [],
    });

    expect(plan.nodes.map((node) => node.id)).toEqual([
      'start',
      'analyze_materials',
      'draft_claim',
      'email_delivery',
    ]);
  });

  it('marks blocked plans when validation has blocking issues', () => {
    const workflow = workflowFixture();
    const plan = planner.buildPlan({
      workflow,
      validation: {
        ...validValidation(),
        can_test: false,
        issues: [
          {
            id: 'missing_facts',
            severity: 'error',
            category: 'schema',
            scope: 'node',
            code: 'CANVAS_REQUIRED_INPUT_MISSING',
            title: 'Missing input',
            message: 'Facts are required.',
            affected_node_id: 'draft_claim',
            affected_input_key: 'facts',
            blocks: ['test_step'],
          },
        ],
      },
      request: requestFixture({
        mode: 'test_selected_step',
        target_node_id: 'draft_claim',
      }),
      pinnedNodeIds: [],
    });

    expect(plan.blocked).toBe(true);
    expect(plan.issues).toHaveLength(1);
  });
});

function requestFixture(
  input: Partial<CanvasTestRunRequest>,
): CanvasTestRunRequest {
  return {
    draft_version_id: 'draft_1',
    mode: 'validation_only',
    target_node_id: null,
    target_branch_id: null,
    input_mode: 'use_current_bindings',
    policy: {
      allow_real_reads: true,
      allow_real_writes: false,
      allow_external_calls: false,
      allow_ai_calls: false,
      ai_mode: 'mock',
      max_loop_items: 5,
      timeout_seconds: 30,
    },
    redaction: {
      raw_input_visible: false,
      raw_output_visible: false,
      store_raw_payload: false,
    },
    ...input,
  };
}

function validValidation(): CanvasValidationSummary {
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

function workflowFixture(): LexFrameWorkflowV2 {
  const nodes = [
    nodeFixture('start', 0),
    nodeFixture('analyze_materials', 100),
    nodeFixture('draft_claim', 200),
    nodeFixture('email_delivery', 300, { external: true }),
  ];
  return {
    schema_version: '2.0',
    id: 'workflow_1',
    workspace_id: 'workspace_1',
    automation_id: 'automation_1',
    draft_version_id: 'draft_1',
    metadata: {
      title: 'Test workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes,
    edges: [
      edgeFixture('start', 'analyze_materials'),
      edgeFixture('analyze_materials', 'draft_claim'),
      edgeFixture('draft_claim', 'email_delivery'),
    ],
    variables: [],
    validation: validValidation(),
    runtime_projection: {
      status: 'not_compiled',
      can_compile: true,
      can_run: true,
      activepieces_flow_id: null,
      last_compile_report_id: null,
      warnings: [],
    },
    layout: {
      direction: 'vertical',
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    created_at: '2026-04-25T00:00:00.000Z',
    updated_at: '2026-04-25T00:00:00.000Z',
  } as unknown as LexFrameWorkflowV2;
}

function nodeFixture(
  id: string,
  y: number,
  options: { readonly external?: boolean } = {},
): WorkflowNode {
  return {
    id,
    type: 'legalAction',
    block_code: id,
    display_name: id,
    handles: [],
    inputs: [],
    outputs: [
      {
        key: 'result',
        label: 'Result',
        data_type: 'json',
        classification: 'workspace_internal',
      },
    ],
    bindings: {},
    input_bindings: [],
    config: {},
    policy: {
      external_action: options.external === true,
      data_classification: 'workspace_internal',
    },
    runtime_mapping: {
      provider: 'internal_worker',
      supports_step_test: true,
      supports_partial_execution: true,
      supports_pinned_data: true,
    },
    layout: { x: 0, y },
  } as WorkflowNode;
}

function edgeFixture(source: string, target: string) {
  return {
    id: `${source}_${target}`,
    type: 'control_flow',
    source_node_id: source,
    source_handle: 'main_output',
    target_node_id: target,
    target_handle: 'main_input',
  } as const;
}
