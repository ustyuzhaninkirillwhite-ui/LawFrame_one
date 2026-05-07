import type { AutomationBlueprint } from '@lexframe/contracts';
import { AutomationBlueprintValidatorService } from './automation-blueprint-validator.service';

const baseBlueprint: AutomationBlueprint = {
  id: 'blueprint-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  intentId: 'intent-1',
  version: '1',
  title: 'Claims intake',
  summary: 'Collect documents, analyze them, and store a result.',
  status: 'draft',
  sourceContext: {
    items: [],
    policyDecision: 'reference_only',
    contextBudgetTokens: 8000,
  },
  workflowInputs: [],
  workflowOutputs: [
    {
      id: 'output-1',
      key: 'analysis',
      label: 'Analysis',
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
      description: 'Start by user confirmation.',
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
      id: 'analyze',
      kind: 'legal_action',
      moduleCode: 'legal.document_review',
      moduleVersion: '1',
      title: 'Analyze documents',
      description: 'Review selected case documents.',
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
      title: 'Store result',
      description: 'Finish draft workflow.',
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
      targetStepId: 'analyze',
      kind: 'control',
    },
    {
      id: 'edge-2',
      sourceStepId: 'analyze',
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

describe('AutomationBlueprintValidatorService', () => {
  it('blocks external delivery without an approval gate and never enables publish or production run', () => {
    const service = new AutomationBlueprintValidatorService();
    const blueprint: AutomationBlueprint = {
      ...baseBlueprint,
      steps: [
        ...baseBlueprint.steps,
        {
          id: 'deliver',
          kind: 'delivery',
          title: 'Send result',
          description: 'External email delivery.',
          inputRequirements: [],
          outputDefinitions: [],
          config: {},
          policy: {
            riskLevel: 'high',
            dataClassification: 'client_material',
            requiresApproval: true,
            externalAction: true,
          },
          runtimeMapping: {
            provider: 'activepieces',
            pieceName: '@lexframe/piece-delivery',
            actionName: 'send_email',
          },
        },
      ],
      edges: [
        ...baseBlueprint.edges,
        {
          id: 'edge-3',
          sourceStepId: 'analyze',
          targetStepId: 'deliver',
          kind: 'control',
        },
      ],
    };

    const result = service.validate(blueprint);

    expect(result.status).toBe('policy_blocked');
    expect(result.policyBlocks.map((issue) => issue.code)).toContain(
      'external_delivery_requires_approval_gate',
    );
    expect(result.canApprove).toBe(false);
    expect(result.canPublish).toBe(false);
    expect(result.canRunProduction).toBe(false);
  });

  it('rejects unapproved Activepieces pieces proposed by AI', () => {
    const service = new AutomationBlueprintValidatorService();
    const blueprint: AutomationBlueprint = {
      ...baseBlueprint,
      steps: baseBlueprint.steps.map((step) =>
        step.id === 'analyze'
          ? {
              ...step,
              runtimeMapping: {
                provider: 'activepieces',
                pieceName: '@activepieces/piece-openai',
                actionName: 'chat_completion',
              },
            }
          : step,
      ),
    };

    const result = service.validate(blueprint);

    expect(result.status).toBe('policy_blocked');
    expect(result.policyBlocks.map((issue) => issue.code)).toContain(
      'activepieces_piece_not_allowed',
    );
  });
});
