import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const loadCjsModule = createRequire(__filename);
const {
  invalidFixtures,
  mswFixtures,
  releaseGateMatrix,
  validFixtures,
} = loadCjsModule("../../../packages/canvas-test-fixtures/index.cjs") as {
  validFixtures: readonly { name: string; workflow: { nodes: readonly unknown[] } }[];
  invalidFixtures: readonly {
    name: string;
    expectedValidationCodes: readonly string[];
  }[];
  mswFixtures: {
    endpoints: readonly string[];
    errors: readonly { code: string; status: number }[];
  };
  releaseGateMatrix: readonly { gate: string; blocksOn: readonly string[] }[];
};

test.describe("Canvas v2 release-gate fixtures", () => {
  test("baseline fixture inventory supports Canvas E2E gates", async () => {
    expect(validFixtures.length).toBeGreaterThanOrEqual(20);
    expect(invalidFixtures.length).toBeGreaterThanOrEqual(20);
    expect(releaseGateMatrix.map((item) => item.gate)).toEqual([
      "Contract",
      "Validation",
      "Security",
      "Runtime",
      "E2E",
      "Integrated Readiness",
      "Performance",
      "Manifest",
    ]);
  });

  test("baseline Canvas journey has valid workflow and API fixtures", async () => {
    const baseline = validFixtures.find(
      (fixture) => fixture.name === "approval-before-delivery-workflow",
    );
    expect(baseline?.workflow.nodes.length).toBeGreaterThanOrEqual(5);
    expect(mswFixtures.endpoints).toContain(
      "POST /automations/:id/canvas/compile-preview",
    );
    expect(mswFixtures.errors.map((item) => item.code)).toContain(
      "CANVAS_POLICY_BLOCKED",
    );
  });

  test("release-blocking invalid fixtures use stable WF codes", async () => {
    expect(
      invalidFixtures.every((fixture) =>
        fixture.expectedValidationCodes.every((code) => code.startsWith("WF_")),
      ),
    ).toBe(true);
  });
});
