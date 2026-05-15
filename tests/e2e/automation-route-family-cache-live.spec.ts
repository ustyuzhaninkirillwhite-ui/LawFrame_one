import { expect, test, type Request } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertRouteFamilyTokenRetention,
  assertTokensClearedAfterLeavingAutomationFamily,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas } from "./utils/automation";
import { openProjectTab } from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation route family cache live", () => {
  test("back forward keeps settled automation family stable and clears token outside", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, {
      email: `block4-route-family-${Date.now()}@lexframe.local`,
      fullName: "Block4 Route Family User",
    });
    const sessionRequests: string[] = [];
    page.on("request", (candidate: Request) => {
      if (
        candidate.method() === "POST" &&
        new URL(candidate.url()).pathname === "/activepieces/session"
      ) {
        sessionRequests.push(candidate.url());
      }
    });
    const canvas = await ensureAutomationCanvas(page, request, projectId);

    await page.goto(`/app/projects/${projectId}`);
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 20_000,
    });
    await openProjectTab(page, "automations");
    const automationLink = page.locator(`a[href="${canvas.route}"]`).first();
    await expect(automationLink).toBeVisible({ timeout: 30_000 });
    await automationLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/automations/${canvas.automation_id}/automation`),
    );
    await waitForBuilderSurface(page);
    await assertRouteFamilyTokenRetention(page);
    const firstOpenRequests = sessionRequests.length;

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}(?:[?#].*)?$`));
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 20_000,
    });
    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/automations/${canvas.automation_id}/automation`),
    );
    await waitForBuilderSurface(page);
    expect(sessionRequests.length - firstOpenRequests).toBeLessThanOrEqual(2);

    await page.goto("/chat");
    await assertTokensClearedAfterLeavingAutomationFamily(page);
    await testInfo.attach("automation-route-family-session-requests", {
      body: Buffer.from(
        `${JSON.stringify({ sessionRequests }, null, 2)}\n`,
        "utf8",
      ),
      contentType: "application/json",
    });
  });
});
