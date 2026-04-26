import type { CanvasOperation, LexFrameWorkflowV2 } from '@lexframe/contracts';
import { CanvasPolicyValidator } from './canvas-policy-validator.service';

describe('CanvasPolicyValidator', () => {
  const validator = new CanvasPolicyValidator();

  it('blocks direct provider and secret-bearing operations', () => {
    const result = validator.validate({
      workflow: workflowFixture(),
      includeSensitiveContext: false,
      operations: [
        {
          client_operation_id: 'op_1',
          operation_type: 'ADD_NODE_FROM_MODULE',
          operation_payload: {
            module_code: 'supabase.service_role.http',
            api_key: 'secret',
          },
        },
      ],
    });

    expect(result.allowed).toBe(false);
    expect(result.codes).toEqual(
      expect.arrayContaining([
        'secret_reference_forbidden',
        'direct_provider_or_code_step_blocked',
      ]),
    );
  });

  it('blocks external delivery without approval path', () => {
    const result = validator.validate({
      workflow: workflowFixture(),
      includeSensitiveContext: false,
      operations: [addModule('delivery.email')],
    });

    expect(result.allowed).toBe(false);
    expect(result.codes).toContain('external_delivery_requires_approval');
  });

  it('allows approval gate proposal before external delivery', () => {
    const result = validator.validate({
      workflow: workflowFixture(),
      includeSensitiveContext: false,
      operations: [addModule('human.approval')],
    });

    expect(result.allowed).toBe(true);
  });
});

function addModule(moduleCode: string): CanvasOperation {
  return {
    client_operation_id: `op_${moduleCode}`,
    operation_type: 'ADD_NODE_FROM_MODULE',
    operation_payload: { module_code: moduleCode },
  };
}

function workflowFixture(): LexFrameWorkflowV2 {
  return {
    schema_version: '2.0',
    id: 'workflow_1',
    workspace_id: 'workspace_1',
    automation_id: 'automation_1',
    draft_version_id: 'draft_1',
    metadata: {
      title: 'Workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes: [],
    edges: [],
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
    },
    runtime_projection: {
      status: 'not_compiled',
      can_compile: false,
      can_run: false,
      warnings: [],
    },
    layout: {
      mode: 'guided_vertical',
    },
    created_at: '2026-04-25T00:00:00.000Z',
    updated_at: '2026-04-25T00:00:00.000Z',
  } as unknown as LexFrameWorkflowV2;
}
