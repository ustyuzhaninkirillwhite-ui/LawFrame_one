import { expect, type Locator, type Page } from "@playwright/test";
import { assertNoBlockingOverlay } from "./clickability";
import { measureClickToVisible } from "./performance";

export { assertNoBlockingOverlay };

export async function measureAnimationCompletion(
  page: Page,
  action: () => Promise<void>,
  expectedState: Locator,
) {
  return measureClickToVisible(page, action, expectedState, "animation-completion", {
    budgetMs: 300,
    notes: ["animation completion"],
  });
}

export async function assertNoInfiniteSpinner(page: Page, timeout = 10_000) {
  await page.waitForTimeout(timeout);
  const visibleSpinners = await page
    .locator(
      [
        "[aria-busy='true']",
        "[data-testid*='spinner']",
        "[data-testid*='loading']",
        ".animate-spin",
      ].join(","),
    )
    .filter({ visible: true })
    .count();

  expect(visibleSpinners).toBe(0);
}

export async function assertReducedMotion(
  page: Page,
  scenario: () => Promise<void>,
) {
  const reduced = await page.evaluate(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduced).toBe(true);

  await scenario();
  await assertNoBlockingOverlay(page);
  const infiniteRunningAnimations = await page.evaluate(() =>
    (document as Document & {
      getAnimations(options?: { subtree?: boolean }): Animation[];
    })
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running")
      .filter((animation) => {
        const timing = animation.effect?.getTiming();
        return timing?.iterations === Infinity || timing?.duration === Infinity;
      }).length,
  );
  expect(infiniteRunningAnimations).toBe(0);
}
