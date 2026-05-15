import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoInfiniteSpinner, assertReducedMotion } from "./utils/animation";
import { installConsoleGuards } from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block5 reduced motion behavior", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signInAsDemo(page, {
      email: `block5-reduced-${Date.now()}@lexframe.local`,
      fullName: "Block5 Reduced Motion User",
    });
  });

  test("keeps core controls usable without relying on animation timing", async ({
    page,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    await assertReducedMotion(page, async () => {
      await page.getByTestId("settings-entry-point").first().click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    await assertReducedMotion(page, async () => {
      await page
        .getByRole("button", {
          name: /Свернуть меню|collapse menu/i,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: /Развернуть меню|open menu|expand menu/i,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: /Развернуть меню|open menu|expand menu/i,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: /Свернуть меню|collapse menu/i,
        }),
      ).toBeVisible();
    });

    await assertReducedMotion(page, async () => {
      const tabs = page.getByRole("tab");
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await tabs.nth(0).click();
      await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    });

    await assertReducedMotion(page, async () => {
      await page
        .getByRole("button", {
          name: /Добавить контекст|add context/i,
        })
        .click();
      await expect(page.getByTestId("project-plus-menu")).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await assertNoInfiniteSpinner(page, 500);
  });
});
