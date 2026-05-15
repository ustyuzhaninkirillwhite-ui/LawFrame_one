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
import {
  installConsoleGuards,
} from "./utils/console";
import { installNetworkSecurityAssertions } from "./utils/network-assertions";

test.describe("@part3 chat multitab consistency", () => {
  test.skip(
    part3UseMsw,
    "MSW chat fixture state is stored in per-tab sessionStorage; backend-backed run covers cross-tab persistence.",
  );

  test("two tabs converge on the same project chat without duplicate messages", async ({
    page,
    context,
  }) => {
    await signInForChatPart3(page, "multitab");
    const threadId = await createProjectChatForPart3(page, part3ProjectId);
    const prompt = `PART3_MULTITAB ${Date.now()}`;

    await openProjectChat(page, part3ProjectId, threadId);
    const secondPage = await context.newPage();
    installConsoleGuards(secondPage);
    installNetworkSecurityAssertions(secondPage);
    await openProjectChat(secondPage, part3ProjectId, threadId);

    await sendChatPrompt(page, prompt);
    await waitForUserVisible(page, prompt);
    await waitForChatControlledOutcome(page);

    await secondPage.reload();
    await expect(chatComposer(secondPage)).toBeVisible({ timeout: 20_000 });
    await expect(userMessage(secondPage, prompt)).toHaveCount(1);
    await assertNoChatRuntimeLeaks(page);
    await assertNoChatRuntimeLeaks(secondPage);
  });
});
