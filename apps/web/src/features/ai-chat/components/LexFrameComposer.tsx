import { Mic, Plus, SendHorizontal, Square } from "lucide-react";
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

  const submit = () => {
    const next = text.trim();

    if (!next || disabled) {
      return;
    }

    setText("");
    onSend(next);
  };

  return (
    <form
      className="shrink-0 bg-[color:var(--lf-bg-panel)] px-4 pb-4 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="mx-auto flex min-h-12 max-w-3xl items-center gap-2 rounded-full border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-panel)] px-2 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.12)]">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Добавить контекст"
          disabled={disabled}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
        <textarea
          className="h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-[color:var(--lf-text-primary)] outline-none placeholder:text-[color:var(--lf-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          value={text}
          disabled={disabled}
          aria-label="Запрос к LexFrame"
          placeholder="Спросите LexFrame"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Голосовой ввод"
          disabled={disabled}
        >
          <Mic size={16} aria-hidden="true" />
        </button>
        {isRunning ? (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] text-[color:var(--lf-text-primary)] transition hover:bg-[color:var(--lf-state-hover)]"
            onClick={onCancel}
            aria-label="Остановить генерацию"
          >
            <Square size={15} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--lf-primary)] text-[color:var(--lf-primary-fg)] transition hover:bg-[color:var(--lf-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || text.trim().length === 0}
            aria-label="Отправить сообщение"
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
