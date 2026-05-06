import type { ChatThreadSummary } from "@lexframe/contracts";
import { MessageSquarePlus, Search } from "lucide-react";

export function LexFrameThreadList({
  threads,
  activeThreadId,
  onCreate,
  onSelect,
}: {
  readonly threads: readonly ChatThreadSummary[];
  readonly activeThreadId: string | null;
  readonly onCreate: () => void;
  readonly onSelect: (threadId: string) => void;
}) {
  return (
    <aside className="w-full border-b border-slate-200 bg-white md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        <button
          type="button"
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded bg-slate-900 px-3 text-sm text-white hover:bg-slate-700"
          onClick={onCreate}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Новый чат
        </button>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 hover:bg-slate-50"
          aria-label="Search chats"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-64 overflow-auto md:max-h-none">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${
              thread.id === activeThreadId ? "bg-slate-100" : ""
            }`}
            onClick={() => onSelect(thread.id)}
          >
            <div className="text-sm font-medium text-slate-900">{thread.title}</div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {thread.lastMessagePreview ?? thread.kind}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
