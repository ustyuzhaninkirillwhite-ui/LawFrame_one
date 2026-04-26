import type { LexFrameWorkflowV2 } from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import { findCanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { CanvasAutoBindingService } from './canvas-auto-binding.service';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import { CanvasModuleAvailabilityService } from './canvas-module-availability.service';
import { CanvasModuleCompatibilityService } from './canvas-module-compatibility.service';
import { CanvasNodeFactory } from './canvas-node-factory.service';
import { createWorkflowEdge, createWorkflowNode } from './canvas-model';

describe('Canvas module palette services', () => {
  const access: AccessContext = {
    activeWorkspace: null,
    roles: ['lawyer'],
    permissions: ['canvas.view', 'canvas.edit', 'automation.run'],
  };
  const registry = new CanvasBlockRegistryService();

  it('reports missing connection as draft-addable requirement', () => {
    const availability = new CanvasModuleAvailabilityService(registry);
    const block = mustBlock('email_delivery');

    const result = availability.evaluate({ block, access });

    expect(result.availability.status).toBe('missing_connection');
    expect(
      result.requirements.some(
        (requirement) =>
          requirement.kind === 'connection' && requirement.status === 'missing',
      ),
    ).toBe(true);
    expect(
      (result.availability.remediation ?? []).some(
        (action) => action.action === 'add_as_draft',
      ),
    ).toBe(true);
  });

  it('keeps forbidden modules blocked by role policy', () => {
    const availability = new CanvasModuleAvailabilityService(registry);
    const viewerAccess: AccessContext = {
      activeWorkspace: null,
      roles: ['viewer'],
      permissions: ['canvas.view'],
    };

    const result = availability.evaluate({
      block: mustBlock('case_material_analysis'),
      access: viewerAccess,
    });

    expect(result.availability.status).toBe('blocked_by_role');
    expect(result.availability.reason_code).toBe('ROLE_NOT_ALLOWED');
  });

  it('rejects delivery insertion before a document output exists', () => {
    const compatibility = new CanvasModuleCompatibilityService(registry);

    const result = compatibility.check({
      access,
      workflow: makeWorkflow(),
      block: mustBlock('email_delivery'),
      insert: {
        position: 'after_node',
        source_node_id: 'trigger_manual_start',
        target_node_id: 'end_success',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason_code).toBe('DELIVERY_REQUIRES_DOCUMENT');
    expect(result.missing_requirements[0]?.kind).toBe('step_output');
  });

  it('creates node and replacement edges for workflow-end insertion', () => {
    const factory = new CanvasNodeFactory();
    const workflow = makeWorkflow();

    const result = factory.createFromModule({
      workflow,
      block: mustBlock('case_material_analysis'),
      insert: { position: 'workflow_end' },
    });

    expect(result.node.block_code).toBe('case_material_analysis');
    expect(result.deletedEdgeIds).toEqual([
      'trigger_manual_start:main_output:end_success:main_input',
    ]);
    expect(result.edges).toHaveLength(2);
    expect(result.edges[0]?.source_node_id).toBe('trigger_manual_start');
    expect(result.edges[1]?.target_node_id).toBe('end_success');
  });

  it('auto-binds exact compatible previous outputs', () => {
    const autoBinding = new CanvasAutoBindingService();
    const workflow = workflowWithAnalysisAndDraft();
    const target = workflow.nodes.find(
      (node) => node.id === 'pretrial_claim_draft_1',
    );

    const result = autoBinding.bind({
      workflow,
      node: target!,
      apply: true,
    });

    expect(
      result.bindings.some(
        (binding) =>
          binding.target?.input_key === 'facts' &&
          binding.source.type === 'step_output' &&
          binding.source.node_id === 'case_material_analysis_1' &&
          binding.source.output_key === 'facts',
      ),
    ).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });
});

function mustBlock(code: string) {
  const block = findCanvasBlockDefinition(code);
  if (!block) {
    throw new Error(`Missing Canvas block fixture: ${code}`);
  }
  return block;
}

function nodeFromBlock(code: string, id: string, x: number, y: number) {
  const block = mustBlock(code);
  return createWorkflowNode({
    id,
    type: block.nodeType,
    blockCode: code,
    displayName: block.displayName,
    x,
    y,
  });
}

function makeWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  const trigger = createWorkflowNode({
    id: 'trigger_manual_start',
    type: 'trigger',
    blockCode: 'manual_start',
    displayName: 'Запуск вручную',
    x: 160,
    y: 60,
  });
  const end = createWorkflowNode({
    id: 'end_success',
    type: 'end',
    blockCode: 'end_success',
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

function workflowWithAnalysisAndDraft(): LexFrameWorkflowV2 {
  const base = makeWorkflow();
  const analysis = nodeFromBlock(
    'case_material_analysis',
    'case_material_analysis_1',
    160,
    180,
  );
  const draft = nodeFromBlock(
    'pretrial_claim_draft',
    'pretrial_claim_draft_1',
    160,
    320,
  );

  return {
    ...base,
    nodes: [base.nodes[0]!, analysis, draft, base.nodes[1]!],
    edges: [
      createWorkflowEdge({
        source: 'trigger_manual_start',
        target: analysis.id,
      }),
      createWorkflowEdge({
        source: analysis.id,
        target: draft.id,
      }),
      createWorkflowEdge({
        source: draft.id,
        target: 'end_success',
      }),
    ],
  };
}
