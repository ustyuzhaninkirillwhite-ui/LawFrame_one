import { expect, test, type Request } from "@playwright/test";
import {
  assertNoChatRuntimeLeaks,
  createGlobalChatForPart3,
  createProjectChatForPart3,
  isChatStreamRequest,
  openGlobalChat,
  openProjectChat,
  part3ProjectId,
  recordRequests,
  sendChatPrompt,
  signInForChatPart3,
  waitForChatControlledOutcome,
  waitForUserVisible,
} from "./utils/chat-runtime-part3";

const providerHostPattern =
  /(api\.openai\.com|openai\.azure\.com|api\.cometapi\.com|api\.anthropic\.com|api\.x\.ai|generativelanguage\.googleapis\.com|api\.tavily\.com)/i;

test.describe("@part3 chat browser security isolation", () => {
  test.beforeEach(async ({ page }) => {
    await signInForChatPart3(page, "security");
  });

  test("chat operations stay on LexFrame backend paths and keep browser surfaces redacted", async ({
    page,
  }) => {
    const allRequests: Request[] = [];
    page.on("request", (request) => allRequests.push(request));
    const streamRequests = recordRequests(page, isChatStreamRequest);
    const projectThreadId = await createProjectChatForPart3(page, part3ProjectId);
    const globalThreadId = await createGlobalChatForPart3(page);
    const projectPrompt = `PART3_SECURITY_PROJECT ${Date.now()}`;
    const globalPrompt = `PART3_SECURITY_GLOBAL ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, projectThreadId);
    await sendChatPrompt(page, projectPrompt);
    await waitForUserVisible(page, projectPrompt);
    await waitForChatControlledOutcome(page);

    await openGlobalChat(page, globalThreadId);
    await sendChatPrompt(page, globalPrompt);
    await waitForUserVisible(page, globalPrompt);
    await waitForChatControlledOutcome(page);

    expect(streamRequests.length).toBeGreaterThanOrEqual(2);
    expect(allRequests.map((request) => request.url()).filter((url) => providerHostPattern.test(url))).toEqual([]);
    await expect(page.locator("body")).not.toContainText(projectThreadId);
    await assertNoChatRuntimeLeaks(page);
  });
});
