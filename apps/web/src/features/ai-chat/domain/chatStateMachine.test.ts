import type { ChatMessageDto } from "@lexframe/contracts";
import { describe, expect, it } from "vitest";
import {
  chatRuntimeReducer,
  initialChatRuntimeState,
} from "./chatStateMachine";

describe("chatRuntimeReducer", () => {
  it("adds optimistic user message and assistant placeholder immediately", () => {
    const user = message({
      id: "client-message-1",
      role: "user",
      text: "Проверь договор",
      clientMessageId: "client-1",
      status: "completed",
    });
    const assistant = message({
      id: "assistant-pending-1",
      role: "assistant",
      text: "",
      status: "streaming",
    });

    const state = chatRuntimeReducer(initialChatRuntimeState, {
      type: "send_started",
      userMessage: user,
      assistantMessage: assistant,
      streamId: "stream-1",
    });

    expect(state.status).toBe("thinking");
    expect(state.activeStreamId).toBe("stream-1");
    expect(state.messages.map((item) => item.id)).toEqual([
      "client-message-1",
      "assistant-pending-1",
    ]);
  });

  it("streams deltas into the existing assistant message without duplicates", () => {
    const assistant = message({
      id: "assistant-pending-1",
      role: "assistant",
      text: "",
      status: "streaming",
    });
    const started = chatRuntimeReducer(initialChatRuntimeState, {
      type: "send_started",
      userMessage: message({
        id: "client-message-1",
        role: "user",
        text: "Привет",
        clientMessageId: "client-1",
      }),
      assistantMessage: assistant,
      streamId: "stream-1",
    });

    const next = chatRuntimeReducer(started, {
      type: "stream_event",
      event: {
        type: "text_delta",
        payload: {
          messageId: "assistant-pending-1",
          delta: "Здравствуйте.",
        },
      },
    });

    expect(next.status).toBe("streaming");
    expect(next.messages).toHaveLength(2);
    expect(next.messages[1]?.parts[0]?.text).toBe("Здравствуйте.");
  });

  it("reconciles a client message id to the server message id", () => {
    const clientUser = message({
      id: "client-message-1",
      role: "user",
      text: "Привет",
      clientMessageId: "client-1",
    });
    const started = chatRuntimeReducer(initialChatRuntimeState, {
      type: "send_started",
      userMessage: clientUser,
      assistantMessage: message({
        id: "assistant-pending-1",
        role: "assistant",
        text: "",
        status: "streaming",
      }),
      streamId: "stream-1",
    });

    const next = chatRuntimeReducer(started, {
      type: "server_reconciled",
      clientMessageId: "client-1",
      userMessage: {
        ...clientUser,
        id: "server-message-1",
      },
    });

    expect(next.messages.map((item) => item.id)).toContain("server-message-1");
    expect(next.messages.map((item) => item.id)).not.toContain(
      "client-message-1",
    );
  });
});

function message(input: {
  readonly id: string;
  readonly role: ChatMessageDto["role"];
  readonly text: string;
  readonly clientMessageId?: string | null;
  readonly status?: ChatMessageDto["status"];
}): ChatMessageDto {
  const now = new Date("2026-05-12T10:00:00.000Z").toISOString();
  return {
    id: input.id,
    threadId: "thread-1",
    workspaceId: "workspace-1",
    projectId: "project_claim_001",
    role: input.role,
    status: input.status ?? "completed",
    parentMessageId: null,
    clientMessageId: input.clientMessageId ?? null,
    branchId: null,
    branchInfo: null,
    run: null,
    createdBy: null,
    requestId: null,
    traceId: null,
    parts: [
      {
        id: `${input.id}-part`,
        type: input.role === "assistant" ? "markdown" : "text",
        text: input.text,
        payload: {},
        sequence: 0,
      },
    ],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}
