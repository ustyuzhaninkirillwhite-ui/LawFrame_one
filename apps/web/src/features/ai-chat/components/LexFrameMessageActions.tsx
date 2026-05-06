import type { ChatMessageDto } from "@lexframe/contracts";
import { GitBranch, RefreshCw, Save } from "lucide-react";

export function LexFrameMessageActions({
  message,
  onRegenerate,
  onBranch,
}: {
  readonly message: ChatMessageDto;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
}) {
  if (message.role === "system") {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-50"
        onClick={() => onBranch(message.id)}
      >
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        Ветка
      </button>
      {message.role === "assistant" ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-50"
          onClick={() => onRegenerate(message.id)}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Повторить
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-50"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        Сохранить
      </button>
    </div>
  );
}
