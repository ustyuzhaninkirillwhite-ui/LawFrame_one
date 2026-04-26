"use client";

import type {
  CanvasModuleCard,
  CanvasOperation,
  CanvasOperationRequest,
  CanvasOperationResult,
  CanvasPermissions,
  LexFrameWorkflowV2,
  NoCodeNodePresentation,
  WorkflowNode,
} from "@lexframe/contracts";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canvasEdgeTypes } from "./canvas-edges";
import { canvasNodeTypes } from "./canvas-nodes";
import {
  cloneNodeForDuplicate,
  connectionToAddEdgeOperation,
  createClientOperationId,
  createInverseOperations,
  explainInvalidConnection,
  isValidConnection,
  resolveReadOnlyMode,
  withBaseGuards,
  workflowToFlowEdges,
  workflowToFlowNodes,
  type CanvasEdgeData,
  type CanvasNodeData,
} from "../lib/canvas-projection";
import { useCanvasUiStore } from "../store";

type CanvasFlowNode = Node<CanvasNodeData>;
type CanvasFlowEdge = Edge<CanvasEdgeData>;

export interface AddModuleFromCanvasInput {
  readonly module: CanvasModuleCard;
  readonly source: "palette" | "recommended" | "inline_add" | "quick_add" | "drag_drop";
  readonly insert: {
    readonly position:
      | "workflow_start"
      | "after_node"
      | "before_node"
      | "branch_true"
      | "branch_false"
      | "router_branch"
      | "loop_body"
      | "approval_after"
      | "error_handler"
      | "workflow_end";
    readonly source_node_id?: string | null;
    readonly target_node_id?: string | null;
    readonly source_handle?: string | null;
    readonly target_handle?: string | null;
  };
}

