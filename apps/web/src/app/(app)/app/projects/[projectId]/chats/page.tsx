import { ProjectChatWorkspace } from "@/components/chat/project-chat-workspace";

export default async function ProjectChatsPage({
  params,
}: {
  readonly params: Promise<{
    readonly projectId: string;
  }>;
}) {
  const { projectId } = await params;

  return <ProjectChatWorkspace projectId={projectId} chatId="" />;
}
