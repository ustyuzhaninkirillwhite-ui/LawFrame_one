"use client";

import type { ChatMessageDto } from "@lexframe/contracts";
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
  const { apiClient, sessionContext } = useSessionBridge();
  const chatApi = React.useMemo(() => createLexFrameChatApi(apiClient), [apiClient]);
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(
    initialThreadId,
  );
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeStreamId, setActiveStreamId] = React.useState<string | null>(null);
  const canSend = sessionContext.permissions.includes("chat.create");
  const canCreateAutomation = sessionContext.permissions.includes(
    "automation_builder.create_intent",
  );

  const loadMessages = React.useCallback(
    async (threadId: string | null) => {
      if (!threadId) {
        setMessages([]);
        return;
      }

      const response = await chatApi.listMessages(threadId);
      setMessages([...response.items]);
    },
    [chatApi],
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveThreadId(initialThreadId);
  }, [initialThreadId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

      setIsRunning(true);
      try {
        const snapshot = await chatApi.streamMessage(threadId, { text });
        setActiveStreamId(snapshot.streamId);
        await loadMessages(threadId);

        if (createdThread) {
          router.push(`/app/projects/${projectId}/chats/${threadId}`);
        }
      } finally {
        setIsRunning(false);
      }
    },
    [activeThreadId, chatApi, loadMessages, projectId, router],
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
      try {
        const snapshot = await chatApi.regenerate(activeThreadId, messageId);
        setActiveStreamId(snapshot.streamId);
        await loadMessages(activeThreadId);
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
