import { Send, Square } from "lucide-react";
import * as React from "react";

export function LexFrameComposer({
  disabled,
  isRunning,
  onSend,
  onCancel,
}: {
  readonly disabled: boolean;
  readonly isRunning: boolean;
  readonly onSend: (text: string) => void;
  readonly onCancel: () => void;
}) {
  const [text, setText] = React.useState("");

  return (
    <form
      className="border-t border-slate-200 bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const next = text.trim();
        if (!next || disabled) {
          return;
        }
        setText("");
        onSend(next);
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-20 flex-1 resize-none rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          value={text}
          disabled={disabled}
          placeholder="Сообщение по проекту, /анализ_договора, /найти_риски..."
          onChange={(event) => setText(event.target.value)}
        />
        {isRunning ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-300 hover:bg-slate-50"
            onClick={onCancel}
            aria-label="Cancel stream"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            className="inline-flex h-10 w-10 items-center justify-center rounded bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
            disabled={disabled || text.trim().length === 0}
            aria-label="Send"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
