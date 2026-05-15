import { expect, type Locator, type Page } from "@playwright/test";
import { writeMetricArtifact } from "./evidence";

export interface PerformanceMetricRecord {
  readonly name: string;
  readonly route: string;
  readonly timestamp: string;
  readonly browser: string;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly durationMs: number;
  readonly maxRafDeltaMs: number;
  readonly longFramesOver50ms: number;
  readonly layoutShift: number;
  readonly passedBudget: boolean;
  readonly notes: readonly string[];
}

interface MeasureOptions {
  readonly budgetMs?: number;
  readonly maxLongFramesOver50ms?: number;
  readonly maxLayoutShift?: number;
  readonly settleMs?: number;
  readonly notes?: readonly string[];
}

export async function measureClickToVisible(
  page: Page,
  action: () => Promise<void>,
  expectedLocator: Locator,
  label: string,
  options: MeasureOptions = {},
) {
  return measureInteraction(page, action, expectedLocator, label, {
    budgetMs: 200,
    maxLongFramesOver50ms: 1,
    maxLayoutShift: 0.1,
    ...options,
  });
}

export async function measureRouteChange(
  page: Page,
  action: () => Promise<void>,
  expectedLocator: Locator,
  label: string,
  options: MeasureOptions = {},
) {
  return measureInteraction(page, action, expectedLocator, label, {
    budgetMs: 300,
    maxLongFramesOver50ms: 2,
    maxLayoutShift: 0.1,
    ...options,
  });
}

export async function measureRafJank(
  page: Page,
  action: () => Promise<void>,
  options: { readonly settleMs?: number } = {},
) {
  await startRafProbe(page);
  await action();
  await page.waitForTimeout(options.settleMs ?? 100);
  return stopRafProbe(page);
}

export async function measureLongTasks(
  page: Page,
  action: () => Promise<void>,
) {
  await startLongTaskProbe(page);
  await action();
  await page.waitForTimeout(50);
  return stopLongTaskProbe(page);
}

export async function measureLayoutShift(
  page: Page,
  action: () => Promise<void>,
) {
  await startLayoutShiftProbe(page);
  await action();
  await page.waitForTimeout(50);
  return stopLayoutShiftProbe(page);
}

export { writeMetricArtifact };

async function measureInteraction(
  page: Page,
  action: () => Promise<void>,
  expectedLocator: Locator,
  label: string,
  options: Required<Pick<MeasureOptions, "budgetMs" | "maxLongFramesOver50ms" | "maxLayoutShift">> &
    MeasureOptions,
) {
  await startRafProbe(page);
  await startLongTaskProbe(page);
  await startLayoutShiftProbe(page);

  const startedAt = Date.now();
  await action();
  await expect(expectedLocator).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(options.settleMs ?? 100);
  const durationMs = Date.now() - startedAt;

  const raf = await stopRafProbe(page);
  const longTasks = await stopLongTaskProbe(page);
  const layoutShift = await stopLayoutShiftProbe(page);
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const longFramesOver50ms = raf.deltas.filter((delta) => delta > 50).length;
  const passedBudget =
    durationMs <= options.budgetMs &&
    longFramesOver50ms <= options.maxLongFramesOver50ms &&
    layoutShift.value <= options.maxLayoutShift;
  const record: PerformanceMetricRecord = {
    name: label,
    route: new URL(page.url()).pathname,
    timestamp: new Date().toISOString(),
    browser: page.context().browser()?.browserType().name() ?? "unknown",
    viewport,
    durationMs,
    maxRafDeltaMs: raf.maxDeltaMs,
    longFramesOver50ms,
    layoutShift: layoutShift.value,
    passedBudget,
    notes: [
      ...(options.notes ?? []),
      ...longTasks.entries.map((entry) => `long-task:${Math.round(entry.duration)}ms`),
    ],
  };

  writeMetricArtifact(label, record);
  expect(record.passedBudget, JSON.stringify(record, null, 2)).toBe(true);
  return record;
}

async function startRafProbe(page: Page) {
  await evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfRafProbe?: {
        active: boolean;
        last: number | null;
        deltas: number[];
      };
    };
    target.__lfRafProbe = { active: true, last: null, deltas: [] };
    const tick = (now: number) => {
      const probe = target.__lfRafProbe;
      if (!probe?.active) {
        return;
      }
      if (probe.last !== null) {
        probe.deltas.push(now - probe.last);
      }
      probe.last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

async function stopRafProbe(page: Page) {
  return evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfRafProbe?: {
        active: boolean;
        deltas: number[];
      };
    };
    const deltas = target.__lfRafProbe?.deltas ?? [];
    if (target.__lfRafProbe) {
      target.__lfRafProbe.active = false;
    }
    return {
      deltas,
      maxDeltaMs: deltas.length > 0 ? Math.max(...deltas) : 0,
    };
  }));
}

async function startLongTaskProbe(page: Page) {
  await evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfLongTaskProbe?: {
        entries: Array<{ name: string; startTime: number; duration: number }>;
        startedAt: number;
        observer?: PerformanceObserver;
      };
    };
    const entries: Array<{ name: string; startTime: number; duration: number }> = [];
    const startedAt = performance.now();
    target.__lfLongTaskProbe?.observer?.disconnect();
    target.__lfLongTaskProbe = { entries, startedAt };

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime < startedAt) {
            continue;
          }

          entries.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
      target.__lfLongTaskProbe.observer = observer;
    } catch {
      target.__lfLongTaskProbe.entries = entries;
    }
  }));
}

async function stopLongTaskProbe(page: Page) {
  return evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfLongTaskProbe?: {
        entries: Array<{ name: string; startTime: number; duration: number }>;
        startedAt: number;
        observer?: PerformanceObserver;
      };
    };
    const entries = target.__lfLongTaskProbe?.entries ?? [];
    target.__lfLongTaskProbe?.observer?.disconnect();
    return { entries };
  }));
}

async function startLayoutShiftProbe(page: Page) {
  await evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfLayoutShiftProbe?: {
        value: number;
        observer?: PerformanceObserver;
      };
    };
    target.__lfLayoutShiftProbe?.observer?.disconnect();
    target.__lfLayoutShiftProbe = { value: 0 };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const candidate = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!candidate.hadRecentInput) {
            target.__lfLayoutShiftProbe!.value += candidate.value ?? 0;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
      target.__lfLayoutShiftProbe.observer = observer;
    } catch {
      target.__lfLayoutShiftProbe.value = 0;
    }
  }));
}

async function stopLayoutShiftProbe(page: Page) {
  return evaluateWithNavigationRetry(page, () => page.evaluate(() => {
    const target = window as Window & {
      __lfLayoutShiftProbe?: {
        value: number;
        observer?: PerformanceObserver;
      };
    };
    const value = target.__lfLayoutShiftProbe?.value ?? 0;
    target.__lfLayoutShiftProbe?.observer?.disconnect();
    return { value };
  }));
}

async function evaluateWithNavigationRetry<T>(
  page: Page,
  action: () => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!isNavigationContextError(error) || attempt === 2) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(100);
    }
  }

  throw new Error("Navigation retry loop exhausted.");
}

function isNavigationContextError(error: unknown) {
  return (
    error instanceof Error &&
    /Execution context was destroyed|Cannot find context|navigation/i.test(
      error.message,
    )
  );
}
