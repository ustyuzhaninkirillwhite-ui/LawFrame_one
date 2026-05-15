import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import path from "node:path";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import {
  openProjectTab,
  projectTabNamePattern,
  renameProjectFromHeader,
} from "./utils/project-workspace";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const fixturesDir = path.join(__dirname, "fixtures", "files");

const emptyStateText = {
  chats: /нет чатов|no chats/i,
  sources: /Источников пока нет|no sources/i,
  automations: /Автоматизаций пока нет|no automations/i,
} as const;

test.describe("@block2 project workspace tabs composer sources and web-search", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
  });

  test("keeps tab content scoped when switching Sources, Automations and Chats", async ({
    page,
  }) => {
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await projectTab(page, "sources").click();
    await projectTab(page, "automations").click();
    await projectTab(page, "chats").click();
    await projectTab(page, "sources").click();
    await expect(projectTab(page, "sources")).toHaveAttribute("aria-selected", "true");

    const shell = projectShell(page);
    await expect(shell.getByText("Block2 Source Fixture")).toBeVisible();
    await expect(shell).not.toContainText(emptyStateText.chats);
    await expect(shell).not.toContainText(emptyStateText.automations);

    await openProjectTab(page, "automations");
    await expect(shell.locator('a[href*="/automations/"]').first()).toBeVisible();
    await expect(shell).not.toContainText("Block2 Source Fixture");
    await expect(shell).not.toContainText(emptyStateText.sources);

    await openProjectTab(page, "chats");
    await expect(shell.locator('a[href*="/chats/"]').first()).toBeVisible();
    await expect(shell).not.toContainText(emptyStateText.sources);
    await expect(shell).not.toContainText(emptyStateText.automations);
  });

  test("keeps composer and tabs usable while project knowledge API is slow", async ({
    page,
  }) => {
    const knowledgeRequests = recordRequests(page, isGetProjectKnowledge);

    await signInForBlock2(page);
    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await expect(projectShell(page)).toBeVisible({ timeout: 15_000 });
    await expect(composerInput(page)).toBeVisible();

    await projectTab(page, "sources").click({ trial: true });
    await projectTab(page, "sources").click();
    await expect(projectTab(page, "sources")).toHaveAttribute("aria-selected", "true");
    await expect(composerInput(page)).toBeVisible();
    await expect(projectTab(page, "chats")).toBeVisible();
    await expect(projectTab(page, "automations")).toBeVisible();
    await expect.poll(() => knowledgeRequests.length, { timeout: 5_000 }).toBeGreaterThan(0);
  });

  test("closes plus menu after file selection and keeps the file chip visible", async ({
    page,
  }) => {
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await openPlusMenu(page);
    await expect(page.getByTestId("project-plus-menu")).toBeVisible();
    await projectFileInput(page).setInputFiles(path.join(fixturesDir, "minimal.txt"));

    await expect(page.getByTestId("project-plus-menu")).toHaveCount(0);
    await expect(projectShell(page)).toContainText("minimal.txt");
  });

  test("shows duplicate file validation without creating a project chat", async ({
    page,
  }) => {
    const createRequests = recordRequests(page, isPostProjectChat);
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await openPlusMenu(page);
    await projectFileInput(page).setInputFiles(path.join(fixturesDir, "minimal.txt"));
    await openPlusMenu(page);
    await projectFileInput(page).setInputFiles(path.join(fixturesDir, "minimal.txt"));

    await expect(projectShell(page)).toContainText("minimal.txt");
    await expect(projectShell(page)).toContainText(/Файл уже прикрепл|already attached/i);
    await page.waitForTimeout(300);
    expect(createRequests).toHaveLength(0);
  });

  test("does not enable project chat creation for invalid-only files", async ({
    page,
  }) => {
    const createRequests = recordRequests(page, isPostProjectChat);
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await projectFileInput(page).setInputFiles(path.join(fixturesDir, "empty.txt"));

    await expect(projectShell(page)).toContainText("empty.txt");
    await expect(sendButton(page)).toBeDisabled();
    await page.waitForTimeout(300);
    expect(createRequests).toHaveLength(0);
  });

  test("preserves web search query and shows controlled error on failure", async ({
    page,
  }) => {
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await openWebSearchPanel(page);
    const query = "block2 provider outage query";
    const panel = webSearchPanel(page);
    await panel.locator("input").fill(query);
    await panel.locator('button[type="submit"]').click();

    await expect(panel.locator("input")).toHaveValue(query);
    await expect(panel).toContainText(/Поиск временно недоступен|temporarily/i);
    await expect(panel).not.toContainText(/HTTP 503|ApiClientError/i);
  });

  test("deduplicates transient and persisted web-search sources after invalidation", async ({
    page,
  }) => {
    const sourceTitle = "Block2 Web Search Source";
    const knowledgeRequests = recordRequests(page, isGetProjectKnowledge);

    await signInForBlock2(page);
    await gotoProjectWorkspace(page);
    await openWebSearchPanel(page);
    const panel = webSearchPanel(page);
    await panel.locator("input").fill("block2 saved web source");
    await panel.locator('button[type="submit"]').click();

    await expect(panel).toHaveCount(0);
    await openProjectTab(page, "sources");
    await expect(projectShell(page).getByText(sourceTitle, { exact: true })).toHaveCount(
      1,
    );
    await expect.poll(() => knowledgeRequests.length, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(500);
    expect(knowledgeRequests.length).toBeLessThanOrEqual(4);
  });

  test("keeps selected automation chip across project tab switches", async ({
    page,
  }) => {
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    await openAutomationPicker(page);
    await page
      .getByRole("button", { name: /Прикрепить|attach/i })
      .first()
      .click();

    await expect(page.getByTestId("selected-automation-chip")).toBeVisible();
    await openProjectTab(page, "sources");
    await expect(page.getByTestId("selected-automation-chip")).toBeVisible();
    await openProjectTab(page, "chats");
    await expect(page.getByTestId("selected-automation-chip")).toBeVisible();
  });

  test("updates project heading and sidebar after rename without reload", async ({
    page,
  }) => {
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    const nextName = `Block2 Renamed ${Date.now()}`;
    await renameProjectFromHeader(page, nextName);

    await expect(page.getByRole("heading", { name: nextName })).toBeVisible();
    await expect(page.locator("aside").getByText(nextName, { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("guards project root composer against double-click send", async ({ page }) => {
    await page.route("**/chat/threads/*/messages:stream", async (route) => {
      await fulfillJson(route, { status: "completed", events: [] });
    });
    await signInForBlock2(page);
    await gotoProjectWorkspace(page);

    const createRequests = recordRequests(page, isPostProjectChat);
    await page.route(`**/projects/${projectId}/chats`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await delay(500);
      await fulfillJson(route, {
        chat: {
          id: "chat_block2_double_click",
          projectId,
          title: "Block2 double-click guard",
        },
        session: {
          id: "aisess_block2_double_click",
          status: "active",
        },
      });
    });

    await composerInput(page).fill("Block2 double-click guard");
    await sendButton(page).dblclick();

    await expect.poll(() => createRequests.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(700);
    expect(createRequests).toHaveLength(1);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});

async function signInForBlock2(page: Page) {
  await signInAsDemo(page, {
    email: `block2-project-workspace-${Date.now()}@lexframe.local`,
    fullName: "Block2 Project Workspace",
  });
}

async function gotoProjectWorkspace(page: Page) {
  await gotoAppRoute(page, `/app/projects/${projectId}`);
  await assertRouteReady(page, "project-workspace");
}

async function gotoAppRoute(page: Page, routePath: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(routePath, { waitUntil: "commit" });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        (!error.message.includes("net::ERR_ABORTED") &&
          !error.message.includes("interrupted by another navigation"))
      ) {
        throw error;
      }
    }

    if (new URL(page.url()).pathname === routePath) {
      return;
    }

    await page.waitForTimeout(150);
  }

  throw new Error(`Navigation did not reach ${routePath}; current URL is ${page.url()}.`);
}

function projectShell(page: Page) {
  return page.getByTestId("project-workspace-shell");
}

function projectTab(page: Page, tab: keyof typeof projectTabNamePattern) {
  return page.getByRole("tab", { name: projectTabNamePattern[tab] });
}

function composerInput(page: Page) {
  return projectShell(page).locator("textarea").first();
}

function sendButton(page: Page) {
  return projectShell(page).getByRole("button", {
    name: /Отправить|send/i,
  });
}

function projectFileInput(page: Page) {
  return projectShell(page).locator('input[type="file"]').nth(1);
}

async function openPlusMenu(page: Page) {
  await projectShell(page)
    .getByRole("button", { name: /Добавить контекст|context/i })
    .click();
  await expect(page.getByTestId("project-plus-menu")).toBeVisible();
}

async function openWebSearchPanel(page: Page) {
  await openPlusMenu(page);
  await page.getByTestId("project-plus-menu").locator("button").nth(2).click();
  await expect(webSearchPanel(page)).toBeVisible();
}

async function openAutomationPicker(page: Page) {
  await openPlusMenu(page);
  await page.getByTestId("project-plus-menu").locator("button").nth(3).click();
}

function webSearchPanel(page: Page) {
  return projectShell(page).locator("form").filter({ has: page.locator("input") });
}

function recordRequests(page: Page, predicate: (request: Request) => boolean) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (predicate(request)) {
      requests.push(request);
    }
  });
  return requests;
}

function isPostProjectChat(request: Request) {
  if (request.method() !== "POST") {
    return false;
  }

  const url = new URL(request.url());
  return url.pathname === `/projects/${projectId}/chats`;
}

function isGetProjectKnowledge(request: Request) {
  if (request.method() !== "GET") {
    return false;
  }

  const url = new URL(request.url());
  return url.pathname === `/projects/${projectId}/knowledge`;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
