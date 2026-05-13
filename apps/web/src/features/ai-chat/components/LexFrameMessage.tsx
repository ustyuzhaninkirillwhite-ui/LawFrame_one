import type { ChatMessageDto } from "@lexframe/contracts";
import { cn } from "@/lib/utils";
import { getChatMessageText } from "../domain/chatMappers";
import { BranchSwitcher } from "./BranchSwitcher";
import { EvidencePanel } from "./EvidencePanel";
import { LexFrameAttachmentTile } from "./LexFrameAttachmentTile";
import { LexFrameMessageActions } from "./LexFrameMessageActions";

export function LexFrameMessage({
  message,
  onRegenerate,
  onBranch,
  onCreateAutomation,
}: {
  readonly message: ChatMessageDto;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
  readonly onCreateAutomation?: (messageId: string) => void;
}) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  if (!isUser && !isAssistant) {
    return null;
  }

  return (
    <article
      data-message-role={message.role}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[84%] rounded-[var(--lf-radius-card)] px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[76%]",
          isUser
            ? "bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)]"
            : "border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] text-[color:var(--lf-text-primary)]",
        )}
      >
        <div
          className={cn(
            "mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
            isUser ? "text-white/70" : "text-[color:var(--lf-text-muted)]",
          )}
        >
          {isUser ? "Вы" : "LexFrame"}
        </div>
        {message.branchInfo?.canSwitch ? (
          <BranchSwitcher
            ordinal={message.branchInfo.ordinal}
            total={message.branchInfo.total}
          />
        ) : null}
        <div className="whitespace-pre-wrap">
          {getChatMessageText(message) || formatMessageStatus(message.status)}
        </div>
        {message.attachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <LexFrameAttachmentTile key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        <EvidencePanel message={message} />
        {isAssistant ? (
          <LexFrameMessageActions
            message={message}
            onRegenerate={onRegenerate}
            onBranch={onBranch}
            onCreateAutomation={onCreateAutomation}
          />
        ) : null}
      </div>
    </article>
  );
}

function formatMessageStatus(status: ChatMessageDto["status"]) {
  if (status === "streaming" || status === "pending") {
    return "Генерируется...";
  }

  if (status === "failed") {
    return "Ответ не был завершен.";
  }

  if (status === "cancelled") {
    return "Генерация остановлена.";
  }

  return "";
}
