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
}: {
  readonly messages: readonly ChatMessageDto[];
  readonly isRunning: boolean;
  readonly disabled: boolean;
  readonly onSend: (text: string) => Promise<void>;
  readonly onCancel: () => void;
  readonly onRegenerate: (messageId: string) => void;
  readonly onBranch: (messageId: string) => void;
}) {
  const runtime = useLexFrameExternalStoreRuntime({
    messages,
    isRunning,
    onSend,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-0 flex-1 flex-col bg-white">
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
        <div className="min-h-0 flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
              Начните project-scoped чат. Контекст, route snapshots и audit остаются в LexFrame.
            </div>
          ) : (
            messages.map((message) => (
              <LexFrameMessage
                key={message.id}
                message={message}
                onRegenerate={onRegenerate}
                onBranch={onBranch}
              />
            ))
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
