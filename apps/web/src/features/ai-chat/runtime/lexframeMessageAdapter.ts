import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatMessageDto } from "@lexframe/contracts";
import { getChatMessageText } from "../domain/chatMappers";

export function toAssistantMessage(message: ChatMessageDto): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role === "tool" ? "assistant" : message.role,
    content: [
      {
        type: "text",
        text: getChatMessageText(message),
      },
    ],
    createdAt: new Date(message.createdAt),
  };
}
