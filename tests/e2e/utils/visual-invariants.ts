import { expect, type Page } from "@playwright/test";

const oldProjectDashboardFragments = [
  "Последние материалы",
  "Глубокое",
  "Прикрепить автоматизацию",
  "Активный проект",
  "0 чатов / 1 автоматизаций",
];

export async function scanVisibleText(
  page: Page,
  forbiddenTexts: readonly (RegExp | string)[],
) {
  const body = page.locator("body");
  for (const text of forbiddenTexts) {
    await expect(body).not.toContainText(text);
  }
}

export async function assertBodyNotScrollableWhenRouteRequiresHScreen(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollHeight: document.body.scrollHeight,
    documentScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));

  expect(
    Math.max(metrics.bodyScrollHeight, metrics.documentScrollHeight),
    JSON.stringify(metrics),
  ).toBeLessThanOrEqual(metrics.viewportHeight + 8);
}

export async function assertNoOldProjectDashboard(page: Page) {
  await scanVisibleText(page, oldProjectDashboardFragments);
}

export async function assertNoDuplicateShellComposers(page: Page) {
  const visibleFloatingComposers = await page
    .getByTestId("floating-ai-composer")
    .filter({ visible: true })
    .count();
  const visibleChatComposers = await page
    .getByTestId("chat-composer-input")
    .filter({ visible: true })
    .count();

  expect(visibleFloatingComposers).toBeLessThanOrEqual(1);
  expect(visibleChatComposers).toBeLessThanOrEqual(1);
  expect(visibleFloatingComposers + visibleChatComposers).toBeLessThanOrEqual(1);
}
