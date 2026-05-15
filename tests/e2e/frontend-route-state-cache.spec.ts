import { expect, test, type Page, type Request } from "@playwright/test";
import { signInAsDemo } from "./helpers/auth";
import { assertNoBlockingOverlay } from "./utils/clickability";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady, waitForStableLayout } from "./utils/navigation";
import { openProjectTab } from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

const projectTabNames = {
  chats: /Р§Р°С‚С‹|чаты|chats/i,
  sources: /РСЃС‚РѕС‡РЅРёРєРё|источники|sources/i,
  automations: /РђРІС‚РѕРјР°С‚РёР·Р°С†РёРё|автоматизации|automations/i,
} as const;

test.describe("@block1 navigation route state and cache", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block1-route-state-${Date.now()}@lexframe.local`,
      fullName: "Block1 Route State",
    });
  });

  test("keeps cached automations visible after Projects -> project return", async ({
    page,
  }) => {
    const automationRequests = recordRequests(page, (request) =>
      isGetProjectPath(request, `/projects/${projectId}/automations`),
    );

    await gotoProjectWorkspace(page);
    await openProjectTab(page, "automations");
    await expect(projectSkeletons(page)).toHaveCount(0);

    const requestsAfterInitialOpen = automationRequests.length;
    await gotoAppRoute(page, "/app/projects");
    await assertRouteReady(page, "ordinary");
    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await openProjectTab(page, "automations");

    await expect(projectSkeletons(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      /Загружаю автоматизации|Loading automations/i,
    );
    expect(automationRequests.length - requestsAfterInitialOpen).toBeLessThanOrEqual(1);
  });

  test("restores project tab selection through browser back and forward", async ({
    page,
  }) => {
    await gotoProjectWorkspace(page);
    await openProjectTab(page, "sources");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=sources$`));
    await openProjectTab(page, "automations");
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}\\?tab=automations$`),
    );

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}\\?tab=sources$`));
    await assertProjectTabSelected(page, "sources");

    await page.goForward();
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}\\?tab=automations$`),
    );
    await assertProjectTabSelected(page, "automations");
  });

  test("persists collapsed sidebar across route changes and reload", async ({ page }) => {
    await gotoAppRoute(page, "/app/projects");
    await assertRouteReady(page, "ordinary");

    await collapseSidebar(page);
    await expect(sidebarExpandButton(page)).toBeVisible();

    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await expect(sidebarExpandButton(page)).toBeVisible();

    await page.reload();
    await assertRouteReady(page, "project-workspace");
    await expect(sidebarExpandButton(page)).toBeVisible();
  });

  test("preserves dirty profile settings field when switching settings tabs", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/app/projects");
    await assertRouteReady(page, "ordinary");
    await page.getByTestId("settings-entry-point").first().click();
    await assertRouteReady(page, "settings");

    const dirtyDisplayName = `Unsaved Block1 ${Date.now()}`;
    await page.getByTestId("settings-profile-display-name").fill(dirtyDisplayName);
    await page.getByTestId("settings-tab-organization").click();
    await expect(page.getByTestId("settings-organization-display-name")).toBeVisible();
    await page.getByTestId("settings-tab-profile").click();

    await expect(page.getByTestId("settings-profile-display-name")).toHaveValue(
      dirtyDisplayName,
    );
  });

  test("does not leak project workspace tabs into global chat and restores them on back", async ({
    page,
  }) => {
    await gotoProjectWorkspace(page);
    await openProjectTab(page, "sources");

    await gotoAppRoute(page, "/chat");
    await assertRouteReady(page, "global-chat");
    await expect(page.getByRole("tab")).toHaveCount(0);

    await page.goBack();
    await assertRouteReady(page, "project-workspace");
    await assertProjectTabSelected(page, "sources");
  });

  test("does not carry the floating global composer into project workspace", async ({
    page,
  }) => {
    await gotoAppRoute(page, "/chat");
    await assertRouteReady(page, "global-chat");

    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");
    await expect(page.getByTestId("floating-ai-composer")).toHaveCount(0);
  });

  test("does not leave stale overlays intercepting project tab clicks after rapid switching", async ({
    page,
  }) => {
    for (let index = 0; index < 3; index += 1) {
      await gotoAppRoute(page, "/chat");
      await assertRouteReady(page, "global-chat");
      await gotoAppRoute(page, `/app/projects/${projectId}`);
      await assertRouteReady(page, "project-workspace");
    }

    const automationsTab = projectTab(page, "automations");
    await automationsTab.click({ trial: true });
    await automationsTab.click();
    await assertProjectTabSelected(page, "automations");
    await assertNoBlockingOverlay(page);
  });

  test("does not refetch core project data repeatedly when toggling theme", async ({
    page,
  }) => {
    const coreProjectRequests = recordRequests(page, (request) =>
      request.method() === "GET" &&
      request.url().includes(`/projects/${projectId}`) &&
      /\/projects\/[^/]+(?:\/snapshot|\/chats|\/automations)?(?:\?|$)/.test(
        new URL(request.url()).pathname,
      ),
    );

    await gotoProjectWorkspace(page);
    await waitForStableLayout(page);
    const requestsBeforeThemeToggle = coreProjectRequests.length;

    await toggleTheme(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await toggleTheme(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.waitForTimeout(750);

    expect(coreProjectRequests.length - requestsBeforeThemeToggle).toBeLessThanOrEqual(1);
  });

  test("restores the same project route after reload", async ({ page }) => {
    await gotoProjectWorkspace(page);
    await page.reload();
    await assertRouteReady(page, "project-workspace");

    expect(new URL(page.url()).pathname).toBe(`/app/projects/${projectId}`);
    await expect(page.getByTestId("project-workspace-shell")).toBeVisible();
  });

  test("clears stale Activepieces browser token on non-automation navigation", async ({
    page,
  }) => {
    const token = buildActivepiecesJwt();
    await page.evaluate((activepiecesToken) => {
      window.sessionStorage.setItem("token", activepiecesToken);
      window.localStorage.setItem("activepieces-token", activepiecesToken);
    }, token);

    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await assertRouteReady(page, "project-workspace");

    const storage = await page.evaluate(() => ({
      sessionToken: window.sessionStorage.getItem("token"),
      localToken: window.localStorage.getItem("activepieces-token"),
    }));
    expect(storage).toEqual({ sessionToken: null, localToken: null });
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});

function projectTab(page: Page, tab: keyof typeof projectTabNames) {
  return page.getByRole("tab", { name: projectTabNames[tab] });
}

async function gotoProjectWorkspace(page: Page) {
  await gotoAppRoute(page, `/app/projects/${projectId}`);
  await assertRouteReady(page, "project-workspace");
}

async function gotoAppRoute(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "commit" });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) {
        throw error;
      }
    }

    if (new URL(page.url()).pathname === path) {
      return;
    }

    await page.waitForTimeout(150);
  }

  throw new Error(`Navigation did not reach ${path}; current URL is ${page.url()}.`);
}

async function assertProjectTabSelected(
  page: Page,
  tab: keyof typeof projectTabNames,
) {
  await expect(page.getByTestId("project-workspace-shell")).toBeVisible({
    timeout: 20_000,
  });
  await expect(projectTab(page, tab)).toHaveAttribute("aria-selected", "true");
}

function projectSkeletons(page: Page) {
  return page.getByTestId("project-workspace-shell").locator(".animate-pulse");
}

async function collapseSidebar(page: Page) {
  await page
    .getByRole("button", {
      name: /РЎРІРµСЂРЅСѓС‚СЊ РјРµРЅСЋ|Свернуть меню|collapse sidebar|collapse menu/i,
    })
    .first()
    .click();
}

function sidebarExpandButton(page: Page) {
  return page.locator("aside").getByRole("button").first();
}

async function toggleTheme(page: Page) {
  await page
    .getByRole("button", {
      name: /Р’РєР»СЋС‡РёС‚СЊ (?:С‚С‘РјРЅСѓСЋ|СЃРІРµС‚Р»СѓСЋ) С‚РµРјСѓ|Включить (?:тёмную|темную|светлую) тему|theme/i,
    })
    .first()
    .click();
}

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

function buildActivepiecesJwt() {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    iss: "activepieces",
    sub: "block1-e2e",
  })}.signature`;
}
