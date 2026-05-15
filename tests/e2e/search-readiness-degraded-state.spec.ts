import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

test.describe("@part8 search readiness degraded state", () => {
  test("legal search failure is shown as a controlled degraded state without blocking unrelated routes", async ({
    page,
  }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `part8-search-degraded-${Date.now()}@lexframe.local`,
      fullName: "Part8 Search Degraded",
    });

    await page.route("**/legal-search/query", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SEARCH_UNAVAILABLE",
          message:
            "opensearch.example.internal stack trace token=raw-secret-marker",
        }),
      });
    });

    await page.goto("/research");
    await assertRouteReady(page, "ordinary");

    const failedSearch = page.waitForResponse(
      (response) =>
        response.url().includes("/legal-search/query") &&
        response.status() === 503,
    );
    await page.locator("input").first().fill("Stage14 estoppel degraded probe");
    await failedSearch;

    await expect(page.locator("body")).toContainText(
      /Поиск временно недоступен|Search temporarily unavailable|поиск.*недоступ/i,
    );
    await expect(page.locator("body")).not.toContainText(
      /opensearch\.example\.internal|raw-secret-marker|stack trace/i,
    );

    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");
    await expect(page.locator("body")).not.toContainText(/raw-secret-marker/i);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});
