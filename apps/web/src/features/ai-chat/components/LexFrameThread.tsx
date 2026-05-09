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
  disabled,
  onSend,
  onCancel,
  onRegenerate,
  onBranch,
  onCreateAutomation,
}: {
  readonly messages: readonly ChatMessageDto[];
  readonly isRunning: boolean;
  readonly disabled: boolean;
  readonly onSend: (text: string) => Promise<void>;
  readonly onCancel: () => void;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
  readonly onCreateAutomation?: (messageId: string) => void;
}) {
  const runtime = useLexFrameExternalStoreRuntime({
    messages,
    isRunning,
    onSend,
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
                  aria-label="LexFrame готовит ответ"
                >
                  <div className="rounded-[var(--lf-radius-card)] border border-[color:var(--lf-border)] bg-[color:var(--lf-bg-muted)] px-4 py-3 text-sm text-[color:var(--lf-text-muted)]">
                    LexFrame готовит ответ...
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <LexFrameComposer
          disabled={disabled}
          isRunning={isRunning}
          onSend={(text) => void onSend(text)}
          onCancel={onCancel}
        />
      </div>
    </AssistantRuntimeProvider>
  );
}
