import type { ChatMessageDto } from "@lexframe/contracts";

export function getChatMessageText(message: ChatMessageDto) {
  return message.parts
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function getChatPreviewText(message: ChatMessageDto) {
  const text = getChatMessageText(message).trim();
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}
