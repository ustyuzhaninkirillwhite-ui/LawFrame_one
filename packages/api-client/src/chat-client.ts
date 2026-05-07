import type {
  ChatMessagesResponse,
  ChatSearchResponse,
  ChatStreamSnapshot,
  ChatThreadResponse,
  CreateChatMessageRequest,
  ProjectKnowledgeItem,
  ProjectKnowledgeListResponse,
  UpdateChatThreadRequest,
  UpsertProjectKnowledgeItemRequest,
} from "@lexframe/contracts";
import {
  buildQueryString,
  requestJson,
  withJsonBody,
  type FetchOptions,
} from "./core";

export interface ChatApi {
  getChatThread(threadId: string): Promise<ChatThreadResponse>;
  updateChatThread(
    threadId: string,
    input: UpdateChatThreadRequest,
  ): Promise<ChatThreadResponse>;
  archiveChatThread(threadId: string): Promise<ChatThreadResponse>;
  deleteChatThread(threadId: string): Promise<ChatThreadResponse>;
  branchChatThread(
    threadId: string,
    input: {
      readonly sourceMessageId?: string | null;
      readonly branchMode?: "project" | "document_review" | "automation_builder";
    },
  ): Promise<ChatThreadResponse>;
  listChatMessages(threadId: string): Promise<ChatMessagesResponse>;
  createChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<unknown>;
  streamChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  resumeChatStream(
    threadId: string,
    streamId: string,
  ): Promise<{
    readonly streamId: string;
    readonly threadId: string;
    readonly status: "completed";
    readonly events: readonly unknown[];
  }>;
  cancelChatStream(
    threadId: string,
    streamId: string,
  ): Promise<{
    readonly streamId: string;
    readonly threadId: string;
    readonly status: "cancelled";
  }>;
  regenerateChatMessage(
    threadId: string,
    messageId: string,
  ): Promise<ChatStreamSnapshot>;
  editChatMessage(
    threadId: string,
    messageId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  searchChats(input: {
    readonly q: string;
    readonly projectId?: string | null;
  }): Promise<ChatSearchResponse>;
  exportChatThread(threadId: string): Promise<{
    readonly threadId: string;
    readonly format: string;
    readonly status: string;
  }>;
  listProjectKnowledge(
    projectId: string,
  ): Promise<ProjectKnowledgeListResponse>;
  createProjectKnowledge(
    projectId: string,
    input: UpsertProjectKnowledgeItemRequest,
  ): Promise<ProjectKnowledgeItem>;
  updateProjectKnowledge(
    projectId: string,
    itemId: string,
    input: Partial<UpsertProjectKnowledgeItemRequest>,
  ): Promise<ProjectKnowledgeItem>;
  deleteProjectKnowledge(
    projectId: string,
    itemId: string,
  ): Promise<{ readonly id: string; readonly status: "deleted" }>;
}

export function createChatClient(options: FetchOptions): ChatApi {
  return {
    getChatThread: (threadId) => requestJson(options, `/chat/threads/${threadId}`),
    updateChatThread: (threadId, input) =>
      requestJson(
        options,
        `/chat/threads/${threadId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    archiveChatThread: (threadId) =>
      requestJson(options, `/chat/threads/${threadId}/archive`, {
        method: "POST",
      }),
    deleteChatThread: (threadId) =>
      requestJson(options, `/chat/threads/${threadId}/delete`, {
        method: "POST",
      }),
    branchChatThread: (threadId, input) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/branch`,
        withJsonBody(input, { method: "POST" }),
      ),
    listChatMessages: (threadId) =>
      requestJson(options, `/chat/threads/${threadId}/messages`),
    createChatMessage: (threadId, input) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/messages`,
        withJsonBody(input, { method: "POST" }),
      ),
    streamChatMessage: (threadId, input) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/messages:stream`,
        withJsonBody(input, { method: "POST" }),
      ),
    resumeChatStream: (threadId, streamId) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/streams/${streamId}/resume`,
        { method: "POST" },
      ),
    cancelChatStream: (threadId, streamId) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/streams/${streamId}/cancel`,
        { method: "POST" },
      ),
    regenerateChatMessage: (threadId, messageId) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/messages/${messageId}/regenerate`,
        { method: "POST" },
      ),
    editChatMessage: (threadId, messageId, input) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/messages/${messageId}/edit`,
        withJsonBody(input, { method: "POST" }),
      ),
    searchChats: (input) =>
      requestJson(
        options,
        `/chat/search${buildQueryString({
          q: input.q,
          projectId: input.projectId ?? undefined,
        })}`,
      ),
    exportChatThread: (threadId) =>
      requestJson(options, `/chat/threads/${threadId}/export`, {
        method: "POST",
      }),
    listProjectKnowledge: (projectId) =>
      requestJson(options, `/projects/${projectId}/knowledge`),
    createProjectKnowledge: (projectId, input) =>
      requestJson(
        options,
        `/projects/${projectId}/knowledge`,
        withJsonBody(input, { method: "POST" }),
      ),
    updateProjectKnowledge: (projectId, itemId, input) =>
      requestJson(
        options,
        `/projects/${projectId}/knowledge/${itemId}`,
        withJsonBody(input, { method: "PATCH" }),
      ),
    deleteProjectKnowledge: (projectId, itemId) =>
      requestJson(options, `/projects/${projectId}/knowledge/${itemId}`, {
        method: "DELETE",
      }),
  };
}
