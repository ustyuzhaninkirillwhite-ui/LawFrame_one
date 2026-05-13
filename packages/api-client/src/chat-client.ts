import type {
  ChatAttachmentCompleteRequest,
  ChatAttachmentDeleteResponse,
  ChatAttachmentDownloadResponse,
  ChatAttachmentResponse,
  ChatAttachmentUploadIntentRequest,
  ChatAttachmentUploadIntentResponse,
  ChatMessagesResponse,
  ChatSearchResponse,
  ChatStreamEvent,
  ChatStreamSnapshot,
  ChatThreadListQuery,
  ChatThreadListResponse,
  ChatThreadResponse,
  CreateChatThreadRequest,
  CreateChatMessageRequest,
  ProjectKnowledgeItem,
  ProjectKnowledgeListResponse,
  ProjectWebSearchRequest,
  ProjectWebSearchResponse,
  UpdateChatThreadRequest,
  UpsertProjectKnowledgeItemRequest,
} from "@lexframe/contracts";
import {
  ApiClientError,
  buildQueryString,
  requestJson,
  resolveHeaders,
  withJsonBody,
  type FetchOptions,
} from "./core";

export interface ChatStreamHandlers {
  readonly signal?: AbortSignal;
  readonly onEvent?: (event: ChatStreamEvent | { readonly type: "done"; readonly payload: Record<string, unknown> }) => void;
}

