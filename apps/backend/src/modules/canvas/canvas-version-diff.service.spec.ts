import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';
import { CanvasVersionDiffService } from './canvas-version-diff.service';

describe('CanvasVersionDiffService', () => {
  const service = new CanvasVersionDiffService();

  it('groups semantic changes by graph, config, bindings, policy, runtime and UX', () => {
    const fromWorkflow = workflowWithAction();
    const toWorkflow: LexFrameWorkflowV2 = {
      ...fromWorkflow,
      nodes: [
        fromWorkflow.nodes[0]!,
        {
          ...fromWorkflow.nodes[1]!,
          display_name: 'Legal review',
          description: 'Changed label',
          config: { threshold: 2 },
          input_bindings: [
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
          policy: {
            ...fromWorkflow.nodes[1]!.policy,
            approval_required: true,
          },
          runtime_mapping: {
            ...fromWorkflow.nodes[1]!.runtime_mapping,
            activepieces_action: 'review',
          },
        },
        createWorkflowNode({
          id: 'delivery_email',
          type: 'delivery',
          displayName: 'Email delivery',
          x: 160,
          y: 320,
        }),
        fromWorkflow.nodes[2]!,
      ],
      edges: [
        fromWorkflow.edges[0]!,
        createWorkflowEdge({
          source: 'legal_action',
          target: 'delivery_email',
        }),
        createWorkflowEdge({
          source: 'delivery_email',
          target: 'end_success',
        }),
      ],
    };

    const diff = service.compare({
      automationId: 'automation_test',
      fromId: 'version_1',
      toId: 'version_2',
      fromWorkflow,
      toWorkflow,
    });

    expect(diff.summary.added_nodes).toBe(1);
    expect(diff.summary.changed_nodes).toBe(2);
    expect(diff.summary.changed_bindings).toBe(1);
    expect(diff.summary.policy_changes).toBe(1);
    expect(diff.summary.runtime_changes).toBe(1);
    expect(
      diff.technical_patch.graph.some((item) => item.type === 'node_added'),
    ).toBe(true);
    expect(diff.human_summary).toEqual(
      expect.arrayContaining([
        '1 node(s) added.',
        '1 data binding change(s).',
        '1 legal/policy change(s).',
      ]),
    );
  });

  it('returns a human no-op summary when workflows are semantically equal', () => {
    const workflow = workflowWithAction();

    const diff = service.compare({
      automationId: 'automation_test',
      fromId: 'version_1',
      toId: 'version_1_copy',
      fromWorkflow: workflow,
      toWorkflow: workflow,
    });

    expect(diff.human_summary).toEqual([
      'No semantic Canvas changes detected.',
    ]);
    expect(diff.summary).toEqual({
      added_nodes: 0,
      removed_nodes: 0,
      changed_nodes: 0,
      changed_bindings: 0,
      policy_changes: 0,
      runtime_changes: 0,
    });
  });
});

function workflowWithAction(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    displayName: 'Manual start',
    x: 160,
    y: 60,
  });
  const action = createWorkflowNode({
    id: 'legal_action',
    type: 'legalAction',
    displayName: 'Legal action',
    x: 160,
    y: 200,
  });
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    displayName: 'End',
    x: 160,
    y: 440,
  });

  return {
    schema_version: '2.0',
    id: 'wf_diff_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'Diff workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
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
    outputs: [],
    nodes: [trigger, action, end],
    edges: [
      createWorkflowEdge({
        source: trigger.id,
        target: action.id,
      }),
      createWorkflowEdge({
        source: action.id,
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
