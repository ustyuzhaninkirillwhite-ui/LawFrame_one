import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertGlobalChatScope,
  assertNoDuplicateAssistantMessages,
  createGlobalChat,
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

test.describe("@block3 global chat runtime separation", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-global-chat-${Date.now()}@lexframe.local`,
      fullName: "Block3 Global Chat User",
    });
  });

  test("keeps global chat history out of project chat routes", async ({ page, request }) => {
    const session = await getWorkspaceApiSession(page, request);
    const threadId = await createGlobalChat(page);

    await page.goto(`/chat/${threadId}`);
    await assertRouteReady(page, "global-chat");
    await assertGlobalChatScope(page);

    const prompt = "Сформируй общий список вопросов без привязки к проекту";
    await sendChatMessage(page, prompt);
    await waitForUserMessage(page, prompt);
    await waitForAssistantPlaceholder(page);
    await waitForAssistantFinalOrControlledFailure(page);
    await assertNoDuplicateAssistantMessages(page);

    const globalThreadsResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads?scope=global`,
      { headers: session.headers },
    );
    expect(globalThreadsResponse.ok(), await globalThreadsResponse.text()).toBeTruthy();
    const globalThreads = (await globalThreadsResponse.json()) as {
      readonly items: readonly { readonly id: string; readonly projectId: string | null }[];
    };
    expect(globalThreads.items.some((thread) => thread.id === threadId && thread.projectId === null)).toBe(true);

    const projectThreadsResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads?scope=project&projectId=${projectId}`,
      { headers: session.headers },
    );
    expect(projectThreadsResponse.ok(), await projectThreadsResponse.text()).toBeTruthy();
    const projectThreads = (await projectThreadsResponse.json()) as {
      readonly items: readonly { readonly id: string }[];
    };
    expect(projectThreads.items.some((thread) => thread.id === threadId)).toBe(false);

    await page.goto(`/app/projects/${projectId}/chats`);
    await assertRouteReady(page, "project-chat");
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/chats`));

    await page.goto(`/chat/${threadId}`);
    await assertGlobalChatScope(page);
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
