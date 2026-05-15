import { FileText, Mic, Paperclip, SendHorizontal, Square, X } from "lucide-react";
import * as React from "react";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Map([
  ["text/plain", [".txt", ".md", ".csv"]],
  ["application/pdf", [".pdf"]],
  ["application/msword", [".doc"]],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    [".docx"],
  ],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    [".xlsx"],
  ],
  ["image/png", [".png"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/webp", [".webp"]],
]);

interface PendingAttachment {
  readonly id: string;
  readonly file: File;
  readonly error: string | null;
}

export function LexFrameComposer({
  disabled,
  isRunning,
  onSend,
  onCancel,
}: {
  readonly disabled: boolean;
  readonly isRunning: boolean;
  readonly onSend: (text: string, files: readonly File[]) => Promise<void> | void;
  readonly onCancel: () => void;
}) {
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const submitLockRef = React.useRef(false);
  const validFiles = attachments
    .filter((attachment) => !attachment.error)
    .map((attachment) => attachment.file);

  React.useEffect(() => {
    if (!isRunning) {
      submitLockRef.current = false;
    }
  }, [isRunning]);

  const addFiles = React.useCallback((files: readonly File[]) => {
    setAttachments((current) => {
      const seen = new Set(
        current.map(
          (attachment) =>
            `${attachment.file.name}:${attachment.file.size}:${attachment.file.type}`,
        ),
      );
      const next = [...current];

      for (const file of files) {
        const duplicateKey = `${file.name}:${file.size}:${file.type}`;
        const error = validateAttachment(file, seen);
        seen.add(duplicateKey);
        next.push({
          id: createAttachmentId(),
          file,
          error,
        });
      }

      return next;
    });
  }, []);

  const submit = () => {
    const next = text.trim();

    if (
      (!next && validFiles.length === 0) ||
      disabled ||
      isRunning ||
      submitLockRef.current
    ) {
      return;
    }

    submitLockRef.current = true;
    setText("");
    setAttachments([]);
    try {
      const sendResult = onSend(next, validFiles);
      void Promise.resolve(sendResult).finally(() => {
        submitLockRef.current = false;
      });
    } catch (error) {
      submitLockRef.current = false;
      throw error;
    }
  };

  return (
    <form
      className="shrink-0 bg-[color:var(--lf-bg-panel)] px-4 pb-4 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        multiple
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {attachments.length > 0 ? (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex max-w-full items-center gap-2 rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] px-3 py-2 text-xs text-[color:var(--lf-text-primary)]"
              data-testid="chat-attachment-chip"
            >
              <FileText size={14} aria-hidden="true" />
              <span className="max-w-48 truncate">{attachment.file.name}</span>
              <span className="text-[color:var(--lf-text-muted)]">
                {formatBytes(attachment.file.size)}
              </span>
              {attachment.error ? (
                <span className="text-[color:var(--danger)]">
                  {attachment.error}
                </span>
              ) : null}
              <button
                type="button"
                className="rounded-full p-1 text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)]"
                aria-label={`Удалить файл ${attachment.file.name}`}
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.id !== attachment.id),
                  )
                }
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div
        className={[
          "mx-auto flex min-h-12 max-w-3xl items-center gap-2 rounded-full border bg-[color:var(--lf-bg-panel)] px-2 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.12)] transition",
          isDragging
            ? "border-[color:var(--lf-primary)]"
            : "border-[color:var(--lf-border)]",
        ].join(" ")}
      >
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--lf-text-muted)] transition hover:bg-[color:var(--lf-state-hover)] hover:text-[color:var(--lf-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Добавить файлы"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={17} aria-hidden="true" />
        </button>
        <textarea
          data-testid="chat-composer-input"
          className="h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-[color:var(--lf-text-primary)] outline-none placeholder:text-[color:var(--lf-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          value={text}
          disabled={disabled}
          aria-label="Запрос к LexFrame"
          placeholder="Спросите LexFrame"
          onChange={(event) => setText(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length > 0) {
              addFiles(files);
            }
          }}
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
            disabled={disabled || (text.trim().length === 0 && validFiles.length === 0)}
            aria-label="Отправить сообщение"
          >
            <SendHorizontal size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}

function validateAttachment(file: File, seen: Set<string>) {
  const duplicateKey = `${file.name}:${file.size}:${file.type}`;
  const extension = getExtension(file.name);
  const allowedExtensions = ALLOWED_ATTACHMENT_TYPES.get(file.type);

  if (file.size <= 0) {
    return "пустой файл";
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "слишком большой файл";
  }

  if (!isSafeFilename(file.name)) {
    return "опасное имя";
  }

  if (!allowedExtensions) {
    return "тип не поддерживается";
  }

  if (!allowedExtensions.includes(extension)) {
    return "расширение не совпадает";
  }

  if (seen.has(duplicateKey)) {
    return "дубликат";
  }

  return null;
}

function isSafeFilename(filename: string) {
  return (
    filename.trim().length > 0 &&
    filename.trim() === filename &&
    !filename.includes("..") &&
    !/[\/\\?%*:|"<>]/.test(filename)
  );
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index).toLowerCase();
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function createAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
