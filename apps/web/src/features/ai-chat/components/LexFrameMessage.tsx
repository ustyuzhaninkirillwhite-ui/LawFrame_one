import type { ChatMessageDto } from "@lexframe/contracts";
import { getChatMessageText } from "../domain/chatMappers";
import { EvidencePanel } from "./EvidencePanel";
import { LexFrameAttachmentTile } from "./LexFrameAttachmentTile";
import { LexFrameMessageActions } from "./LexFrameMessageActions";
import { RouteSnapshotBadge } from "./RouteSnapshotBadge";

export function LexFrameMessage({
  message,
  onRegenerate,
  onBranch,
}: {
  readonly message: ChatMessageDto;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
}) {
  return (
    <article className="border-b border-slate-100 px-5 py-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {message.role}
        <RouteSnapshotBadge message={message} />
      </div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
        {getChatMessageText(message)}
      </div>
      {message.attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <LexFrameAttachmentTile key={attachment.id} attachment={attachment} />
          ))}
        </div>
      ) : null}
      <EvidencePanel message={message} />
      <LexFrameMessageActions
        message={message}
        onRegenerate={onRegenerate}
        onBranch={onBranch}
      />
    </article>
  );
}
