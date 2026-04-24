"use client";

import type {
  InstalledAutomationDetail,
  PermissionCode,
  Stage15UiStatus,
} from "@lexframe/contracts";
import {
  applyNodeChanges,
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  Bot,
  CheckCircle2,
  CircleDot,
  FileText,
  GitBranch,
  Mic,
  Paperclip,
  Play,
  Plus,
  Save,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useStage15ProjectAutomations,
  useStage15ProjectSnapshot,
} from "@/hooks/domain/stage15";
import { cn } from "@/lib/utils";
import { useSessionBridge } from "@/providers/session-provider";
import {
  addPaletteNodeToCanvas,
  addComposerAttachment,
  createEmptyWorkflowCanvas,
  createsCycleWithEdge,
  deriveCanvasStatus,
  insertPaletteNodeOnEdge,
  isBlockingCanvasIssue,
  legalBlockPalette,
  removeCanvasEdge,
  removeCanvasNode,
  removeComposerAttachment,
  updateCanvasEdge,
  updateCanvasNode,
  updateCanvasNodePosition,
  validateCanvasGraph,
  type AutomationComposerAttachment,
  type BlockPaletteItem,
  type CanvasValidationIssue,
  type WorkflowCanvasDraft,
  type WorkflowCanvasEdge,
  type WorkflowCanvasNode,
  type WorkflowCanvasPosition,
  type WorkflowPolicyState,
} from "./automation-workbench-model";

interface FlowNodeData extends Record<string, unknown> {
  readonly label: React.ReactNode;
  readonly action: "select" | "add";
  readonly canvasNodeId?: string;
  readonly edgeId?: string;
}

type WorkbenchFlowNode = Node<FlowNodeData>;
type WorkbenchFlowEdge = Edge<Record<string, unknown>>;
type PaletteTarget =
  | { readonly type: "canvas"; readonly position: WorkflowCanvasPosition }
  | { readonly type: "edge"; readonly edgeId: string };

const statusLabels: Record<Stage15UiStatus, string> = {
  draft: "Draft",
  saved: "Saved",
  autosaving: "Saving",
  syncing: "Syncing",
  synced: "Synced",
  conflict: "Conflict",
  validation_failed: "Validation",
  runtime_unavailable: "Runtime",
  missing_connection: "Connection",
  blocked_by_policy: "Policy",
  permission_required: "Permission",
};

const AUTOMATION_COMPOSER_ONBOARDING_HINT =
  "Опишите автоматизацию, а прикрепленные источники и сценарии будут обязательным контекстом.";
const AUTOMATION_COMPOSER_HINT_STORAGE_KEY = "lexframe.automation-composer-hint.v1";
const AUTOMATION_COMPOSER_HINT_TTL_MS = 48 * 60 * 60 * 1000;
const EMPTY_MISSING_CONNECTIONS: InstalledAutomationDetail["missingConnections"] = [];

