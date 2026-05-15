import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import type { ChatMessageDto } from "@lexframe/contracts";
import { useLexFrameExternalStoreRuntime } from "../runtime/useLexFrameExternalStoreRuntime";
import { LexFrameComposer } from "./LexFrameComposer";
import { LexFrameMessage } from "./LexFrameMessage";

export function LexFrameThread({
  messages,
  isRunning,
  runStatus,
  streamErrorMessage,
  disabled,
  onSend,
  onCancel,
  onRegenerate,
  onBranch,
  onCreateAutomation,
}: {
  readonly messages: readonly ChatMessageDto[];
  readonly isRunning: boolean;
  readonly runStatus: string;
  readonly streamErrorMessage?: string | null;
  readonly disabled: boolean;
  readonly onSend: (text: string, files: readonly File[]) => Promise<void>;
  readonly onCancel: () => void;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
  readonly onCreateAutomation?: (messageId: string) => void;
}) {
  const runtime = useLexFrameExternalStoreRuntime({
    messages,
    isRunning,
    onSend: (text) => onSend(text, []),
  });
  const visibleMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--lf-bg-panel)]">
        <ThreadPrimitive.Root className="hidden" />
        <ThreadPrimitive.Viewport className="hidden">
          <ThreadPrimitive.Messages
            components={{
              Message: () => (
                <MessagePrimitive.Root>
                  <MessagePrimitive.Parts />
                </MessagePrimitive.Root>
              ),
            }}
          />
          <ComposerPrimitive.Root>
            <ComposerPrimitive.Input />
            <ComposerPrimitive.Send />
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Viewport>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          {visibleMessages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center text-center">
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[color:var(--lf-text-primary)] md:text-4xl">
                С чего начнем?
              </h1>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-3">
              {visibleMessages.map((message) => (
                <LexFrameMessage
                  key={message.id}
                  message={message}
                  onRegenerate={onRegenerate}
                  onBranch={onBranch}
                  onCreateAutomation={onCreateAutomation}
                />
              ))}
              {isRunning ? (
                <div
                  className="flex justify-start"
                  data-testid="chat-running-status"
                  aria-label="LexFrame обрабатывает ответ"
                >
                  <div className="rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] px-4 py-3 text-sm text-[color:var(--lf-text-muted)]">
                    {formatRunStatus(runStatus)}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {streamErrorMessage ? (
            <div
              className="mx-auto mt-4 max-w-3xl rounded-[var(--lf-radius-card)] border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--lf-text-primary)]"
              role="status"
              aria-live="polite"
              data-testid="chat-stream-error"
            >
              {streamErrorMessage}
            </div>
          ) : null}
        </div>
        <LexFrameComposer
          disabled={disabled}
          isRunning={isRunning}
          onSend={onSend}
          onCancel={onCancel}
        />
      </div>
    </AssistantRuntimeProvider>
  );
}

function formatRunStatus(status: string) {
  if (status === "recovering") {
    return "LexFrame восстанавливает незавершенный ответ...";
  }

  if (status === "streaming") {
    return "LexFrame генерирует ответ...";
  }

  if (status === "failed") {
    return "LexFrame не смог завершить ответ.";
  }

  return "LexFrame обрабатывает запрос...";
}
