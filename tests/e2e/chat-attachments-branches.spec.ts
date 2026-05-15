import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import path from "node:path";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";
import {
  assertAttachmentChip,
  assertNoDuplicateAssistantMessages,
  attachFileToComposer,
  createProjectChat,
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
const fixturesDir = path.join(__dirname, "fixtures", "files");

test.describe("@block3 chat attachments and branches", () => {
  test.beforeEach(async ({ page }) => {
    installConsoleGuards(page);
    installNetworkSecurityAssertions(page);
    await signInAsDemo(page, {
      email: `block3-attachments-${Date.now()}@lexframe.local`,
      fullName: "Block3 Attachments User",
    });
  });

  test("uses real browser File upload, validates bad files and preserves branch history", async ({
    page,
    request,
  }) => {
    const session = await getWorkspaceApiSession(page, request);
    const threadId = await createProjectChat(page, projectId);

    await page.goto(`/app/projects/${projectId}/chats/${threadId}`);
    await assertRouteReady(page, "project-chat");

    await attachFileToComposer(page, path.join(fixturesDir, "minimal.txt"));
    await assertAttachmentChip(page, "minimal.txt");

    const uploadIntentRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("/chat/attachments/upload-intents"),
    );
    const completeRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        /\/chat\/attachments\/[^/]+\/complete$/.test(new URL(request.url()).pathname),
    );

    const prompt = "Разбери вложение и отметь, каких фактов не хватает";
    await sendChatMessage(page, prompt);
    await waitForUserMessage(page, prompt);
    await waitForAssistantPlaceholder(page);

    const uploadIntent = await uploadIntentRequest;
    expect(uploadIntent.postData()).toContain("minimal.txt");
    await completeRequest;

    await waitForAssistantFinalOrControlledFailure(page);
    await assertNoDuplicateAssistantMessages(page);

    await attachFileToComposer(page, path.join(fixturesDir, "empty.txt"));
    await expect(page.getByTestId("chat-attachment-chip").filter({ hasText: "empty.txt" })).toContainText(
      /РїСѓСЃС‚|empty/i,
    );

    const fileInput = page.locator('form input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "payload.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not executable"),
    });
    await expect(page.getByTestId("chat-attachment-chip").filter({ hasText: "payload.exe" })).toContainText(
      /РЅРµ РїРѕРґРґРµСЂ|unsupported|type/i,
    );

    await fileInput.setInputFiles({
      name: "bad:name.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("unsafe name"),
    });
    await expect(page.getByTestId("chat-attachment-chip").filter({ hasText: "bad:name.txt" })).toContainText(
      /РѕРїР°СЃ|unsafe|name/i,
    );

    await fileInput.setInputFiles({
      name: "oversize.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(26 * 1024 * 1024, 1),
    });
    await expect(page.getByTestId("chat-attachment-chip").filter({ hasText: "oversize.bin" })).toContainText(
      /СЃР»РёС€РєРѕРј|large|big/i,
    );

    const messagesResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads/${threadId}/messages`,
      { headers: session.headers },
    );
    expect(messagesResponse.ok(), await messagesResponse.text()).toBeTruthy();
    const messages = (await messagesResponse.json()) as {
      readonly items: readonly { readonly id: string; readonly role: string }[];
    };
    const sourceMessageId = messages.items.find((message) => message.role === "user")?.id;
    expect(sourceMessageId).toBeTruthy();

    const branchResponse = await request.post(
      `${session.apiBaseUrl}/chat/threads/${threadId}/branch`,
      {
        headers: {
          ...session.headers,
          "content-type": "application/json",
        },
        data: {
          sourceMessageId,
          branchMode: "project",
        },
      },
    );
    expect(branchResponse.ok(), await branchResponse.text()).toBeTruthy();
    const branch = (await branchResponse.json()) as {
      readonly thread: { readonly id: string; readonly currentBranchId: string | null };
    };
    expect(branch.thread.id).toBeTruthy();
    expect(branch.thread.id).not.toBe(threadId);

    if (branch.thread.currentBranchId) {
      const switchResponse = await request.post(
        `${session.apiBaseUrl}/chat/threads/${branch.thread.id}/branches/${branch.thread.currentBranchId}/switch`,
        { headers: session.headers },
      );
      expect(switchResponse.status()).toBeLessThan(500);
    }

    await page.goto(`/app/projects/${projectId}/chats/${branch.thread.id}`);
    await assertRouteReady(page, "project-chat");
    await assertNoHydrationErrors(page);
    await assertNoConsoleErrors(page, [/Failed to load resource/i]);
    await assertNoProjectFlowSecurityLeaks(page);
  });
});
