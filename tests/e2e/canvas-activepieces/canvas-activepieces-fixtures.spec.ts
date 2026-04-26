import { expect, test } from "@playwright/test";

const { runtimeSnapshots } = require(
  "../../../packages/canvas-test-fixtures/index.cjs",
) as {
  runtimeSnapshots: readonly {
    name: string;
    runtimeGraph: { provider: string; nodes: readonly unknown[]; snapshotHash: string };
  }[];
};

test.describe("Canvas v2 Activepieces reverse-sync fixtures", () => {
  test("covers safe import, unknown node and policy-blocked runtime edits", async () => {
    const names = runtimeSnapshots.map((snapshot) => snapshot.name);
    expect(names).toContain("safe-label-change");
    expect(names).toContain("unknown-runtime-node");
    expect(names).toContain("code-step");
    expect(names).toContain("direct-ai-provider");
    expect(names).toContain("approval-removed-before-delivery");
  });

  test("runtime snapshots are Activepieces-bound and hashable", async () => {
    for (const snapshot of runtimeSnapshots) {
      expect(snapshot.runtimeGraph.provider).toBe("activepieces");
      expect(snapshot.runtimeGraph.snapshotHash.length).toBeGreaterThanOrEqual(16);
    }
  });
});
