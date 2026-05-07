import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const loadCjsModule = createRequire(__filename);
const { invalidFixtures, runtimeSnapshots } = loadCjsModule(
  "../../../packages/canvas-test-fixtures/index.cjs",
) as {
  invalidFixtures: readonly {
    name: string;
    expectedValidationCodes: readonly string[];
  }[];
  runtimeSnapshots: readonly { name: string }[];
};

test.describe("Canvas v2 security release fixtures", () => {
  test("security gate covers secrets, cross-workspace, delivery and direct AI", async () => {
    const codes = invalidFixtures.flatMap(
      (fixture) => fixture.expectedValidationCodes,
    );
    expect(codes).toContain("WF_POLICY_005_SECRET_VALUE_IN_CONFIG");
    expect(codes).toContain("WF_POLICY_004_CROSS_WORKSPACE_REFERENCE");
    expect(codes).toContain("WF_POLICY_002_EXTERNAL_DELIVERY_APPROVAL_REQUIRED");
    expect(codes).toContain("WF_POLICY_011_DIRECT_AI_PROVIDER_FORBIDDEN");
  });

  test("reverse-sync security fixtures block unsafe runtime edits", async () => {
    expect(runtimeSnapshots.map((snapshot) => snapshot.name)).toEqual(
      expect.arrayContaining([
        "raw-http",
        "direct-ai-provider",
        "approval-removed-before-delivery",
      ]),
    );
  });
});
