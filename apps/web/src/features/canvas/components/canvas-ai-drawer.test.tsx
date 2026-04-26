import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasAiDrawer } from "./canvas-drawers";

vi.mock("../hooks/use-canvas-data", () => ({
  useCanvasAiExplain: () => mutationMock(),
  useCanvasAiPatchApply: () => mutationMock(),
  useCanvasAiPatchProposal: () => mutationMock(),
  useCanvasAiPatchReject: () => mutationMock(),
  useCanvasAiTestPlan: () => mutationMock(),
}));

describe("CanvasAiDrawer", () => {
  it("disables patch proposal for explain-only viewers", () => {
    render(
      <CanvasAiDrawer
        automationId="automation_1"
        workflowHash="hash_1"
        selectedNodeId={null}
        readOnly
        lockStatus="unlocked"
        permissions={{
          can_view: true,
          can_edit: false,
          can_publish: false,
          can_test: false,
          can_open_advanced_builder: false,
          can_debug: false,
          can_ai_explain: true,
          can_ai_propose_patch: false,
          can_ai_apply_patch: false,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /Explain/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Propose patch/i })).toBeDisabled();
  });
});

function mutationMock() {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
  };
}
