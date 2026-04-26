"use client";

import { create } from "zustand";

interface CanvasUiState {
  readonly selectedNodeId: string | null;
  readonly selectedEdgeId: string | null;
  readonly inspectorTab:
    | "overview"
    | "inputs"
    | "settings"
    | "data"
    | "connections"
    | "test"
    | "outputs"
      | "errors"
      | "policies"
      | "history"
      | "debug";
  readonly paletteOpen: boolean;
  readonly inspectorExpanded: boolean;
  readonly bottomPanelOpen: boolean;
  readonly chatDrawerOpen: boolean;
  readonly runPreviewDrawerOpen: boolean;
  readonly versionHistoryDrawerOpen: boolean;
  readonly commandPaletteOpen: boolean;
  readonly pendingOperationIds: readonly string[];
  readonly connectionNotice: string | null;
  readonly localDraftEdits: Record<string, Record<string, unknown>>;
  readonly dirtyFields: Record<string, readonly string[]>;
  readonly dataPickerState: {
    readonly nodeId: string | null;
    readonly inputKey: string | null;
  };
  readonly setSelectedNode: (nodeId: string | null) => void;
  readonly setSelectedEdge: (edgeId: string | null) => void;
  readonly setInspectorTab: (tab: CanvasUiState["inspectorTab"]) => void;
  readonly setInspectorExpanded: (expanded: boolean) => void;
  readonly setPaletteOpen: (open: boolean) => void;
  readonly setBottomPanelOpen: (open: boolean) => void;
  readonly setChatDrawerOpen: (open: boolean) => void;
  readonly setRunPreviewDrawerOpen: (open: boolean) => void;
  readonly setVersionHistoryDrawerOpen: (open: boolean) => void;
  readonly setCommandPaletteOpen: (open: boolean) => void;
  readonly setConnectionNotice: (notice: string | null) => void;
  readonly setLocalDraftEdit: (
    nodeId: string,
    key: string,
    value: unknown,
  ) => void;
  readonly clearLocalDraftEdits: (nodeId: string) => void;
  readonly setDataPickerState: (
    state: CanvasUiState["dataPickerState"],
  ) => void;
  readonly addPendingOperation: (operationId: string) => void;
  readonly removePendingOperation: (operationId: string) => void;
  readonly clearSelection: () => void;
}

export const useCanvasUiStore = create<CanvasUiState>((set) => ({
  selectedNodeId: null,
  selectedEdgeId: null,
  inspectorTab: "overview",
  paletteOpen: true,
  inspectorExpanded: false,
  bottomPanelOpen: true,
  chatDrawerOpen: false,
  runPreviewDrawerOpen: false,
  versionHistoryDrawerOpen: false,
  commandPaletteOpen: false,
  pendingOperationIds: [],
  connectionNotice: null,
  localDraftEdits: {},
  dirtyFields: {},
  dataPickerState: {
    nodeId: null,
    inputKey: null,
  },
  setSelectedNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
    }),
  setSelectedEdge: (edgeId) =>
    set({
      selectedNodeId: null,
      selectedEdgeId: edgeId,
    }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setInspectorExpanded: (inspectorExpanded) => set({ inspectorExpanded }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
  setChatDrawerOpen: (chatDrawerOpen) => set({ chatDrawerOpen }),
  setRunPreviewDrawerOpen: (runPreviewDrawerOpen) =>
    set({ runPreviewDrawerOpen }),
  setVersionHistoryDrawerOpen: (versionHistoryDrawerOpen) =>
    set({ versionHistoryDrawerOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setConnectionNotice: (connectionNotice) => set({ connectionNotice }),
  setLocalDraftEdit: (nodeId, key, value) =>
    set((state) => {
      const nodeEdits = state.localDraftEdits[nodeId] ?? {};
      const nodeDirtyFields = state.dirtyFields[nodeId] ?? [];
      return {
        localDraftEdits: {
          ...state.localDraftEdits,
          [nodeId]: {
            ...nodeEdits,
            [key]: value,
          },
        },
        dirtyFields: {
          ...state.dirtyFields,
          [nodeId]: nodeDirtyFields.includes(key)
            ? nodeDirtyFields
            : [...nodeDirtyFields, key],
        },
      };
    }),
  clearLocalDraftEdits: (nodeId) =>
    set((state) => {
      const { [nodeId]: _edits, ...localDraftEdits } = state.localDraftEdits;
      const { [nodeId]: _dirty, ...dirtyFields } = state.dirtyFields;
      void _edits;
      void _dirty;
      return { localDraftEdits, dirtyFields };
    }),
  setDataPickerState: (dataPickerState) => set({ dataPickerState }),
  addPendingOperation: (operationId) =>
    set((state) => ({
      pendingOperationIds: [...state.pendingOperationIds, operationId],
    })),
  removePendingOperation: (operationId) =>
    set((state) => ({
      pendingOperationIds: state.pendingOperationIds.filter(
        (item) => item !== operationId,
      ),
    })),
  clearSelection: () =>
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
    }),
}));