export interface ChatApi {
  listChatThreads(input?: ChatThreadListQuery): Promise<ChatThreadListResponse>;
  createChatThread(input?: CreateChatThreadRequest): Promise<ChatThreadResponse>;
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
  switchChatBranch(threadId: string, branchId: string): Promise<ChatThreadResponse>;
  listChatMessages(threadId: string): Promise<ChatMessagesResponse>;
  createChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<unknown>;
  streamChatMessage(
    threadId: string,
    input: CreateChatMessageRequest,
  ): Promise<ChatStreamSnapshot>;
  streamChatMessageEvents(
    threadId: string,
    input: CreateChatMessageRequest,
    handlers?: ChatStreamHandlers,
  ): Promise<ChatStreamSnapshot>;
  resumeChatStream(
    threadId: string,
    streamId: string,
  ): Promise<ChatStreamSnapshot>;
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
  createChatAttachmentUploadIntents(
    input: ChatAttachmentUploadIntentRequest,
  ): Promise<ChatAttachmentUploadIntentResponse>;
  completeChatAttachmentUpload(
    attachmentId: string,
    input: ChatAttachmentCompleteRequest,
  ): Promise<ChatAttachmentResponse>;
  deleteChatAttachment(
    attachmentId: string,
  ): Promise<ChatAttachmentDeleteResponse>;
  downloadChatAttachment(
    attachmentId: string,
  ): Promise<ChatAttachmentDownloadResponse>;
  searchChats(input: {
    readonly q: string;
    readonly scope?: ChatThreadListQuery["scope"];
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
  searchProjectWeb(
    projectId: string,
    input: ProjectWebSearchRequest,
  ): Promise<ProjectWebSearchResponse>;
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
    listChatThreads: (input = { scope: "global" }) =>
      requestJson(
        options,
        `/chat/threads${buildQueryString({
          scope: input.scope ?? "global",
          projectId: input.projectId ?? undefined,
        })}`,
      ),
    createChatThread: (input = {}) =>
      requestJson(
        options,
        "/chat/threads",
        withJsonBody(input, { method: "POST" }),
      ),
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
    switchChatBranch: (threadId, branchId) =>
      requestJson(
        options,
        `/chat/threads/${threadId}/branches/${branchId}/switch`,
        { method: "POST" },
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
    streamChatMessageEvents: (threadId, input, handlers) =>
      streamChatMessageEvents(options, threadId, input, handlers),
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
    createChatAttachmentUploadIntents: (input) =>
      requestJson(
        options,
        "/chat/attachments/upload-intents",
        withJsonBody(input, { method: "POST" }),
      ),
    completeChatAttachmentUpload: (attachmentId, input) =>
      requestJson(
        options,
        `/chat/attachments/${attachmentId}/complete`,
        withJsonBody(input, { method: "POST" }),
      ),
    deleteChatAttachment: (attachmentId) =>
      requestJson(options, `/chat/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    downloadChatAttachment: (attachmentId) =>
      requestJson(options, `/chat/attachments/${attachmentId}/download`),
    searchChats: (input) =>
      requestJson(
        options,
        `/chat/search${buildQueryString({
          q: input.q,
          scope: input.scope,
          projectId: input.projectId ?? undefined,
        })}`,
      ),
    exportChatThread: (threadId) =>
      requestJson(options, `/chat/threads/${threadId}/export`, {
        method: "POST",
      }),
    listProjectKnowledge: (projectId) =>
      requestJson(options, `/projects/${projectId}/knowledge`),
    searchProjectWeb: (projectId, input) =>
      requestJson(
        options,
        `/projects/${projectId}/web-search`,
        withJsonBody(input, { method: "POST" }),
      ),
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

async function streamChatMessageEvents(
  options: FetchOptions,
  threadId: string,
  input: CreateChatMessageRequest,
  handlers: ChatStreamHandlers = {},
): Promise<ChatStreamSnapshot> {
  const init = withJsonBody(input, {
    method: "POST",
    headers: { accept: "text/event-stream" },
    signal: handlers.signal,
  });
  const response = await fetch(
    `${options.baseUrl}/chat/threads/${threadId}/messages:stream`,
    {
      ...init,
      headers: await resolveHeaders(options, init),
    },
  );

  if (!response.ok) {
    throw new ApiClientError(
      `HTTP ${response.status} for /chat/threads/${threadId}/messages:stream`,
      response.status,
      response.headers.get("x-error-code"),
      response.headers.get("x-request-id"),
      undefined,
    );
  }

  if (!response.body) {
    return requestJson(
      options,
      `/chat/threads/${threadId}/messages:stream`,
      withJsonBody(input, { method: "POST" }),
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalSnapshot: ChatStreamSnapshot | null = null;
  let streamError: { readonly code: string | null; readonly message: string | null } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) {
        continue;
      }

      handlers.onEvent?.(event);
      if (event.type === "done") {
        const snapshot = event.payload.snapshot;
        if (isChatStreamSnapshot(snapshot)) {
          finalSnapshot = snapshot;
        }
      } else if (event.type === "error") {
        const code = event.payload.code;
        const message = event.payload.message;
        streamError = {
          code: typeof code === "string" ? code : "CHAT_STREAM_FAILED",
          message:
            typeof message === "string"
              ? message
              : "Chat stream returned an error event.",
        };
      }
    }

    if (done) {
      break;
    }
  }

  if (!finalSnapshot) {
    if (streamError) {
      throw new ApiClientError(
        streamError.message ?? "Chat stream returned an error event.",
        502,
        streamError.code ?? "CHAT_STREAM_FAILED",
        response.headers.get("x-request-id"),
        undefined,
      );
    }

    throw new ApiClientError(
      "Chat stream ended without a final snapshot.",
      502,
      "CHAT_STREAM_INCOMPLETE",
      response.headers.get("x-request-id"),
      undefined,
    );
  }

  return finalSnapshot;
}

function parseSseFrame(
  frame: string,
): (ChatStreamEvent | { readonly type: "done"; readonly payload: Record<string, unknown> }) | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as {
      readonly type?: unknown;
      readonly payload?: unknown;
    };
    if (
      typeof parsed.type === "string" &&
      typeof parsed.payload === "object" &&
      parsed.payload !== null
    ) {
      return {
        type: parsed.type,
        payload: parsed.payload as Record<string, unknown>,
      } as ChatStreamEvent | {
        readonly type: "done";
        readonly payload: Record<string, unknown>;
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isChatStreamSnapshot(value: unknown): value is ChatStreamSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly streamId?: unknown }).streamId === "string" &&
    typeof (value as { readonly threadId?: unknown }).threadId === "string" &&
    typeof (value as { readonly messageId?: unknown }).messageId === "string"
  );
}
