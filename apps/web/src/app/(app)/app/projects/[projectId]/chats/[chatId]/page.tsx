import { ProjectChatWorkspace } from "@/components/chat/project-chat-workspace";

export default async function ProjectChatPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
    readonly chatId: string;
  }>;
}) {
  const { projectId, chatId } = await params;

  return <ProjectChatWorkspace projectId={projectId} chatId={chatId} />;
}
