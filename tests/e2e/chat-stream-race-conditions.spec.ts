import { expect, test } from "@playwright/test";
import {
  assertNoChatRuntimeLeaks,
  assertNoDuplicateTextMessages,
  chatComposer,
  createGlobalChatForPart3,
  createProjectChatForPart3,
  isChatStreamRequest,
  openGlobalChat,
  openProjectChat,
  part3ProjectId,
  part3UseMsw,
  recordRequests,
  sendChatPrompt,
  signInForChatPart3,
  waitForChatControlledOutcome,
  waitForUserVisible,
} from "./utils/chat-runtime-part3";

test.describe("@part3 chat stream race conditions", () => {
  test.beforeEach(async ({ page }) => {
    await signInForChatPart3(page, "stream-race");
  });

  test("late project chat stream does not render after switching to a global chat route", async ({
    page,
  }) => {
    const projectThreadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = part3UseMsw
      ? `BLOCK3_DELAY part3 isolation ${Date.now()}`
      : `PART3_ROUTE_STREAM_ISOLATION ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, projectThreadId);
    await sendChatPrompt(page, prompt);
    await waitForUserVisible(page, prompt);

    const globalThreadId = await createGlobalChatForPart3(page);
    await openGlobalChat(page, globalThreadId);
    await expect(chatComposer(page)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(prompt);
    await expect
      .poll(
        async () => page.locator("body").innerText(),
        { timeout: part3UseMsw ? 5_000 : 2_000 },
      )
      .not.toContain(prompt);
    await assertNoChatRuntimeLeaks(page);
  });

  test("rapid Enter plus click creates one user message and one stream request", async ({
    page,
  }) => {
    const requests = recordRequests(page, isChatStreamRequest);
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = `PART3_DOUBLE_SUBMIT ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    await chatComposer(page).fill(prompt);
    await Promise.all([
      chatComposer(page).press("Enter"),
      page.getByRole("button", { name: /Отправить сообщение|send/i }).click(),
    ]);

    await waitForUserVisible(page, prompt);
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(1);
    await assertNoDuplicateTextMessages(page, prompt);
    await waitForChatControlledOutcome(page);
    await assertNoChatRuntimeLeaks(page);
  });
});
