import { GlobalChatWorkspace } from "@/components/chat/global-chat-workspace";

export default async function ChatThreadPage({
  params,
}: {
  readonly params: Promise<{ readonly chatId: string }>;
}) {
  const { chatId } = await params;

  return <GlobalChatWorkspace chatId={chatId} />;
}
