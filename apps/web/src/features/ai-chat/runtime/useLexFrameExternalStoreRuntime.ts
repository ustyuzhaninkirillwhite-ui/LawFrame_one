"use client";

import type { AppendMessage } from "@assistant-ui/react";
import type { ChatMessageDto } from "@lexframe/contracts";
import { useExternalStoreRuntime } from "@assistant-ui/react";
import * as React from "react";
import { toAssistantMessage } from "./lexframeMessageAdapter";

export function useLexFrameExternalStoreRuntime(input: {
  readonly messages: readonly ChatMessageDto[];
  readonly isRunning: boolean;
  readonly onSend: (text: string) => Promise<void>;
}) {
  const convertMessage = React.useCallback(
    (message: ChatMessageDto) => toAssistantMessage(message),
    [],
  );
  const onNew = React.useCallback(
    async (message: AppendMessage) => {
      const text = message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n")
        .trim();

      if (!text) {
        return;
      }

      await input.onSend(text);
    },
    [input],
  );

  return useExternalStoreRuntime({
    isRunning: input.isRunning,
    messages: input.messages,
    convertMessage,
    onNew,
  });
}
