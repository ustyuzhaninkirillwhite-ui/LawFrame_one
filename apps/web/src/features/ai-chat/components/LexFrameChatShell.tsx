"use client";

import type {
  ChatMessageDto,
  ChatStreamEvent,
  ChatStreamSnapshot,
} from "@lexframe/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";
import { createLexFrameChatApi } from "../api/chatApi";
import { getChatMessageText } from "../domain/chatMappers";
import {
  chatRuntimeReducer,
  initialChatRuntimeState,
} from "../domain/chatStateMachine";
import { LexFrameThread } from "./LexFrameThread";

export function LexFrameChatShell({
  projectId,
  initialThreadId,
}: {
  readonly projectId: string | null;
  readonly initialThreadId: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { apiClient, sessionContext } = useSessionBridge();
  const chatApi = React.useMemo(() => createLexFrameChatApi(apiClient), [apiClient]);
  const chatThreadsQueryKey = React.useMemo(
    () => ["chatThreads", projectId ?? "global"] as const,
    [projectId],
  );
  const [runtime, dispatchRuntime] = React.useReducer(
    chatRuntimeReducer,
    initialChatRuntimeState,
  );
  const messages = runtime.messages;
  const [threadOverride, setThreadOverride] = React.useState<{
    readonly routeThreadId: string | null;
    readonly activeThreadId: string | null;
  } | null>(null);
  const activeThreadId =
    threadOverride?.routeThreadId === initialThreadId
      ? threadOverride.activeThreadId
      : initialThreadId;
  const setActiveThreadId = React.useCallback(
    (threadId: string | null) => {
      setThreadOverride({
        routeThreadId: initialThreadId,
        activeThreadId: threadId,
      });
    },
    [initialThreadId],
  );
  const messageLoadRequestId = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const canSend = sessionContext.permissions.includes("chat.create");
  const canCreateAutomation =
    Boolean(projectId) &&
    sessionContext.permissions.includes("automation_builder.create_intent");
  const chatRouteForThread = React.useCallback(
    (threadId: string) =>
      projectId ? `/app/projects/${projectId}/chats/${threadId}` : `/chat/${threadId}`,
    [projectId],
  );
  const invalidateProjectChatSurfaces = React.useCallback(() => {
    const workspaceId = sessionContext.activeWorkspace?.id;
    if (!workspaceId || !projectId) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["stage15-project-chats", workspaceId, projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["stage15-project-snapshot", workspaceId, projectId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["stage15-projects", workspaceId],
      }),
      queryClient.invalidateQueries({
        queryKey: chatThreadsQueryKey,
      }),
    ]);
  }, [chatThreadsQueryKey, projectId, queryClient, sessionContext.activeWorkspace?.id]);

  const loadMessages = React.useCallback(
    async (threadId: string | null) => {
      const requestId = messageLoadRequestId.current + 1;
      messageLoadRequestId.current = requestId;

      if (!threadId) {
        if (requestId === messageLoadRequestId.current) {
          dispatchRuntime({ type: "hydrate", messages: [] });
        }
        return [];
      }

      const response = await queryClient.fetchQuery({
        queryKey: chatMessagesQueryKey(threadId),
        queryFn: () => chatApi.listMessages(threadId),
      });
      const nextMessages = [...response.items];
      if (requestId === messageLoadRequestId.current) {
        dispatchRuntime({ type: "hydrate", messages: nextMessages });
        if (response.latestRun?.status === "recovering") {
          dispatchRuntime({
            type: "recovering",
            streamId: response.latestRun.streamId,
          });
        }
      }
      return nextMessages;
    },
    [chatApi, queryClient],
  );

  React.useEffect(() => {
    void loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  const sendMessage = React.useCallback(
    async (text: string, files: readonly File[] = []) => {
      let threadId = activeThreadId;
      let createdThread = false;

      if (!threadId) {
        if (projectId) {
          const created = await chatApi.createProjectThread(projectId, {
            title: text.slice(0, 80),
            source: "project_chat",
          });
          threadId = created.chat.id;
        } else {
          const created = await chatApi.createGlobalThread({
            title: text.slice(0, 80),
            kind: "general",
          });
          threadId = created.thread.id;
        }
        createdThread = true;
        setActiveThreadId(threadId);
      }

      const clientMessageId = createClientMessageId();
      const optimisticStreamId = `client-stream-${clientMessageId}`;
      const createdAt = new Date().toISOString();
      dispatchRuntime({
        type: "send_started",
        streamId: optimisticStreamId,
        userMessage: createOptimisticMessage({
          id: `client-message-${clientMessageId}`,
          threadId,
          projectId,
          workspaceId: sessionContext.activeWorkspace?.id ?? "",
          role: "user",
          status: "completed",
          text,
          clientMessageId,
          createdAt,
          attachments: createOptimisticAttachments(files),
        }),
        assistantMessage: createOptimisticMessage({
          id: `assistant-placeholder-${clientMessageId}`,
          threadId,
          projectId,
          workspaceId: sessionContext.activeWorkspace?.id ?? "",
          role: "assistant",
          status: "streaming",
          text: "",
          clientMessageId: null,
          createdAt,
          attachments: [],
        }),
      });
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      try {
        const attachmentIds = files.length
          ? await uploadChatAttachments(chatApi, threadId, files)
          : [];
        const snapshot = await chatApi.streamMessageEvents(
          threadId,
          { text, clientMessageId, attachmentIds },
          {
            signal: abortControllerRef.current.signal,
            onEvent: (event) => {
              if (event.type !== "done") {
                dispatchRuntime({
                  type: "stream_event",
                  event: event as ChatStreamEvent,
                });
              }
            },
          },
        );
        dispatchRuntime({
          type: "server_reconciled",
          clientMessageId,
          userMessage: snapshot.userMessage ?? null,
          assistantMessage: snapshot.assistantMessage ?? null,
        });
        const snapshotMessage = createAssistantMessageFromSnapshot(snapshot, projectId);
        if (snapshotMessage) {
          dispatchRuntime({
            type: "completed",
            assistantMessage: snapshot.assistantMessage ?? snapshotMessage,
          });
        }
        const persistedMessages = await loadMessages(threadId);
        if (
          snapshotMessage &&
          !persistedMessages.some((message) => message.id === snapshotMessage.id)
        ) {
          dispatchRuntime({
            type: "completed",
            assistantMessage: snapshot.assistantMessage ?? snapshotMessage,
          });
        }

        if (createdThread) {
          router.push(chatRouteForThread(threadId));
        }
      } catch (error) {
        await loadMessages(threadId).catch(() => undefined);
        dispatchRuntime({
          type: "failed",
          errorMessage: formatChatStreamError(error),
        });

        if (createdThread) {
          router.push(chatRouteForThread(threadId));
        }
      } finally {
        if (threadId) {
          void queryClient.invalidateQueries({
            queryKey: chatMessagesQueryKey(threadId),
          });
          void queryClient.invalidateQueries({
            queryKey: chatThreadQueryKey(threadId),
          });
        }
        if (runtime.activeStreamId) {
          void queryClient.invalidateQueries({
            queryKey: chatRunQueryKey(runtime.activeStreamId),
          });
        }
        abortControllerRef.current = null;
        invalidateProjectChatSurfaces();
      }
    },
    [
      activeThreadId,
      chatApi,
      chatRouteForThread,
      invalidateProjectChatSurfaces,
      loadMessages,
      projectId,
      queryClient,
      router,
      runtime.activeStreamId,
      sessionContext.activeWorkspace?.id,
      setActiveThreadId,
    ],
  );

  const cancelStream = React.useCallback(() => {
    abortControllerRef.current?.abort();
    if (!activeThreadId || !runtime.activeStreamId) {
      dispatchRuntime({ type: "cancelled" });
      return;
    }

    void chatApi.cancelStream(activeThreadId, runtime.activeStreamId).finally(() => {
      dispatchRuntime({ type: "cancelled" });
    });
  }, [activeThreadId, chatApi, runtime.activeStreamId]);

  const branch = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId) {
        return;
      }

      const response = await chatApi.branchThread(activeThreadId, messageId);
      setActiveThreadId(response.thread.id);
      router.push(chatRouteForThread(response.thread.id));
    },
    [activeThreadId, chatApi, chatRouteForThread, router, setActiveThreadId],
  );

  const regenerate = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId) {
        return;
      }

      try {
        const snapshot = await chatApi.regenerate(activeThreadId, messageId);
        if (snapshot.assistantMessage) {
          dispatchRuntime({
            type: "completed",
            assistantMessage: snapshot.assistantMessage,
          });
        }
        await loadMessages(activeThreadId);
      } catch (error) {
        await loadMessages(activeThreadId).catch(() => undefined);
        dispatchRuntime({
          type: "failed",
          errorMessage: formatChatStreamError(error),
        });
      }
    },
    [activeThreadId, chatApi, loadMessages],
  );

  const createAutomationFromMessage = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId || !projectId) {
        return;
      }

      const message = messages.find((item) => item.id === messageId);
      if (!message) {
        return;
      }

      const text = getChatMessageText(message).trim();
      const response = await apiClient.createAutomationIntent(projectId, {
        source: "project_chat_action",
        sourceThreadId: activeThreadId,
        sourceMessageId: message.id,
        title: text.slice(0, 80) || "Automation intent from project chat",
        userGoal: text || "/создать_автоматизацию",
        classification: "workspace_internal",
      });
      router.push(
        `/app/projects/${projectId}/automation-builder/${response.intent.id}`,
      );
    },
    [activeThreadId, apiClient, messages, projectId, router],
  );

  return (
    <section className="flex h-full min-h-0 flex-1 overflow-hidden bg-[color:var(--lf-bg-panel)]">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--lf-border)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--lf-text-muted)]">
            LexFrame AI
          </div>
        </header>
        <LexFrameThread
          messages={messages}
          isRunning={isChatRunning(runtime.status)}
          runStatus={runtime.status}
          streamErrorMessage={runtime.errorMessage}
          disabled={!canSend}
          onSend={sendMessage}
          onCancel={cancelStream}
          onRegenerate={(messageId) => void regenerate(messageId)}
          onBranch={(messageId) => void branch(messageId)}
          onCreateAutomation={
            canCreateAutomation
              ? (messageId) => void createAutomationFromMessage(messageId)
              : undefined
          }
        />
      </div>
    </section>
  );
}

