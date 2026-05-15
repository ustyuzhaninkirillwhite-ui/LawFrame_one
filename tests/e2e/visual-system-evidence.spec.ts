import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import { installConsoleGuards } from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { takeVisualEvidence } from "./utils/visual";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block5 visual system evidence", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block5-visual-${Date.now()}@lexframe.local`,
      fullName: "Block5 Visual Evidence User",
    });
  });

  test("captures route screenshots without changing visual baselines", async ({
    page,
    request,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await takeVisualEvidence(page, "project-workspace");

    await page.goto("/chat");
    await assertRouteReady(page, "global-chat");
    await takeVisualEvidence(page, "global-chat");

    await page.goto("/documents");
    await assertRouteReady(page, "documents");
    await takeVisualEvidence(page, "documents-root");

    await page.goto("/sources");
    await assertRouteReady(page, "sources");
    await takeVisualEvidence(page, "sources-root");

    await page.goto(`/app/projects/${projectId}/automations`);
    await assertRouteReady(page, "automations");
    await takeVisualEvidence(page, "automations-list");

    const canvas = await openEnsuredAutomationCanvas(page, request, projectId);
    await expect(page).toHaveURL(canvas.route);
    await takeVisualEvidence(page, "automation-canvas-ready-or-unavailable");
  });
});
