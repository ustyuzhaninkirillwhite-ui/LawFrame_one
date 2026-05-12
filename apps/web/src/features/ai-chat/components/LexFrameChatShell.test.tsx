import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ChatMessageDto, ChatThreadSummary } from "@lexframe/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LexFrameChatShell } from "./LexFrameChatShell";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  invalidateQueries: vi.fn(),
  chatApi: {
    listProjectThreads: vi.fn(),
    createProjectThread: vi.fn(),
    getThread: vi.fn(),
    listMessages: vi.fn(),
    streamMessage: vi.fn(),
    cancelStream: vi.fn(),
    branchThread: vi.fn(),
    regenerate: vi.fn(),
    edit: vi.fn(),
    listProjectKnowledge: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

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
    mocks.chatApi.streamMessage.mockResolvedValue({ streamId: "stream_1" });
  });

  it("renders a clean empty chat without inner thread list, context drawer, or warning panel", async () => {
    render(<LexFrameChatShell projectId="project_claim_001" initialThreadId={null} />);

    expect(await screen.findByText("С чего начнем?")).toBeInTheDocument();
    expect(screen.queryByText("Контекст проекта")).not.toBeInTheDocument();
    expect(screen.queryByText("Чат создан. История хранится в LexFrame DB.")).not.toBeInTheDocument();
    expect(screen.queryByText("Новый чат проекта")).not.toBeInTheDocument();
    expect(screen.queryByText(/Юридические материалы/i)).not.toBeInTheDocument();
  });

  it("creates a project chat, streams the first prompt, and navigates to the chat route", async () => {
    render(<LexFrameChatShell projectId="project_claim_001" initialThreadId={null} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Запрос к LexFrame" }), {
      target: { value: "Проверить позицию" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить сообщение" }));

    await waitFor(() => {
      expect(mocks.chatApi.createProjectThread).toHaveBeenCalledWith("project_claim_001", {
        title: "Проверить позицию",
        source: "project_chat",
      });
      expect(mocks.chatApi.streamMessage).toHaveBeenCalledWith("thread_created", {
        text: "Проверить позицию",
      });
      expect(mocks.push).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/chats/thread_created",
      );
    });
  });

  it("reloads persisted messages and shows a safe diagnostic when the stream fails", async () => {
    const providerError = Object.assign(
      new Error("raw provider invalid token should stay out of the UI"),
      { code: "AI_GATEWAY_NOT_READY" },
    );

    mocks.chatApi.listMessages
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [message("user", "LEXFRAME_CHAT_SMOKE_OK", "message_user")],
      });
    mocks.chatApi.streamMessage.mockRejectedValue(providerError);

    const { container } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "LEXFRAME_CHAT_SMOKE_OK" },
    });

    const sendButton = container.querySelector('button[type="submit"]');
    expect(sendButton).not.toBeNull();
    fireEvent.click(sendButton as HTMLElement);

    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK")).toBeInTheDocument();
    expect(screen.getByTestId("chat-stream-error")).toHaveTextContent(
      "AI_GATEWAY_NOT_READY",
    );
    expect(screen.queryByText(/invalid token/i)).not.toBeInTheDocument();
    expect(mocks.chatApi.streamMessage).toHaveBeenCalledWith("thread_existing", {
      text: "LEXFRAME_CHAT_SMOKE_OK",
    });
    await waitFor(() => {
      expect(mocks.chatApi.listMessages).toHaveBeenCalledTimes(2);
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["stage15-project-chats", "ws_1", "project_claim_001"],
    });
  });

  it("renders the successful stream snapshot while persisted messages refresh", async () => {
    mocks.chatApi.listMessages.mockResolvedValue({ items: [] });
    mocks.chatApi.streamMessage.mockResolvedValue({
      streamId: "stream_live",
      workspaceId: "ws_1",
      threadId: "thread_existing",
      messageId: "message_assistant_live",
      status: "completed",
      events: [
        {
          type: "text_delta",
          payload: {
            messageId: "message_assistant_live",
            delta: "LEXFRAME_CHAT_SMOKE_OK live response",
          },
        },
      ],
    });

    const { container } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "LEXFRAME_CHAT_SMOKE_OK" },
    });
    const sendButton = container.querySelector('button[type="submit"]');
    expect(sendButton).not.toBeNull();
    fireEvent.click(sendButton as HTMLElement);

    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK live response")).toBeInTheDocument();
    expect(
      document.querySelector('[data-message-role="assistant"]'),
    ).toBeInTheDocument();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["stage15-project-chats", "ws_1", "project_claim_001"],
    });
  });

  it("does not let a stale initial message load erase a completed assistant response", async () => {
    const initialLoad = deferred<{ readonly items: readonly ChatMessageDto[] }>();
    mocks.chatApi.listMessages
      .mockReturnValueOnce(initialLoad.promise)
      .mockResolvedValueOnce({
        items: [message("assistant", "LEXFRAME_CHAT_SMOKE_OK persisted response", "message_assistant_live")],
      });
    mocks.chatApi.streamMessage.mockResolvedValue({
      streamId: "stream_live",
      workspaceId: "ws_1",
      threadId: "thread_existing",
      messageId: "message_assistant_live",
      status: "completed",
      events: [
        {
          type: "text_delta",
          payload: {
            messageId: "message_assistant_live",
            delta: "LEXFRAME_CHAT_SMOKE_OK persisted response",
          },
        },
      ],
    });

    const { container } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "LEXFRAME_CHAT_SMOKE_OK" },
    });
    const sendButton = container.querySelector('button[type="submit"]');
    expect(sendButton).not.toBeNull();
    fireEvent.click(sendButton as HTMLElement);

    expect(await screen.findByText("LEXFRAME_CHAT_SMOKE_OK persisted response")).toBeInTheDocument();

    await act(async () => {
      initialLoad.resolve({ items: [] });
      await initialLoad.promise;
    });

    expect(screen.getByText("LEXFRAME_CHAT_SMOKE_OK persisted response")).toBeInTheDocument();
  });

  it("renders user and agent messages with distinct conversational alignment", async () => {
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

    const userMessage = container.querySelector('[data-message-role="user"]');
    const assistantMessage = container.querySelector('[data-message-role="assistant"]');

    expect(userMessage).toHaveClass("justify-end");
    expect(assistantMessage).toHaveClass("justify-start");
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
    createdBy: role === "user" ? "user_1" : null,
    requestId: null,
    traceId: null,
    parts: [
      {
        id: `${id}_part`,
        type: "text",
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
