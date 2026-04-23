"use client";

import type { AiChatMode, AiChatSource } from "@lexframe/contracts";
import * as React from "react";

interface AiChatStoreState {
  readonly source: AiChatSource;
  readonly mode: AiChatMode;
  readonly message: string;
  readonly selectedDocumentIds: readonly string[];
  readonly selectedTemplateIds: readonly string[];
  readonly selectedProfileId: string | null;
  readonly currentAutomationId: string | null;
  readonly activeSessionId: string | null;
  readonly activeDraftId: string | null;
  readonly activeRequestId: string | null;
}

interface AiChatStore {
  readonly state: AiChatStoreState;
  readonly deferredMessage: string;
  readonly isPending: boolean;
  readonly updateState: (next: Partial<AiChatStoreState>) => void;
  readonly setMessage: (message: string) => void;
  readonly toggleDocument: (documentId: string) => void;
  readonly toggleTemplate: (templateId: string) => void;
  readonly selectSession: (sessionId: string | null) => void;
  readonly selectDraft: (draftId: string | null) => void;
  readonly selectRequest: (requestId: string | null) => void;
  readonly resetComposer: () => void;
}

export function useAiChatStore(
  initialState: Partial<AiChatStoreState> = {},
): AiChatStore {
  const [state, setState] = React.useState<AiChatStoreState>({
    source: initialState.source ?? "global_chat",
    mode: initialState.mode ?? "create_workflow",
    message: initialState.message ?? "",
    selectedDocumentIds: initialState.selectedDocumentIds ?? [],
    selectedTemplateIds: initialState.selectedTemplateIds ?? [],
    selectedProfileId: initialState.selectedProfileId ?? null,
    currentAutomationId: initialState.currentAutomationId ?? null,
    activeSessionId: initialState.activeSessionId ?? null,
    activeDraftId: initialState.activeDraftId ?? null,
    activeRequestId: initialState.activeRequestId ?? null,
  });
  const [isPending, startTransition] = React.useTransition();
  const deferredMessage = React.useDeferredValue(state.message);

  const updateState = React.useCallback((next: Partial<AiChatStoreState>) => {
    startTransition(() => {
      setState((previous) => ({
        ...previous,
        ...next,
      }));
    });
  }, []);

  const setMessage = React.useCallback(
    (message: string) => {
      updateState({ message });
    },
    [updateState],
  );

  const toggleDocument = React.useCallback((documentId: string) => {
    startTransition(() => {
      setState((previous) => ({
        ...previous,
        selectedDocumentIds: previous.selectedDocumentIds.includes(documentId)
          ? previous.selectedDocumentIds.filter((id) => id !== documentId)
          : [...previous.selectedDocumentIds, documentId],
      }));
    });
  }, []);

  const toggleTemplate = React.useCallback((templateId: string) => {
    startTransition(() => {
      setState((previous) => ({
        ...previous,
        selectedTemplateIds: previous.selectedTemplateIds.includes(templateId)
          ? previous.selectedTemplateIds.filter((id) => id !== templateId)
          : [...previous.selectedTemplateIds, templateId],
      }));
    });
  }, []);

  const selectSession = React.useCallback(
    (sessionId: string | null) => {
      updateState({ activeSessionId: sessionId });
    },
    [updateState],
  );

  const selectDraft = React.useCallback(
    (draftId: string | null) => {
      updateState({ activeDraftId: draftId });
    },
    [updateState],
  );

  const selectRequest = React.useCallback(
    (requestId: string | null) => {
      updateState({ activeRequestId: requestId });
    },
    [updateState],
  );

  const resetComposer = React.useCallback(() => {
    updateState({
      message: "",
      activeRequestId: null,
    });
  }, [updateState]);

  return {
    state,
    deferredMessage,
    isPending,
    updateState,
    setMessage,
    toggleDocument,
    toggleTemplate,
    selectSession,
    selectDraft,
    selectRequest,
    resetComposer,
  };
}
