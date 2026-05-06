"use client";

import { LexFrameChatShell } from "@/features/ai-chat/components/LexFrameChatShell";

export function ProjectChatWorkspace({
  projectId,
  chatId,
}: {
  readonly projectId: string;
  readonly chatId: string;
}) {
  return (
    <LexFrameChatShell
      projectId={projectId}
      initialThreadId={chatId.trim().length > 0 ? chatId : null}
    />
  );
}
