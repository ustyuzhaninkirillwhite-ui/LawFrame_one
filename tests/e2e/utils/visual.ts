import { expect, type Page } from "@playwright/test";
import { takeEvidenceScreenshot } from "./evidence";

export async function takeVisualEvidence(page: Page, name: string) {
  await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  await assertNoHorizontalScroll(page);
  return takeEvidenceScreenshot(page, name);
}

export async function assertNoHorizontalScroll(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    Math.max(metrics.documentScrollWidth, metrics.bodyScrollWidth),
    JSON.stringify(metrics),
  ).toBeLessThanOrEqual(metrics.viewportWidth + 8);
}
