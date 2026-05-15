import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertClickable, assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoDuplicateShellComposers, assertNoOldProjectDashboard } from "./utils/visual-invariants";

const projectId = "project_claim_001";

test.describe("@block2 frontend shell clickability", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block2-click-${Date.now()}@lexframe.local`,
      fullName: "Block2 Clickability",
    });
  });

  test("clicks project workspace tabs and composer controls without old dashboard fragments", async ({
    page,
  }) => {
    await page.goto(`/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await assertNoOldProjectDashboard(page);

    await assertClickable(page.getByRole("tab", { name: "Источники" }), {
      page,
      expected: {
        predicate: async () =>
          page.getByRole("tab", { name: "Источники" }).getAttribute("aria-selected")
            .then((value) => value === "true"),
      },
    });
    await assertClickable(page.getByRole("tab", { name: "Автоматизации" }), {
      page,
      expected: {
        predicate: async () =>
          page.getByRole("tab", { name: "Автоматизации" }).getAttribute("aria-selected")
            .then((value) => value === "true"),
      },
    });

    const addContext = page.getByRole("button", { name: "Добавить контекст" });
    await assertClickable(addContext, {
      page,
      expected: { visible: page.getByTestId("project-plus-menu") },
    });
    await expect(page.getByRole("button", { name: "Добавить фото" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Фото или файлы" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Поиск по сети" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Автоматизации" })).toBeVisible();

    await page.mouse.click(20, 20);
    await assertNoBlockingOverlay(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });

  test("opens sidebar search, tools and creates a project with visible route outcome", async ({
    page,
  }) => {
    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");

    await assertClickable(page.getByRole("button", { name: "Поиск в чатах" }), {
      page,
      expected: { visible: page.locator("#sidebar-chat-search") },
    });
    await page.locator("#sidebar-chat-search").fill("договор");
    await page.keyboard.press("Enter");

    await assertClickable(page.getByRole("button", { name: "Инструменты" }), {
      page,
      expected: { visible: page.getByRole("link", { name: "Коннекторы" }) },
    });
    await expect(page.getByRole("link", { name: "Пульс" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Библиотека актов" })).toBeVisible();

    await page.getByRole("button", { name: "Создать проект" }).click();
    const submit = page.getByRole("button", { name: "Создать проект" }).last();
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder("Например, новый спор").fill(`Block2 ${Date.now()}`);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/app\/projects\/project_/);
    await assertNoDuplicateShellComposers(page);
  });
});
