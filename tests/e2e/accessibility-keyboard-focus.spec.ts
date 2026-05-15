import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertFocusVisible, assertKeyboardReachable } from "./utils/accessibility";
import { installConsoleGuards } from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block5 accessibility keyboard and focus", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block5-a11y-${Date.now()}@lexframe.local`,
      fullName: "Block5 Accessibility User",
    });
  });

  test("keeps sidebar, settings, tabs and composer keyboard reachable", async ({
    page,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    const settings = page.getByTestId("settings-entry-point").first();
    await assertKeyboardReachable(page, settings, { maxTabs: 60 });
    await assertFocusVisible(page, settings);
    await settings.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const firstTab = page.getByRole("tab").first();
    await assertKeyboardReachable(page, firstTab, { maxTabs: 80 });
    await assertFocusVisible(page, firstTab);

    const composer = page.getByRole("textbox").first();
    await composer.focus();
    await expect(composer).toBeFocused();
  });
});
