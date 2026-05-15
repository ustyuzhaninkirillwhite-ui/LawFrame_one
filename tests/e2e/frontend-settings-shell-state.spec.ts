import { expect, test, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import {
  assertMainReceivesPointerEvents,
  collectNetworkSummary,
  installNetworkSummary,
  measureClickToVisible,
  waitForShellReady,
  withApiDelay,
  withApiFailureOnce,
} from "./utils/shell-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block1 settings shell state", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSummary(page);
  });

  test("opens and closes settings from expanded and collapsed sidebar without leaving a blocking overlay", async ({
    page,
  }, testInfo) => {
    await signInAsDemo(page, {
      email: `block1-settings-${Date.now()}@lexframe.local`,
      fullName: "Block1 Settings",
    });
    await page.goto("/app/projects");
    await waitForShellReady(page);
    await assertRouteReady(page, "ordinary");

    const expandedOpenMs = await measureClickToVisible(
      page,
      () => page.getByTestId("settings-entry-point").click(),
      page.getByRole("dialog"),
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("settings-entry-point")).toBeFocused();
    await assertNoBlockingOverlay(page);
    await assertMainReceivesPointerEvents(page);

    await page
      .getByRole("button", { name: /Свернуть меню|collapse/i })
      .click();
    await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    const collapsedOpenMs = await measureClickToVisible(
      page,
      () => page.getByTestId("settings-entry-point").click(),
      page.getByRole("dialog"),
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await assertNoBlockingOverlay(page);
    await assertMainReceivesPointerEvents(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "settings-dialog-click-metrics", {
      expandedOpenMs,
      collapsedOpenMs,
      network: await collectNetworkSummary(page),
    });
  });

  test("keeps independent shell controls usable while settings bootstrap is delayed and recovers from fail-once", async ({
    page,
  }, testInfo) => {
    const projectsEndpoint = /\/projects(?:\?|$)/;
    await withApiDelay(page, projectsEndpoint, 900);
    await withApiFailureOnce(page, projectsEndpoint, 503, {
      error: {
        code: "PROJECTS_TEMPORARILY_UNAVAILABLE",
        message: "Projects are temporarily unavailable.",
      },
    });

    await signInAsDemo(page, {
      email: `block1-settings-delay-${Date.now()}@lexframe.local`,
      fullName: "Block1 Settings Delay",
    });
    await page.goto(`/app/projects/${projectId}`);
    await waitForShellReady(page);

    await page
      .getByRole("button", { name: /Включить|theme/i })
      .first()
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByTestId("settings-entry-point").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("settings-profile-display-name")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog")).not.toContainText(
      /stack trace|Authorization|Bearer|HTTP 503/i,
    );
    await page.keyboard.press("Escape");
    await assertNoBlockingOverlay(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "settings-delayed-fail-once-network", {
      network: await collectNetworkSummary(page),
    });
  });
});

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
