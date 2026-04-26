import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { CanvasValidationService } from './canvas-validation.service';
import { ConnectionRequirementsService } from './connection-requirements.service';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';
import { CanvasStepInspectorService } from './canvas-step-inspector.service';

describe('CanvasStepInspectorService', () => {
  const actor: AuthenticatedActor = {
    id: 'user_test',
    email: 'user@example.test',
    fullName: 'Test User',
    emailConfirmedAt: null,
    assuranceLevel: 'aal1',
    accessToken: 'token',
    sessionId: 'session',
  };
  const access: AccessContext = {
    activeWorkspace: {
      id: 'workspace_test',
      name: 'Workspace',
      slug: 'workspace',
      role: 'owner',
      status: 'active',
    },
    roles: ['lawyer'],
    permissions: ['canvas.view', 'canvas.edit', 'automation.run'],
  };
  const workflow = makeWorkflow();
  const validationService = new CanvasValidationService();
  const databaseService = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
  const draftService = {
    ensureDraft: jest.fn().mockResolvedValue({
      id: 'draft_test',
      workflow,
    }),
  };
  const ioService = {
    listSources: jest.fn().mockResolvedValue({
      compatible_sources: [
        {
          type: 'workflow_input',
          source: { type: 'workflow_input', input_key: 'query' },
          label: 'Workflow / Query',
          data_type: 'string',
          classification: 'workspace_internal',
          compatibility: 'valid',
          preview: null,
        },
      ],
      incompatible_sources: [],
    }),
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CanvasStepInspectorService(
    databaseService as never,
    draftService as never,
    validationService,
    ioService as never,
    new ConnectionRequirementsService(),
    auditService as never,
  );

  it('returns a backend DTO without exposing secret config values', async () => {
    const dto = await service.getInspector(
      actor,
      access,
      'automation_test',
      'case_law_search_1',
    );

    expect(dto.node.id).toBe('case_law_search_1');
    expect(dto.inputs[0]?.compatible_sources_count).toBe(1);
    expect(dto.settings_form.fields.map((field) => field.key)).toContain(
      'limit',
    );
    expect(JSON.stringify(dto)).not.toContain('secret-value');
    expect(dto.tabs).toEqual([
      'overview',
      'inputs',
      'settings',
      'data',
      'test',
      'errors',
      'outputs',
    ]);
  });

  it('returns redacted step test output through backend policy', async () => {
    draftService.ensureDraft.mockResolvedValueOnce({
      id: 'draft_test',
      workflow: makeWorkflow({ includeSecretConfig: false }),
    });

    const result = await service.testNode(
      actor,
      access,
      'automation_test',
      'case_law_search_1',
      {
        mode: 'selected_step',
        sample_data_mode: 'auto',
        client_operation_id: 'test_op',
      },
    );

    expect(result.status).toBe('passed');
    expect(JSON.stringify(result)).not.toContain('token');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'canvas.step.test.started' }),
    );
  });
});

function makeWorkflow(
  options: { readonly includeSecretConfig?: boolean } = {},
): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    blockCode: 'manual_start',
    displayName: 'Manual start',
    x: 160,
    y: 60,
  });
  const runtimeReadyTrigger = {
    ...trigger,
    runtime_mapping: {
      ...trigger.runtime_mapping,
      provider: 'internal_worker' as const,
      internal_route: 'manual_start',
      can_compile: true,
    },
  };
  const action = {
    ...createWorkflowNode({
      id: 'case_law_search_1',
      type: 'legalAction',
      blockCode: 'case_law_search',
      displayName: 'Search case law',
      x: 160,
      y: 220,
    }),
    config: {
      limit: 5,
      ...(options.includeSecretConfig === false
        ? {}
        : { api_key: 'secret-value' }),
    },
    input_bindings: [
      {
        target: {
          node_id: 'case_law_search_1',
          input_key: 'query',
        },
        source: {
          type: 'workflow_input' as const,
          input_key: 'query',
        },
      },
    ],
    runtime_mapping: {
      provider: 'internal_worker' as const,
      internal_route: 'case_law_search',
      can_compile: true,
      supports_step_test: true,
    },
  };
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    blockCode: 'end_success',
    displayName: 'End',
    x: 160,
    y: 380,
  });

  return {
    schema_version: '2.0',
    id: 'workflow_test',
    workspace_id: 'workspace_test',
    automation_id: 'automation_test',
    draft_version_id: 'draft_test',
    metadata: {
      title: 'Workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [
      {
        key: 'query',
        label: 'Query',
        data_type: 'string',
        type: 'string',
        required: true,
        classification: 'workspace_internal',
      },
    ],
    outputs: [],
    nodes: [runtimeReadyTrigger, action, end],
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
