import type { AutomationBlueprint } from '@lexframe/contracts';
import { AutomationRuntimeDraftService } from './automation-runtime-draft.service';
import { AutomationBlueprintCanvasConverterService } from './automation-blueprint-canvas-converter.service';
import { AutomationBlueprintValidatorService } from './automation-blueprint-validator.service';

describe('AutomationRuntimeDraftService', () => {
  it('returns a degraded state instead of faking Activepieces or MCP success', () => {
    const service = new AutomationRuntimeDraftService(
      new AutomationBlueprintValidatorService(),
      new AutomationBlueprintCanvasConverterService(),
    );

    const result = service.createRuntimeDraft({
      blueprint: {
        id: 'blueprint-1',
        workspaceId: 'workspace-1',
        intentId: 'intent-1',
        version: '1',
        title: 'Draft only',
        summary: 'No AP runtime configured.',
        status: 'approved',
        sourceContext: { items: [], policyDecision: 'reference_only' },
        workflowInputs: [],
        workflowOutputs: [],
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
            id: 'end',
            kind: 'end',
            title: 'End',
            description: 'End.',
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
            targetStepId: 'end',
            kind: 'control',
          },
        ],
        dataBindings: [],
        requiredDocuments: [],
        requiredConnections: [],
        approvalGates: [],
        dataPolicy: {
          highestClassification: 'workspace_internal',
          contextModes: ['reference_only'],
          externalProviderAllowed: false,
          rawSecretMaterialAllowed: false,
        },
        runtimePlan: {
          target: 'activepieces_draft',
          activepieces: { required: true, createDraftAllowed: true },
        },
        testPlan: { scenarios: [] },
        riskReport: { riskLevel: 'low', warnings: [], blocks: [] },
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
          canCreateRuntimeDraft: true,
          canPublish: false,
          canRunProduction: false,
        },
        createdBy: 'user-1',
        createdAt: '2026-05-06T00:00:00.000Z',
        updatedAt: '2026-05-06T00:00:00.000Z',
      } satisfies AutomationBlueprint,
      activepiecesAvailable: false,
      mcpAvailable: false,
    });

    expect(result.status).toBe('runtime_creation_unavailable');
    expect(result.canvasDraft.workflow.schema_version).toBe('2.0');
    expect(result.activepiecesFlowId).toBeNull();
    expect(result.mcpInvocationId).toBeNull();
  });
});