export function AutomationWorkbench({ projectId }: { readonly projectId: string }) {
  const automations = useStage15ProjectAutomations(projectId);
  const snapshot = useStage15ProjectSnapshot(projectId);
  const { sessionContext } = useSessionBridge();
  const permissions = sessionContext.permissions;
  const canEdit = hasPermission(permissions, "automation.edit");
  const canRun = hasPermission(permissions, "automation.run");
  const canOpenAdvanced = hasPermission(permissions, "activepieces.open_builder");
  const [draft, setDraft] = React.useState<WorkflowCanvasDraft>(() =>
    createEmptyWorkflowCanvas(),
  );
  const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = React.useState<string | null>(
    "local_empty_canvas",
  );
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);
  const [settingsNodeId, setSettingsNodeId] = React.useState<string | null>(null);
  const [paletteTarget, setPaletteTarget] = React.useState<PaletteTarget | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [attachments, setAttachments] = React.useState<readonly AutomationComposerAttachment[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const [forcedStatus, setForcedStatus] = React.useState<Stage15UiStatus | null>(null);
  const [chatPrompt, setChatPrompt] = React.useState("");
  const [chatDraft, setChatDraft] = React.useState(AUTOMATION_COMPOSER_ONBOARDING_HINT);
  const [showComposerHint, setShowComposerHint] = React.useState(false);
  const [connectNotice, setConnectNotice] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const automationList = automations.data ?? [];
  const projectDocuments = snapshot.data?.projectDocuments ?? [];
  const selectedAutomation =
    automationList.find((automation) => automation.id === selectedAutomationId) ?? null;
  const missingConnections = selectedAutomation?.missingConnections ?? EMPTY_MISSING_CONNECTIONS;
  const validationIssues = React.useMemo(
    () => validateCanvasGraph(draft.nodes, draft.edges),
    [draft],
  );
  const derivedStatus = React.useMemo(
    () => deriveCanvasStatus(validationIssues, missingConnections, dirty, conflict),
    [conflict, dirty, missingConnections, validationIssues],
  );
  const activeForcedStatus = dirty && forcedStatus !== "autosaving" ? null : forcedStatus;
  const uiStatus = activeForcedStatus ?? derivedStatus;
  const selectedNode = draft.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const settingsNode = draft.nodes.find((node) => node.id === settingsNodeId) ?? null;
  const selectedEdge = draft.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const saveDisabledReason = getSaveDisabledReason({
    canEdit,
    dirty,
  });
  const runDisabledReason = getRunDisabledReason({
    canRun,
    missingConnections,
    nodeCount: draft.nodes.length,
    status: uiStatus,
    validationIssues,
  });
  const advancedDisabledReason = !selectedAutomationId
    ? "Для Advanced выберите сохраненную автоматизацию."
    : !canOpenAdvanced
      ? "Нужно право activepieces.open_builder."
      : null;
  const openNodeSettings = React.useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSettingsNodeId(nodeId);
    setPaletteTarget(null);
    setComposerOpen(false);
  }, [
    setComposerOpen,
    setPaletteTarget,
    setSelectedEdgeId,
    setSelectedNodeId,
    setSettingsNodeId,
  ]);

  const deleteCanvasNode = React.useCallback((nodeId: string) => {
    setDraft((currentDraft) => removeCanvasNode(currentDraft, nodeId));
    setSelectedNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId));
    setSettingsNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId));
    setSelectedEdgeId(null);
    setPaletteTarget(null);
    setDirty(true);
    setConnectNotice("Блок удалён вместе со связанными переходами.");
  }, [
    setConnectNotice,
    setDirty,
    setDraft,
    setPaletteTarget,
    setSelectedEdgeId,
    setSelectedNodeId,
    setSettingsNodeId,
  ]);

  const deleteCanvasEdge = React.useCallback((edgeId: string) => {
    setDraft((currentDraft) => removeCanvasEdge(currentDraft, edgeId));
    setSelectedEdgeId((currentEdgeId) => (currentEdgeId === edgeId ? null : currentEdgeId));
    setPaletteTarget(null);
    setDirty(true);
    setConnectNotice("Связь удалена.");
  }, [
    setConnectNotice,
    setDirty,
    setDraft,
    setPaletteTarget,
    setSelectedEdgeId,
  ]);

  const builtFlowNodes = React.useMemo(
    () =>
      buildFlowNodes({
        canEdit,
        draft,
        onDeleteNode: deleteCanvasNode,
        onOpenSettings: openNodeSettings,
        paletteEdgeId: paletteTarget?.type === "edge" ? paletteTarget.edgeId : null,
        selectedNodeId,
      }),
    [canEdit, deleteCanvasNode, draft, openNodeSettings, paletteTarget, selectedNodeId],
  );
  const [flowNodes, setFlowNodes] = React.useState<WorkbenchFlowNode[]>(builtFlowNodes);
  const flowEdges = React.useMemo(() => buildFlowEdges(draft, selectedEdgeId), [draft, selectedEdgeId]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFlowNodes(builtFlowNodes);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [builtFlowNodes]);

  React.useEffect(() => {
    if (forcedStatus !== "autosaving") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDirty(false);
      setForcedStatus("saved");
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [forcedStatus]);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        setShowComposerHint(shouldShowAutomationComposerHint(window.localStorage));
      } catch {
        setShowComposerHint(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function createLocalDraft() {
    const nextDraft = createEmptyWorkflowCanvas();
    setDraft(nextDraft);
    setSelectedAutomationId(null);
    setSelectedDraftId(`local_${Date.now().toString(36)}`);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSettingsNodeId(null);
    setPaletteTarget(null);
    setDirty(true);
    setConflict(false);
    setForcedStatus("draft");
    setConnectNotice("Создан пустой canvas draft. Добавьте первый блок вручную или через чат.");
  }

  function addPaletteItem(item: BlockPaletteItem) {
    if (!paletteTarget) {
      return;
    }

    const missingPermissions = item.requiredPermissions.filter(
      (permission) => !hasPermission(permissions, permission),
    );

    if (missingPermissions.length > 0) {
      setConnectNotice(`Нужны права: ${missingPermissions.join(", ")}.`);
      return;
    }

    const nodeId = `${item.kind}_${Date.now().toString(36)}`;
    setDraft((currentDraft) => {
      if (paletteTarget.type === "edge") {
        return insertPaletteNodeOnEdge(currentDraft, paletteTarget.edgeId, item, nodeId);
      }

      return addPaletteNodeToCanvas(currentDraft, item, nodeId, paletteTarget.position);
    });
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSettingsNodeId(nodeId);
    setPaletteTarget(null);
    setDirty(true);
    setConnectNotice("Модуль добавлен на canvas. Настройте входы, выходы и prompt.");
  }

  const onConnect = React.useCallback((connection: Connection) => {
    const sourceNodeId = connection.source;
    const targetNodeId = connection.target;

    if (!sourceNodeId || !targetNodeId) {
      return;
    }

    if (sourceNodeId === targetNodeId) {
      setConnectNotice("Связь отклонена: блок нельзя соединить с самим собой.");
      return;
    }

    setDraft((currentDraft) => {
      if (
        currentDraft.edges.some(
          (candidate) =>
            candidate.sourceNodeId === sourceNodeId && candidate.targetNodeId === targetNodeId,
        )
      ) {
        setConnectNotice("Такая связь уже есть.");
        return currentDraft;
      }

      const edge = {
        id: `edge_${sourceNodeId}_${targetNodeId}_${Date.now().toString(36)}`,
        sourceNodeId,
        targetNodeId,
        condition: "success",
      };

      if (
        !currentDraft.nodes.some((node) => node.id === sourceNodeId) ||
        !currentDraft.nodes.some((node) => node.id === targetNodeId) ||
        createsCycleWithEdge(currentDraft.nodes, currentDraft.edges, edge)
      ) {
        setConnectNotice("Связь отклонена: в canvas нельзя создавать циклы.");
        return currentDraft;
      }

      setDirty(true);
      setConnectNotice("Связь добавлена. Для ветвления задайте условие на связи.");
      return {
        ...currentDraft,
        edges: [...currentDraft.edges, edge],
      };
    });
  }, [setConnectNotice, setDirty, setDraft]);

  function updateNode(nodeId: string, changes: Partial<Omit<WorkflowCanvasNode, "id">>) {
    setDraft((currentDraft) => updateCanvasNode(currentDraft, nodeId, changes));
    setDirty(true);
  }

  function updateEdge(edgeId: string, condition: string) {
    setDraft((currentDraft) =>
      updateCanvasEdge(currentDraft, edgeId, {
        condition: condition.trim() || "success",
      }),
    );
    setDirty(true);
  }

  const onNodesChange = React.useCallback((changes: NodeChange<WorkbenchFlowNode>[]) => {
    setFlowNodes((currentNodes) =>
      applyNodeChanges(changes, currentNodes) as WorkbenchFlowNode[],
    );
  }, [setFlowNodes]);

  const onNodeDragStop = React.useCallback((_: React.MouseEvent, node: WorkbenchFlowNode) => {
    if (node.data.action !== "select" || !node.data.canvasNodeId) {
      return;
    }

    setDraft((currentDraft) =>
      updateCanvasNodePosition(currentDraft, node.data.canvasNodeId!, node.position),
    );
    setDirty(true);
  }, [setDirty, setDraft]);

  function handleNodeClick(_: React.MouseEvent, node: WorkbenchFlowNode) {
    if (node.data.action === "add" && node.data.edgeId) {
      setPaletteTarget({ type: "edge", edgeId: node.data.edgeId });
      setSelectedEdgeId(node.data.edgeId);
      setSettingsNodeId(null);
      setComposerOpen(false);
      return;
    }

    if (node.data.canvasNodeId) {
      setSelectedNodeId(node.data.canvasNodeId);
      setSelectedEdgeId(null);
      setPaletteTarget(null);
      setComposerOpen(false);
    }
  }

  function handleEdgeClick(event: React.MouseEvent, edge: WorkbenchFlowEdge) {
    event.stopPropagation();
    const edgeId = String(edge.data?.canvasEdgeId ?? edge.id);
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setSettingsNodeId(null);
    setPaletteTarget(null);
    setComposerOpen(false);
  }

  function closeCanvasOverlays() {
    setPaletteTarget(null);
    setSettingsNodeId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setComposerOpen(false);
  }

  function openPaletteAt(position: WorkflowCanvasPosition) {
    setPaletteTarget({ type: "canvas", position });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSettingsNodeId(null);
    setComposerOpen(false);
  }

  const deleteSelectedCanvasItem = React.useCallback(() => {
    if (selectedNodeId) {
      deleteCanvasNode(selectedNodeId);
      return;
    }

    if (selectedEdgeId) {
      deleteCanvasEdge(selectedEdgeId);
    }
  }, [deleteCanvasEdge, deleteCanvasNode, selectedEdgeId, selectedNodeId]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;

      if (target?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }

      if (!selectedNodeId && !selectedEdgeId) {
        return;
      }

      event.preventDefault();
      deleteSelectedCanvasItem();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelectedCanvasItem, selectedEdgeId, selectedNodeId]);

  function addAttachment(attachment: AutomationComposerAttachment) {
    setAttachments((current) => addComposerAttachment(current, attachment));
    setComposerOpen(false);
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    addAttachment({
      id: `local_file_${Date.now().toString(36)}`,
      required: true,
      title: `${file.name} · pending`,
      type: "file",
    });
    event.target.value = "";
  }

  function handleChatSubmit() {
    const trimmed = chatPrompt.trim();

    if (!trimmed) {
      return;
    }

    setChatDraft(
      `Запрос принят: "${trimmed}". В контекст добавлено: ${
        attachments.length > 0
          ? attachments.map((attachment) => attachment.title).join(", ")
          : "без вложений"
      }.`,
    );
    setChatPrompt("");
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[color:var(--background)]">
      <div className="absolute inset-0 bottom-[98px]">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onConnect={onConnect}
          onEdgeClick={handleEdgeClick}
          onNodeClick={handleNodeClick}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
          onPaneClick={closeCanvasOverlays}
          defaultViewport={{ x: 120, y: 32, zoom: 0.92 }}
          minZoom={0.4}
          maxZoom={1.45}
          nodesDraggable
          proOptions={{ hideAttribution: true }}
          className="automation-canvas"
        >
          <Background color="rgba(255,255,255,0.13)" gap={18} size={1} />
          <Controls className="!left-5 !top-5 !bottom-auto !rounded-[18px] !border !border-[color:var(--line)] !bg-[color:var(--panel)]/92 !shadow-none [&_button]:!border-[color:var(--line)] [&_button]:!bg-transparent [&_button_svg]:!fill-[color:var(--foreground)]" />
        </ReactFlow>
      </div>

      {draft.nodes.length === 0 ? (
        <CanvasEmptyState onAddBlock={() => openPaletteAt({ x: 360, y: 180 })} />
      ) : null}

      <CanvasHud
        connectNotice={connectNotice}
        dirty={dirty}
        draftId={selectedDraftId}
        issues={validationIssues}
        selectedNode={selectedNode}
        status={uiStatus}
      />

      <CanvasActionHud
        advancedDisabledReason={advancedDisabledReason}
        canOpenAdvanced={canOpenAdvanced}
        onAddBlock={() => openPaletteAt({ x: 420, y: 220 })}
        onCreateDraft={createLocalDraft}
        onPreflight={() =>
          setConnectNotice("Локальная проверка пройдена. Runtime sync и delivery не запускались.")
        }
        onSave={() => setForcedStatus("autosaving")}
        projectId={projectId}
        runDisabledReason={runDisabledReason}
        saveDisabledReason={saveDisabledReason}
        selectedAutomationId={selectedAutomationId}
      />

      {paletteTarget ? (
        <BlockPalette
          onClose={() => setPaletteTarget(null)}
          onSelect={addPaletteItem}
        />
      ) : null}

      {selectedEdge ? (
        <EdgeSettingsPopover
          key={selectedEdge.id}
          edge={selectedEdge}
          onClose={() => setSelectedEdgeId(null)}
          onDelete={() => deleteCanvasEdge(selectedEdge.id)}
          onUpdate={updateEdge}
        />
      ) : null}

      {settingsNode ? (
        <ModuleSettingsDrawer
          canEdit={canEdit}
          node={settingsNode}
          onDelete={() => deleteCanvasNode(settingsNode.id)}
          onClose={() => setSettingsNodeId(null)}
          onUpdate={(changes) => updateNode(settingsNode.id, changes)}
        />
      ) : null}

      <AutomationChatComposer
        attachments={attachments}
        automations={automationList}
        chatDraft={chatDraft}
        chatPrompt={chatPrompt}
        documents={projectDocuments}
        fileInputRef={fileInputRef}
        menuOpen={composerOpen}
        showChatDraft={showComposerHint || chatDraft !== AUTOMATION_COMPOSER_ONBOARDING_HINT}
        onAddAttachment={addAttachment}
        onChatPromptChange={setChatPrompt}
        onChatSubmit={handleChatSubmit}
        onFileSelected={handleFileSelected}
        onOpenBlockPalette={() => openPaletteAt({ x: 420, y: 220 })}
        onRemoveAttachment={(attachment) =>
          setAttachments((current) => removeComposerAttachment(current, attachment))
        }
        onToggleMenu={() => setComposerOpen((current) => !current)}
      />
    </div>
  );
}

