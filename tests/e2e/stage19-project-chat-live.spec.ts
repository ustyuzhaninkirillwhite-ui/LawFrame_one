import { expect, test } from "@playwright/test";
import { getWorkspaceApiSession } from "./helpers/api";
import { signInAsDemo } from "./helpers/auth";

const projectId = "project_claim_001";
const forbiddenSecretPattern =
  /(sk-|xai-|service_role|SUPABASE_SERVICE_ROLE|ACTIVEPIECES_API_KEY|AP_JWT_SECRET|AP_ENCRYPTION_KEY|BEGIN PRIVATE KEY)/i;

test.describe("@stage19 @project-chat Stage 19 project chat live audit", () => {
  test("persists project-scoped threads, streams through backend and blocks foreign project context", async ({
    page,
    request,
  }) => {
    await signInAsDemo(page, {
      email: `stage19-chat-${Date.now()}@lexframe.local`,
      fullName: "Stage19 Chat Audit",
    });
    const session = await getWorkspaceApiSession(page, request);
    const headers = {
      ...session.headers,
      "content-type": "application/json",
    };

    const readinessResponse = await request.get(
      `${session.apiBaseUrl}/readiness/stage19`,
      { headers: session.headers },
    );
    const readinessText = await readinessResponse.text();
    expect(readinessResponse.status(), readinessText).toBeLessThan(500);
    const readiness = JSON.parse(readinessText) as { readonly status: string };
    expect(readiness.status).not.toBe("unavailable");

    await page.goto(`/app/projects/${projectId}/chats`);
    await expect(page.locator("textarea:visible").first()).toBeVisible({
      timeout: 15_000,
    });

    const createThreadResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/chats`,
      {
        headers,
        data: {
          title: "Stage 19 audit project chat",
          source: "project_chat",
        },
      },
    );
    const createThreadText = await createThreadResponse.text();
    expect(createThreadResponse.ok(), createThreadText).toBeTruthy();
    const created = JSON.parse(createThreadText) as {
      readonly chat: { readonly id: string; readonly projectId: string };
    };
    expect(created.chat.projectId).toBe(projectId);

    const knowledgeResponse = await request.post(
      `${session.apiBaseUrl}/projects/${projectId}/knowledge`,
      {
        headers,
        data: {
          sourceType: "manual_note",
          sourceId: `stage19-note-${Date.now()}`,
          mode: "project_knowledge",
          classification: "workspace_internal",
          pinned: true,
          enabledForChat: true,
          citationRequired: true,
        },
      },
    );
    const knowledgeText = await knowledgeResponse.text();
    expect(knowledgeResponse.ok(), knowledgeText).toBeTruthy();
    const knowledge = JSON.parse(knowledgeText) as { readonly id: string };
    expect(knowledge.id).toBeTruthy();

    const streamResponse = await request.post(
      `${session.apiBaseUrl}/chat/threads/${created.chat.id}/messages:stream`,
      {
        headers,
        data: {
          text: "Создай краткий юридический план по материалам проекта.",
          attachments: [
            {
              sourceType: "manual_note",
              sourceId: knowledge.id,
              mode: "project_knowledge",
            },
          ],
        },
      },
    );
    const streamBody = await streamResponse.text();
    expect(streamResponse.ok(), streamBody).toBeTruthy();
    const stream = JSON.parse(streamBody) as {
      readonly streamId: string;
      readonly status: string;
      readonly events: readonly { readonly type: string; readonly payload: Record<string, unknown> }[];
    };
    expect(stream.status).toBe("completed");
    expect(stream.events.some((event) => event.type === "route_snapshot")).toBe(true);
    expect(JSON.stringify(stream)).toContain("default_chat");
    expect(JSON.stringify(stream)).toContain("deepseek-v4-flash");
    expect(JSON.stringify(stream)).not.toMatch(forbiddenSecretPattern);

    const messagesResponse = await request.get(
      `${session.apiBaseUrl}/chat/threads/${created.chat.id}/messages`,
      { headers: session.headers },
    );
    const messagesText = await messagesResponse.text();
    expect(messagesResponse.ok(), messagesText).toBeTruthy();
    const messages = JSON.parse(messagesText) as {
      readonly items: readonly { readonly id: string; readonly role: string }[];
    };
    expect(messages.items.some((message) => message.role === "user")).toBe(true);
    expect(messages.items.some((message) => message.role === "assistant")).toBe(true);

    await page.goto(`/app/projects/${projectId}/chats/${created.chat.id}`);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/chats/${created.chat.id}`));

    const resumeResponse = await request.post(
      `${session.apiBaseUrl}/chat/threads/${created.chat.id}/streams/${stream.streamId}/resume`,
      { headers: session.headers },
    );
    expect(resumeResponse.ok(), await resumeResponse.text()).toBeTruthy();

    const searchResponse = await request.get(
      `${session.apiBaseUrl}/chat/search?q=${encodeURIComponent("юридический")}&projectId=${projectId}`,
      { headers: session.headers },
    );
    expect(searchResponse.ok(), await searchResponse.text()).toBeTruthy();

    const branchResponse = await request.post(
      `${session.apiBaseUrl}/chat/threads/${created.chat.id}/branch`,
      {
        headers,
        data: {
          sourceMessageId: messages.items[0]?.id ?? null,
          branchMode: "project",
        },
      },
    );
    expect(branchResponse.ok(), await branchResponse.text()).toBeTruthy();

    const foreignKnowledgeResponse = await request.get(
      `${session.apiBaseUrl}/projects/foreign_project_001/knowledge`,
      { headers: session.headers },
    );
    expect(foreignKnowledgeResponse.status()).toBeGreaterThanOrEqual(400);
    expect(foreignKnowledgeResponse.status()).toBeLessThan(500);
  });
});
