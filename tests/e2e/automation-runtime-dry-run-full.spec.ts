import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { waitForBuilderSurface } from "./utils/activepieces";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";
import {
  assertRunSuccessOrControlledFailure,
  startDryRun,
  waitForRunTimeline,
} from "./utils/canvas-runtime";
import {
  assertRunEvidenceSafe,
  readRunEvidenceFromApiOrDb,
} from "./utils/run-evidence";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation runtime dry-run", () => {
  test.beforeEach(async ({ page }) => {
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `block4-dry-run-${Date.now()}@lexframe.local`,
      fullName: "Block4 Dry Run User",
    });
  });

  test("starts dry-run only through LexFrame backend and reads safe run evidence", async ({
    page,
    request,
  }) => {
    await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);

    const response = await startDryRun(page);
    const payload = (await response.json().catch(() => null)) as {
      readonly runId?: string;
      readonly status?: string;
      readonly code?: string;
    } | null;

    await waitForRunTimeline(page);
    await assertRunSuccessOrControlledFailure(page);

    if (payload?.runId) {
      const evidence = await readRunEvidenceFromApiOrDb(page, request, payload.runId);
      assertRunEvidenceSafe(evidence);
      expect(JSON.stringify(evidence)).toContain(payload.runId);
    } else if (payload?.code) {
      expect(payload.code).toMatch(/READINESS_GATE_BLOCKED|RUNTIME_MAPPING_MISSING/i);
    }

    await assertNoAutomationBrowserSecrets(page);
  });

  test("disables the dry-run button and prevents duplicate run posts", async ({
    page,
    request,
  }, testInfo) => {
    let releaseRun: () => void = () => undefined;
    const pendingRun = new Promise<void>((resolve) => {
      releaseRun = resolve;
    });
    const runRequests: string[] = [];
    await page.route("**/automations/*/run", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      runRequests.push(route.request().url());
      await pendingRun;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          runId: "run_block4_dry_run_duplicate_guard",
          status: "queued",
          traceId: "trace_block4_dry_run_duplicate_guard",
          externalRunId: null,
          dispatchMode: "simulated",
        }),
      });
    });

    await openEnsuredAutomationCanvas(page, request, projectId);
    await waitForBuilderSurface(page);

    const dryRunButton = page.getByRole("button", { name: /dry-run/i });
    const dryRunElement = await dryRunButton.elementHandle();
    expect(dryRunElement).not.toBeNull();
    await dryRunButton.evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
        button.click();
      }
    });

    await expect
      .poll(() => runRequests.length, { timeout: 10_000 })
      .toBe(1);
    expect(
      await dryRunElement!.evaluate((button) =>
        button instanceof HTMLButtonElement ? button.disabled : false,
      ),
    ).toBe(true);
    await testInfo.attach("dry-run-duplicate-network", {
      body: Buffer.from(`${JSON.stringify({ runRequests }, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });

    releaseRun();
    await expect(page.locator("body")).toContainText(
      /run_block4_dry_run_duplicate_guard|queued/i,
      { timeout: 10_000 },
    );
  });
});
