import type { ChatMessageDto, ChatStreamEvent } from "@lexframe/contracts";

export type ChatUiRunState =
  | "idle"
  | "composing"
  | "uploading"
  | "sending"
  | "queued"
  | "thinking"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovering";

export interface ChatRuntimeState {
  readonly status: ChatUiRunState;
  readonly messages: readonly ChatMessageDto[];
  readonly activeStreamId: string | null;
  readonly errorMessage: string | null;
}

export type ChatRuntimeAction =
  | { readonly type: "hydrate"; readonly messages: readonly ChatMessageDto[] }
  | {
      readonly type: "send_started";
      readonly userMessage: ChatMessageDto;
      readonly assistantMessage: ChatMessageDto;
      readonly streamId: string;
    }
  | { readonly type: "stream_event"; readonly event: ChatStreamEvent }
  | {
      readonly type: "server_reconciled";
      readonly clientMessageId?: string | null;
      readonly userMessage?: ChatMessageDto | null;
      readonly assistantMessage?: ChatMessageDto | null;
    }
  | { readonly type: "completed"; readonly assistantMessage?: ChatMessageDto | null }
  | { readonly type: "failed"; readonly errorMessage: string }
  | { readonly type: "cancelled" }
  | { readonly type: "recovering"; readonly streamId: string | null };

export const initialChatRuntimeState: ChatRuntimeState = {
  status: "idle",
  messages: [],
  activeStreamId: null,
  errorMessage: null,
};

export function chatRuntimeReducer(
  state: ChatRuntimeState,
  action: ChatRuntimeAction,
): ChatRuntimeState {
  switch (action.type) {
    case "hydrate":
      return {
        status: "idle",
        messages: mergeMessages([], action.messages),
        activeStreamId: null,
        errorMessage: null,
      };
    case "send_started":
      return {
        status: "thinking",
        messages: mergeMessages(state.messages, [
          action.userMessage,
          action.assistantMessage,
        ]),
        activeStreamId: action.streamId,
        errorMessage: null,
      };
    case "stream_event":
      return applyStreamEvent(state, action.event);
    case "server_reconciled":
      return {
        ...state,
        messages: reconcileServerMessages(state.messages, action),
      };
    case "completed":
      return {
        ...state,
        status: "completed",
        activeStreamId: null,
        messages: action.assistantMessage
          ? mergeMessages(state.messages, [action.assistantMessage])
          : state.messages,
      };
    case "failed":
      return {
        ...state,
        status: "failed",
        activeStreamId: null,
        errorMessage: action.errorMessage,
        messages: state.messages.map((message) =>
          message.role === "assistant" && message.status === "streaming"
            ? { ...message, status: "failed" }
            : message,
        ),
      };
    case "cancelled":
      return {
        ...state,
        status: "cancelled",
        activeStreamId: null,
        messages: state.messages.map((message) =>
          message.role === "assistant" && message.status === "streaming"
            ? { ...message, status: "cancelled" }
            : message,
        ),
      };
    case "recovering":
      return {
        ...state,
        status: "recovering",
        activeStreamId: action.streamId,
      };
  }
}

export function mergeMessages(
  current: readonly ChatMessageDto[],
  incoming: readonly ChatMessageDto[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (message.clientMessageId) {
      for (const [id, existing] of byId) {
        if (
          id !== message.id &&
          existing.clientMessageId === message.clientMessageId
        ) {
          byId.delete(id);
        }
      }
    }

    byId.set(message.id, { ...byId.get(message.id), ...message });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

function reconcileServerMessages(
  current: readonly ChatMessageDto[],
  action: Extract<ChatRuntimeAction, { readonly type: "server_reconciled" }>,
) {
  let next = current;

  if (action.userMessage) {
    next = next.map((message) =>
      action.clientMessageId &&
      message.clientMessageId === action.clientMessageId
        ? action.userMessage!
        : message,
    );
    if (!next.some((message) => message.id === action.userMessage?.id)) {
      next = [...next, action.userMessage];
    }
  }

  if (action.assistantMessage) {
    next = mergeMessages(next, [action.assistantMessage]);
  }

  return mergeMessages([], next);
}

function applyStreamEvent(
  state: ChatRuntimeState,
  event: ChatStreamEvent,
): ChatRuntimeState {
  if (event.type === "message_start") {
    const messageId = event.payload.messageId;
    if (typeof messageId !== "string") {
      return state;
    }

    return {
      ...state,
      messages: state.messages.map((message) =>
        message.role === "assistant" && message.status === "streaming"
          ? { ...message, id: messageId }
          : message,
      ),
    };
  }

  if (event.type === "run_status") {
    const status =
      typeof event.payload.status === "string"
        ? toChatUiRunState(event.payload.status)
        : state.status;
    return {
      ...state,
      status,
      activeStreamId:
        typeof event.payload.streamId === "string"
          ? event.payload.streamId
          : state.activeStreamId,
    };
  }

  if (event.type === "text_delta") {
    const messageId = event.payload.messageId;
    const delta = event.payload.delta;
    if (typeof messageId !== "string" || typeof delta !== "string") {
      return state;
    }

    return {
      ...state,
      status: "streaming",
      messages: appendDelta(state.messages, messageId, delta),
    };
  }

  if (event.type === "error") {
    return {
      ...state,
      status: "failed",
      activeStreamId: null,
      errorMessage:
        typeof event.payload.code === "string" ? event.payload.code : "CHAT_STREAM_FAILED",
    };
  }

  if (event.type === "message_done") {
    const messageId = event.payload.messageId;
    return {
      ...state,
      status: event.payload.status === "failed" ? "failed" : "completed",
      activeStreamId: null,
      messages:
        typeof messageId === "string"
          ? state.messages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    status:
                      event.payload.status === "failed" ? "failed" : "completed",
                  }
                : message,
            )
          : state.messages,
    };
  }

  return state;
}

function appendDelta(
  messages: readonly ChatMessageDto[],
  messageId: string,
  delta: string,
) {
  return messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    const firstPart = message.parts[0] ?? {
      id: `${message.id}_stream_text`,
      type: "markdown" as const,
      text: "",
      payload: {},
      sequence: 0,
    };

    return {
      ...message,
      status: "streaming" as const,
      parts: [
        {
          ...firstPart,
          text: `${firstPart.text ?? ""}${delta}`,
        },
        ...message.parts.slice(1),
      ],
    };
  });
}

function toChatUiRunState(value: string): ChatUiRunState {
  if (
    value === "queued" ||
    value === "thinking" ||
    value === "streaming" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "recovering"
  ) {
    return value;
  }

  return "thinking";
}
