import { expect, type Locator, type Page, type Request } from "@playwright/test";

interface ClickExpected {
  readonly url?: RegExp | string;
  readonly visible?: Locator;
  readonly hidden?: Locator;
  readonly requestUrl?: RegExp | string;
  readonly predicate?: () => Promise<boolean>;
}

interface AssertClickableOptions {
  readonly page?: Page;
  readonly enabled?: boolean;
  readonly keyboardReachable?: boolean;
  readonly timeout?: number;
  readonly expected?: ClickExpected;
}

export async function assertClickable(
  locator: Locator,
  options: AssertClickableOptions = {},
) {
  const timeout = options.timeout ?? 10_000;
  await expect(locator).toHaveCount(1, { timeout });
  await expect(locator).toBeVisible({ timeout });

  if (options.enabled === false) {
    await expect(locator).toBeDisabled({ timeout });
    return;
  }

  await expect(locator).toBeEnabled({ timeout });

  if (options.page) {
    await assertReceivesPointerEvents(options.page, locator);
  }

  if (options.keyboardReachable) {
    await locator.focus();
    await expect(locator).toBeFocused({ timeout });
  }

  if (options.expected) {
    const page = options.page;
    if (!page) {
      throw new Error("assertClickable expected outcomes require a page.");
    }
    await measureClickOutcome(page, () => locator.click(), options.expected);
    return;
  }

  await locator.click();
}

export async function assertReceivesPointerEvents(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const result = await locator.evaluate(
    (element, point) => {
      const x = point.x + point.width / 2;
      const y = point.y + point.height / 2;
      const target = document.elementFromPoint(x, y);
      const style = window.getComputedStyle(element);

      return {
        receivesPointerEvents:
          style.pointerEvents !== "none" &&
          Boolean(target && (element === target || element.contains(target))),
        targetTag: target?.tagName ?? null,
        targetTestId: target?.getAttribute("data-testid") ?? null,
      };
    },
    box!,
  );

  expect(result.receivesPointerEvents, JSON.stringify(result)).toBe(true);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

export async function assertNoBlockingOverlay(page: Page) {
  const blockers = await page.evaluate(() => {
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const element = document.elementFromPoint(viewportCenter.x, viewportCenter.y);
    const blockingSelectors = [
      "[aria-modal='true']",
      "[role='dialog']",
      "[data-testid='project-plus-menu']",
      "[data-radix-popper-content-wrapper]",
    ];

    if (!element) {
      return [];
    }

    return blockingSelectors
      .map((selector) => element.closest(selector))
      .filter((candidate): candidate is Element => Boolean(candidate))
      .map((candidate) => ({
        selector: blockingSelectors.find((selector) => candidate.matches(selector)),
        text: candidate.textContent?.trim().slice(0, 120) ?? "",
      }));
  });

  expect(blockers).toEqual([]);
}

export async function measureClickOutcome(
  page: Page,
  action: () => Promise<void>,
  expected: ClickExpected,
) {
  const requestPromise = expected.requestUrl
    ? page.waitForRequest(
        (request) => matches(request.url(), expected.requestUrl!),
        { timeout: 10_000 },
      )
    : null;

  await action();

  if (expected.url) {
    await expect(page).toHaveURL(expected.url);
  }
  if (expected.visible) {
    await expect(expected.visible).toBeVisible({ timeout: 10_000 });
  }
  if (expected.hidden) {
    await expect(expected.hidden).toBeHidden({ timeout: 10_000 });
  }
  if (requestPromise) {
    const request: Request = await requestPromise;
    expect(request.url()).toBeTruthy();
  }
  if (expected.predicate) {
    await expect.poll(expected.predicate, { timeout: 10_000 }).toBe(true);
  }
}

function matches(value: string, expected: RegExp | string) {
  return typeof expected === "string" ? value.includes(expected) : expected.test(value);
}
