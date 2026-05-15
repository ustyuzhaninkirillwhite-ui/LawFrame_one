import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { openEnsuredAutomationCanvas } from "./utils/automation";
import { writeBrowserSecurityScanArtifact } from "./utils/browser-security";
import { assertClickable } from "./utils/clickability";
import { assertNoConsoleErrors, installConsoleGuards } from "./utils/console";
import { writeJsonArtifact } from "./utils/evidence";
import { assertRouteReady } from "./utils/navigation";
import { measureClickToVisible } from "./utils/performance";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block5 system release gate smoke", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block5-gate-${Date.now()}@lexframe.local`,
      fullName: "Block5 Gate User",
    });
  });

  test("covers one clickability, chat, automation, performance and security smoke path", async ({
    page,
    request,
  }) => {
    const failedRequests: string[] = [];
    page.on("requestfailed", (browserRequest) => {
      const failureText = browserRequest.failure()?.errorText ?? "";
      if (/net::ERR_ABORTED|NS_BINDING_ABORTED/i.test(failureText)) {
        return;
      }

      failedRequests.push(
        `${browserRequest.method()} ${browserRequest.url()} ${failureText}`.trim(),
      );
    });

    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    await assertClickable(page.getByTestId("settings-entry-point").first(), {
      page,
      keyboardReachable: true,
      expected: { visible: page.getByRole("dialog") },
    });
    await page.keyboard.press("Escape");

    await page.goto("/chat");
    await assertRouteReady(page, "global-chat");
    await expect(page.getByTestId("chat-composer-input")).toBeVisible();

    await openEnsuredAutomationCanvas(page, request, projectId);
    await assertRouteReady(page, "automation-canvas");

    await page.goto(`/app/projects/${projectId}`);
    await measureClickToVisible(
      page,
      () =>
        page
          .getByRole("button", {
            name: /Добавить контекст|add context/i,
          })
          .click(),
      page.getByTestId("project-plus-menu"),
      "system-gate-performance-smoke",
      { budgetMs: 600, settleMs: 0 },
    );
    await writeBrowserSecurityScanArtifact(page);
    await page.goto("/chat");
    await assertRouteReady(page, "global-chat");
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    writeJsonArtifact("block5-release-gate", "complete-frontend-journey-network", {
      generatedAt: new Date().toISOString(),
      failedRequests,
    });
    expect(failedRequests).toEqual([]);
  });
});
