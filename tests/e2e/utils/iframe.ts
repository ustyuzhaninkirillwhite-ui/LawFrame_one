import { expect, type FrameLocator, type Page } from "@playwright/test";

export async function waitForIframe(page: Page, selector: string): Promise<FrameLocator> {
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 45_000 });
  return page.frameLocator(selector).first();
}

export async function assertIframeDoesNotContain(
  page: Page,
  selector: string,
  forbidden: RegExp,
) {
  const iframe = page.locator(selector).first();
  const handle = await iframe.elementHandle().catch(() => null);
  const frame = await handle?.contentFrame().catch(() => null);
  if (!frame) {
    return;
  }

  await expect(frame.locator("body")).not.toContainText(forbidden);
}
