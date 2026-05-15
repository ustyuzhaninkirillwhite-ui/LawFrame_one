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
    createGlobalThread: vi.fn(),
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
    mocks.chatApi.createGlobalThread.mockResolvedValue({
      thread: thread("thread_global_created", "Глобальный чат", null),
    });
    mocks.chatApi.createAttachmentUploadIntents.mockResolvedValue({
      items: [],
      errors: [],
    });
    mocks.chatApi.completeAttachmentUpload.mockResolvedValue({
      attachment: {
        id: "attachment_uploaded",
        sourceType: "uploaded_file",
        sourceId: "attachment_uploaded",
        mode: "thread_attachment",
        classification: "workspace_internal",
        citationRequired: false,
        originalFilename: "demo.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        status: "uploaded",
        downloadPath: "/chat/attachments/attachment_uploaded/download",
        storageKey: null,
        metadata: {},
      },
    });
    mocks.chatApi.cancelStream.mockResolvedValue({
      streamId: "stream_live",
      threadId: "thread_existing",
      status: "cancelled",
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

  it("replaces thread messages when the route thread changes", async () => {
    mocks.chatApi.listMessages
      .mockResolvedValueOnce({
        items: [message("user", "THREAD_A_SHOULD_NOT_LEAK", "message_thread_a")],
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...message("user", "THREAD_B_VISIBLE", "message_thread_b"),
            threadId: "thread_next",
          },
        ],
      });

    const { rerender } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    expect(await screen.findByText("THREAD_A_SHOULD_NOT_LEAK")).toBeInTheDocument();

    rerender(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_next"
      />,
    );

    expect(await screen.findByText("THREAD_B_VISIBLE")).toBeInTheDocument();
    expect(screen.queryByText("THREAD_A_SHOULD_NOT_LEAK")).not.toBeInTheDocument();
  });

  it("ignores stream events from a previous route thread after navigation", async () => {
    let previousRouteEvent:
      | ((event: {
          readonly type: string;
          readonly payload: Record<string, unknown>;
        }) => void)
      | null = null;
    mocks.chatApi.listMessages
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [
          {
            ...message("user", "THREAD_B_VISIBLE", "message_thread_b_user"),
            threadId: "thread_next",
          },
          {
            ...message("assistant", "", "message_thread_b_assistant", "streaming"),
            threadId: "thread_next",
          },
        ],
      });
    mocks.chatApi.streamMessageEvents.mockImplementation(
      async (
        _threadId: string,
        _input: { readonly text: string; readonly clientMessageId?: string | null },
        handlers?: {
          readonly onEvent?: (event: {
            readonly type: string;
            readonly payload: Record<string, unknown>;
          }) => void;
        },
      ) => {
        previousRouteEvent = handlers?.onEvent ?? null;
        return new Promise<ChatStreamSnapshot>(() => undefined);
      },
    );

    const { rerender } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "THREAD_A_PENDING" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(previousRouteEvent).not.toBeNull();
    });

    rerender(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_next"
      />,
    );

    expect(await screen.findByText("THREAD_B_VISIBLE")).toBeInTheDocument();

    await act(async () => {
      previousRouteEvent?.({
        type: "message_start",
        payload: {
          streamId: "stream_old",
          threadId: "thread_existing",
          messageId: "message_thread_a_assistant",
        },
      });
      previousRouteEvent?.({
        type: "text_delta",
        payload: {
          messageId: "message_thread_a_assistant",
          delta: "THREAD_A_STREAM_LEAK",
        },
      });
    });

    expect(screen.queryByText("THREAD_A_STREAM_LEAK")).not.toBeInTheDocument();
    expect(screen.getByText("THREAD_B_VISIBLE")).toBeInTheDocument();
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

  it("creates global chats without project scope and navigates to the global route", async () => {
    render(<LexFrameChatShell projectId={null} initialThreadId={null} />);

    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "Глобальный вопрос" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(mocks.chatApi.createGlobalThread).toHaveBeenCalledWith({
        title: "Глобальный вопрос",
        kind: "general",
      });
      expect(mocks.push).toHaveBeenCalledWith("/chat/thread_global_created");
    });
    expect(mocks.chatApi.createProjectThread).not.toHaveBeenCalled();
  });

  it("uploads attachment bytes, completes the upload and sends returned attachment ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    mocks.chatApi.createAttachmentUploadIntents.mockResolvedValue({
      items: [
        {
          id: "attachment_uploaded",
          clientAttachmentId: "client-attachment-0",
          uploadUrl: "https://uploads.example.test/chat/attachment",
          method: "PUT",
          headers: { "content-type": "text/plain" },
          expiresAt: "2026-05-13T00:10:00.000Z",
          attachment: {
            id: "attachment_uploaded",
            sourceType: "uploaded_file",
            sourceId: "attachment_uploaded",
            mode: "thread_attachment",
            classification: "workspace_internal",
            citationRequired: false,
            originalFilename: "demo.txt",
            mimeType: "text/plain",
            sizeBytes: 4,
            status: "pending_upload",
            downloadPath: "/chat/attachments/attachment_uploaded/download",
            storageKey: null,
            metadata: {},
          },
        },
      ],
      errors: [],
    });

    const { container } = render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["demo"], "demo.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "Проанализируй вложение" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(mocks.chatApi.createAttachmentUploadIntents).toHaveBeenCalledWith({
        threadId: "thread_existing",
        files: [
          {
            clientAttachmentId: "client-attachment-0",
            filename: "demo.txt",
            mimeType: "text/plain",
            sizeBytes: 4,
          },
        ],
      });
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://uploads.example.test/chat/attachment",
      expect.objectContaining({
        method: "PUT",
        body: file,
      }),
    );
    expect(mocks.chatApi.completeAttachmentUpload).toHaveBeenCalledWith(
      "attachment_uploaded",
      { threadId: "thread_existing" },
    );
    expect(mocks.chatApi.streamMessageEvents).toHaveBeenCalledWith(
      "thread_existing",
      expect.objectContaining({
        text: "Проанализируй вложение",
        attachmentIds: ["attachment_uploaded"],
      }),
      expect.any(Object),
    );

    fetchSpy.mockRestore();
  });

  it("cancels an active stream through the backend and leaves a controlled state", async () => {
    mocks.chatApi.streamMessageEvents.mockImplementation(
      async (
        threadId: string,
        _input: { readonly text: string; readonly clientMessageId?: string | null },
        handlers?: {
          readonly onEvent?: (event: {
            readonly type: string;
            readonly payload: Record<string, unknown>;
          }) => void;
        },
      ) => {
        handlers?.onEvent?.({
          type: "run_status",
          payload: {
            streamId: "stream_live",
            threadId,
            messageId: "message_assistant_live",
            status: "streaming",
          },
        });
        return new Promise<ChatStreamSnapshot>(() => undefined);
      },
    );

    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "Долгий ответ" },
    });
    fireEvent.click(sendButton());
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Остановить генерацию|РћСЃС‚Р°РЅРѕРІРёС‚СЊ РіРµРЅРµСЂР°С†РёСЋ/,
      }),
    );

    await waitFor(() => {
      expect(mocks.chatApi.cancelStream).toHaveBeenCalledWith(
        "thread_existing",
        "stream_live",
      );
    });
    expect(
      await screen.findByText(
        /Генерация остановлена|Р“РµРЅРµСЂР°С†РёСЏ РѕСЃС‚Р°РЅРѕРІР»РµРЅР°/,
      ),
    ).toBeInTheDocument();
  });

  it("cancels an optimistic stream locally before the backend stream id arrives", async () => {
    mocks.chatApi.streamMessageEvents.mockImplementation(
      () => new Promise<ChatStreamSnapshot>(() => undefined),
    );

    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    fireEvent.change(screen.getByTestId("chat-composer-input"), {
      target: { value: "РћСЃС‚Р°РЅРѕРІРёС‚СЊ РґРѕ stream id" },
    });
    fireEvent.click(sendButton());
    fireEvent.click(await screen.findByLabelText("Остановить генерацию"));

    expect(mocks.chatApi.cancelStream).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Генерация остановлена."),
    ).toBeInTheDocument();
  });

  it("branches and regenerates assistant messages without deleting old history", async () => {
    mocks.chatApi.listMessages.mockResolvedValue({
      items: [
        message("user", "Исходный вопрос", "message_user"),
        {
          ...message("assistant", "Исходный ответ", "message_assistant"),
          branchInfo: {
            branchId: "branch_1",
            activeBranchId: "branch_1",
            ordinal: 1,
            total: 2,
            canSwitch: true,
          },
        },
      ],
    });
    mocks.chatApi.branchThread.mockResolvedValue({
      thread: thread("thread_branch", "Project branch"),
    });
    mocks.chatApi.regenerate.mockResolvedValue(
      snapshot("thread_existing", "Исходный вопрос", "Новый ответ ветки"),
    );

    render(
      <LexFrameChatShell
        projectId="project_claim_001"
        initialThreadId="thread_existing"
      />,
    );

    expect(await screen.findByText("Исходный ответ")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ветка|Р’РµС‚РєР°/ }));
    await waitFor(() => {
      expect(mocks.chatApi.branchThread).toHaveBeenCalledWith(
        "thread_existing",
        "message_assistant",
      );
      expect(mocks.push).toHaveBeenCalledWith(
        "/app/projects/project_claim_001/chats/thread_branch",
      );
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Повторить|РџРѕРІС‚РѕСЂРёС‚СЊ/,
      }),
    );
    expect(await screen.findByText("Новый ответ ветки")).toBeInTheDocument();
    expect(screen.getByText("Исходный ответ")).toBeInTheDocument();
  });
});

function sendButton() {
  return screen.getByRole("button", {
    name: /Отправить сообщение|РћС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ/,
  });
}

function thread(
  id: string,
  title: string,
  projectId: string | null = "project_claim_001",
): ChatThreadSummary {
  return {
    id,
    workspaceId: "ws_1",
    projectId,
    kind: projectId ? "project" : "general",
    visibility: projectId ? "project" : "private",
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
  status: ChatMessageDto["status"] = "completed",
): ChatMessageDto {
  return {
    id,
    threadId: "thread_existing",
    workspaceId: "ws_1",
    projectId: "project_claim_001",
    role,
    status,
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
