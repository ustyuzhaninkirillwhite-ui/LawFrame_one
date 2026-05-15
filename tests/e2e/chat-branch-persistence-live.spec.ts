import { expect, test } from "@playwright/test";
import {
  assertNoChatRuntimeLeaks,
  createProjectChatForPart3,
  fetchChatApiFromBrowser,
  openProjectChat,
  part3ProjectId,
  sendChatPrompt,
  signInForChatPart3,
  waitForChatControlledOutcome,
  waitForUserVisible,
} from "./utils/chat-runtime-part3";

test.describe("@part3 chat branch persistence live", () => {
  test.beforeEach(async ({ page }) => {
    await signInForChatPart3(page, "branch");
  });

  test("branch creation is additive and remains visible after reload", async ({
    page,
  }) => {
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = `PART3_BRANCH_SOURCE ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    await sendChatPrompt(page, prompt);
    await waitForUserVisible(page, prompt);
    await waitForChatControlledOutcome(page);

    const messages = await fetchChatApiFromBrowser<{
      readonly items: readonly { readonly id: string; readonly role: string }[];
    }>(page, `/chat/threads/${threadId}/messages`);
    const sourceMessageId =
      messages.items.find((message) => message.role === "user")?.id ?? null;
    expect(sourceMessageId).toBeTruthy();

    const branch = await fetchChatApiFromBrowser<{
      readonly thread: { readonly id: string; readonly currentBranchId: string | null };
    }>(page, `/chat/threads/${threadId}/branch`, {
      method: "POST",
      body: {
        sourceMessageId,
        branchMode: "project",
      },
    });
    expect(branch.thread.id).not.toBe(threadId);

    await openProjectChat(page, part3ProjectId, branch.thread.id);
    await expect(page.locator("body")).toContainText(prompt);
    await page.reload();
    await expect(page.locator("body")).toContainText(prompt);
    await assertNoChatRuntimeLeaks(page);
  });
});
