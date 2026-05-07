import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const projectId = "project_claim_001";

test.describe("@stage18 @stage19 @stage20 regression live audit", () => {
  test("message action path creates only an AutomationIntent and does not create runtime side effects", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `stage18-20-regression-${Date.now()}@lexframe.local`,
      fullName: "Stage18 20 Regression",
    });
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };

    const chatResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/chats`,
      {
        headers,
        data: {
          title: "Stage 18-20 regression chat",
          source: "project_chat",
        },
      },
    );
    const chatText = await chatResponse.text();
    expect(chatResponse.ok(), chatText).toBeTruthy();
    const chat = JSON.parse(chatText) as {
      readonly chat: { readonly id: string };
    };

    const streamResponse = await request.post(
      `${session.apiBaseUrl}/chat/threads/${chat.chat.id}/messages:stream`,
      {
        headers,
        data: {
          text: "Создать автоматизацию без публикации и без запуска production.",
        },
      },
    );
    expect(streamResponse.ok(), await streamResponse.text()).toBeTruthy();

    const messagesResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads/${chat.chat.id}/messages`,
      { headers: session.headers },
    );
    const messagesText = await messagesResponse.text();
    expect(messagesResponse.ok(), messagesText).toBeTruthy();
    const messages = JSON.parse(messagesText) as {
      readonly items: readonly { readonly id: string; readonly role: string; readonly parts: readonly { readonly text: string | null }[] }[];
    };
    const assistantMessage = messages.items.find((message) => message.role === "assistant");
    expect(assistantMessage?.id).toBeTruthy();

    const intentResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/automation-intents`,
      {
        headers,
        data: {
          source: "project_chat_action",
          sourceThreadId: chat.chat.id,
          sourceMessageId: assistantMessage!.id,
          title: "Intent from chat action",
          userGoal: assistantMessage!.parts.map((part) => part.text ?? "").join("\n"),
          classification: "workspace_internal",
        },
      },
    );
    const intentText = await intentResponse.text();
    expect(intentResponse.ok(), intentText).toBeTruthy();
    const intent = JSON.parse(intentText) as {
      readonly intent: {
        readonly id: string;
        readonly source: string;
        readonly sourceThreadId: string | null;
        readonly sourceMessageId: string | null;
        readonly status: string;
      };
      readonly latestBlueprint: unknown;
    };
    expect(intent.intent.source).toBe("project_chat_action");
    expect(intent.intent.sourceThreadId).toBe(chat.chat.id);
    expect(intent.intent.sourceMessageId).toBe(assistantMessage!.id);
    expect(intent.intent.status).toBe("created");
    expect(intent.latestBlueprint).toBeNull();

    const securityResponse = await request.post(
      `${session.apiBaseUrl}/automation-builder/security/preflight`,
      { headers: session.headers },
    );
    const securityText = await securityResponse.text();
    expect(securityResponse.ok(), securityText).toBeTruthy();
    const security = JSON.parse(securityText) as {
      readonly canPublish: boolean;
      readonly canRunProduction: boolean;
      readonly frontendRuntimeCallsAllowed: boolean;
    };
    expect(security.canPublish).toBe(false);
    expect(security.canRunProduction).toBe(false);
    expect(security.frontendRuntimeCallsAllowed).toBe(false);
  });
});
