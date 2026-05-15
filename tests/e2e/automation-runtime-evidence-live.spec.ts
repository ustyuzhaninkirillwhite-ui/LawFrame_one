import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { waitForBuilderSurface } from "./utils/activepieces";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import { startDryRun, waitForRunTimeline } from "./utils/canvas-runtime";
import {
  assertRunEvidenceSafe,
  readRunEvidenceFromApiOrDb,
} from "./utils/run-evidence";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation runtime evidence live", () => {
  test("dry-run creates retrievable redacted LexFrame run evidence", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `block4-evidence-${Date.now()}@lexframe.local`,
      fullName: "Block4 Evidence User",
    });
    await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);

    const response = await startDryRun(page);
    const payload = await response.json();
    expect(payload.runId).toBeTruthy();
    await waitForRunTimeline(page);

    const evidence = await readRunEvidenceFromApiOrDb(page, request, payload.runId);
    assertRunEvidenceSafe(evidence);
    expect(JSON.stringify(evidence)).toContain(payload.runId);
    expect(JSON.stringify(evidence)).toContain(payload.traceId);
  });
});
