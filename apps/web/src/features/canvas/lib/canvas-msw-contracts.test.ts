import { describe, expect, it } from "vitest";
import {
  canvasMswContractEndpoints,
  canvasMswErrorFixtures,
  canvasMswRequiredScenarios,
} from "../fixtures/canvas-msw-contracts";

describe("Canvas MSW contract gate", () => {
  it("covers all required Canvas API surfaces", () => {
    expect(canvasMswContractEndpoints).toContain(
      "GET /automations/:id/canvas",
    );
    expect(canvasMswContractEndpoints).toContain(
      "POST /automations/:id/canvas/operations",
    );
    expect(canvasMswContractEndpoints).toContain(
      "POST /automations/:id/canvas/compile-preview",
    );
    expect(canvasMswContractEndpoints).toContain("POST /activepieces/session");
    expect(canvasMswContractEndpoints).toContain("POST /activepieces/embed-token");
  });

  it("covers release-blocking error shapes", () => {
    expect(canvasMswErrorFixtures.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "CANVAS_PERMISSION_DENIED",
        "CANVAS_DRAFT_LOCKED",
        "CANVAS_VERSION_CONFLICT",
        "CANVAS_VALIDATION_FAILED",
        "CANVAS_POLICY_BLOCKED",
        "ACTIVEPIECES_RUNTIME_UNAVAILABLE",
        "CONNECTION_MISSING",
      ]),
    );
  });

  it("covers baseline Canvas user scenarios", () => {
    expect(canvasMswRequiredScenarios).toEqual(
      expect.arrayContaining([
        "valid draft loads",
        "autosave conflict",
        "publish blocked by validation",
        "compile preview succeeds",
        "automation session degraded by local keys",
        "automation session unavailable",
        "reverse sync conflict",
      ]),
    );
  });
});
