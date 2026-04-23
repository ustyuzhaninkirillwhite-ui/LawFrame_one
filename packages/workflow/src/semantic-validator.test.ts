import { describe, expect, it } from "vitest";
import {
  invalidWorkflowExample,
  validWorkflowExample,
  validWorkflowPatchExample,
} from "./examples";
import {
  applyWorkflowPatch,
  compileRuntimePlanPreview,
  createWorkflowPolicyReport,
  createWorkflowValidationReport,
  generateWorkflowPatchDiff,
  validateWorkflowDefinition,
  validateWorkflowPatch,
} from "./semantic-validator";

describe("validateWorkflowDefinition", () => {
  it("accepts the valid example", () => {
    const result = validateWorkflowDefinition(validWorkflowExample);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects the invalid example", () => {
    const result = validateWorkflowDefinition(invalidWorkflowExample);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("Unknown moduleCode: workflow.external-notify");
    expect(result.issues).toContain("Missing dependency target: missing-step");
    expect(result.issues).toContain("External delivery step must require approval: unsafe-delivery");
  });

  it("creates structured validation and policy reports", () => {
    const report = createWorkflowValidationReport(validWorkflowExample);
    const policy = createWorkflowPolicyReport(validWorkflowExample, {
      dataClass: "C_CONFIDENTIAL_CLIENT",
    });

    expect(report.valid).toBe(true);
    expect(policy.valid).toBe(true);
    expect(policy.providerRoute).toBe("xai_zdr");
  });

  it("builds runtime preview with missing connections", () => {
    const preview = compileRuntimePlanPreview(validWorkflowExample, {
      availableConnections: [],
    });

    expect(preview.runnable).toBe(false);
    expect(preview.missingRuntimeBindings).toHaveLength(1);
    expect(preview.missingRuntimeBindings[0]?.requiredConnection).toBe("gmail");
  });

  it("validates and applies a workflow patch", () => {
    const validation = validateWorkflowPatch(
      validWorkflowPatchExample,
      validWorkflowExample,
    );
    const nextWorkflow = applyWorkflowPatch(
      validWorkflowExample,
      validWorkflowPatchExample,
    );
    const diff = generateWorkflowPatchDiff(
      validWorkflowExample,
      validWorkflowPatchExample,
    );

    expect(validation.ok).toBe(true);
    expect(nextWorkflow.steps.some((step) => step.stepId === "limitation-check")).toBe(true);
    expect(diff.addedSteps).toContain("Проверка давности");
  });
});
