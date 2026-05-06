import type { ChatMessageAttachmentDto } from "@lexframe/contracts";

export function formatAttachmentMode(attachment: ChatMessageAttachmentDto) {
  return `${attachment.classification} / ${attachment.mode}`;
}