function isChatRunning(status: string) {
  return (
    status === "uploading" ||
    status === "sending" ||
    status === "queued" ||
    status === "thinking" ||
    status === "streaming" ||
    status === "recovering"
  );
}

function chatMessagesQueryKey(threadId: string) {
  return ["chatMessages", threadId] as const;
}

function chatThreadQueryKey(threadId: string) {
  return ["chatThread", threadId] as const;
}

function chatRunQueryKey(runId: string) {
  return ["chatRun", runId] as const;
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createOptimisticMessage(input: {
  readonly id: string;
  readonly threadId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly role: "user" | "assistant";
  readonly status: ChatMessageDto["status"];
  readonly text: string;
  readonly clientMessageId: string | null;
  readonly createdAt: string;
  readonly attachments?: ChatMessageDto["attachments"];
}): ChatMessageDto {
  return {
    id: input.id,
    threadId: input.threadId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    role: input.role,
    status: input.status,
    parentMessageId: null,
    clientMessageId: input.clientMessageId,
    branchId: null,
    branchInfo: null,
    run: null,
    createdBy: null,
    requestId: null,
    traceId: null,
    parts: [
      {
        id: `${input.id}_part`,
        type: input.role === "assistant" ? "markdown" : "text",
        text: input.text,
        payload: {},
        sequence: 0,
      },
    ],
    attachments: input.attachments ?? [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

function createOptimisticAttachments(files: readonly File[]): ChatMessageDto["attachments"] {
  return files.map((file, index) => ({
    id: `client-attachment-${index}-${file.name}`,
    sourceType: "uploaded_file",
    sourceId: `client-attachment-${index}-${file.name}`,
    mode: "thread_attachment",
    classification: "workspace_internal",
    citationRequired: false,
    originalFilename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    status: "pending_upload",
    downloadPath: null,
    storageKey: null,
    metadata: {},
  }));
}

async function uploadChatAttachments(
  chatApi: ReturnType<typeof createLexFrameChatApi>,
  threadId: string,
  files: readonly File[],
) {
  const filesWithIds = files.map((file, index) => ({
    file,
    clientAttachmentId: `client-attachment-${index}`,
  }));
  const intents = await chatApi.createAttachmentUploadIntents({
    threadId,
    files: filesWithIds.map(({ file, clientAttachmentId }) => ({
      clientAttachmentId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    })),
  });

  if (intents.errors.length > 0) {
    const code = intents.errors[0]?.code ?? "CHAT_ATTACHMENT_INVALID";
    throw Object.assign(new Error(code), { code });
  }

  const uploadedIds: string[] = [];
  for (const item of intents.items) {
    const file = filesWithIds.find(
      (entry) => entry.clientAttachmentId === item.clientAttachmentId,
    )?.file;

    if (!file) {
      continue;
    }

    const response = await fetch(item.uploadUrl, {
      method: item.method,
      headers: item.headers,
      body: file,
    });

    if (!response.ok) {
      throw Object.assign(new Error("CHAT_ATTACHMENT_UPLOAD_FAILED"), {
        code: "CHAT_ATTACHMENT_UPLOAD_FAILED",
      });
    }

    await chatApi.completeAttachmentUpload(item.id, { threadId });
    uploadedIds.push(item.id);
  }

  return uploadedIds;
}

function formatChatStreamError(error: unknown): string {
  const code = getSafeErrorCode(error);

  if (code) {
    return `Не удалось получить ответ LexFrame AI. Код: ${code}. Проверьте подключение провайдера в настройках.`;
  }

  return "Не удалось получить ответ LexFrame AI. Проверьте подключение провайдера в настройках.";
}

function getSafeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;

  if (typeof code !== "string" || !/^[A-Z0-9_:-]{2,80}$/.test(code)) {
    return null;
  }

  return code;
}

function createAssistantMessageFromSnapshot(
  snapshot: ChatStreamSnapshot,
  projectId: string | null,
): ChatMessageDto | null {
  const text = snapshot.events
    .filter((event) => event.type === "text_delta")
    .map((event) =>
      typeof event.payload.delta === "string" ? event.payload.delta : "",
    )
    .join("")
    .trim();

  if (!text) {
    return null;
  }

  const timestamp = new Date().toISOString();
  return {
    id: snapshot.messageId,
    threadId: snapshot.threadId,
    workspaceId: snapshot.workspaceId,
    projectId,
    role: "assistant",
    status: snapshot.status === "completed" ? "completed" : "streaming",
    parentMessageId: null,
    createdBy: null,
    requestId: null,
    traceId: null,
    parts: [
      {
        id: `${snapshot.messageId}_stream_text`,
        type: "markdown",
        text,
        payload: {},
        sequence: 0,
      },
    ],
    attachments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
