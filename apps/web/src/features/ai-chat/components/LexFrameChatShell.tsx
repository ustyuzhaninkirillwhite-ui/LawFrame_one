"use client";

import type {
  ChatMessageDto,
  ChatThreadSummary,
  ProjectKnowledgeItem,
} from "@lexframe/contracts";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useSessionBridge } from "@/providers/session-provider";
import { createLexFrameChatApi } from "../api/chatApi";
import { getChatMessageText } from "../domain/chatMappers";
import { LegalDataWarning } from "./LegalDataWarning";
import { LexFrameThread } from "./LexFrameThread";
import { LexFrameThreadList } from "./LexFrameThreadList";
import { ProjectContextDrawer } from "./ProjectContextDrawer";

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
  const [threads, setThreads] = React.useState<ChatThreadSummary[]>([]);
  const [messages, setMessages] = React.useState<ChatMessageDto[]>([]);
  const [knowledge, setKnowledge] = React.useState<ProjectKnowledgeItem[]>([]);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(
    initialThreadId,
  );
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeStreamId, setActiveStreamId] = React.useState<string | null>(null);
  const canSend = sessionContext.permissions.includes("chat.create");
  const canCreateAutomation = sessionContext.permissions.includes(
    "automation_builder.create_intent",
  );

  const loadThreads = React.useCallback(async () => {
    const response = await chatApi.listProjectThreads(projectId);
    setThreads([...response.items]);
  }, [chatApi, projectId]);

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
    void loadThreads();
  }, [loadThreads]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages(activeThreadId);
  }, [activeThreadId, loadMessages]);

  React.useEffect(() => {
    chatApi
      .listProjectKnowledge(projectId)
      .then((response) => setKnowledge([...response.items]))
      .catch(() => setKnowledge([]));
  }, [chatApi, projectId]);

  const createThread = React.useCallback(async () => {
    const response = await chatApi.createProjectThread(projectId, {
      title: "Новый чат проекта",
      source: "project_chat",
    });
    setActiveThreadId(response.chat.id);
    await loadThreads();
  }, [chatApi, loadThreads, projectId]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      let threadId = activeThreadId;
      if (!threadId) {
        const created = await chatApi.createProjectThread(projectId, {
          title: text.slice(0, 80),
          source: "project_chat",
        });
        threadId = created.chat.id;
        setActiveThreadId(threadId);
      }

      setIsRunning(true);
      try {
        const snapshot = await chatApi.streamMessage(threadId, { text });
        setActiveStreamId(snapshot.streamId);
        await loadMessages(threadId);
        await loadThreads();
      } finally {
        setIsRunning(false);
      }
    },
    [activeThreadId, chatApi, loadMessages, loadThreads, projectId],
  );

  const cancelStream = React.useCallback(() => {
    if (!activeThreadId || !activeStreamId) {
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
      await loadThreads();
    },
    [activeThreadId, chatApi, loadThreads],
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
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden border border-slate-200 bg-white md:flex-row">
      <LexFrameThreadList
        threads={threads}
        activeThreadId={activeThreadId}
        onCreate={() => void createThread()}
        onSelect={setActiveThreadId}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <LegalDataWarning />
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
      </main>
      <ProjectContextDrawer items={knowledge} />
    </div>
  );
}
