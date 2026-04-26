"use client";

import type { CanvasOperationResult } from "@lexframe/contracts";
import * as React from "react";
import { QueryState } from "@/components/stage3-shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useCanvasDraft,
  useCanvasApplyValidationFix,
  useCanvasAiConfigureStep,
  useCanvasAiValidationFix,
  useCanvasCompilePreview,
  useCanvasIssueExplanation,
  useCanvasLock,
  useCanvasModuleCatalog,
  useCanvasOperations,
  useCanvasPresentation,
  useCanvasSecurityContext,
  useCanvasVersionState,
  useCanvasVersions,
  useValidateCanvas,
} from "../hooks/use-canvas-data";
import { CanvasCommandPalette } from "../components/canvas-command-palette";
import {
  CanvasChatDrawerContent,
  PublishModal,
  CanvasSideDrawer,
  RunPreviewDrawerContent,
  VersionHistoryDrawerContent,
} from "../components/canvas-drawers";
import { CanvasHeader, type CanvasSaveStatus } from "../components/canvas-header";
import { CanvasTestPanel } from "../components/canvas-test-panel";
import { ModulePalette } from "../components/module-palette";
import { RuntimeSyncPanel } from "../components/runtime-sync-panel";
import { StepInspector } from "../components/step-inspector";
import { ValidationRail } from "../components/validation-rail";
import {
  type AddModuleFromCanvasInput,
  WorkflowCanvas,
} from "../components/workflow-canvas";
import { useCanvasUiStore } from "../store";

