import { expect, test, type Response } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { waitForBuilderSurface } from "./utils/activepieces";
import { ensureAutomationCanvas } from "./utils/automation";
import { createProjectViaApi } from "./utils/project-workspace-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation cross-scope access", () => {
  test("mismatched projectId and automationId does not issue a ready AP session", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `block4-cross-scope-${Date.now()}@lexframe.local`,
      fullName: "Block4 Cross Scope User",
    });
    const canvas = await ensureAutomationCanvas(page, request, projectId);
    const otherProjectId = await createProjectViaApi(
      page,
      request,
      `Block4 cross scope ${Date.now()}`,
    );
    const sessionResponses: Response[] = [];
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        response.url().includes("/activepieces/session")
      ) {
        sessionResponses.push(response);
      }
    });

    await page.goto(
      `/app/projects/${otherProjectId}/automations/${canvas.automation_id}/automation`,
    );
    await waitForBuilderSurface(page);

    await expect(page.getByTestId("builder-unavailable-state")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("body")).not.toContainText(
      /activepieces login|sign in to activepieces|BEGIN PRIVATE KEY|AP_JWT_SECRET|service_role|stack trace/i,
    );
    for (const response of sessionResponses) {
      expect(response.status()).not.toBe(200);
    }
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
