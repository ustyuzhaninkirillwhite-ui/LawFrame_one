import { expect, test, type Page, type Request } from "@playwright/test";
import path from "node:path";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";
const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@block3 chat runtime resilience", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    await signInAsDemo(page, {
      email: `block3-runtime-${Date.now()}@lexframe.local`,
      fullName: "Block3 Runtime User",
    });
  });

  test("shows the user message immediately while the stream is delayed", async ({
    page,
  }) => {
    const threadId = makeThreadId("optimistic");
    await gotoProjectChat(page, threadId);

    const prompt = `BLOCK3_DELAY optimistic ${Date.now()}`;
    const startedAt = Date.now();
    await composer(page).fill(prompt);
    await composer(page).press("Enter");

    await expect(userMessage(page, prompt)).toBeVisible({ timeout: 1_000 });
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await cancelIfRunning(page);
  });

  test("keeps an assistant pending placeholder visible during delayed stream", async ({
    page,
  }) => {
    const threadId = makeThreadId("pending");
    await gotoProjectChat(page, threadId);

    await sendPrompt(page, `BLOCK3_DELAY pending ${Date.now()}`);

    await expect.poll(() => hasPendingAssistantState(page), { timeout: 1_000 }).toBe(true);
    await cancelIfRunning(page);
  });

  test("keeps the user message and shows a controlled error when stream fails", async ({
    page,
  }) => {
    const threadId = makeThreadId("failure");
    await gotoProjectChat(page, threadId);
    const prompt = `BLOCK3_FAIL_ONCE safe failure ${Date.now()}`;

    await sendPrompt(page, prompt);

    await expect(userMessage(page, prompt)).toBeVisible();
    await expect(page.getByTestId("chat-stream-error")).toContainText(
      "AI_GATEWAY_NOT_READY",
    );
    await assertNoRawProviderLeak(page);
  });

  test("recovers the latest run after reload during a pending stream", async ({
    page,
  }) => {
    const streamRequests = recordRequests(page, isPostChatStream);
    const threadId = makeThreadId("reload");
    await gotoProjectChat(page, threadId);
    const prompt = `BLOCK3_RELOAD_PENDING ${Date.now()}`;

    await sendPrompt(page, prompt);
    await expect(userMessage(page, prompt)).toBeVisible({ timeout: 1_000 });
    await expect.poll(() => streamRequests.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(100);
    await page.reload();

    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/chats/${threadId}$`),
    );
    await expect(composer(page)).toBeVisible({ timeout: 20_000 });
    await expect(userMessage(page, prompt)).toBeVisible();
    await expect.poll(() => hasPendingAssistantState(page), { timeout: 5_000 }).toBe(true);
  });

  test("cancels a delayed stream without deleting the user message", async ({
    page,
  }) => {
    const threadId = makeThreadId("cancel");
    await gotoProjectChat(page, threadId);
    const prompt = `BLOCK3_CANCEL ${Date.now()}`;

    await sendPrompt(page, prompt);
    await expect(userMessage(page, prompt)).toBeVisible({ timeout: 1_000 });
    await expect(stopOrSendButton(page)).toBeVisible();
    await stopOrSendButton(page).click();

    await expect(userMessage(page, prompt)).toBeVisible();
    await expect.poll(() => hasRunningStatus(page), { timeout: 5_000 }).toBe(false);
  });

  test("sends once with Enter and preserves newline with Shift+Enter", async ({
    page,
  }) => {
    const streamRequests = recordRequests(page, isPostChatStream);
    const threadId = makeThreadId("enter");
    await gotoProjectChat(page, threadId);

    await composer(page).fill("BLOCK3_ENTER line one");
    await composer(page).press("Shift+Enter");
    await composer(page).type("line two");
    await expect(composer(page)).toHaveValue("BLOCK3_ENTER line one\nline two");
    await composer(page).press("Enter");

    await expect(userMessage(page, "BLOCK3_ENTER line one")).toBeVisible();
    await expect.poll(() => streamRequests.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(700);
    expect(streamRequests).toHaveLength(1);
  });

  test("does not duplicate the user message or stream on double Enter", async ({
    page,
  }) => {
    const streamRequests = recordRequests(page, isPostChatStream);
    const threadId = makeThreadId("double");
    await gotoProjectChat(page, threadId);
    const prompt = `BLOCK3_DOUBLE_ENTER ${Date.now()}`;

    await composer(page).fill(prompt);
    await Promise.all([composer(page).press("Enter"), composer(page).press("Enter")]);

    await expect(userMessage(page, prompt)).toBeVisible();
    await expect.poll(() => streamRequests.length, { timeout: 5_000 }).toBe(1);
    await page.waitForTimeout(700);
    expect(streamRequests).toHaveLength(1);
    await expect(userMessage(page, prompt)).toHaveCount(1);
  });

  test("removes an attachment chip and does not send the removed file later", async ({
    page,
  }) => {
    const uploadRequests = recordRequests(page, isPostAttachmentUploadIntent);
    const threadId = makeThreadId("attachment");
    await gotoProjectChat(page, threadId);

    await page
      .locator("form input[type='file']")
      .first()
      .setInputFiles(path.join(fixturesDir, "minimal.txt"));
    const chip = page.getByTestId("chat-attachment-chip").filter({ hasText: "minimal.txt" });
    await expect(chip).toBeVisible();
    await chip.locator("button").last().click();

    await expect(page.getByTestId("chat-attachment-chip")).toHaveCount(0);
    await sendPrompt(page, `BLOCK3_ATTACHMENT_REMOVED ${Date.now()}`);
    await page.waitForTimeout(300);
    expect(uploadRequests).toHaveLength(0);
  });

  test("preserves unsent draft while using the branch switcher", async ({ page }) => {
    await gotoProjectChat(page, "thread_block3_branch");
    const draft = `BLOCK3 branch draft ${Date.now()}`;

    await expect(page.getByText("1 / 2")).toBeVisible();
    await composer(page).fill(draft);
    await branchSwitcherNext(page).click();

    await expect(composer(page)).toHaveValue(draft);
  });

  test("keeps a safe failure state after navigating away and back", async ({
    page,
  }) => {
    const threadId = makeThreadId("nav-failure");
    await gotoProjectChat(page, threadId);
    const prompt = `BLOCK3_FAIL_ONCE_NAV ${Date.now()}`;

    await sendPrompt(page, prompt);
    await expect(page.getByTestId("chat-stream-error")).toContainText(
      "AI_GATEWAY_NOT_READY",
    );

    await gotoAppRoute(page, `/app/projects/${projectId}`);
    await gotoProjectChat(page, threadId);

    await expect(userMessage(page, prompt)).toBeVisible();
    await expect.poll(() => hasRunningStatus(page), { timeout: 3_000 }).toBe(false);
    await assertNoRawProviderLeak(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
  });
});

function makeThreadId(label: string) {
  return `thread_block3_${label}_${Date.now()}`;
}

async function gotoProjectChat(page: Page, threadId: string) {
  await gotoAppRoute(page, `/app/projects/${projectId}/chats/${threadId}`);
  await assertRouteReady(page, "project-chat");
  await expect(composer(page)).toBeVisible({ timeout: 20_000 });
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

async function sendPrompt(page: Page, prompt: string) {
  await composer(page).fill(prompt);
  await composer(page).press("Enter");
}

function composer(page: Page) {
  return page.getByTestId("chat-composer-input");
}

function userMessage(page: Page, text: string) {
  return page.locator("[data-message-role='user']").filter({ hasText: text });
}

function runningStatus(page: Page) {
  return page.getByTestId("chat-running-status");
}

function stopOrSendButton(page: Page) {
  return page.locator("form").last().locator("button").last();
}

function branchSwitcherNext(page: Page) {
  return page
    .locator("[data-message-role='assistant']")
    .filter({ hasText: "1 / 2" })
    .locator("button")
    .last();
}

async function hasPendingAssistantState(page: Page) {
  const assistantVisible = await page
    .locator("[data-message-role='assistant']")
    .first()
    .isVisible()
    .catch(() => false);

  return assistantVisible || (await hasRunningStatus(page));
}

async function hasRunningStatus(page: Page) {
  return runningStatus(page).first().isVisible().catch(() => false);
}

async function cancelIfRunning(page: Page) {
  if (await hasRunningStatus(page)) {
    await stopOrSendButton(page).click();
    await expect.poll(() => hasRunningStatus(page), { timeout: 5_000 }).toBe(false);
  }
}

async function assertNoRawProviderLeak(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /raw provider|invalid token|authorization|bearer|eyJ[a-zA-Z0-9_-]*|sk-[a-zA-Z0-9_-]+/i,
  );
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

function isPostChatStream(request: Request) {
  if (request.method() !== "POST") {
    return false;
  }

  return /\/chat\/threads\/[^/]+\/messages:stream$/.test(
    new URL(request.url()).pathname,
  );
}

function isPostAttachmentUploadIntent(request: Request) {
  return (
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/chat/attachments/upload-intents"
  );
}
