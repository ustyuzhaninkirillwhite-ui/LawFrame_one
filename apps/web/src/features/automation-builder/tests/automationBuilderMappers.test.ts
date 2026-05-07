import { describe, expect, it } from "vitest";
import { deriveAutomationBuilderStage, hasBlockingReadiness } from "../domain/automationBuilderMappers";

describe("automation builder mappers", () => {
  it("keeps publish/run out of readiness-derived frontend state", () => {
    expect(
      hasBlockingReadiness({
        status: "degraded",
        checks: {
          runtime_draft_creation: {
            status: "not_configured",
            reason: "AP unavailable in mock mode",
          },
          direct_provider_call_scan: {
            status: "pass",
            reason: "no direct provider calls",
          },
        },
      }),
    ).toBe(false);
  });

  it("derives clarification stage from blueprint questions", () => {
    expect(
      deriveAutomationBuilderStage({
        intent: {
          id: "intent_1",
          workspaceId: "workspace_1",
          projectId: "project_1",
          source: "automation_builder_page",
          userGoal: "review contract",
          status: "blueprint_ready",
          classification: "workspace_internal",
          createdBy: "user_1",
          createdAt: "2026-05-06T00:00:00.000Z",
          updatedAt: "2026-05-06T00:00:00.000Z",
        },
        blueprint: {
          id: "blueprint_1",
          workspaceId: "workspace_1",
          projectId: "project_1",
          intentId: "intent_1",
          version: "1",
          title: "Review",
          summary: "Review",
          status: "needs_clarification",
          sourceContext: { items: [], policyDecision: "reference_only" },
          workflowInputs: [],
          workflowOutputs: [],
          steps: [],
          edges: [],
          dataBindings: [],
          requiredDocuments: [],
          requiredConnections: [],
          approvalGates: [],
          dataPolicy: {
            highestClassification: "workspace_internal",
            contextModes: ["reference_only"],
            externalProviderAllowed: false,
            rawSecretMaterialAllowed: false,
          },
          runtimePlan: { target: "canvas_draft" },
          testPlan: { scenarios: [] },
          riskReport: { riskLevel: "low", warnings: [], blocks: [] },
          clarificationState: {
            status: "needs_answers",
            questions: [
              {
                id: "q1",
                intentId: "intent_1",
                kind: "missing_goal",
                question: "What should be drafted?",
                required: true,
                answerType: "text",
                createdAt: "2026-05-06T00:00:00.000Z",
              },
            ],
          },
          validationSummary: {
            status: "invalid",
            errors: [],
            warnings: [],
            policyBlocks: [],
            affectedSteps: [],
            affectedEdges: [],
            canAskClarification: true,
            canApprove: false,
            canConvertToCanvasDraft: false,
            canCreateRuntimeDraft: false,
            canPublish: false,
            canRunProduction: false,
          },
          createdBy: "user_1",
          createdAt: "2026-05-06T00:00:00.000Z",
          updatedAt: "2026-05-06T00:00:00.000Z",
        },
        runtimeCreated: false,
        canvasCreated: false,
      }),
    ).toBe("clarification");
  });
});
