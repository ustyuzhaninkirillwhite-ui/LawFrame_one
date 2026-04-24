import { describe, expect, it } from "vitest";
import {
  isAutomationCanvasRoute,
  isProjectWorkspaceRoute,
} from "./automation-canvas-route";

describe("isAutomationCanvasRoute", () => {
  it("matches only project automation index routes", () => {
    expect(isAutomationCanvasRoute("/app/projects/project_claim_001/automations")).toBe(true);
    expect(isAutomationCanvasRoute("/app/projects/project_claim_001/automations/")).toBe(true);

    expect(isAutomationCanvasRoute("/app/projects/project_claim_001/automations/automation_001")).toBe(
      false,
    );
    expect(
      isAutomationCanvasRoute(
        "/app/projects/project_claim_001/automations/automation_001/advanced-builder",
      ),
    ).toBe(false);
    expect(isAutomationCanvasRoute("/app")).toBe(false);
    expect(isAutomationCanvasRoute("/automations")).toBe(false);
  });
});

describe("isProjectWorkspaceRoute", () => {
  it("matches only project workspace index routes", () => {
    expect(isProjectWorkspaceRoute("/app/projects/project_claim_001")).toBe(true);
    expect(isProjectWorkspaceRoute("/app/projects/project_claim_001/")).toBe(true);

    expect(isProjectWorkspaceRoute("/app/projects/project_claim_001/automations")).toBe(false);
    expect(isProjectWorkspaceRoute("/app/projects/project_claim_001/chats/chat_1")).toBe(false);
    expect(isProjectWorkspaceRoute("/app")).toBe(false);
  });
});
