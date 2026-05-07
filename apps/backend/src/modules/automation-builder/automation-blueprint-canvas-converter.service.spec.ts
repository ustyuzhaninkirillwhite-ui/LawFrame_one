import type { AutomationBlueprint } from '@lexframe/contracts';
import { AutomationBlueprintCanvasConverterService } from './automation-blueprint-canvas-converter.service';

const blueprint: AutomationBlueprint = {
  id: 'blueprint-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  intentId: 'intent-1',
  version: '1',
  title: 'Contract review process',
  summary: 'Review selected documents and store a result.',
  status: 'approved',
  sourceContext: {
    items: [{ id: 'ctx-1', type: 'selected_document', sourceId: 'docv-1' }],
    policyDecision: 'reference_only',
    contextBudgetTokens: 8000,
  },
  workflowInputs: [
    {
      id: 'input-1',
      key: 'documents',
      label: 'Documents',
      type: 'document[]',
      classification: 'client_material',
      required: true,
    },
  ],
  workflowOutputs: [
    {
      id: 'output-1',
      key: 'review_result',
      label: 'Review result',
      type: 'document',
      classification: 'client_material',
      required: true,
    },
  ],
  steps: [
    {
      id: 'trigger',
      kind: 'trigger',
      title: 'Manual start',
      description: 'Start manually.',
      inputRequirements: [],
      outputDefinitions: [],
      config: {},
      policy: {
        riskLevel: 'low',
        dataClassification: 'workspace_internal',
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: { provider: 'lexframe_canvas' },
    },
    {
      id: 'review',
      kind: 'legal_action',
      moduleCode: 'legal.document_review',
      moduleVersion: '1',
      title: 'Review contract',
      description: 'Extract key legal risks.',
      inputRequirements: [],
      outputDefinitions: [],
      config: {},
      policy: {
        riskLevel: 'medium',
        dataClassification: 'client_material',
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: {
        provider: 'activepieces',
        pieceName: '@lexframe/piece-legal',
        actionName: 'review_document',
      },
    },
    {
      id: 'end',
      kind: 'end',
      title: 'Finish',
      description: 'Finish workflow.',
      inputRequirements: [],
      outputDefinitions: [],
      config: {},
      policy: {
        riskLevel: 'low',
        dataClassification: 'workspace_internal',
        requiresApproval: false,
        externalAction: false,
      },
      runtimeMapping: { provider: 'none' },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      sourceStepId: 'trigger',
      targetStepId: 'review',
      kind: 'control',
    },
    {
      id: 'edge-2',
      sourceStepId: 'review',
      targetStepId: 'end',
      kind: 'control',
    },
  ],
  dataBindings: [],
  requiredDocuments: [],
  requiredConnections: [],
  approvalGates: [],
  dataPolicy: {
    highestClassification: 'client_material',
    contextModes: ['reference_only'],
    externalProviderAllowed: false,
    rawSecretMaterialAllowed: false,
  },
  runtimePlan: {
    target: 'canvas_draft',
    activepieces: { required: false, createDraftAllowed: false },
  },
  testPlan: { scenarios: [] },
  riskReport: { riskLevel: 'medium', warnings: [], blocks: [] },
  clarificationState: { status: 'complete', questions: [] },
  validationSummary: {
    status: 'valid',
    errors: [],
    warnings: [],
    policyBlocks: [],
    affectedSteps: [],
    affectedEdges: [],
    canAskClarification: false,
    canApprove: true,
    canConvertToCanvasDraft: true,
    canCreateRuntimeDraft: false,
    canPublish: false,
    canRunProduction: false,
  },
  createdBy: 'user-1',
  createdAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
};

describe('AutomationBlueprintCanvasConverterService', () => {
  it('creates a LexFrame Workflow DSL v2 draft projection with blueprint lineage', () => {
    const service = new AutomationBlueprintCanvasConverterService();

    const workflow = service.toWorkflowDraft(blueprint, {
      automationId: 'automation-1',
      draftVersionId: 'draft-version-1',
      now: '2026-05-06T00:00:00.000Z',
    });

    expect(workflow.schema_version).toBe('2.0');
    expect(workflow.metadata.title).toBe(blueprint.title);
    expect(workflow.metadata.status).toBe('draft');
    expect(workflow.validation.can_publish).toBe(false);
    expect(workflow.validation.can_run).toBe(false);
    expect(workflow.nodes.map((node) => node.id)).toEqual([
      'trigger',
      'review',
      'end',
    ]);
    expect(workflow.runtime_projection.status).toBe('compile_required');
    expect(workflow.policies).toMatchObject({
      source_blueprint_id: 'blueprint-1',
      source_intent_id: 'intent-1',
    });
  });
});
