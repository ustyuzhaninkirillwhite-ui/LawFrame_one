import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertClickable } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoSecretsInBrowserStorage } from "./utils/storage";

test.describe("@block2 sidebar and settings", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block2-settings-${Date.now()}@lexframe.local`,
      fullName: "Block2 Settings",
    });
  });

  test("opens settings from expanded and collapsed sidebar, switches tabs and keeps keys write-only", async ({
    page,
  }) => {
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    await assertClickable(page.getByTestId("settings-entry-point").first(), {
      page,
      expected: { visible: page.getByRole("dialog") },
      keyboardReachable: true,
    });
    await assertRouteReady(page, "settings");
    await page.getByTestId("settings-tab-organization").click();
    await expect(page.getByTestId("settings-organization-display-name")).toBeVisible();
    await page.getByTestId("settings-tab-ai").click();
    await expect(page.locator("body")).toContainText(/AI|Gateway|model/i);

    const apiKey = `sk-block2-${Date.now()}-not-a-real-key`;
    const replaceKey = page.getByRole("button", { name: "Заменить ключ" }).first();
    if (await replaceKey.isVisible().catch(() => false)) {
      await replaceKey.click();
    }
    const keyInput = page.getByLabel(/API key/i).first();
    await keyInput.fill(apiKey);
    await expect(page.locator("body")).not.toContainText(apiKey);
    await keyInput.fill("");
    await assertNoSecretsInBrowserStorage(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Свернуть меню" }).click();
    await assertClickable(page.getByTestId("settings-entry-point").first(), {
      page,
      expected: { visible: page.getByRole("dialog") },
      keyboardReachable: true,
    });
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("theme toggle and sign out remain reachable without signing out", async ({ page }) => {
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    const themeToggle = page
      .getByRole("button", { name: /Включить (тёмную|светлую) тему/ })
      .first();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await themeToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Выйти" }).first()).toBeVisible();
  });
});
