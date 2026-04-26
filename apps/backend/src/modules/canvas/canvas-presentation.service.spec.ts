import type {
  LexFrameWorkflowV2,
  ValidationIssue,
  WorkflowNode,
} from '@lexframe/contracts';
import { CanvasPresentationService } from './canvas-presentation.service';

describe('CanvasPresentationService', () => {
  const service = new CanvasPresentationService(
    {} as never,
    {} as never,
    {} as never,
  );

  it('maps validation issues to basic no-code messages without raw fields', () => {
    const issue: ValidationIssue = {
      id: 'issue_missing_facts',
      severity: 'error',
      category: 'type_compatibility',
      scope: 'node',
      code: 'WF_TYPE_001_REQUIRED_INPUT_MISSING',
      title: 'Missing input',
      message: 'facts is required',
      developer_message: 'node.module_code=input is missing JSONPath mapping',
      affected_node_id: 'analysis_1',
      affected_input_key: 'facts',
      field_path: 'nodes[0].input_bindings.facts',
      blocks: ['publish', 'run'],
      suggested_fixes: [
        {
          id: 'fix_bind_facts',
          type: 'bind_input',
          label: 'Bind facts',
          operation_type: 'UPSERT_INPUT_BINDING',
          operation_payload: {
            node_id: 'analysis_1',
            input_key: 'facts',
          },
        },
      ],
    };

    const message = service.toNoCodeValidationMessage(
      issue,
      makeWorkflow(),
      'basic',
    );

    expect(message.title).toContain('Факты дела');
    expect(message.how_to_fix.length).toBeGreaterThan(0);
    expect(message.can_auto_fix).toBe(true);
    expect(message.auto_fix_operation).toBeNull();
    expect(message.suggested_fixes).toEqual([]);
    expect(message.advanced).toBeNull();
    expect(JSON.stringify(message)).not.toContain('module_code');
    expect(JSON.stringify(message)).not.toContain('JSONPath');
    expect(JSON.stringify(message)).not.toContain('runtime payload');
  });

  it('keeps technical validation details permission-gated in developer mode', () => {
    const issue: ValidationIssue = {
      id: 'issue_secret',
      severity: 'policy_block',
      category: 'security',
      scope: 'node',
      code: 'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
      title: 'Secret exposed',
      message: 'Secret value in config',
      developer_message: 'secret appears in raw config',
      affected_node_id: 'analysis_1',
      blocks: ['publish'],
    };

    const message = service.toNoCodeValidationMessage(
      issue,
      makeWorkflow(),
      'developer',
    );

    expect(message.plain_language_message).toContain('секрет');
    expect(message.advanced).toMatchObject({
      code: 'WF_POLICY_005_SECRET_VALUE_IN_CONFIG',
      category: 'security',
    });
  });
});

function makeWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  return {
    schema_version: '2.0',
    id: 'workflow_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'No-code test',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes: [makeNode()],
    edges: [],
    variables: [],
    validation: {
      status: 'invalid',
      errors_count: 1,
      warnings_count: 0,
      policy_blocks_count: 0,
      issues: [],
      can_save: true,
      can_test: false,
      can_publish: false,
      can_compile: false,
      can_run: false,
      can_sync: false,
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
    created_at: now,
    updated_at: now,
  };
}

function makeNode(): WorkflowNode {
  return {
    id: 'analysis_1',
    type: 'legalAction',
    block_code: 'case_material_analysis',
    display_name: 'Анализ материалов',
    handles: [],
    inputs: [
      {
        key: 'facts',
        label: 'Факты дела',
        type: 'text',
        data_type: 'text',
        required: true,
      },
    ],
    outputs: [],
    bindings: {},
    input_bindings: [],
    config: {},
    policy: {},
    runtime_mapping: {},
    layout: { x: 0, y: 0 },
  };
}
