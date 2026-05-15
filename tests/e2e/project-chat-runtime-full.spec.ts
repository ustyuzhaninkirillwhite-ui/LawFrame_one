import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertNoDuplicateAssistantMessages,
  assertProjectChatScope,
  cancelChatRun,
  createProjectChat,
  reloadAndAssertRecovery,
  sendChatMessage,
  waitForAssistantFinalOrControlledFailure,
  waitForAssistantPlaceholder,
  waitForUserMessage,
} from "./utils/chat";
import {
  assertNoConsoleErrors,
  assertNoHydrationErrors,
  installConsoleGuards,
} from "./utils/console";
import { assertRouteReady } from "./utils/navigation";
import { assertNoProjectFlowSecurityLeaks, installNetworkSecurityAssertions } from "./utils/network-assertions";

const projectId = process.env.LEXFRAME_E2E_PROJECT_ID ?? "project_claim_001";

test.describe("@block3 project chat runtime", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-project-chat-${Date.now()}@lexframe.local`,
      fullName: "Block3 Project Chat User",
    });
  });

  test("persists optimistic send, assistant placeholder, recovery and scoped messages", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const threadId = await createProjectChat(page, projectId);

    await page.goto(`/app/projects/${projectId}/chats/${threadId}`);
    await assertRouteReady(page, "project-chat");
    await assertProjectChatScope(page, projectId);

    const prompt = "Проверь позицию по делу и перечисли недостающие факты";
    await sendChatMessage(page, prompt);
    await waitForUserMessage(page, prompt);
    await waitForAssistantPlaceholder(page);
    await waitForAssistantFinalOrControlledFailure(page);
    await assertNoDuplicateAssistantMessages(page);

    const messagesResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads/${threadId}/messages`,
      { headers: session.headers },
    );
    expect(messagesResponse.ok(), await messagesResponse.text()).toBeTruthy();
    const messages = (await messagesResponse.json()) as {
      readonly items: readonly { readonly id: string; readonly role: string }[];
      readonly latestRun?: { readonly streamId: string; readonly status: string } | null;
    };
    expect(messages.items.some((message) => message.role === "user")).toBe(true);
    expect(messages.items.filter((message) => message.role === "assistant").length).toBeLessThanOrEqual(1);

    if (messages.latestRun?.streamId) {
      const resumeResponse = await request.post(
        `${session.apiBaseUrl}/chat/threads/${threadId}/streams/${messages.latestRun.streamId}/resume`,
        { headers: session.headers },
      );
      expect(resumeResponse.status()).toBeLessThan(500);
    }

    await reloadAndAssertRecovery(page);
    await assertProjectChatScope(page, projectId);
    await cancelChatRun(page);
    await assertNoDuplicateAssistantMessages(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