export function WorkflowCanvasPage({
  projectId,
  automationId,
}: {
  readonly projectId: string;
  readonly automationId: string;
}) {
  const draft = useCanvasDraft(automationId);
  const presentation = useCanvasPresentation({
    automationId,
    mode: "basic",
    locale: "ru-RU",
  });
  const moduleCatalog = useCanvasModuleCatalog({
    automationId,
    mode: "palette",
  });
  const versions = useCanvasVersions(automationId);
  const versionState = useCanvasVersionState(automationId);
  const securityContext = useCanvasSecurityContext(automationId);
  const operations = useCanvasOperations(automationId);
  const validate = useValidateCanvas(automationId);
  const explainIssue = useCanvasIssueExplanation(automationId);
  const applyValidationFix = useCanvasApplyValidationFix(automationId);
  const fixValidationWithAi = useCanvasAiValidationFix(automationId);
  const configureStepWithAi = useCanvasAiConfigureStep(automationId);
  const compilePreview = useCanvasCompilePreview(automationId);
  const lock = useCanvasLock(automationId, draft.data?.draft_id);
  const selectedNodeId = useCanvasUiStore((state) => state.selectedNodeId);
  const setSelectedNode = useCanvasUiStore((state) => state.setSelectedNode);
  const paletteOpen = useCanvasUiStore((state) => state.paletteOpen);
  const setPaletteOpen = useCanvasUiStore((state) => state.setPaletteOpen);
  const inspectorExpanded = useCanvasUiStore((state) => state.inspectorExpanded);
  const chatDrawerOpen = useCanvasUiStore((state) => state.chatDrawerOpen);
  const setChatDrawerOpen = useCanvasUiStore((state) => state.setChatDrawerOpen);
  const runPreviewDrawerOpen = useCanvasUiStore(
    (state) => state.runPreviewDrawerOpen,
  );
  const setRunPreviewDrawerOpen = useCanvasUiStore(
    (state) => state.setRunPreviewDrawerOpen,
  );
  const versionHistoryDrawerOpen = useCanvasUiStore(
    (state) => state.versionHistoryDrawerOpen,
  );
  const setVersionHistoryDrawerOpen = useCanvasUiStore(
    (state) => state.setVersionHistoryDrawerOpen,
  );
  const commandPaletteOpen = useCanvasUiStore(
    (state) => state.commandPaletteOpen,
  );
  const setCommandPaletteOpen = useCanvasUiStore(
    (state) => state.setCommandPaletteOpen,
  );
  const selectedAddResultRef = React.useRef<string | null>(null);
  const [publishOpen, setPublishOpen] = React.useState(false);

  React.useEffect(() => {
    const results = operations.data?.operation_results ?? [];
    for (let index = results.length - 1; index >= 0; index -= 1) {
      const result = results[index];
      if (!result) {
        continue;
      }
      if (
        result.operation_type === "ADD_NODE_FROM_MODULE" &&
        result.added_node_id
      ) {
        const key = `${operations.data?.revision_counter ?? "0"}:${result.added_node_id}`;
        if (selectedAddResultRef.current !== key) {
          selectedAddResultRef.current = key;
          setSelectedNode(result.added_node_id);
        }
        break;
      }
    }
  }, [operations.data, setSelectedNode]);

  React.useEffect(() => {
    if (draft.data?.lock.status !== "locked_by_me") {
      return;
    }
    const interval = window.setInterval(() => {
      lock.heartbeat.mutate();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [draft.data?.lock.status, lock.heartbeat]);

  if (draft.isError) {
    return (
      <QueryState
        title="Canvas недоступен"
        description={
          draft.error instanceof Error
            ? draft.error.message
            : "Backend не вернул Canvas draft."
        }
      />
    );
  }

  if (draft.isLoading || !draft.data) {
    return (
      <QueryState
        title="Загрузка Canvas"
        description="Получаем canonical Workflow DSL v2, permissions, lock и validation state."
      />
    );
  }

  const canvasDraft = draft.data;
  const workflow = canvasDraft.workflow;
  const permissions =
    securityContext.data?.capabilities ?? canvasDraft.permissions;
  const selectedNode =
    workflow.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const readOnly =
    !permissions.can_edit ||
    canvasDraft.lock.status !== "locked_by_me";
  const pending =
    operations.isPending ||
    validate.isPending ||
    applyValidationFix.isPending ||
    fixValidationWithAi.isPending ||
    configureStepWithAi.isPending ||
    compilePreview.isPending ||
    lock.acquire.isPending ||
    lock.heartbeat.isPending ||
    lock.release.isPending;
  const saveStatus = resolveSaveStatus({
    pending: operations.isPending,
    failed: operations.isError,
    rejectedReason: operations.data?.accepted === false
      ? operations.data.rejected_reason ?? "rejected"
      : null,
  });
  const catalog = moduleCatalog.data ?? null;
  const modules = catalog?.modules ?? [];
  const latestAddResult = resolveLatestAddResult(
    operations.data?.operation_results ?? [],
  );
  const latestAddNotice = buildLatestAddNotice(latestAddResult);

  function applyOperations(input: Parameters<typeof operations.mutate>[0]) {
    operations.mutate({
      ...input,
      draft_id: input.draft_id ?? canvasDraft.draft_id,
      expected_revision: input.expected_revision ?? canvasDraft.revision,
      base_hash: input.base_hash ?? canvasDraft.draft_hash,
      operations: input.operations,
    });
  }

  function addModuleFromCatalog(input: AddModuleFromCanvasInput) {
    if (readOnly) {
      return;
    }
    applyOperations({
      operations: [
        {
          client_operation_id: `add_module_${input.source}_${Date.now()}`,
          operation_type: "ADD_NODE_FROM_MODULE",
          operation_payload: {
            module_code: input.module.module_code,
            module_version: input.module.module_version ?? undefined,
            insert: input.insert,
            initial_config: {},
            auto_bind_inputs: true,
            create_default_error_policy: true,
            source: input.source,
          },
        },
      ],
    });
  }

  function autoLayout() {
    applyOperations({
      operations: [
        {
          client_operation_id: `auto_layout_${Date.now()}`,
          operation_type: "UPDATE_LAYOUT",
          operation_payload: { auto_arrange: true },
          base_workflow_hash: canvasDraft.workflow_hash,
          base_revision_counter: canvasDraft.revision_counter,
        },
      ],
    });
  }

  return (
    <div
      role="region"
      aria-label="Рабочая область Canvas"
      className="flex min-h-[calc(100vh-64px)] flex-col overflow-hidden rounded-[8px] border border-[color:var(--line)] bg-[#0b0f15]"
    >
      <CanvasHeader
        projectId={projectId}
        automationId={automationId}
        workflow={workflow}
        workflowHash={canvasDraft.workflow_hash}
        versionState={versionState.data ?? null}
        validation={canvasDraft.validation}
        permissions={permissions}
        lock={canvasDraft.lock}
        pending={pending}
        saveStatus={saveStatus}
        onValidate={() => validate.mutate({ mode: "full", reason: "manual_validate" })}
        onCompilePreview={() => compilePreview.mutate()}
        onAutoArrange={autoLayout}
        onAcquireLock={() => lock.acquire.mutate({})}
        onReleaseLock={() => lock.release.mutate()}
        onTogglePalette={() => setPaletteOpen(!paletteOpen)}
        onOpenChat={() => setChatDrawerOpen(true)}
        onOpenRunPreview={() => setRunPreviewDrawerOpen(true)}
        onOpenVersions={() => setVersionHistoryDrawerOpen(true)}
        onOpenPublish={() => setPublishOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      <RuntimeSyncPanel
        automationId={automationId}
        security={securityContext.data ?? null}
      />
      <CanvasTestPanel
        automationId={automationId}
        workflow={workflow}
        permissions={permissions}
        selectedNodeId={selectedNode?.id ?? null}
      />

      {operations.data?.accepted === false ? (
        <StatusBanner
          tone="danger"
          title="Операция Canvas отклонена"
          message={operations.data.rejected_reason ?? "Backend не принял изменение."}
        />
      ) : null}
      {operations.isError ? (
        <StatusBanner
          tone="danger"
          title="Не удалось сохранить изменение"
          message={
            operations.error instanceof Error
              ? operations.error.message
              : "Проверьте соединение и повторите операцию."
          }
        />
      ) : null}
      {canvasDraft.lock.status === "locked_by_other" ? (
        <StatusBanner
          tone="muted"
          title="Черновик заблокирован"
          message={`Редактирует: ${canvasDraft.lock.locked_by_user_email ?? "другой пользователь"}.`}
        />
      ) : null}
      {latestAddNotice ? (
        <StatusBanner
          tone="muted"
          title={latestAddNotice.title}
          message={latestAddNotice.message}
        />
      ) : null}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          paletteOpen
            ? inspectorExpanded
              ? "lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_760px]"
              : "lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_460px]"
            : inspectorExpanded
              ? "lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_760px]"
              : "lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_460px]",
        )}
      >
        {paletteOpen ? (
          <div className="hidden min-h-0 lg:block">
            {catalog ? (
              <ModulePalette
                catalog={catalog}
                readOnly={readOnly}
                onAdd={(module, source) =>
                  addModuleFromCatalog({
                    module,
                    source,
                    insert: { position: "workflow_end" },
                  })
                }
              />
            ) : (
              <QueryState
                title="Загрузка палитры"
                description="Получаем backend catalog модулей Canvas."
              />
            )}
          </div>
        ) : null}
        <main className="min-w-0">
          <WorkflowCanvas
            workflow={workflow}
            permissions={canvasDraft.permissions}
            workflowHash={canvasDraft.workflow_hash}
            lockReadOnly={canvasDraft.lock.status === "locked_by_other"}
        modules={modules}
        operationResults={operations.data?.operation_results ?? []}
        noCodeNodes={presentation.data?.nodes}
        onAddModule={addModuleFromCatalog}
        onOperations={applyOperations}
      />
        </main>
        <div className="hidden min-h-0 xl:block">
          <StepInspector
            automationId={automationId}
            workflow={workflow}
            selectedNode={selectedNode}
            permissions={canvasDraft.permissions}
            workflowHash={canvasDraft.workflow_hash}
            readOnly={readOnly}
            onOperations={applyOperations}
            onConfigureWithAi={(nodeId) => {
              setChatDrawerOpen(true);
              configureStepWithAi.mutate({
                selected_node_id: nodeId,
                base_workflow_hash: canvasDraft.workflow_hash,
                message: "Configure the selected Canvas step.",
              });
            }}
          />
        </div>
      </div>

      <ValidationRail
        validation={canvasDraft.validation}
        onExplainIssue={(issueId) => explainIssue.mutateAsync(issueId)}
        onApplySuggestedFix={(issueId, suggestedFixId, confirmed) =>
          applyValidationFix.mutateAsync({
            issueId,
            request: {
              suggested_fix_id: suggestedFixId,
              confirmed_by_user: confirmed,
            },
          }).then(() => undefined)
        }
        onFixIssueWithAi={(issueId) => {
          setChatDrawerOpen(true);
          return fixValidationWithAi
            .mutateAsync({
              selected_validation_issue_id: issueId,
              base_workflow_hash: canvasDraft.workflow_hash,
              message: "Propose an AI fix for this validation issue.",
            })
            .then(() => undefined);
        }}
      />

      {selectedNode ? (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-[color:var(--line)] bg-[#0d1118] shadow-[0_18px_60px_rgba(0,0,0,0.42)] xl:hidden">
          <StepInspector
            automationId={automationId}
            workflow={workflow}
            selectedNode={selectedNode}
            permissions={canvasDraft.permissions}
            workflowHash={canvasDraft.workflow_hash}
            readOnly={readOnly}
            onOperations={applyOperations}
            onConfigureWithAi={(nodeId) => {
              setChatDrawerOpen(true);
              configureStepWithAi.mutate({
                selected_node_id: nodeId,
                base_workflow_hash: canvasDraft.workflow_hash,
                message: "Configure the selected Canvas step.",
              });
            }}
          />
        </div>
      ) : null}

      <CanvasSideDrawer
        title="Canvas Assistant"
        badge="Shell"
        open={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
      >
        <CanvasChatDrawerContent
          automationId={automationId}
          workflowHash={canvasDraft.workflow_hash}
          selectedNodeId={selectedNode?.id ?? null}
          readOnly={readOnly}
          lockStatus={canvasDraft.lock.status}
          permissions={canvasDraft.permissions}
        />
      </CanvasSideDrawer>
      <CanvasSideDrawer
        title="Run preview"
        badge="Dry-run foundation"
        open={runPreviewDrawerOpen}
        onClose={() => setRunPreviewDrawerOpen(false)}
      >
        <RunPreviewDrawerContent workflow={workflow} />
      </CanvasSideDrawer>
      <CanvasSideDrawer
        title="Version history"
        badge="Read-only"
        open={versionHistoryDrawerOpen}
        onClose={() => setVersionHistoryDrawerOpen(false)}
      >
        <VersionHistoryDrawerContent
          automationId={automationId}
          versions={versions.data}
          versionState={versionState.data ?? null}
          isLoading={versions.isLoading}
        />
      </CanvasSideDrawer>
      <PublishModal
        automationId={automationId}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        draftHash={canvasDraft.workflow_hash}
        revision={canvasDraft.revision}
        permissions={canvasDraft.permissions}
      />
      <CanvasCommandPalette
        open={commandPaletteOpen}
        modules={modules}
        readOnly={readOnly}
        onClose={() => setCommandPaletteOpen(false)}
        onAddModule={(module) =>
          addModuleFromCatalog({
            module,
            source: "quick_add",
            insert: { position: "workflow_end" },
          })
        }
        onValidate={() => validate.mutate({ mode: "full", reason: "manual_validate" })}
        onAutoLayout={autoLayout}
      />
    </div>
  );
}

function resolveLatestAddResult(
  results: readonly CanvasOperationResult[],
): CanvasOperationResult | null {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (!result) {
      continue;
    }
    if (result.operation_type === "ADD_NODE_FROM_MODULE") {
      return result;
    }
  }
  return null;
}

function buildLatestAddNotice(
  result: ReturnType<typeof resolveLatestAddResult>,
) {
  if (!result) {
    return null;
  }
  const warnings = result.warnings ?? [];
  const missing = result.missing_requirements ?? [];
  if (warnings.length === 0 && missing.length === 0) {
    return null;
  }
  const warningText = warnings.length > 0 ? warnings.join("; ") : null;
  const missingText =
    missing.length > 0
      ? `Нужно настроить: ${missing.map((item) => item.label).join(", ")}.`
      : null;
  return {
    title: missing.length > 0 ? "Модуль добавлен как draft" : "Модуль добавлен с предупреждениями",
    message: [missingText, warningText].filter(Boolean).join(" "),
  };
}

function StatusBanner({
  title,
  message,
  tone,
}: {
  readonly title: string;
  readonly message: string;
  readonly tone: "danger" | "muted";
}) {
  return (
    <div className="border-b border-[color:var(--line)] bg-[#111722] px-5 py-3">
      <Badge variant={tone}>{title}</Badge>
      <span className="ml-3 text-sm text-[color:var(--muted)]">{message}</span>
    </div>
  );
}

function resolveSaveStatus(input: {
  readonly pending: boolean;
  readonly failed: boolean;
  readonly rejectedReason: string | null;
}): CanvasSaveStatus {
  if (input.pending) {
    return "saving";
  }
  if (
    input.rejectedReason === "WORKFLOW_HASH_MISMATCH" ||
    input.rejectedReason === "RUNTIME_CONFLICT"
  ) {
    return "conflict";
  }
  if (input.failed || input.rejectedReason) {
    return "failed";
  }
  return "saved";
}
