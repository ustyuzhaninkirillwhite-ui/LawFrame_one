import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ChatMessageDto, ChatStreamSnapshot, ChatThreadSummary } from "@lexframe/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LexFrameChatShell } from "./LexFrameChatShell";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  invalidateQueries: vi.fn(),
  fetchQuery: vi.fn(),
  chatApi: {
    listProjectThreads: vi.fn(),
    createProjectThread: vi.fn(),
    getThread: vi.fn(),
    listMessages: vi.fn(),
    streamMessage: vi.fn(),
    streamMessageEvents: vi.fn(),
    cancelStream: vi.fn(),
    branchThread: vi.fn(),
    regenerate: vi.fn(),
    edit: vi.fn(),
    listProjectKnowledge: vi.fn(),
    createAttachmentUploadIntents: vi.fn(),
    completeAttachmentUpload: vi.fn(),
    deleteAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@tanstack/react-query", () => {
  const queryClient = {
    fetchQuery: mocks.fetchQuery,
    invalidateQueries: mocks.invalidateQueries,
  };

  return {
    useQueryClient: () => queryClient,
  };
});

vi.mock("@/providers/session-provider", () => ({
  useSessionBridge: () => ({
    apiClient: {
      createAutomationIntent: vi.fn(),
    },
    sessionContext: {
      activeWorkspace: { id: "ws_1" },
      permissions: ["chat.create", "automation_builder.create_intent"],
    },
  }),
}));

vi.mock("../api/chatApi", () => ({
  createLexFrameChatApi: () => mocks.chatApi,
}));

vi.mock("../runtime/useLexFrameExternalStoreRuntime", () => ({
  useLexFrameExternalStoreRuntime: () => ({}),
}));

vi.mock("@assistant-ui/react", () => {
  const Passthrough = ({ children }: { readonly children?: unknown }) => children;

  return {
    AssistantRuntimeProvider: Passthrough,
    ComposerPrimitive: {
      Root: Passthrough,
      Input: () => null,
      Send: () => null,
    },
    MessagePrimitive: {
      Root: Passthrough,
      Parts: () => null,
    },
    ThreadPrimitive: {
      Root: () => null,
      Viewport: Passthrough,
      Messages: () => null,
    },
  };
});

