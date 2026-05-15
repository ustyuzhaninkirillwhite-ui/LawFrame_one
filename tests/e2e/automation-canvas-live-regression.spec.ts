import { expect, test, type Page, type Request, type TestInfo } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import {
  assertNoAutomationBrowserSecrets,
  installAutomationBrowserSecretScan,
} from "./utils/browser-secret-scan";
import { assertNotActivepiecesLogin, waitForBuilderSurface } from "./utils/activepieces";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@stage23 automation canvas live regression", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installAutomationBrowserSecretScan(page);
    await signInAsDemo(page, {
      email: `stage23-automation-live-${Date.now()}@lexframe.local`,
      fullName: "Stage23 Automation Live User",
    });
  });

  test("opens from chat without endless loading and reuses the warmed canvas on re-entry", async ({
    page,
  }, testInfo) => {
    const requests = recordAutomationRuntimeRequests(page);

    await page.goto("/chat");
    await expect(page.getByRole("button", { name: /новый чат/i })).toBeVisible({
      timeout: 20_000,
    });

    await openAutomationFromSidebar(page);
    await expectAutomationCanvasReady(page, testInfo, "first-open");
    const firstOpenCounts = summarizeRequests(requests);

    await page.goto("/chat");
    await expect(page.getByRole("button", { name: /новый чат/i })).toBeVisible({
      timeout: 20_000,
    });

    await openAutomationFromSidebar(page);
    await expectAutomationCanvasReady(page, testInfo, "second-open");
    const secondOpenCounts = summarizeRequests(requests);
    expect(secondOpenCounts.ensure - firstOpenCounts.ensure).toBeLessThanOrEqual(1);
    expect(secondOpenCounts.session - firstOpenCounts.session).toBeLessThanOrEqual(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAutomationCanvasReady(page, testInfo, "reload");

    await assertNotActivepiecesLogin(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoAutomationBrowserSecrets(page);
    await attachJson(testInfo, "automation-canvas-live-regression-network", {
      finalUrl: page.url(),
      counts: summarizeRequests(requests),
      requests,
    });
  });
});

async function openAutomationFromSidebar(page: Page) {
  const automationLink = page.getByRole("link", { name: /автоматизации/i }).first();
  await expect(automationLink).toBeVisible({ timeout: 20_000 });
  await automationLink.click();
  await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/automations`), {
    timeout: 20_000,
  });
}

async function expectAutomationCanvasReady(
  page: Page,
  testInfo: TestInfo,
  stepName: string,
) {
  await expect
    .poll(
      async () => {
        if (await page.getByTestId("automation-canvas-unavailable-state").isVisible().catch(() => false)) {
          return "unavailable";
        }
        if (await page.getByTestId("builder-unavailable-state").isVisible().catch(() => false)) {
          return "builder-unavailable";
        }
        const container = page.getByTestId("activepieces-canvas-container");
        if (await container.isVisible().catch(() => false)) {
          const iframeCount = await container.locator("iframe").count().catch(() => 0);
          return iframeCount > 0 ? "ready" : "container-without-iframe";
        }
        if (await page.getByTestId("automation-canvas-loading-state").isVisible().catch(() => false)) {
          return "loading";
        }
        return "waiting";
      },
      { timeout: 45_000 },
    )
    .toBe("ready");

  await expect(page.getByTestId("automation-canvas-loading-state")).toHaveCount(0);
  await expect(page.getByTestId("automation-canvas-unavailable-state")).toHaveCount(0);
  await expect(page.getByTestId("activepieces-canvas-container").locator("iframe").first()).toBeVisible({
    timeout: 10_000,
  });
  await waitForBuilderSurface(page);
  await attachJson(testInfo, `automation-canvas-${stepName}-state`, {
    url: page.url(),
    backgroundState: await page
      .getByTestId("automation-canvas-background-state")
      .textContent()
      .catch(() => null),
  });
}

function recordAutomationRuntimeRequests(page: Page) {
  const requests: Array<{ method: string; pathname: string; status?: number }> = [];
  page.on("request", (request) => {
    const pathname = safePathname(request);
    if (isTrackedAutomationRuntimePath(request, pathname)) {
      requests.push({ method: request.method(), pathname });
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    const pathname = safePathname(request);
    if (!isTrackedAutomationRuntimePath(request, pathname)) {
      return;
    }
    const match = [...requests]
      .reverse()
      .find((entry) => entry.method === request.method() && entry.pathname === pathname && entry.status === undefined);
    if (match) {
      match.status = response.status();
    }
  });
  return requests;
}

function summarizeRequests(
  requests: ReadonlyArray<{ method: string; pathname: string }>,
) {
  return {
    ensure: requests.filter(
      (request) =>
        request.method === "POST" &&
        request.pathname === `/projects/${projectId}/automations/stage17-canvas/ensure`,
    ).length,
    session: requests.filter(
      (request) =>
        request.method === "POST" && request.pathname === "/activepieces/session",
    ).length,
    list: requests.filter(
      (request) =>
        request.method === "GET" &&
        request.pathname === `/projects/${projectId}/automations`,
    ).length,
  };
}

function isTrackedAutomationRuntimePath(request: Request, pathname: string) {
  if (request.method() === "POST" && pathname === "/activepieces/session") {
    return true;
  }
  if (pathname === `/projects/${projectId}/automations`) {
    return true;
  }
  return pathname === `/projects/${projectId}/automations/stage17-canvas/ensure`;
}

function safePathname(request: Request) {
  try {
    return new URL(request.url()).pathname;
  } catch {
    return "";
  }
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}
