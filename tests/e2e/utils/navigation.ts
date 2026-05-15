import { expect, type Page } from "@playwright/test";

export type RouteKind =
  | "ordinary"
  | "project-workspace"
  | "project-chat"
  | "global-chat"
  | "settings"
  | "documents"
  | "sources"
  | "automations"
  | "automation-canvas";

export async function waitForStableLayout(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

export async function assertRouteReady(page: Page, routeKind: RouteKind) {
  await waitForStableLayout(page);
  await expect(page.locator("body")).toBeVisible();

  if (routeKind === "ordinary") {
    await expect(page.getByTestId("app-shell-panel")).toBeVisible({ timeout: 15_000 });
    return;
  }

  if (routeKind === "project-workspace") {
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 15_000,
    });
    return;
  }

  if (routeKind === "project-chat" || routeKind === "global-chat") {
    await expect(page.getByTestId("chat-composer-input")).toBeVisible({
      timeout: 15_000,
    });
    return;
  }

  if (routeKind === "settings") {
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    return;
  }

  if (routeKind === "documents") {
    await expect(page.locator("body")).toContainText(/documents|Document/i);
    return;
  }

  if (routeKind === "sources") {
    await expect(page.locator("body")).toContainText(
      /sources|source|registry|источники|реестр/i,
    );
    return;
  }

  if (routeKind === "automation-canvas") {
    await expect
      .poll(
        async () => {
          if (await page.getByTestId("activepieces-canvas-container").isVisible().catch(() => false)) {
            return "canvas";
          }
          if (await page.getByTestId("builder-unavailable-state").isVisible().catch(() => false)) {
            return "degraded";
          }
          return "waiting";
        },
        { timeout: 45_000 },
      )
      .not.toBe("waiting");
    return;
  }

  if (routeKind === "automations") {
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/automations(?:[?#].*)?$/);
    await expect(page.getByTestId("app-shell-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("app-shell-main")).toHaveAttribute(
      "data-route-mode",
      "panel",
    );
    return;
  }

  await expect(page.locator("body")).toContainText(/automation|автомат/i);
}
