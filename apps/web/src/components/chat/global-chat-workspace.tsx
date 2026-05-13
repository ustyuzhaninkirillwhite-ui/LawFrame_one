"use client";

import { LexFrameChatShell } from "@/features/ai-chat/components/LexFrameChatShell";

export function GlobalChatWorkspace({
  chatId,
}: {
  readonly chatId: string | null;
}) {
  return <LexFrameChatShell projectId={null} initialThreadId={chatId} />;
}
