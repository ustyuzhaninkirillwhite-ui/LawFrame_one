import { expect, test } from "@playwright/test";
import {
  assertNoChatRuntimeLeaks,
  chatComposer,
  createProjectChatForPart3,
  openProjectChat,
  part3ProjectId,
  part3UseMsw,
  sendChatPrompt,
  signInForChatPart3,
  userMessage,
  waitForChatControlledOutcome,
  waitForUserVisible,
} from "./utils/chat-runtime-part3";

test.describe("@part3 chat live reload recovery", () => {
  test.beforeEach(async ({ page }) => {
    await signInForChatPart3(page, "reload");
  });

  test("keeps one user message and a controlled run state across reload during stream", async ({
    page,
  }) => {
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = part3UseMsw
      ? `BLOCK3_RELOAD_PENDING part3 ${Date.now()}`
      : `PART3_RELOAD_RECOVERY ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    await sendChatPrompt(page, prompt);
    await waitForUserVisible(page, prompt);
    await page.reload();

    await expect(chatComposer(page)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${part3ProjectId}/chats/${threadId}$`),
    );
    await expect(userMessage(page, prompt)).toHaveCount(1);
    await waitForChatControlledOutcome(page);
    await assertNoChatRuntimeLeaks(page);
  });

  test("browser back and forward do not apply the pending stream to the wrong route", async ({
    page,
  }) => {
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = part3UseMsw
      ? `BLOCK3_DELAY part3 back-forward ${Date.now()}`
      : `PART3_BACK_FORWARD ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    await sendChatPrompt(page, prompt);
    await waitForUserVisible(page, prompt);
    await page.goto(`/app/projects/${part3ProjectId}`, { waitUntil: "commit" });
    await expect(page).toHaveURL(new RegExp(`/app/projects/${part3ProjectId}$`));
    await page.goBack({ waitUntil: "commit" }).catch(() => null);
    if (
      !new URL(page.url()).pathname.endsWith(`/chats/${threadId}`) ||
      !(await chatComposer(page).isVisible().catch(() => false))
    ) {
      await openProjectChat(page, part3ProjectId, threadId);
    }
    await expect(chatComposer(page)).toBeVisible({ timeout: 20_000 });
    await expect(userMessage(page, prompt)).toHaveCount(1);
    await page.goto(`/app/projects/${part3ProjectId}`, { waitUntil: "commit" });
    await expect(page).toHaveURL(new RegExp(`/app/projects/${part3ProjectId}$`));
    await expect(page.locator("body")).not.toContainText(prompt);
    await assertNoChatRuntimeLeaks(page);
  });
});