function CanvasHud({
  connectNotice,
  dirty,
  draftId,
  issues,
  selectedNode,
  status,
}: {
  readonly connectNotice: string | null;
  readonly dirty: boolean;
  readonly draftId: string | null;
  readonly issues: readonly CanvasValidationIssue[];
  readonly selectedNode: WorkflowCanvasNode | null;
  readonly status: Stage15UiStatus;
}) {
  const blockingIssueCount = issues.filter(isBlockingCanvasIssue).length;
  const warningIssueCount = issues.length - blockingIssueCount;

  return (
    <div className="pointer-events-none absolute left-5 top-5 z-10 flex max-w-[min(720px,calc(100vw-220px))] items-center gap-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--panel)]/92 px-3 py-2 text-xs shadow-xl shadow-black/25 backdrop-blur">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          blockingIssueCount > 0
            ? "bg-[color:var(--danger)]"
            : warningIssueCount > 0
              ? "bg-[color:var(--accent-strong)]"
              : "bg-[color:var(--success)]",
        )}
      />
      <span className="shrink-0 font-semibold">Builder</span>
      <span className="shrink-0 text-[color:var(--muted)]">{statusLabels[status]}</span>
      <span className="shrink-0 text-[color:var(--muted)]">
        {blockingIssueCount > 0
          ? `${blockingIssueCount} validation`
          : warningIssueCount > 0
            ? `${warningIssueCount} warning`
            : "OK"}
      </span>
      {dirty ? <span className="shrink-0 text-[color:var(--accent-strong)]">Draft</span> : null}
      <span className="min-w-0 truncate text-[color:var(--muted)]" title={connectNotice ?? draftId ?? ""}>
        {connectNotice ?? selectedNode?.title ?? draftId}
      </span>
    </div>
  );
}

