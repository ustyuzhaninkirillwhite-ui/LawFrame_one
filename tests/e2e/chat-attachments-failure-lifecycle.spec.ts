import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  assertNoChatRuntimeLeaks,
  chatComposer,
  createProjectChatForPart3,
  installBackendRouteFailureOnce,
  isAttachmentIntentRequest,
  isChatStreamRequest,
  openProjectChat,
  part3ProjectId,
  part3UseMsw,
  recordRequests,
  sendChatPrompt,
  setMswControl,
  signInForChatPart3,
  streamError,
  waitForChatControlledOutcome,
  waitForUserVisible,
} from "./utils/chat-runtime-part3";

const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@part3 chat attachment failure lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await signInForChatPart3(page, "attachments");
  });

  test("upload intent failure is controlled and does not start a phantom stream", async ({
    page,
  }) => {
    const streamRequests = recordRequests(page, isChatStreamRequest);
    const intentRequests = recordRequests(page, isAttachmentIntentRequest);
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = `PART3_UPLOAD_INTENT_FAILURE ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    if (part3UseMsw) {
      await setMswControl(page, {
        failures: {
          "POST /chat/attachments/upload-intents": {
            status: 503,
            code: "CHAT_ATTACHMENT_UPLOAD_INTENT_FAILED",
            message: "Upload intent is temporarily unavailable.",
            remaining: 1,
          },
        },
      });
    } else {
      await installBackendRouteFailureOnce(
        page,
        "**/chat/attachments/upload-intents",
        503,
        "CHAT_ATTACHMENT_UPLOAD_INTENT_FAILED",
        "Upload intent is temporarily unavailable.",
      );
    }

    await page
      .locator("form input[type='file']")
      .first()
      .setInputFiles(path.join(fixturesDir, "minimal.txt"));
    await expect(page.getByTestId("chat-attachment-chip")).toContainText("minimal.txt");
    await sendChatPrompt(page, prompt);

    await waitForUserVisible(page, prompt);
    await expect(streamError(page)).toContainText(
      "CHAT_ATTACHMENT_UPLOAD_INTENT_FAILED",
    );
    expect(intentRequests.length).toBe(1);
    expect(streamRequests.length).toBe(0);

    const retryPrompt = `PART3_TEXT_RECOVERY ${Date.now()}`;
    await chatComposer(page).fill(retryPrompt);
    await chatComposer(page).press("Enter");
    await waitForUserVisible(page, retryPrompt);
    await waitForChatControlledOutcome(page);
    await assertNoChatRuntimeLeaks(page);
  });
});