describe("LexFrameChatShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.push.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.fetchQuery.mockReset();
    mocks.fetchQuery.mockImplementation(
      ({ queryFn }: { readonly queryFn: () => Promise<unknown> }) => queryFn(),
    );
    for (const apiMock of Object.values(mocks.chatApi)) {
      apiMock.mockReset();
    }
    mocks.chatApi.listProjectThreads.mockResolvedValue({
      items: [thread("thread_existing", "Новый чат проекта")],
    });
    mocks.chatApi.listMessages.mockResolvedValue({ items: [] });
    mocks.chatApi.listProjectKnowledge.mockResolvedValue({ items: [] });
    mocks.chatApi.createProjectThread.mockResolvedValue({
      chat: {
        id: "thread_created",
        projectId: "project_claim_001",
        title: "Проверить позицию",
        status: "active",
        lastMessagePreview: "",
        selectedDocumentIds: [],
        linkedAutomationId: null,
        updatedAt: "2026-05-08T10:00:00.000Z",
      },
      session: {} as never,
    });
    mocks.chatApi.streamMessageEvents.mockImplementation(
      async (
        threadId: string,
        input: { readonly text: string; readonly clientMessageId?: string | null },
        handlers?: {
          readonly onEvent?: (event: {
            readonly type: string;
            readonly payload: Record<string, unknown>;
          }) => void;
        },
      ) => {
        handlers?.onEvent?.({
          type: "message_start",
          payload: {
            streamId: "stream_live",
            threadId,
            messageId: "message_assistant_live",
            clientMessageId: input.clientMessageId ?? null,
          },
        });
        handlers?.onEvent?.({
          type: "run_status",
          payload: {
            streamId: "stream_live",
            threadId,
            messageId: "message_assistant_live",
            status: "streaming",
          },
        });
        handlers?.onEvent?.({
          type: "text_delta",
          payload: {
            messageId: "message_assistant_live",
            delta: "LEXFRAME_CHAT_SMOKE_OK live response",
          },
        });
        return snapshot(threadId, input.text);
      },
    );
  });

  it("renders the empty chat state without duplicating the project chat history sidebar", async () => {
    render(<LexFrameChatShell projectId="project_claim_001" initialThreadId={null} />);

    expect(await screen.findByText("С чего начнем?")).toBeInTheDocument();
    expect(screen.queryByText("Чаты")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новый чат" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Поиск в чатах" })).not.toBeInTheDocument();
    expect(screen.queryByText("Контекст проекта")).not.toBeInTheDocument();
  });

  it("creates a project chat, shows optimistic messages, streams, and navigates", async () => {
    render(<LexFrameChatShell projectId="project_claim_001" initialThreadId={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Запрос к LexFrame" }), {
      target: { value: "Проверить позицию" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    await waitFor(() => {
      expect(screen.getAllByText("Проверить позицию").length).toBeGreaterThan(0);
    });
    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK live response")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.chatApi.createProjectThread).toHaveBeenCalledWith("project_claim_001", {
        title: "Проверить позицию",
        source: "project_chat",
      });
      expect(mocks.chatApi.streamMessageEvents).toHaveBeenCalledWith(
        "thread_created",
        expect.objectContaining({ text: "Проверить позицию" }),
        expect.any(Object),
      );
      expect(mocks.push).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/chats/thread_created",
      );
    });
  });

  it("keeps the user message visible and shows a safe diagnostic when stream fails", async () => {
    const providerError = Object.assign(
      new Error("raw provider invalid token should stay out of the UI"),
      { code: "AI_GATEWAY_NOT_READY" },
    );
    mocks.chatApi.listMessages
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [message("user", "LEXFRAME_CHAT_SMOKE_OK", "message_user")],
      });
    mocks.chatApi.streamMessageEvents.mockRejectedValue(providerError);

    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Запрос к LexFrame" }), {
      target: { value: "LEXFRAME_CHAT_SMOKE_OK" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK")).toBeInTheDocument();
    expect(screen.getByTestId("chat-stream-error")).toHaveTextContent(
      "AI_GATEWAY_NOT_READY",
    );
    expect(screen.queryByText(/invalid token/i)).not.toBeInTheDocument();
    expect(mocks.chatApi.streamMessageEvents).toHaveBeenCalledWith(
      "thread_existing",
      expect.objectContaining({ text: "LEXFRAME_CHAT_SMOKE_OK" }),
      expect.any(Object),
    );
  });

  it("lets the user attach and remove a file before sending", async () => {
    const { container } = render(
      <LexFrameChatShell projectId="project_claim_001" initialThreadId={null} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["demo"], "demo.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("demo.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Удалить файл demo.txt" }));
    expect(screen.queryByText("demo.txt")).not.toBeInTheDocument();
  });

  it("does not let a stale initial message load erase a completed assistant response", async () => {
    const initialLoad = deferred<{ readonly items: readonly ChatMessageDto[] }>();
    mocks.chatApi.listMessages
      .mockReturnValueOnce(initialLoad.promise)
      .mockResolvedValueOnce({
        items: [
          message(
            "assistant",
            "LEXFRAME_CHAT_SMOKE_OK persisted response",
            "message_assistant_live",
          ),
        ],
      });
    mocks.chatApi.streamMessageEvents.mockResolvedValue(
      snapshot("thread_existing", "LEXFRAME_CHAT_SMOKE_OK", "LEXFRAME_CHAT_SMOKE_OK persisted response"),
    );

    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Запрос к LexFrame" }), {
      target: { value: "LEXFRAME_CHAT_SMOKE_OK" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK persisted response")).toBeInTheDocument();

    await act(async () => {
      initialLoad.resolve({ items: [] });
      await initialLoad.promise;
    });

    expect(screen.getByText("LEXFRAME_CHAT_SMOKE_OK persisted response")).toBeInTheDocument();
  });

  it("renders user and assistant messages with distinct conversational alignment", async () => {
    mocks.chatApi.listMessages.mockResolvedValue({
      items: [
        message("user", "Я написал запрос", "message_user"),
        message("assistant", "Агент ответил по делу", "message_assistant"),
        message("system", "technical system note", "message_system"),
      ],
    });

    const { container } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    expect(await screen.findByText("Я написал запрос")).toBeInTheDocument();
    expect(screen.getByText("Агент ответил по делу")).toBeInTheDocument();
    expect(screen.queryByText("technical system note")).not.toBeInTheDocument();

    expect(container.querySelector('[data-message-role="user"]')).toHaveClass(
      "justify-end",
    );
    expect(
      container.querySelector('[data-message-role="assistant"]'),
    ).toHaveClass("justify-start");
  });

  it("reloads messages when the route thread changes", async () => {
    const { rerender } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    await waitFor(() => {
      expect(mocks.chatApi.listMessages).toHaveBeenCalledWith(
        "thread_existing",
      );
    });

    mocks.chatApi.listMessages.mockClear();
    rerender(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_next"
      />,
    );

    await waitFor(() => {
      expect(mocks.chatApi.listMessages).toHaveBeenCalledWith("thread_next");
    });
  });

  it("loads the active thread messages through the Stage 22 chat query key", async () => {
    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    await waitFor(() => {
      expect(mocks.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["chatMessages", "thread_existing"],
        }),
      );
    });
  });
});

function thread(id: string, title: string): ChatThreadSummary {
  return {
    id,
    workspaceId: "ws_1",
    projectId: "project_claim_001",
    kind: "project",
    visibility: "project",
    status: "active",
    title,
    lastMessagePreview: null,
    currentBranchId: null,
    createdBy: "user_1",
    createdAt: "2026-05-08T10:00:00.000Z",
    updatedAt: "2026-05-08T10:00:00.000Z",
    archivedAt: null,
    deletedAt: null,
  };
}

function message(
  role: ChatMessageDto["role"],
  text: string,
  id: string,
): ChatMessageDto {
  return {
    id,
    threadId: "thread_existing",
    workspaceId: "ws_1",
    projectId: "project_claim_001",
    role,
    status: "completed",
    parentMessageId: null,
    clientMessageId: null,
    branchId: null,
    branchInfo: null,
    run: null,
    createdBy: role === "user" ? "user_1" : null,
    requestId: null,
    traceId: null,
    parts: [
      {
        id: `${id}_part`,
        type: role === "assistant" ? "markdown" : "text",
        text,
        payload: {},
        sequence: 0,
      },
    ],
    attachments: [],
    createdAt: "2026-05-08T10:00:00.000Z",
    updatedAt: "2026-05-08T10:00:00.000Z",
  };
}

function snapshot(
  threadId: string,
  userText: string,
  assistantText = "LEXFRAME_CHAT_SMOKE_OK live response",
): ChatStreamSnapshot {
  return {
    streamId: "stream_live",
    workspaceId: "ws_1",
    threadId,
    messageId: "message_assistant_live",
    status: "completed",
    clientMessageId: "client-message-1",
    userMessage: message("user", userText, "message_user"),
    assistantMessage: message("assistant", assistantText, "message_assistant_live"),
    run: null,
    events: [
      {
        type: "text_delta",
        payload: {
          messageId: "message_assistant_live",
          delta: assistantText,
        },
      },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
