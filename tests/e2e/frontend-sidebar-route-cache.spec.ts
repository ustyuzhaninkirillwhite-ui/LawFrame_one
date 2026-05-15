import { expect, test, type Page, type Request, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { openProjectTab, openProjectWorkspace } from "./utils/project-workspace";
import {
  assertMainReceivesPointerEvents,
  collectNetworkSummary,
  countRequestsMatching,
  installNetworkSummary,
  waitForRouteSettled,
  waitForShellReady,
} from "./utils/shell-runtime";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block1 sidebar route cache", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSummary(page);
    await signInAsDemo(page, {
      email: `block1-sidebar-${Date.now()}@lexframe.local`,
      fullName: "Block1 Sidebar",
    });
    await waitForShellReady(page);
  });

  test("preserves active project and collapsed state through route change, back, forward and reload", async ({
    page,
  }, testInfo) => {
    const projectSurfaceRequests = countRequestsMatching(page, (request: Request) => {
      if (request.method() !== "GET") {
        return false;
      }
      const path = new URL(request.url()).pathname;
      return (
        path === `/projects/${projectId}/chats` ||
        path === `/projects/${projectId}/automations`
      );
    });
    const readinessRequests = countRequestsMatching(page, (request: Request) =>
      request.method() === "GET" &&
      new URL(request.url()).pathname.match(
        new RegExp(`^/projects/${projectId}/automations/[^/]+/canvas-readiness$`),
      ) !== null,
    );

    await page.goto("/app/projects");
    await assertRouteReady(page, "ordinary");
    await expect(page).toHaveURL(/\/app\/projects$/);
    await page
      .getByRole("button", { name: /Свернуть меню|collapse/i })
      .click();
    await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
      "data-collapsed",
      "true",
    );

    await page
      .locator(`a[href="/app/projects/${projectId}/automations"]`)
      .click();
    await assertRouteReady(page, "automations");
    await assertSidebarProjectState(page, true);

    await page.goBack();
    await assertRouteReady(page, "ordinary");
    await expect(page).toHaveURL(/\/app\/projects$/);
    await assertSidebarProjectState(page, true);

    await page.goForward();
    await assertRouteReady(page, "automations");
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/automations$/);
    await assertSidebarProjectState(page, true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await assertRouteReady(page, "automations");
    await expect(page).toHaveURL(/\/app\/projects\/[^/]+\/automations$/);
    await assertSidebarProjectState(page, true);
    expect(projectSurfaceRequests.count()).toBeLessThanOrEqual(8);
    expect(readinessRequests.count()).toBeLessThanOrEqual(4);

    await assertNoBlockingOverlay(page);
    await assertMainReceivesPointerEvents(page);
    await attachJson(testInfo, "sidebar-back-forward-request-metrics", {
      projectSurfaceRequestCount: projectSurfaceRequests.count(),
      projectSurfaceRequests: projectSurfaceRequests.urls,
      readinessRequestCount: readinessRequests.count(),
      readinessRequests: readinessRequests.urls,
      summary: await collectNetworkSummary(page),
    });
  });

  test("returns to the automations tab without a full skeleton or request storm", async ({
    page,
  }, testInfo) => {
    const automationRequests = countRequestsMatching(page, (request: Request) =>
      request.method() === "GET" &&
      new URL(request.url()).pathname === `/projects/${projectId}/automations`,
    );

    await openProjectWorkspace(page, projectId);
    await openProjectTab(page, "automations");
    await expect(projectSkeletons(page)).toHaveCount(0);
    const requestsAfterInitialOpen = automationRequests.count();

    await page.goto("/app/projects", { waitUntil: "domcontentloaded" });
    await assertRouteReady(page, "ordinary");
    await page.goto(`/app/projects/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
    await assertRouteReady(page, "project-workspace");
    await openProjectTab(page, "automations");
    await waitForRouteSettled(page);

    await expect(projectSkeletons(page)).toHaveCount(0);
    expect(automationRequests.count() - requestsAfterInitialOpen).toBeLessThanOrEqual(1);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await attachJson(testInfo, "automations-return-cache-metrics", {
      initialRequests: requestsAfterInitialOpen,
      finalRequests: automationRequests.count(),
      requestDelta: automationRequests.count() - requestsAfterInitialOpen,
      summary: await collectNetworkSummary(page),
    });
  });
});

async function assertSidebarProjectState(page: Page, collapsed: boolean) {
  await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
    "data-active-project-id",
    projectId,
  );
  await expect(page.getByTestId("project-sidebar")).toHaveAttribute(
    "data-collapsed",
    String(collapsed),
  );
}

function projectSkeletons(page: Page) {
  return page.getByTestId("project-workspace-shell").locator(".animate-pulse");
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
