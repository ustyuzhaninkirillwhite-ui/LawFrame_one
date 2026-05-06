import type { ChatMessageAttachmentDto } from "@lexframe/contracts";
import { FileText } from "lucide-react";
import { formatAttachmentMode } from "../runtime/lexframeAttachmentAdapter";

export function LexFrameAttachmentTile({
  attachment,
}: {
  readonly attachment: ChatMessageAttachmentDto;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700">
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{attachment.sourceType}</span>
      <span className="text-slate-500">{formatAttachmentMode(attachment)}</span>
    </div>
  );
}
