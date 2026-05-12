"use client";

import type { ChatMessageDto, ChatStreamSnapshot } from "@lexframe/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";
import { createLexFrameChatApi } from "../api/chatApi";
import { getChatMessageText } from "../domain/chatMappers";
import { LexFrameThread } from "./LexFrameThread";

export function LexFrameChatShell({
  projectId,
  initialThreadId,
}: {
  readonly projectId: string;
  readonly initialThreadId: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { apiClient, sessionContext } = useSessionBridge();
  const chatApi = React.useMemo(() => createLexFrameChatApi(apiClient), [apiClient]);
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(
    initialThreadId,
  );
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeStreamId, setActiveStreamId] = React.useState<string | null>(null);
  const [streamErrorMessage, setStreamErrorMessage] = React.useState<string | null>(
    null,
  );
  const messageLoadRequestId = React.useRef(0);
  const canSend = sessionContext.permissions.includes("chat.create");
  const canCreateAutomation = sessionContext.permissions.includes(
    "automation_builder.create_intent",
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
    ]);
  }, [projectId, queryClient, sessionContext.activeWorkspace?.id]);

  const loadMessages = React.useCallback(
    async (threadId: string | null) => {
      const requestId = messageLoadRequestId.current + 1;
      messageLoadRequestId.current = requestId;

      if (!threadId) {
        if (requestId === messageLoadRequestId.current) {
          setMessages([]);
        }
        return [];
      }

      const response = await chatApi.listMessages(threadId);
      const nextMessages = [...response.items];
      if (requestId === messageLoadRequestId.current) {
        setMessages(nextMessages);
      }
      return nextMessages;
    },
    [chatApi],
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveThreadId(initialThreadId);
  }, [initialThreadId]);

  React.useEffect(() => {
    void loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      let threadId = activeThreadId;
      let createdThread = false;

      if (!threadId) {
        const created = await chatApi.createProjectThread(projectId, {
          title: text.slice(0, 80),
          source: "project_chat",
        });
        threadId = created.chat.id;
        createdThread = true;
        setActiveThreadId(threadId);
      }

      setStreamErrorMessage(null);
      setActiveStreamId(null);
      setIsRunning(true);
      try {
        const snapshot = await chatApi.streamMessage(threadId, { text });
        setActiveStreamId(snapshot.streamId);
        const snapshotMessage = createAssistantMessageFromSnapshot(snapshot, projectId);
        if (snapshotMessage) {
          setMessages((current) => upsertChatMessage(current, snapshotMessage));
        }
        const persistedMessages = await loadMessages(threadId);
        if (
          snapshotMessage &&
          !persistedMessages.some((message) => message.id === snapshotMessage.id)
        ) {
          setMessages((current) => upsertChatMessage(current, snapshotMessage));
        }

        if (createdThread) {
          router.push(`/app/projects/${projectId}/chats/${threadId}`);
        }
      } catch (error) {
        await loadMessages(threadId).catch(() => undefined);
        setStreamErrorMessage(formatChatStreamError(error));

        if (createdThread) {
          router.push(`/app/projects/${projectId}/chats/${threadId}`);
        }
      } finally {
        setIsRunning(false);
        invalidateProjectChatSurfaces();
      }
    },
    [
      activeThreadId,
      chatApi,
      invalidateProjectChatSurfaces,
      loadMessages,
      projectId,
      router,
    ],
  );

  const cancelStream = React.useCallback(() => {
    if (!activeThreadId || !activeStreamId) {
      setIsRunning(false);
      return;
    }

    void chatApi.cancelStream(activeThreadId, activeStreamId).finally(() => {
      setIsRunning(false);
    });
  }, [activeStreamId, activeThreadId, chatApi]);

  const branch = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId) {
        return;
      }

      const response = await chatApi.branchThread(activeThreadId, messageId);
      setActiveThreadId(response.thread.id);
      router.push(`/app/projects/${projectId}/chats/${response.thread.id}`);
    },
    [activeThreadId, chatApi, projectId, router],
  );

  const regenerate = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId) {
        return;
      }

      setIsRunning(true);
      setStreamErrorMessage(null);
      try {
        const snapshot = await chatApi.regenerate(activeThreadId, messageId);
        setActiveStreamId(snapshot.streamId);
        await loadMessages(activeThreadId);
      } catch (error) {
        await loadMessages(activeThreadId).catch(() => undefined);
        setStreamErrorMessage(formatChatStreamError(error));
      } finally {
        setIsRunning(false);
      }
    },
    [activeThreadId, chatApi, loadMessages],
  );

  const createAutomationFromMessage = React.useCallback(
    async (messageId: string) => {
      if (!activeThreadId) {
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
    <section className="flex min-h-[calc(100vh-9rem)] flex-1 flex-col overflow-hidden bg-[color:var(--lf-bg-panel)]">
      <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--lf-border)] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--lf-text-muted)]">
          LexFrame AI
        </div>
      </header>
      <LexFrameThread
        messages={messages}
        isRunning={isRunning}
        streamErrorMessage={streamErrorMessage}
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
    </section>
  );
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
  projectId: string,
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

function upsertChatMessage(
  messages: readonly ChatMessageDto[],
  message: ChatMessageDto,
) {
  const existingIndex = messages.findIndex((item) => item.id === message.id);
  if (existingIndex === -1) {
    return [...messages, message];
  }

  return messages.map((item, index) => (index === existingIndex ? message : item));
}
