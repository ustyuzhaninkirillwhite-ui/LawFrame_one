import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

const projectId = "project_claim_001";

test.describe("@block2 keyboard accessibility", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block2-keyboard-${Date.now()}@lexframe.local`,
      fullName: "Block2 Keyboard",
    });
  });

  test("tabs through sidebar actions and closes settings/search with Escape", async ({ page }) => {
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await page.getByRole("button", { name: "Поиск в чатах" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#sidebar-chat-search")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Поиск в чатах" }).click();

    await page.getByTestId("settings-entry-point").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("supports keyboard rename save and cancel on project workspace", async ({ page }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    await page.getByRole("button", { name: /Переименовать проект/ }).click();
    const nameInput = page.getByRole("textbox", { name: "Название проекта" });
    await expect(nameInput).toBeFocused();
    await nameInput.fill("Block2 temporary name");
    await page.keyboard.press("Escape");
    await expect(nameInput).toHaveCount(0);

    await page.getByRole("button", { name: /Переименовать проект/ }).click();
    const secondInput = page.getByRole("textbox", { name: "Название проекта" });
    await secondInput.fill(`Block2 ${Date.now()}`);
    await page.keyboard.press("Enter");
    await expect(secondInput).toHaveCount(0);
  });
});