function CanvasActionHud({
  advancedDisabledReason,
  canOpenAdvanced,
  onAddBlock,
  onCreateDraft,
  onPreflight,
  onSave,
  projectId,
  runDisabledReason,
  saveDisabledReason,
  selectedAutomationId,
}: {
  readonly advancedDisabledReason: string | null;
  readonly canOpenAdvanced: boolean;
  readonly onAddBlock: () => void;
  readonly onCreateDraft: () => void;
  readonly onPreflight: () => void;
  readonly onSave: () => void;
  readonly projectId: string;
  readonly runDisabledReason: string | null;
  readonly saveDisabledReason: string | null;
  readonly selectedAutomationId: string | null;
}) {
  return (
    <div className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)]/92 p-1.5 shadow-xl shadow-black/25 backdrop-blur">
      <IconAction label="Добавить блок" onClick={onAddBlock}>
        <Plus className="h-4 w-4" />
      </IconAction>
      <IconAction label="Новый draft" onClick={onCreateDraft}>
        <Sparkles className="h-4 w-4" />
      </IconAction>
      <IconAction label="Сохранить" onClick={onSave} reason={saveDisabledReason}>
        <Save className="h-4 w-4" />
      </IconAction>
      <IconAction label="Проверить" onClick={onPreflight} reason={runDisabledReason}>
        <Play className="h-4 w-4" />
      </IconAction>
      {advancedDisabledReason || !canOpenAdvanced || !selectedAutomationId ? (
        <IconAction label="Advanced" reason={advancedDisabledReason ?? "Недоступно"}>
          <Zap className="h-4 w-4" />
        </IconAction>
      ) : (
        <Link
          href={`/app/projects/${projectId}/automations/${selectedAutomationId}/advanced-builder`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-white/6 hover:text-[color:var(--foreground)]"
          title="Advanced"
        >
          <Zap className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function CanvasEmptyState({ onAddBlock }: { readonly onAddBlock: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[28%] z-10 flex justify-center px-6">
      <div className="pointer-events-auto grid w-full max-w-[420px] justify-items-center gap-4 rounded-[28px] border border-[color:var(--line)] bg-[color:var(--panel)]/82 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 text-[color:var(--accent-strong)]">
          <Workflow className="h-5 w-5" />
        </div>
        <div className="grid gap-2">
          <div className="font-[family-name:var(--font-display)] text-2xl">Пустой canvas</div>
          <div className="text-sm leading-6 text-[color:var(--muted)]">
            Начните с собственного блока или выберите юридический модуль из палитры.
          </div>
        </div>
        <Button type="button" onClick={onAddBlock}>
          <Plus className="h-4 w-4" />
          Добавить блок
        </Button>
      </div>
    </div>
  );
}

function IconAction({
  children,
  label,
  onClick,
  reason,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
  readonly onClick?: () => void;
  readonly reason?: string | null;
}) {
  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-white/6 hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={Boolean(reason) || !onClick}
      onClick={onClick}
      title={reason ?? label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function BlockPalette({
  onClose,
  onSelect,
}: {
  readonly onClose: () => void;
  readonly onSelect: (item: BlockPaletteItem) => void;
}) {
  return (
    <div
      data-testid="automation-block-palette"
      className="absolute left-5 top-20 z-30 max-h-[calc(100vh-176px)] w-[340px] overflow-hidden rounded-[24px] border border-[color:var(--line)] bg-[color:var(--panel)]/96 p-3 shadow-2xl shadow-black/35 backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <div className="text-sm font-semibold">Добавить модуль</div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
          onClick={onClose}
          aria-label="Закрыть палитру"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid max-h-[calc(100vh-248px)] gap-2 overflow-y-auto overscroll-contain pb-3 pr-1">
        {legalBlockPalette.map((item) => (
          <button
            key={`${item.kind}_${item.label}`}
            type="button"
            className="rounded-[18px] border border-[color:var(--line)] bg-black/20 p-3 text-left transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent)]/10"
            onClick={() => onSelect(item)}
          >
            <div className="text-sm font-semibold">{item.label}</div>
            <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
              {item.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EdgeSettingsPopover({
  edge,
  onClose,
  onDelete,
  onUpdate,
}: {
  readonly edge: WorkflowCanvasEdge;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onUpdate: (edgeId: string, condition: string) => void;
}) {
  const [condition, setCondition] = React.useState(edge.condition ?? "success");

  return (
    <div className="absolute right-5 top-[92px] z-30 w-[320px] rounded-[22px] border border-[color:var(--line)] bg-[color:var(--panel)]/96 p-4 shadow-2xl shadow-black/35 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Условие связи
          </div>
          <div className="mt-1 text-sm text-[color:var(--muted-strong)]">
            {edge.sourceNodeId} {"->"} {edge.targetNodeId}
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
          onClick={onClose}
          aria-label="Закрыть настройки связи"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        <input
          className="min-h-10 rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 text-sm outline-none focus:border-[color:var(--accent)]"
          value={condition}
          onChange={(event) => setCondition(event.target.value)}
          onBlur={() => onUpdate(edge.id, condition)}
          placeholder="success / if_ready / else"
        />
        <button
          type="button"
          className="min-h-10 rounded-[16px] border border-[color:var(--danger)]/45 px-3 text-sm text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10"
          onClick={onDelete}
        >
          Удалить связь
        </button>
      </div>
    </div>
  );
}

function ModuleSettingsDrawer({
  canEdit,
  node,
  onClose,
  onDelete,
  onUpdate,
}: {
  readonly canEdit: boolean;
  readonly node: WorkflowCanvasNode;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onUpdate: (changes: Partial<Omit<WorkflowCanvasNode, "id">>) => void;
}) {
  return (
    <div className="absolute right-5 top-20 z-30 max-h-[calc(100vh-196px)] w-[410px] overflow-y-auto rounded-[24px] border border-[color:var(--line)] bg-[color:var(--panel)]/96 p-4 shadow-2xl shadow-black/35 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Настройки модуля
          </div>
          <div className="mt-1 truncate text-lg font-semibold">{node.title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="module-settings-delete"
            disabled={!canEdit}
            onClick={onDelete}
            aria-label="Удалить блок"
            title="Удалить блок"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-white/6 hover:text-[color:var(--foreground)]"
            data-testid="module-settings-close"
            onClick={onClose}
            aria-label="Закрыть настройки"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm">
          Название
          <input
            className="min-h-10 rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
            value={node.title}
            disabled={!canEdit}
            onChange={(event) => onUpdate({ title: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Описание
          <Textarea
            value={node.description}
            disabled={!canEdit}
            rows={3}
            onChange={(event) => onUpdate({ description: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Промпт
          <Textarea
            value={node.prompt}
            disabled={!canEdit}
            rows={5}
            onChange={(event) => onUpdate({ prompt: event.target.value })}
          />
        </label>
        <BindingsEditor
          key={`input-${node.id}`}
          disabled={!canEdit}
          label="Входы"
          value={node.inputBindings}
          onApply={(inputBindings) => onUpdate({ inputBindings })}
        />
        <BindingsEditor
          key={`output-${node.id}`}
          disabled={!canEdit}
          label="Выходы"
          value={node.outputBindings}
          onApply={(outputBindings) => onUpdate({ outputBindings })}
        />
        <BindingsEditor
          key={`connections-${node.id}`}
          disabled={!canEdit}
          label="Подключения"
          value={node.connectionBindings}
          onApply={(connectionBindings) => onUpdate({ connectionBindings })}
        />
        <label className="grid gap-2 text-sm">
          Runtime
          <input
            className="min-h-10 rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
            value={node.runtimeRequirement ?? ""}
            disabled={!canEdit}
            onChange={(event) =>
              onUpdate({
                runtimeRequirement: event.target.value.trim() || null,
              })
            }
            placeholder="@lexframe/module или connection"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 py-3 text-sm">
          Требует согласование
          <input
            type="checkbox"
            checked={node.requiresApproval}
            disabled={!canEdit}
            onChange={(event) =>
              onUpdate({
                requiresApproval: event.target.checked,
                policyState: event.target.checked ? "requires_approval" : node.policyState,
              })
            }
          />
        </label>
        <label className="grid gap-2 text-sm">
          Риск / policy
          <select
            className="min-h-10 rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 text-sm outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
            value={node.policyState}
            disabled={!canEdit}
            onChange={(event) =>
              onUpdate({
                policyState: event.target.value as WorkflowPolicyState,
              })
            }
          >
            <option value="ok">Без блокеров</option>
            <option value="requires_approval">Требует согласование</option>
            <option value="external_action">Внешнее действие</option>
            <option value="missing_connection">Нет подключения</option>
            <option value="blocked_by_policy">Policy block</option>
          </select>
        </label>
        <button
          type="button"
          className="flex min-h-10 items-center justify-center rounded-[16px] border border-[color:var(--danger)]/45 px-3 text-sm text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!canEdit}
          onClick={onDelete}
        >
          Удалить блок
        </button>
      </div>
    </div>
  );
}

function BindingsEditor({
  disabled,
  label,
  onApply,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onApply: (value: Record<string, string>) => void;
  readonly value: Record<string, string>;
}) {
  const [draft, setDraft] = React.useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = React.useState<string | null>(null);

  function apply() {
    try {
      const parsed = JSON.parse(draft) as unknown;

      if (!isStringRecord(parsed)) {
        setError("Ожидается JSON object со строковыми значениями.");
        return;
      }

      setError(null);
      onApply(parsed);
    } catch {
      setError("Некорректный JSON.");
    }
  }

  return (
    <label className="grid gap-2 text-sm">
      {label}
      <textarea
        className="min-h-[96px] resize-y rounded-[16px] border border-[color:var(--line)] bg-black/24 px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-[color:var(--accent)] disabled:opacity-60"
        value={draft}
        disabled={disabled}
        onBlur={apply}
        onChange={(event) => setDraft(event.target.value)}
      />
      {error ? <span className="text-xs text-[color:var(--danger)]">{error}</span> : null}
    </label>
  );
}

function AutomationChatComposer({
  attachments,
  automations,
  chatDraft,
  chatPrompt,
  documents,
  fileInputRef,
  menuOpen,
  onAddAttachment,
  onChatPromptChange,
  onChatSubmit,
  onFileSelected,
  onOpenBlockPalette,
  onRemoveAttachment,
  onToggleMenu,
  showChatDraft,
}: {
  readonly attachments: readonly AutomationComposerAttachment[];
  readonly automations: readonly InstalledAutomationDetail[];
  readonly chatDraft: string;
  readonly chatPrompt: string;
  readonly documents: readonly { readonly id: string; readonly title: string }[];
  readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
  readonly menuOpen: boolean;
  readonly onAddAttachment: (attachment: AutomationComposerAttachment) => void;
  readonly onChatPromptChange: (value: string) => void;
  readonly onChatSubmit: () => void;
  readonly onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onOpenBlockPalette: () => void;
  readonly onRemoveAttachment: (attachment: AutomationComposerAttachment) => void;
  readonly onToggleMenu: () => void;
  readonly showChatDraft: boolean;
}) {
  const firstAutomation = automations[0] ?? null;
  const firstDocument = documents[0] ?? null;
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [composerOverflow, setComposerOverflow] = React.useState(false);

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const maxHeight = 112;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(nextHeight, 44)}px`;
    setComposerOverflow(textarea.scrollHeight > maxHeight);
  }, [chatPrompt]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-[color:var(--line)] bg-[color:var(--panel)]/96 px-5 py-4 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="mx-auto grid max-w-[1180px] gap-2">
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <button
                key={`${attachment.type}_${attachment.id}`}
                type="button"
                className="flex max-w-[260px] items-center gap-2 rounded-full border border-[color:var(--line)] bg-black/20 px-3 py-1.5 text-xs text-[color:var(--muted-strong)]"
                onClick={() => onRemoveAttachment(attachment)}
                title="Убрать из контекста"
              >
                <span className="truncate">{attachment.title}</span>
                <X className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
          </div>
        ) : showChatDraft ? (
          <div className="truncate text-xs text-[color:var(--muted)]">{chatDraft}</div>
        ) : null}

        <div className="relative flex items-end gap-2 rounded-[24px] border border-[color:var(--line)] bg-black/24 p-2">
          <button
            type="button"
            data-testid="automation-context-menu-trigger"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            onClick={onToggleMenu}
            aria-label="Добавить контекст"
          >
            <Plus className="h-5 w-5" />
          </button>
          <Textarea
            ref={textareaRef}
            data-testid="automation-chat-input"
            value={chatPrompt}
            onChange={(event) => onChatPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onChatSubmit();
              }
            }}
            placeholder="Опишите automation: документы, проверки, промпты, согласование, результат"
            rows={1}
            className={cn(
              "min-h-11 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0",
              composerOverflow ? "overflow-y-auto" : "overflow-y-hidden",
            )}
          />
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-white/6 hover:text-[color:var(--foreground)]"
            aria-label="Голосовой ввод"
            title="Голосовой ввод"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-testid="automation-chat-submit"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-black transition hover:bg-[color:var(--accent-strong)]"
            onClick={onChatSubmit}
            aria-label="Отправить"
          >
            <Send className="h-5 w-5" />
          </button>

          {menuOpen ? (
            <div className="absolute bottom-[64px] left-2 z-30 w-[320px] rounded-[22px] border border-[color:var(--line)] bg-[color:var(--panel)]/98 p-2 shadow-2xl shadow-black/35 backdrop-blur">
              <ComposerMenuButton
                icon={<Plus className="h-4 w-4" />}
                label="Добавить блок на canvas"
                onClick={onOpenBlockPalette}
              />
              <ComposerMenuButton
                icon={<Workflow className="h-4 w-4" />}
                label="Добавить автоматизацию в контекст"
                onClick={() => {
                  if (firstAutomation) {
                    onAddAttachment({
                      id: firstAutomation.id,
                      required: true,
                      title: firstAutomation.title,
                      type: "automation",
                    });
                  }
                }}
                disabled={!firstAutomation}
              />
              <ComposerMenuButton
                icon={<Paperclip className="h-4 w-4" />}
                label="Прикрепить файл"
                onClick={() => fileInputRef.current?.click()}
              />
              <ComposerMenuButton
                icon={<FileText className="h-4 w-4" />}
                label="Выбрать источник проекта"
                onClick={() => {
                  onAddAttachment(
                    firstDocument
                      ? {
                          id: firstDocument.id,
                          required: true,
                          title: firstDocument.title,
                          type: "document",
                        }
                      : {
                          id: "project_sources",
                          required: true,
                          title: "Источники проекта",
                          type: "source",
                        },
                  );
                }}
              />
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                onChange={onFileSelected}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ComposerMenuButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-sm text-[color:var(--muted-strong)] transition hover:bg-white/6 hover:text-[color:var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CanvasNodeLabel({
  canEdit,
  node,
  onDeleteNode,
  onOpenSettings,
  selected,
}: {
  readonly canEdit: boolean;
  readonly node: WorkflowCanvasNode;
  readonly onDeleteNode: (nodeId: string) => void;
  readonly onOpenSettings: (nodeId: string) => void;
  readonly selected: boolean;
}) {
  return (
    <div className="grid gap-2 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {React.createElement(iconForNode(node), {
            className: "h-4 w-4 shrink-0 text-[color:var(--accent-strong)]",
          })}
          <div className="truncate text-sm font-semibold">{node.title}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selected && canEdit ? (
            <button
              type="button"
              className="nodrag flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--danger)]/45 bg-[color:var(--danger)]/8 text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/14"
              data-testid={`node-delete-${node.id}`}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteNode(node.id);
              }}
              aria-label={`Удалить блок ${node.title}`}
              title="Удалить блок"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className="nodrag flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/4 text-[color:var(--muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            data-testid={`node-settings-${node.id}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings(node.id);
            }}
            aria-label={`Настройки ${node.title}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">
        {node.description}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[color:var(--line)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {nodeKindLabel(node)}
        </span>
        {node.requiresApproval ? (
          <span className="rounded-full border border-[color:var(--accent)]/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--accent-strong)]">
            approval
          </span>
        ) : null}
        {selected ? <CircleDot className="h-4 w-4 text-[color:var(--accent-strong)]" /> : null}
      </div>
    </div>
  );
}

function buildFlowNodes({
  canEdit,
  draft,
  onDeleteNode,
  onOpenSettings,
  paletteEdgeId,
  selectedNodeId,
}: {
  readonly canEdit: boolean;
  readonly draft: WorkflowCanvasDraft;
  readonly onDeleteNode: (nodeId: string) => void;
  readonly onOpenSettings: (nodeId: string) => void;
  readonly paletteEdgeId: string | null;
  readonly selectedNodeId: string | null;
}): WorkbenchFlowNode[] {
  const canvasNodes: WorkbenchFlowNode[] = draft.nodes.map((node) => ({
    id: node.id,
    type: "default",
    position: node.position,
    data: {
      action: "select",
      canvasNodeId: node.id,
      label: (
        <CanvasNodeLabel
          canEdit={canEdit}
          node={node}
          onDeleteNode={onDeleteNode}
          onOpenSettings={onOpenSettings}
          selected={selectedNodeId === node.id}
        />
      ),
    },
    style: {
      width: 320,
      borderRadius: 22,
      border: borderForPolicy(node.policyState, selectedNodeId === node.id),
      background: "rgba(12, 17, 25, 0.96)",
      boxShadow: selectedNodeId === node.id ? "0 0 0 1px rgba(199, 164, 106, 0.35)" : "none",
      color: "var(--foreground)",
      padding: 14,
      transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
    },
  }));
  const addNodes: WorkbenchFlowNode[] = draft.edges.map((edge) => {
    const sourceNode = draft.nodes.find((node) => node.id === edge.sourceNodeId);
    const targetNode = draft.nodes.find((node) => node.id === edge.targetNodeId);
    const active = paletteEdgeId === edge.id;
    const x = sourceNode && targetNode ? (sourceNode.position.x + targetNode.position.x) / 2 + 136 : 656;
    const y = sourceNode && targetNode ? (sourceNode.position.y + targetNode.position.y) / 2 + 54 : 200;

    return {
      id: `add_${edge.id}`,
      type: "default",
      position: {
        x,
        y,
      },
      draggable: false,
      selectable: false,
      data: {
        action: "add",
        edgeId: edge.id,
        label: <Plus className="mx-auto h-4 w-4" />,
      },
      style: {
        width: 44,
        height: 44,
        borderRadius: 999,
        border: active
          ? "1px solid var(--accent)"
          : "1px solid rgba(199, 164, 106, 0.42)",
        background: active ? "rgba(199, 164, 106, 0.18)" : "rgba(18, 24, 34, 0.98)",
        color: "var(--accent-strong)",
        padding: 9,
      },
    };
  });

  return [...canvasNodes, ...addNodes];
}

function buildFlowEdges(
  draft: WorkflowCanvasDraft,
  selectedEdgeId: string | null,
): WorkbenchFlowEdge[] {
  return draft.edges.flatMap((edge) => {
    const addNodeId = `add_${edge.id}`;
    const selected = selectedEdgeId === edge.id;
    const style = {
      stroke: selected ? "rgba(199, 164, 106, 0.95)" : "rgba(199, 164, 106, 0.62)",
      strokeWidth: selected ? 3 : 2,
      transition: "stroke 160ms ease, stroke-width 160ms ease",
    };
    const data = {
      canvasEdgeId: edge.id,
    };

    return [
      {
        id: `${edge.id}_source`,
        source: edge.sourceNodeId,
        target: addNodeId,
        animated: true,
        data,
        style,
      },
      {
        id: `${edge.id}_target`,
        source: addNodeId,
        target: edge.targetNodeId,
        animated: true,
        data,
        label: edge.condition ?? "success",
        labelStyle: {
          fill: "var(--muted)",
          fontSize: 11,
        },
        style,
      },
    ];
  });
}

function getSaveDisabledReason({
  canEdit,
  dirty,
}: {
  readonly canEdit: boolean;
  readonly dirty: boolean;
}) {
  if (!canEdit) {
    return "Нужно право automation.edit.";
  }

  if (!dirty) {
    return "Нет несохраненных изменений.";
  }

  return null;
}

function getRunDisabledReason({
  canRun,
  missingConnections,
  nodeCount,
  status,
  validationIssues,
}: {
  readonly canRun: boolean;
  readonly missingConnections: readonly string[];
  readonly nodeCount: number;
  readonly status: Stage15UiStatus;
  readonly validationIssues: readonly CanvasValidationIssue[];
}) {
  if (!canRun) {
    return "Нужно право automation.run.";
  }

  if (nodeCount === 0) {
    return "Добавьте хотя бы один блок.";
  }

  if (validationIssues.some(isBlockingCanvasIssue) || status === "validation_failed") {
    return "Нельзя запускать при validation_failed.";
  }

  if (missingConnections.length > 0 || status === "missing_connection") {
    return "Нельзя запускать без подключений.";
  }

  if (
    status === "blocked_by_policy" ||
    status === "permission_required" ||
    status === "runtime_unavailable"
  ) {
    return `Нельзя запускать при статусе ${statusLabels[status]}.`;
  }

  return null;
}

function shouldShowAutomationComposerHint(storage: Storage | null, now = Date.now()) {
  if (!storage) {
    return true;
  }

  try {
    const rawFirstSeenAt = storage.getItem(AUTOMATION_COMPOSER_HINT_STORAGE_KEY);

    if (!rawFirstSeenAt) {
      storage.setItem(AUTOMATION_COMPOSER_HINT_STORAGE_KEY, String(now));
      return true;
    }

    const firstSeenAt = Number(rawFirstSeenAt);

    if (!Number.isFinite(firstSeenAt) || firstSeenAt <= 0 || firstSeenAt > now) {
      storage.setItem(AUTOMATION_COMPOSER_HINT_STORAGE_KEY, String(now));
      return true;
    }

    return now - firstSeenAt < AUTOMATION_COMPOSER_HINT_TTL_MS;
  } catch {
    return true;
  }
}

function hasPermission(
  permissions: readonly PermissionCode[],
  permission: PermissionCode,
) {
  return permissions.includes(permission);
}

function nodeKindLabel(node: WorkflowCanvasNode) {
  if (node.kind === "trigger") {
    return "триггер";
  }

  if (node.kind === "document") {
    return "документы";
  }

  if (node.kind === "legal_analysis") {
    return "анализ";
  }

  if (node.kind === "generation") {
    return "генерация";
  }

  if (node.kind === "approval") {
    return "согласование";
  }

  if (node.kind === "delivery") {
    return "доставка";
  }

  if (node.kind === "condition") {
    return "условие";
  }

  if (node.kind === "custom") {
    return "свой блок";
  }

  return "хранилище";
}

function iconForNode(node: WorkflowCanvasNode) {
  if (node.kind === "trigger") {
    return Zap;
  }

  if (node.kind === "document") {
    return FileText;
  }

  if (node.kind === "legal_analysis") {
    return GitBranch;
  }

  if (node.kind === "generation") {
    return Workflow;
  }

  if (node.kind === "approval") {
    return ShieldAlert;
  }

  if (node.kind === "delivery") {
    return Play;
  }

  if (node.kind === "custom") {
    return Bot;
  }

  return CheckCircle2;
}

function borderForPolicy(policyState: WorkflowPolicyState, selected: boolean) {
  if (selected) {
    return "1px solid var(--accent)";
  }

  if (policyState === "external_action" || policyState === "requires_approval") {
    return "1px solid rgba(199, 164, 106, 0.55)";
  }

  if (policyState === "missing_connection" || policyState === "blocked_by_policy") {
    return "1px solid rgba(240, 95, 95, 0.52)";
  }

  return "1px solid rgba(255, 255, 255, 0.12)";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "string");
}
