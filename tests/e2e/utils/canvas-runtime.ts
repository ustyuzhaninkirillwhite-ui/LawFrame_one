import { expect, type Page } from "@playwright/test";

export async function startDryRun(page: Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/automations\/[^/]+\/run$/.test(new URL(response.url()).pathname),
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /dry-run/i }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBeLessThan(500);
  return response;
}

export async function waitForRunTimeline(page: Page) {
  await expect(page.locator("body")).toContainText(/run_|queued|running|completed|failed|dry-run/i, {
    timeout: 30_000,
  });
}

export async function assertRunControlledFailure(page: Page, code: string) {
  await expect(page.locator("body")).toContainText(new RegExp(code, "i"), {
    timeout: 30_000,
  });
  await expect(page.locator("body")).not.toContainText(/stack trace|TypeError|Unhandled/i);
}

export async function assertRunSuccessOrControlledFailure(page: Page) {
  await expect(page.locator("body")).toContainText(
    /run_|queued|running|completed|failed|RUNTIME_MAPPING_MISSING|READINESS_GATE_BLOCKED/i,
    { timeout: 30_000 },
  );
  await expect(page.locator("body")).not.toContainText(/Unhandled|stack trace/i);
}
