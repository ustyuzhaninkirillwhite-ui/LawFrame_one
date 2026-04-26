import { expect, test } from "@playwright/test";

const { largeFixtures, performanceBudgets } = require(
  "../../../packages/canvas-test-fixtures/index.cjs",
) as {
  largeFixtures: readonly {
    name: string;
    workflow: { nodes: readonly unknown[] };
  }[];
  performanceBudgets: {
    initialLoad25NodesP95Ms: number;
    initialLoad100NodesP95Ms: number;
    operationApplyP95Ms: number;
    validationAfterSmallOperationP95Ms: number;
    autosaveBackendP95Ms: number;
    compilePreview50NodesP95Ms: number;
  };
};

test.describe("Canvas v2 performance fixture gate", () => {
  test("includes 25, 50 and 100-node fixtures", async () => {
    const nodeCounts = largeFixtures.map((fixture) => fixture.workflow.nodes.length);
    expect(nodeCounts.some((count) => count >= 25)).toBe(true);
    expect(nodeCounts.some((count) => count >= 50)).toBe(true);
    expect(nodeCounts.some((count) => count >= 100)).toBe(true);
  });

  test("hard budgets match stage 16.17 release gate", async () => {
    expect(performanceBudgets.initialLoad25NodesP95Ms).toBeLessThanOrEqual(1500);
    expect(performanceBudgets.initialLoad100NodesP95Ms).toBeLessThanOrEqual(3000);
    expect(performanceBudgets.operationApplyP95Ms).toBeLessThanOrEqual(200);
    expect(performanceBudgets.validationAfterSmallOperationP95Ms).toBeLessThanOrEqual(500);
    expect(performanceBudgets.autosaveBackendP95Ms).toBeLessThanOrEqual(1000);
    expect(performanceBudgets.compilePreview50NodesP95Ms).toBeLessThanOrEqual(3000);
  });
});
