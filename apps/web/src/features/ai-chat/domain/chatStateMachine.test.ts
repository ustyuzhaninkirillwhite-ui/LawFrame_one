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

  it("replaces an optimistic user message when hydrate returns the same client message id", () => {
    const started = chatRuntimeReducer(initialChatRuntimeState, {
      type: "send_started",
      userMessage: message({
        id: "client-message-1",
        role: "user",
        text: "BLOCK3_FAIL_ONCE",
        clientMessageId: "client-1",
      }),
      assistantMessage: message({
        id: "assistant-pending-1",
        role: "assistant",
        text: "",
        status: "streaming",
      }),
      streamId: "stream-1",
    });

    const next = chatRuntimeReducer(started, {
      type: "hydrate",
      messages: [
        message({
          id: "server-message-1",
          role: "user",
          text: "BLOCK3_FAIL_ONCE",
          clientMessageId: "client-1",
        }),
      ],
    });

    expect(next.messages.map((item) => item.id)).toContain("server-message-1");
    expect(next.messages.map((item) => item.id)).not.toContain(
      "client-message-1",
    );
    expect(
      next.messages.filter((item) => item.clientMessageId === "client-1"),
    ).toHaveLength(1);
  });

  it("replaces the visible thread snapshot on hydrate instead of keeping messages from another thread", () => {
    const previousThreadMessage = message({
      id: "message-thread-a",
      role: "user",
      text: "THREAD_A_SHOULD_NOT_LEAK",
    });
    const nextThreadMessage = {
      ...message({
        id: "message-thread-b",
        role: "user",
        text: "THREAD_B_VISIBLE",
      }),
      threadId: "thread-b",
    };

    const next = chatRuntimeReducer(
      {
        ...initialChatRuntimeState,
        messages: [previousThreadMessage],
      },
      {
        type: "hydrate",
        messages: [nextThreadMessage],
      },
    );

    expect(next.messages.map((item) => item.id)).toEqual(["message-thread-b"]);
    expect(next.messages.map((item) => item.threadId)).toEqual(["thread-b"]);
  });

  it("moves through queued, thinking, streaming, completed, failed, cancelled and recovering states", () => {
    const started = chatRuntimeReducer(initialChatRuntimeState, {
      type: "send_started",
      userMessage: message({
        id: "client-message-1",
        role: "user",
        text: "Проверь позицию",
        clientMessageId: "client-1",
      }),
      assistantMessage: message({
        id: "assistant-pending-1",
        role: "assistant",
        text: "",
        status: "streaming",
      }),
      streamId: "stream-1",
    });
    const queued = chatRuntimeReducer(started, {
      type: "stream_event",
      event: {
        type: "run_status",
        payload: { streamId: "stream-1", status: "queued" },
      },
    });
    const thinking = chatRuntimeReducer(queued, {
      type: "stream_event",
      event: {
        type: "run_status",
        payload: { streamId: "stream-1", status: "thinking" },
      },
    });
    const streaming = chatRuntimeReducer(thinking, {
      type: "stream_event",
      event: {
        type: "text_delta",
        payload: {
          messageId: "assistant-pending-1",
          delta: "Нужны факты.",
        },
      },
    });
    const completed = chatRuntimeReducer(streaming, {
      type: "stream_event",
      event: {
        type: "message_done",
        payload: { messageId: "assistant-pending-1", status: "completed" },
      },
    });
    const failed = chatRuntimeReducer(streaming, {
      type: "failed",
      errorMessage: "AI_GATEWAY_NOT_READY",
    });
    const cancelled = chatRuntimeReducer(streaming, { type: "cancelled" });
    const recovering = chatRuntimeReducer(completed, {
      type: "recovering",
      streamId: "stream-recover",
    });

    expect(queued.status).toBe("queued");
    expect(thinking.status).toBe("thinking");
    expect(streaming.status).toBe("streaming");
    expect(completed.status).toBe("completed");
    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toBe("AI_GATEWAY_NOT_READY");
    expect(cancelled.status).toBe("cancelled");
    expect(recovering.status).toBe("recovering");
    expect(recovering.activeStreamId).toBe("stream-recover");
  });

  it("keeps branch variants as distinct messages while preserving chronological order", () => {
    const firstBranch = message({
      id: "assistant-branch-1",
      role: "assistant",
      text: "Первый вариант",
      status: "completed",
    });
    const secondBranch = {
      ...message({
        id: "assistant-branch-2",
        role: "assistant",
        text: "Второй вариант",
        status: "completed",
      }),
      branchId: "branch-2",
    };

    const state = chatRuntimeReducer(
      {
        ...initialChatRuntimeState,
        messages: [firstBranch],
      },
      {
        type: "completed",
        assistantMessage: secondBranch,
      },
    );

    expect(state.messages.map((item) => item.id)).toEqual([
      "assistant-branch-1",
      "assistant-branch-2",
    ]);
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
