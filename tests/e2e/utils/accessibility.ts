import { expect, type Locator, type Page } from "@playwright/test";

export async function assertKeyboardReachable(
  page: Page,
  locator: Locator,
  options: { readonly maxTabs?: number } = {},
) {
  await expect(locator).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Home").catch(() => undefined);
  await page.locator("body").focus();

  for (let index = 0; index < (options.maxTabs ?? 40); index += 1) {
    if (await isFocused(locator)) {
      return;
    }
    await page.keyboard.press("Tab");
  }

  expect(await isFocused(locator)).toBe(true);
}

export async function assertFocusVisible(page: Page, locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const focusStyle = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
    };
  });

  expect(
    focusStyle.outlineStyle !== "none" ||
      focusStyle.outlineWidth !== "0px" ||
      focusStyle.boxShadow !== "none",
    JSON.stringify(focusStyle),
  ).toBe(true);
  await page.keyboard.press("Tab").catch(() => undefined);
}

async function isFocused(locator: Locator) {
  return locator
    .evaluate((element) => element === document.activeElement)
    .catch(() => false);
}
