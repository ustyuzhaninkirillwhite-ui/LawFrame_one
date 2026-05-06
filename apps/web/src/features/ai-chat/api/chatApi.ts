import type { ApiClient } from "@lexframe/api-client";
import type {
  ChatMessagesResponse,
  ChatStreamSnapshot,
  ChatThreadListResponse,
  ChatThreadResponse,
  CreateChatMessageRequest,
  ProjectKnowledgeListResponse,
  Stage15CreateProjectChatRequest,
  Stage15ProjectChatCreatedResponse,
} from "@lexframe/contracts";

export interface LexFrameChatApi {
  listProjectThreads(projectId: string): Promise<ChatThreadListResponse>;
  createProjectThread(
    projectId: string,
    input?: Stage15CreateProjectChatRequest,
  ): Promise<Stage15ProjectChatCreatedResponse>;
  getThread(threadId: string): Promise<ChatThreadResponse>;
  listMessages(threadId: string): Promise<ChatMessagesResponse>;
  streamMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  cancelStream(threadId: string, streamId: string): Promise<unknown>;
  branchThread(threadId: string, messageId: string | null): Promise<ChatThreadResponse>;
  regenerate(threadId: string, messageId: string): Promise<ChatStreamSnapshot>;
  edit(
    threadId: string,
    messageId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  listProjectKnowledge(projectId: string): Promise<ProjectKnowledgeListResponse>;
}

export function createLexFrameChatApi(apiClient: ApiClient): LexFrameChatApi {
  return {
    listProjectThreads: async (projectId) => ({
      items: (await apiClient.listProjectChats(projectId)).map((chat) => ({
        id: chat.id,
        workspaceId: "",
        projectId: chat.projectId,
        kind: "project",
        visibility: "project",
        status: chat.status === "active" ? "active" : "archived",
        title: chat.title,
        lastMessagePreview: chat.lastMessagePreview,
        currentBranchId: null,
        createdBy: null,
        createdAt: chat.updatedAt,
        updatedAt: chat.updatedAt,
        archivedAt: null,
        deletedAt: null,
      })),
    }),
    createProjectThread: (projectId, input) =>
      apiClient.createProjectChat(projectId, input),
    getThread: (threadId) => apiClient.getChatThread(threadId),
    listMessages: (threadId) => apiClient.listChatMessages(threadId),
    streamMessage: (threadId, input) =>
      apiClient.streamChatMessage(threadId, input),
    cancelStream: (threadId, streamId) =>
      apiClient.cancelChatStream(threadId, streamId),
    branchThread: (threadId, messageId) =>
      apiClient.branchChatThread(threadId, {
        sourceMessageId: messageId,
        branchMode: "project",
      }),
    regenerate: (threadId, messageId) =>
      apiClient.regenerateChatMessage(threadId, messageId),
    edit: (threadId, messageId, input) =>
      apiClient.editChatMessage(threadId, messageId, input),
    listProjectKnowledge: (projectId) =>
      apiClient.listProjectKnowledge(projectId),
  };
}