export function WorkflowCanvas({
  workflow,
  permissions,
  workflowHash,
  lockReadOnly,
  modules,
  operationResults,
  noCodeNodes,
  onAddModule,
  onOperations,
}: {
  readonly workflow: LexFrameWorkflowV2;
  readonly permissions: CanvasPermissions;
  readonly workflowHash: string;
  readonly lockReadOnly: boolean;
  readonly modules: readonly CanvasModuleCard[];
  readonly operationResults: readonly CanvasOperationResult[];
  readonly noCodeNodes?: readonly NoCodeNodePresentation[];
  readonly onAddModule: (input: AddModuleFromCanvasInput) => void;
  readonly onOperations: (input: CanvasOperationRequest) => void;
}) {
  const setSelectedNode = useCanvasUiStore((state) => state.setSelectedNode);
  const setSelectedEdge = useCanvasUiStore((state) => state.setSelectedEdge);
  const selectedNodeId = useCanvasUiStore((state) => state.selectedNodeId);
  const selectedEdgeId = useCanvasUiStore((state) => state.selectedEdgeId);
  const connectionNotice = useCanvasUiStore((state) => state.connectionNotice);
  const setConnectionNotice = useCanvasUiStore((state) => state.setConnectionNotice);
  const setCommandPaletteOpen = useCanvasUiStore(
    (state) => state.setCommandPaletteOpen,
  );
  const readOnlyState = React.useMemo(
    () => resolveReadOnlyMode({ workflow, permissions, lockReadOnly }),
    [lockReadOnly, permissions, workflow],
  );
  const readOnly = readOnlyState.readOnly;
  const nodesById = React.useMemo(
    () => new Map(workflow.nodes.map((node) => [node.id, node])),
    [workflow.nodes],
  );
  const validationContext = React.useMemo(
    () => ({ workflow, nodesById, edges: workflow.edges }),
    [nodesById, workflow],
  );
  const [flowInstance, setFlowInstance] =
    React.useState<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    readonly nodeId: string;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const [undoStack, setUndoStack] = React.useState<readonly CanvasOperation[][]>([]);
  const [redoStack, setRedoStack] = React.useState<readonly CanvasOperation[][]>([]);
  const lastBackendUndoRef = React.useRef<string | null>(null);

  const inlineModules = React.useMemo(
    () =>
      modules.filter(
        (item) =>
          canAddModule(item.availability.status) &&
          !["trigger", "end", "group"].includes(item.insertion.default_node_type),
      ),
    [modules],
  );

  const dispatchOperations = React.useCallback(
    (
      operations: readonly CanvasOperation[],
      options: {
        readonly recordHistory?: boolean;
        readonly selectNodeId?: string | null;
      } = {},
    ) => {
      if (operations.length === 0) {
        return;
      }
      if (options.recordHistory) {
        const inverse = createInverseOperations(workflow, operations);
        if (inverse.length > 0) {
          setUndoStack((stack) => [...stack, [...inverse]]);
          setRedoStack([]);
        }
      }
      onOperations({
        operations: withBaseGuards(
          operations,
          workflowHash,
          workflow.revision_counter,
        ),
      });
      if (options.selectNodeId !== undefined) {
        setSelectedNode(options.selectNodeId);
      }
    },
    [onOperations, setSelectedNode, workflow, workflowHash],
  );

  const onInlineAdd = React.useCallback(
    (edgeId: string, module: CanvasModuleCard) => {
      if (readOnly) {
        return;
      }
      const edge = workflow.edges.find((item) => item.id === edgeId);
      if (!edge) {
        return;
      }
      onAddModule({
        module,
        source: "inline_add",
        insert: {
          position: "after_node",
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          source_handle: edge.source_handle,
          target_handle: edge.target_handle,
        },
      });
    },
    [onAddModule, readOnly, workflow.edges],
  );

  const projectedNodes = React.useMemo(
    () =>
      workflowToFlowNodes(workflow, permissions, lockReadOnly, {
        noCodeNodes,
      }),
    [lockReadOnly, noCodeNodes, permissions, workflow],
  );
  const projectedEdges = React.useMemo(
    () =>
      workflowToFlowEdges(workflow, permissions, lockReadOnly, {
        inlineModules,
        onInlineAdd,
      }),
    [inlineModules, lockReadOnly, onInlineAdd, permissions, workflow],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(projectedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(projectedEdges);

  React.useEffect(() => {
    setNodes(projectedNodes);
    setEdges(projectedEdges);
  }, [projectedEdges, projectedNodes, setEdges, setNodes]);

  React.useEffect(() => {
    for (let index = operationResults.length - 1; index >= 0; index -= 1) {
      const result = operationResults[index];
      if (!result) {
        continue;
      }
      const undoOperations = result.undo_operations ?? [];
      if (
        result.operation_type === "ADD_NODE_FROM_MODULE" &&
        result.added_node_id &&
        undoOperations.length > 0
      ) {
        const key = `${result.added_node_id}:${undoOperations
          .map((operation) => operation.client_operation_id)
          .join("|")}`;
        if (lastBackendUndoRef.current !== key) {
          lastBackendUndoRef.current = key;
          setUndoStack((stack) => [...stack, [...undoOperations]]);
          setRedoStack([]);
        }
        break;
      }
    }
  }, [operationResults]);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (readOnly) {
        return;
      }
      const rejectedReason = explainInvalidConnection(connection, validationContext);
      if (rejectedReason) {
        setConnectionNotice(rejectedReason);
        return;
      }
      const operation = connectionToAddEdgeOperation(connection);
      if (!operation) {
        return;
      }
      dispatchOperations([operation], { recordHistory: true });
      setConnectionNotice(null);
    },
    [
      dispatchOperations,
      readOnly,
      setConnectionNotice,
      validationContext,
    ],
  );

  const onNodeDragStop = React.useCallback(
    (_event: React.MouseEvent, node: CanvasFlowNode) => {
      if (readOnly) {
        return;
      }
      dispatchOperations(
        [
          {
            client_operation_id: createClientOperationId("move"),
            operation_type: "MOVE_NODE",
            operation_payload: {
              node_id: node.id,
              x: node.position.x,
              y: node.position.y,
            },
          },
        ],
        { recordHistory: true },
      );
    },
    [dispatchOperations, readOnly],
  );

  const deleteSelection = React.useCallback(() => {
    if (readOnly) {
      return;
    }
    if (selectedNodeId) {
      const selectedNode = workflow.nodes.find((node) => node.id === selectedNodeId);
      if (selectedNode && selectedNode.type !== "trigger" && selectedNode.type !== "end") {
        dispatchOperations(
          [
            {
              client_operation_id: createClientOperationId("delete_node"),
              operation_type: "DELETE_NODE",
              operation_payload: { node_id: selectedNodeId },
            },
          ],
          { recordHistory: true, selectNodeId: null },
        );
      }
      return;
    }
    if (selectedEdgeId) {
      dispatchOperations(
        [
          {
            client_operation_id: createClientOperationId("delete_edge"),
            operation_type: "DELETE_EDGE",
            operation_payload: { edge_id: selectedEdgeId },
          },
        ],
        { recordHistory: true },
      );
      setSelectedEdge(null);
    }
  }, [
    dispatchOperations,
    readOnly,
    selectedEdgeId,
    selectedNodeId,
    setSelectedEdge,
    workflow.nodes,
  ]);

  const duplicateNode = React.useCallback(
    (nodeId: string | null = selectedNodeId) => {
      if (readOnly || !nodeId) {
        return;
      }
      const node = workflow.nodes.find((item) => item.id === nodeId);
      if (!node || node.type === "trigger" || node.type === "end") {
        return;
      }
      const duplicate = cloneNodeForDuplicate(node);
      dispatchOperations(
        [
          {
            client_operation_id: createClientOperationId("duplicate_node"),
            operation_type: "ADD_NODE",
            operation_payload: { node: duplicate },
          },
        ],
        { recordHistory: true, selectNodeId: duplicate.id },
      );
    },
    [dispatchOperations, readOnly, selectedNodeId, workflow.nodes],
  );

  const undo = React.useCallback(() => {
    const inverse = undoStack.at(-1);
    if (!inverse || readOnly) {
      return;
    }
    const redo = createInverseOperations(workflow, inverse);
    setUndoStack((stack) => stack.slice(0, -1));
    if (redo.length > 0) {
      setRedoStack((stack) => [...stack, [...redo]]);
    }
    onOperations({
      operations: withBaseGuards(inverse, workflowHash, workflow.revision_counter),
    });
  }, [onOperations, readOnly, undoStack, workflow, workflowHash]);

  const redo = React.useCallback(() => {
    const operations = redoStack.at(-1);
    if (!operations || readOnly) {
      return;
    }
    const inverse = createInverseOperations(workflow, operations);
    setRedoStack((stack) => stack.slice(0, -1));
    if (inverse.length > 0) {
      setUndoStack((stack) => [...stack, [...inverse]]);
    }
    onOperations({
      operations: withBaseGuards(
        operations,
        workflowHash,
        workflow.revision_counter,
      ),
    });
  }, [onOperations, readOnly, redoStack, workflow, workflowHash]);

  const copiedNodeRef = React.useRef<WorkflowNode | null>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedNode(null);
        setSelectedEdge(null);
        setContextMenu(null);
        setConnectionNotice(null);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !readOnly) {
        deleteSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateNode();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const node = selectedNodeId
          ? workflow.nodes.find((item) => item.id === selectedNodeId)
          : null;
        if (node && node.type !== "trigger" && node.type !== "end") {
          copiedNodeRef.current = node;
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        if (!readOnly && copiedNodeRef.current) {
          const node = cloneNodeForDuplicate(copiedNodeRef.current, 56);
          dispatchOperations(
            [
              {
                client_operation_id: createClientOperationId("paste_node"),
                operation_type: "ADD_NODE",
                operation_payload: { node },
              },
            ],
            { recordHistory: true, selectNodeId: node.id },
          );
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    deleteSelection,
    dispatchOperations,
    duplicateNode,
    readOnly,
    redo,
    selectedNodeId,
    setCommandPaletteOpen,
    setConnectionNotice,
    setSelectedEdge,
    setSelectedNode,
    undo,
    workflow.nodes,
  ]);

  const onDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) {
        return;
      }
      const code = event.dataTransfer.getData("application/x-lexframe-module");
      const moduleCard = modules.find((item) => item.module_code === code);
      if (!moduleCard || !flowInstance) {
        return;
      }
      onAddModule({
        module: moduleCard,
        source: "drag_drop",
        insert: { position: workflow.nodes.length === 0 ? "workflow_start" : "workflow_end" },
      });
    },
    [modules, flowInstance, onAddModule, readOnly, workflow.nodes.length],
  );

  return (
    <div className="relative h-full min-h-[640px] overflow-hidden bg-[#10141c]">
      <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
        nodeTypes={canvasNodeTypes}
        edgeTypes={canvasEdgeTypes}
        nodes={nodes}
        edges={edges}
        onInit={setFlowInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        isValidConnection={(connection) =>
          isValidConnection(toConnection(connection), validationContext)
        }
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          setSelectedNode(node.id);
          setContextMenu(null);
        }}
        onEdgeClick={(_, edge) => {
          setSelectedEdge(edge.id);
          setContextMenu(null);
        }}
        onPaneClick={() => {
          setSelectedNode(null);
          setSelectedEdge(null);
          setContextMenu(null);
        }}
        onNodeDoubleClick={(_, node) => setSelectedNode(node.id)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          setSelectedNode(node.id);
          setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
        }}
        onNodeDragStop={onNodeDragStop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = readOnly ? "none" : "copy";
        }}
        onDrop={onDrop}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <MiniMap pannable zoomable />
        <Controls aria-label="Масштаб и навигация Canvas" />
        <Background />
      </ReactFlow>

      {workflow.nodes.length === 0 ? (
        <CanvasEmptyState readOnly={readOnly} />
      ) : null}

      {connectionNotice ? (
        <div className="absolute left-4 top-4 max-w-md rounded-[8px] border border-[color:var(--danger)]/40 bg-[#111722] p-3 text-sm text-[#f5f2ea] shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <Badge variant="danger">Связь заблокирована</Badge>
          <div className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
            {connectionNotice}
          </div>
        </div>
      ) : null}

      {readOnlyState.reason ? (
        <div className="absolute bottom-4 left-4 rounded-[8px] border border-[color:var(--line)] bg-[#111722] px-3 py-2 text-xs text-[color:var(--muted)]">
          {readOnlyState.reason}
        </div>
      ) : null}

      <CanvasToolbar
        canUndo={undoStack.length > 0 && !readOnly}
        canRedo={redoStack.length > 0 && !readOnly}
        onUndo={undo}
        onRedo={redo}
        onDelete={deleteSelection}
        onDuplicate={() => duplicateNode()}
        readOnly={readOnly}
      />

      {contextMenu ? (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          readOnly={readOnly}
          onDuplicate={() => {
            duplicateNode(contextMenu.nodeId);
            setContextMenu(null);
          }}
          onDelete={() => {
            deleteSelection();
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}

function canAddModule(status: CanvasModuleCard["availability"]["status"]) {
  return [
    "available",
    "available_with_warnings",
    "missing_connection",
    "missing_profile",
    "missing_template",
  ].includes(status);
}

function CanvasToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
  readOnly,
}: {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
  readonly onDuplicate: () => void;
  readonly readOnly: boolean;
}) {
  return (
    <div className="absolute right-4 top-4 flex flex-wrap gap-2 rounded-[8px] border border-[color:var(--line)] bg-[#111722]/92 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
      <Button type="button" size="sm" variant="ghost" disabled={!canUndo} onClick={onUndo}>
        Undo
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={!canRedo} onClick={onRedo}>
        Redo
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function CanvasEmptyState({ readOnly }: { readonly readOnly: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="max-w-sm rounded-[8px] border border-[color:var(--line)] bg-[#111722]/94 p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.36)]">
        <Badge variant="muted">Пустой Canvas</Badge>
        <h2 className="mt-3 text-lg font-semibold">Здесь пока нет сценария</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {readOnly
            ? "У вас есть доступ только на просмотр."
            : "Начните со стартового блока или перетащите модуль из палитры."}
        </p>
      </div>
    </div>
  );
}

function NodeContextMenu({
  x,
  y,
  readOnly,
  onDuplicate,
  onDelete,
  onClose,
}: {
  readonly x: number;
  readonly y: number;
  readonly readOnly: boolean;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 w-48 rounded-[8px] border border-[color:var(--line)] bg-[#111722] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.4)]"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={readOnly} onClick={onDelete}>
        Delete
      </Button>
    </div>
  );
}

function toConnection(connection: Connection | Edge): Connection {
  return {
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? null,
    targetHandle: connection.targetHandle ?? null,
  };
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}
