import { expect, test, type Page, type Request, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertRouteFamilyTokenRetention,
  assertTokensClearedAfterLeavingAutomationFamily,
  waitForBuilderSurface,
} from "./utils/activepieces";
import { ensureAutomationCanvas, openAutomationCanvas } from "./utils/automation";
import { openProjectTab } from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block4 automation route cache and cleanup", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page, {
      email: `block4-cache-${Date.now()}@lexframe.local`,
      fullName: "Block4 Cache User",
    });
  });

  test("does not show skeleton or storm requests when re-entering the automation tab", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      process.env.LEXFRAME_E2E_USE_MSW === "1",
      "Backend request-count cache guard is covered by backend-backed runtime; MSW service worker request accounting is not equivalent.",
    );
    const automationRequests = recordRequests(page, (candidate) =>
      isGetProjectPath(candidate, `/projects/${projectId}/automations`),
    );
    const canvas = await ensureAutomationCanvas(page, request, projectId);

    await page.goto(`/app/projects/${projectId}`);
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 20_000,
    });
    await openProjectTab(page, "automations");
    await expect(page.locator(`a[href="${canvas.route}"]`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(projectSkeletons(page)).toHaveCount(0);
    const requestsAfterFirstEntry = automationRequests.length;

    await openProjectTab(page, "chats");
    await openProjectTab(page, "automations");
    await page.waitForTimeout(500);

    await expect(projectSkeletons(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      /Загружаю автоматизации|Loading automations/i,
    );
    expect(automationRequests.length - requestsAfterFirstEntry).toBeLessThanOrEqual(1);
    await attachJson(testInfo, "automation-tab-reentry-network", {
      requests: automationRequests,
    });
  });

  test("keeps composer and tabs usable while automation list request is slow", async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.LEXFRAME_E2E_USE_MSW === "1",
      "This browser route interception guard targets backend-backed network behavior; MSW handles the request before page.route.",
    );
    let releaseAutomations: () => void = () => undefined;
    const delayedAutomations = new Promise<void>((resolve) => {
      releaseAutomations = resolve;
    });
    let automationRequests = 0;
    await page.route(`**/projects/${projectId}/automations`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      automationRequests += 1;
      await delayedAutomations;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto(`/app/projects/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
      timeout: 20_000,
    });
    await openProjectTab(page, "automations");

    await expect(page.getByRole("textbox").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /чаты|chats/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /автоматизации|automations/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(automationRequests).toBeLessThanOrEqual(2);
    await testInfo.attach("slow-automation-list", {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });

    releaseAutomations();
    await expect(projectSkeletons(page)).toHaveCount(0, { timeout: 10_000 });
  });

  test("reuses route-family session where possible and clears AP browser tokens after leaving", async ({
    page,
    request,
  }, testInfo) => {
    let sessionRequests = 0;
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        response.url().includes("/activepieces/session")
      ) {
        sessionRequests += 1;
      }
    });

    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await openAutomationCanvas(page, projectId, canvas.automation_id);
    await waitForBuilderSurface(page);
    const firstSessionRequests = sessionRequests;
    await assertRouteFamilyTokenRetention(page);

    await page.goto(`/app/projects/${projectId}/automations`);
    await page.goto(canvas.route);
    await waitForBuilderSurface(page);
    expect(sessionRequests).toBeLessThanOrEqual(firstSessionRequests + 1);

    await page.goto("/app/projects");
    await assertTokensClearedAfterLeavingAutomationFamily(page);
    await attachJson(testInfo, "automation-route-token-cleanup-storage", {
      storage: await readStorage(page),
    });
  });

  test("reloads the automation canvas without a repeated AP session loop", async ({
    page,
    request,
  }, testInfo) => {
    const sessionRequests = recordRequests(page, (candidate) =>
      candidate.method() === "POST" &&
      new URL(candidate.url()).pathname === "/activepieces/session",
    );

    const canvas = await ensureAutomationCanvas(page, request, projectId);
    await page.goto(canvas.route);
    await waitForBuilderSurface(page);
    const requestsAfterFirstOpen = sessionRequests.length;

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBuilderSurface(page);
    await page.waitForTimeout(750);

    expect(sessionRequests.length - requestsAfterFirstOpen).toBeLessThanOrEqual(1);
    await attachJson(testInfo, "automation-route-session-loop-network", {
      requests: sessionRequests,
    });
  });

  test("does not accumulate hidden iframes after repeated project and automation navigation", async ({
    page,
    request,
  }) => {
    const canvas = await ensureAutomationCanvas(page, request, projectId);

    for (let index = 0; index < 2; index += 1) {
      await page.goto(canvas.route);
      await waitForBuilderSurface(page);
      await page.goto("/app/projects");
      await expect(page.getByTestId("app-shell-panel")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("iframe")).toHaveCount(0);
    }
  });
});

function recordRequests(
  page: Page,
  predicate: (request: Request) => boolean,
): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (predicate(request)) {
      requests.push(request.url());
    }
  });
  return requests;
}

function isGetProjectPath(request: Request, expectedPath: string) {
  return request.method() === "GET" && new URL(request.url()).pathname === expectedPath;
}

function projectSkeletons(page: Page) {
  return page.getByTestId("project-workspace-shell").locator(".animate-pulse");
}

async function readStorage(page: Page) {
  return page.evaluate(() => ({
    localStorage: { ...window.localStorage },
    sessionStorage: { ...window.sessionStorage },
  }));
}

async function attachJson(
  testInfo: TestInfo,
  name: string,
  body: unknown,
) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
