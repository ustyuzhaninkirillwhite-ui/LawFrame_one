"use client";

import { AiChatWorkspace } from "@/components/ai/ai-chat-workspace";

export function ProjectChatWorkspace({
  projectId,
  chatId,
}: {
  readonly projectId: string;
  readonly chatId: string;
}) {
  void chatId;

  return <AiChatWorkspace initialSource="project_chat" projectId={projectId} />;
}
