"use client";

import type {
  CanvasDataSourceCandidate,
  CanvasOperationRequest,
  CanvasPermissions,
  CanvasSourcesResponse,
  LexFrameWorkflowV2,
  StepErrorPolicy,
  StepInputBinding,
  StepInputViewModel,
  StepInspectorDto,
  StepInspectorPermissionsDto,
  StepInspectorTab,
  StepSettingsFieldDto,
  WorkflowDataField,
  WorkflowNode,
} from "@lexframe/contracts";
import type { ReactNode } from "react";
import * as React from "react";
import {
  AlertTriangle,
  Database,
  Expand,
  Link2,
  Loader2,
  Play,
  Save,
  Shield,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClientOperationId } from "../lib/canvas-projection";
import {
  bindingStatusFromState,
  buildStepInspectorTabs,
  resolveInputStatus,
  sourceCandidateKey,
} from "../lib/step-inspector-model";
import { useCanvasUiStore } from "../store";
import { useStepInspector, useStepTest } from "../hooks/use-canvas-data";

type OperationDispatcher = (input: CanvasOperationRequest) => void;

const tabLabels: Record<StepInspectorTab, string> = {
  overview: "Обзор",
  inputs: "Что нужно шагу",
  settings: "Настройки",
  data: "Данные",
  connections: "Подключения",
  test: "Проверка",
  errors: "Ошибки",
  outputs: "Что создаёт",
  policies: "Риски",
  history: "История",
  debug: "Advanced",
};

export function StepInspector({
  automationId,
  workflow,
  selectedNode,
  permissions,
  workflowHash,
  readOnly,
  onOperations,
  onConfigureWithAi,
}: {
  readonly automationId: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly selectedNode: WorkflowNode | null;
  readonly permissions: CanvasPermissions;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
  readonly onConfigureWithAi?: (nodeId: string) => void;
}) {
  const inspectorTab = useCanvasUiStore((state) => state.inspectorTab);
  const setInspectorTab = useCanvasUiStore((state) => state.setInspectorTab);
  const inspectorExpanded = useCanvasUiStore((state) => state.inspectorExpanded);
  const setInspectorExpanded = useCanvasUiStore(
    (state) => state.setInspectorExpanded,
  );
  const inspector = useStepInspector({
    automationId,
    nodeId: selectedNode?.id ?? null,
  });
  const inspectorDto = inspector.data ?? null;
  const fallbackPermissions = permissionsFromCanvas(permissions, readOnly);
  const stepPermissions = inspectorDto?.permissions ?? fallbackPermissions;
  const tabs =
    inspectorDto?.tabs ??
    buildStepInspectorTabs({
      nodeType: selectedNode?.type ?? null,
      permissions: stepPermissions,
    });
  const activeTab = tabs.includes(inspectorTab as StepInspectorTab)
    ? (inspectorTab as StepInspectorTab)
    : tabs[0] ?? "overview";

  React.useEffect(() => {
    if (!tabs.includes(inspectorTab as StepInspectorTab)) {
      setInspectorTab(tabs[0] ?? "overview");
    }
  }, [inspectorTab, setInspectorTab, tabs]);

  if (!selectedNode) {
    return (
      <aside className="flex min-h-0 flex-col border-l border-[color:var(--line)] bg-[#0d1118]/90">
        <EmptyState
          title="Шаг не выбран"
          text="Выберите шаг сценария, чтобы настроить данные, проверку и риски."
        />
      </aside>
    );
  }

  return (
    <aside
      className={
        "flex min-h-0 flex-col border-l border-[color:var(--line)] bg-[#0d1118]/90 " +
        (inspectorExpanded ? "xl:min-w-[720px]" : "xl:min-w-[420px]")
      }
    >
      <InspectorHeader
        workflow={workflow}
        node={selectedNode}
        inspector={inspectorDto}
        permissions={stepPermissions}
        readOnly={readOnly}
        expanded={inspectorExpanded}
        onToggleExpanded={() => setInspectorExpanded(!inspectorExpanded)}
        onOperations={onOperations}
        workflowHash={workflowHash}
        onConfigureWithAi={onConfigureWithAi}
      />

      <StepStatusStrip
        inspector={inspectorDto}
        node={selectedNode}
        isLoading={inspector.isLoading}
      />

      <div className="flex flex-wrap gap-2 border-b border-[color:var(--line)] p-3">
        {tabs.map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={activeTab === tab ? "default" : "ghost"}
            onClick={() => setInspectorTab(tab)}
          >
            {tabLabels[tab]}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {inspector.isLoading && !inspectorDto ? (
          <LoadingPanel />
        ) : inspector.isError ? (
          <EmptyState
            title="Настройки шага недоступны"
            text={
              inspector.error instanceof Error
                ? inspector.error.message
                : "Backend не вернул данные настройки шага."
            }
          />
        ) : (
          <InspectorBody
            automationId={automationId}
            workflow={workflow}
            node={selectedNode}
            inspector={inspectorDto}
            tab={activeTab}
            permissions={stepPermissions}
            workflowHash={workflowHash}
            readOnly={readOnly || !stepPermissions.can_edit_config}
            onOperations={onOperations}
          />
        )}
      </div>

      <InspectorFooter
        node={selectedNode}
        permissions={stepPermissions}
        readOnly={readOnly}
        workflowHash={workflowHash}
        onOperations={onOperations}
        onOpenTab={setInspectorTab}
      />
    </aside>
  );
}

function InspectorHeader({
  workflow,
  node,
  inspector,
  permissions,
  readOnly,
  expanded,
  onToggleExpanded,
  onOperations,
  workflowHash,
  onConfigureWithAi,
}: {
  readonly workflow: LexFrameWorkflowV2;
  readonly node: WorkflowNode;
  readonly inspector: StepInspectorDto | null;
  readonly permissions: StepInspectorPermissionsDto;
  readonly readOnly: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly onOperations: OperationDispatcher;
  readonly workflowHash: string;
  readonly onConfigureWithAi?: (nodeId: string) => void;
}) {
  const issues = workflow.validation.issues.filter(
    (issue) => issue.affected_node_id === node.id,
  );
  const danger = issues.some(
    (issue) => issue.severity === "error" || issue.severity === "policy_block",
  );
  return (
    <div className="border-b border-[color:var(--line)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="muted">Настройки шага</Badge>
          <h2 className="mt-3 truncate text-sm font-semibold">
            {inspector?.overview.title ?? node.display_name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {inspector?.overview.category_label ? (
              <Badge variant="muted">{inspector.overview.category_label}</Badge>
            ) : null}
            {inspector?.overview.risk_level ? (
              <Badge
                variant={
                  inspector.overview.risk_level === "critical" ? "danger" : "muted"
                }
              >
                {riskText(inspector.overview.risk_level)}
              </Badge>
            ) : null}
            {inspector?.overview.approval_required ? (
              <Badge variant="accent">Нужно согласование</Badge>
            ) : null}
            {danger ? <Badge variant="danger">Нужно исправить</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {onConfigureWithAi ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={readOnly}
              onClick={() => onConfigureWithAi(node.id)}
              title="Настроить с AI"
            >
              <Wand2 aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleExpanded}
            title={expanded ? "Свернуть настройки" : "Развернуть настройки"}
          >
            <Expand aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={readOnly || !permissions.can_delete_step}
            onClick={() =>
              onOperations({
                operations: [
                  {
                    client_operation_id: createClientOperationId("delete_node"),
                    operation_type: "DELETE_NODE",
                    operation_payload: { node_id: node.id },
                    base_workflow_hash: workflowHash,
                  },
                ],
              })
            }
            title="Удалить шаг"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      {inspector?.overview.description ? (
        <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
          {inspector.overview.description}
        </p>
      ) : null}
    </div>
  );
}

function StepStatusStrip({
  inspector,
  node,
  isLoading,
}: {
  readonly inspector: StepInspectorDto | null;
  readonly node: WorkflowNode;
  readonly isLoading: boolean;
}) {
  const validation = inspector?.validation;
  const testState = inspector?.test_state;
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-[color:var(--line)] p-3 text-xs">
      <StatusChip label="Проверка" value={statusText(validation?.status ?? "loading")} />
      <StatusChip
        label="Пример результата"
        value={statusText(
          isLoading
            ? "loading"
            : testState?.sample_data_status ?? node.test_state?.sample_data_status ?? "missing",
        )}
      />
      <StatusChip
        label="Замечания"
        value={String(inspector?.validation.issues.length ?? 0)}
      />
    </div>
  );
}

function InspectorBody({
  automationId,
  workflow,
  node,
  inspector,
  tab,
  permissions,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly automationId: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly node: WorkflowNode;
  readonly inspector: StepInspectorDto | null;
  readonly tab: StepInspectorTab;
  readonly permissions: StepInspectorPermissionsDto;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  const issues = inspector
    ? inspector.validation.issues.filter((issue) => issue.affected_node_id === node.id)
    : workflow.validation.issues.filter((issue) => issue.affected_node_id === node.id);

  if (!inspector) {
    return <FallbackOverview node={node} issues={issues} />;
  }

  if (tab === "overview") {
    return <OverviewTab inspector={inspector} />;
  }
  if (tab === "inputs") {
    return (
      <StepInputsTab
        inspector={inspector}
        workflowHash={workflowHash}
        readOnly={readOnly || !permissions.can_edit_bindings}
        onOperations={onOperations}
      />
    );
  }
  if (tab === "settings") {
    return (
      <StepSettingsFormRenderer
        key={`${inspector.settings_form.node_id}:${inspector.settings_form.schema_version}:${JSON.stringify(
          inspector.settings_form.values,
        )}`}
        form={inspector.settings_form}
        node={node}
        workflowHash={workflowHash}
        readOnly={readOnly || !permissions.can_edit_config}
        onOperations={onOperations}
      />
    );
  }
  if (tab === "data") {
    return (
      <StepDataTab
        inspector={inspector}
        workflowHash={workflowHash}
        readOnly={readOnly || !permissions.can_edit_bindings}
        onOperations={onOperations}
      />
    );
  }
  if (tab === "connections") {
    return <ConnectionsTab inspector={inspector} />;
  }
  if (tab === "test") {
    return (
      <TestingTab
        automationId={automationId}
        inspector={inspector}
        readOnly={!permissions.can_test_step}
      />
    );
  }
  if (tab === "errors") {
    return (
      <ErrorsTab
        key={`${node.id}:${inspector.error_policy.mode}:${inspector.error_policy.retry_count ?? ""}`}
        policy={inspector.error_policy}
        node={node}
        issues={issues}
        workflowHash={workflowHash}
        readOnly={readOnly || !permissions.can_edit_error_policy}
        onOperations={onOperations}
      />
    );
  }
  if (tab === "outputs") {
    return <OutputsTab workflow={workflow} inspector={inspector} />;
  }
  if (tab === "policies") {
    return <PoliciesTab inspector={inspector} />;
  }
  if (tab === "history") {
    return <HistoryTab inspector={inspector} />;
  }
  if (tab === "debug" && permissions.can_view_raw_data) {
    return <RawDebugPanel value={inspector} />;
  }

  return <OverviewTab inspector={inspector} />;
}

function OverviewTab({ inspector }: { readonly inspector: StepInspectorDto }) {
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Обзор шага" />
      <KeyValue
        label="Тип"
        value={inspector.overview.category_label ?? inspector.node.type}
      />
      <KeyValue
        label="Что нужно шагу"
        value={inspector.overview.needs.length ? inspector.overview.needs.join(", ") : "Не требуется"}
      />
      <KeyValue
        label="Что создаёт"
        value={inspector.overview.creates.length ? inspector.overview.creates.join(", ") : "Нет результата"}
      />
      <KeyValue
        label="Согласование"
        value={booleanText(inspector.overview.approval_required)}
      />
      <div className="flex flex-wrap gap-2">
        {inspector.overview.badges.map((badge) => (
          <Badge key={badge} variant="muted">
            {badge}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function StepInputsTab({
  inspector,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly inspector: StepInspectorDto;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  if (inspector.inputs.length === 0) {
    return (
      <EmptyState
        title="Данные не требуются"
        text="Этот шаг может работать без дополнительных входных данных."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Что нужно шагу" />
      {inspector.inputs.map((input) => (
        <InputBindingCard
          key={input.input.key}
          nodeId={inspector.node.id}
          inputModel={input}
          sources={inspector.data_sources.by_input_key[input.input.key]}
          workflowHash={workflowHash}
          readOnly={readOnly}
          onOperations={onOperations}
        />
      ))}
    </div>
  );
}

function StepDataTab({
  inspector,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly inspector: StepInspectorDto;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  const [query, setQuery] = React.useState("");
  const lowerQuery = query.trim().toLocaleLowerCase("en-US");
  const inputs = lowerQuery
    ? inspector.inputs.filter((item) =>
        `${item.input.label} ${item.input.key}`
          .toLocaleLowerCase("en-US")
          .includes(lowerQuery),
      )
    : inspector.inputs;

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Выберите данные" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти поле шага"
        className="rounded-[8px]"
      />
      {inputs.length === 0 ? (
        <EmptyState title="Ничего не найдено" text="Очистите поиск, чтобы увидеть все поля." />
      ) : (
        inputs.map((input) => (
          <InputBindingCard
            key={input.input.key}
            nodeId={inspector.node.id}
            inputModel={input}
            sources={inspector.data_sources.by_input_key[input.input.key]}
            workflowHash={workflowHash}
            readOnly={readOnly}
            onOperations={onOperations}
          />
        ))
      )}
    </div>
  );
}

function InputBindingCard({
  nodeId,
  inputModel,
  sources,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly nodeId: string;
  readonly inputModel: StepInputViewModel;
  readonly sources: CanvasSourcesResponse | undefined;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  const input = inputModel.input;
  const binding = inputModel.binding ?? null;
  const status =
    inputModel.status ??
    resolveInputStatus({
      field: input,
      binding,
      issues: inputModel.issues,
    });

  function upsertBinding(
    candidate: CanvasDataSourceCandidate,
    transform?: string | null,
  ) {
    const bindingPayload: StepInputBinding = {
      target: {
        node_id: nodeId,
        input_key: input.key,
      },
      targetNodeId: nodeId,
      targetInputKey: input.key,
      source: candidate.source,
      transform: transform
        ? ({ type: transform } as StepInputBinding["transform"])
        : undefined,
      validation_state:
        candidate.compatibility === "valid"
          ? "valid"
          : candidate.compatibility === "warning"
            ? "warning"
            : "invalid",
      created_by: "user",
      created_at: new Date().toISOString(),
    };
    onOperations({
      operations: [
        {
          client_operation_id: createClientOperationId("upsert_binding"),
          operation_type: "UPSERT_INPUT_BINDING",
          operation_payload: { binding: bindingPayload },
          base_workflow_hash: workflowHash,
        },
      ],
    });
  }

  function deleteBinding() {
    onOperations({
      operations: [
        {
          client_operation_id: createClientOperationId("delete_binding"),
          operation_type: "DELETE_INPUT_BINDING",
          operation_payload: {
            node_id: nodeId,
            input_key: input.key,
            binding_id: binding?.id,
          },
          base_workflow_hash: workflowHash,
        },
      ],
    });
  }

  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{input.label}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {fieldType(input)}
            {input.required ? " / обязательно" : ""}
          </div>
        </div>
        <BindingStatusBadge status={bindingStatusFromState(status, binding)} />
      </div>
      <div className="mt-3">
        {binding ? (
          <BindingChip binding={binding} onDelete={readOnly ? undefined : deleteBinding} />
        ) : (
          <div className="text-xs text-[color:var(--muted)]">
            Источник данных не выбран.
          </div>
        )}
      </div>
      {inputModel.issues.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {inputModel.issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : null}
      <DataPicker
        sources={sources}
        readOnly={readOnly}
        onPick={upsertBinding}
      />
    </div>
  );
}

function DataPicker({
  sources,
  readOnly,
  onPick,
}: {
  readonly sources: CanvasSourcesResponse | undefined;
  readonly readOnly: boolean;
  readonly onPick: (
    candidate: CanvasDataSourceCandidate,
    transform?: string | null,
  ) => void;
}) {
  const compatible = sources?.compatible_sources ?? [];
  const incompatible = sources?.incompatible_sources ?? [];

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--muted-strong)]">
        <Database className="size-3" aria-hidden />
        Источники данных
      </div>
      <DataSourceList
        candidates={compatible}
        readOnly={readOnly}
        onPick={onPick}
      />
      {incompatible.length > 0 ? (
        <details className="rounded-[8px] border border-[color:var(--line)] bg-black/15 p-2 text-xs">
          <summary className="cursor-pointer text-[color:var(--muted)]">
            Источники, которые сейчас не подходят
          </summary>
          <div className="mt-2">
            <DataSourceList
              candidates={incompatible}
              readOnly={readOnly}
              onPick={onPick}
              incompatible
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function DataSourceList({
  candidates,
  readOnly,
  incompatible,
  onPick,
}: {
  readonly candidates: readonly CanvasDataSourceCandidate[];
  readonly readOnly: boolean;
  readonly incompatible?: boolean;
  readonly onPick: (
    candidate: CanvasDataSourceCandidate,
    transform?: string | null,
  ) => void;
}) {
  if (candidates.length === 0) {
    return <EmptyPanel text="Нет доступных источников." compact />;
  }

  return (
    <div className="flex flex-col gap-2">
      {candidates.map((candidate) => (
        <div
          key={sourceCandidateKey(candidate)}
          className="rounded-[8px] border border-[color:var(--line)] bg-black/15 p-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{candidate.label}</div>
              <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                {dataTypeText(candidate.data_type)} / {classificationText(candidate.classification)}
              </div>
            </div>
            <Badge variant={candidate.compatibility === "invalid" ? "danger" : "muted"}>
              {compatibilityText(candidate.compatibility)}
            </Badge>
          </div>
          {candidate.reason ? (
            <div className="mt-2 text-[11px] leading-4 text-[color:var(--muted)]">
              {candidate.reason}
            </div>
          ) : null}
          {candidate.preview ? <DataSourcePreview candidate={candidate} /> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={readOnly || incompatible}
              onClick={() => onPick(candidate)}
            >
              <Link2 aria-hidden />
              Выбрать
            </Button>
            {candidate.suggested_transform ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => onPick(candidate, candidate.suggested_transform)}
              >
                <Wand2 aria-hidden />
                Преобразовать
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StepSettingsFormRenderer({
  form,
  node,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly form: StepInspectorDto["settings_form"];
  readonly node: WorkflowNode;
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  const setLocalDraftEdit = useCanvasUiStore((state) => state.setLocalDraftEdit);
  const clearLocalDraftEdits = useCanvasUiStore((state) => state.clearLocalDraftEdits);
  const [values, setValues] = React.useState<Record<string, unknown>>(form.values);
  const [error, setError] = React.useState<string | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(form.values);

  function updateValue(field: StepSettingsFieldDto, value: unknown) {
    setValues((current) => ({ ...current, [field.key]: value }));
    setLocalDraftEdit(node.id, field.key, value);
  }

  function save() {
    const parsed: Record<string, unknown> = {};
    try {
      for (const field of form.fields) {
        if (field.readonly) {
          continue;
        }
        parsed[field.key] = coerceFieldValue(field, values[field.key]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Invalid value.");
      return;
    }
    onOperations({
      operations: [
        {
          client_operation_id: createClientOperationId("update_node_config"),
          operation_type: "UPDATE_NODE_CONFIG",
          operation_payload: {
            node_id: node.id,
            config: parsed,
          },
          base_workflow_hash: workflowHash,
        },
      ],
    });
    clearLocalDraftEdits(node.id);
  }

  if (form.fields.length === 0) {
    return (
      <EmptyState
        title="Дополнительных настроек нет"
        text="Для этого шага достаточно выбранных данных и политики выполнения."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Настройки шага" />
      {form.fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={values[field.key] ?? field.value ?? field.default_value ?? ""}
          readOnly={readOnly || Boolean(field.readonly)}
          onChange={(value) => updateValue(field, value)}
        />
      ))}
      {form.validation_issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
      {error ? <EmptyPanel text={error} /> : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={readOnly || !dirty} onClick={save}>
          <Save aria-hidden />
          Сохранить настройки
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!dirty}
          onClick={() => {
            setValues(form.values);
            clearLocalDraftEdits(node.id);
            setError(null);
          }}
        >
          <X aria-hidden />
          Отменить
        </Button>
      </div>
    </div>
  );
}

function SettingsField({
  field,
  value,
  readOnly,
  onChange,
}: {
  readonly field: StepSettingsFieldDto;
  readonly value: unknown;
  readonly readOnly: boolean;
  readonly onChange: (value: unknown) => void;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {field.label}
        {field.required ? <Badge variant="muted">required</Badge> : null}
      </span>
      {field.help_text ? (
        <span className="text-xs leading-5 text-[color:var(--muted)]">
          {field.help_text}
        </span>
      ) : null}
      {field.control === "textarea" || field.control === "json" ? (
        <Textarea
          value={stringifyValue(value, field.control === "json")}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-[8px]"
        />
      ) : field.control === "select" ? (
        <select
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 rounded-[8px] border border-[color:var(--line)] bg-[#0b0f15] px-3 text-sm outline-none"
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.control === "checkbox" ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4"
        />
      ) : (
        <Input
          type={field.control === "number" ? "number" : "text"}
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-[8px]"
        />
      )}
    </label>
  );
}

function ConnectionsTab({ inspector }: { readonly inspector: StepInspectorDto }) {
  if (inspector.connections.length === 0) {
    return <EmptyState title="Подключения не нужны" text="Шаг не требует внешних учётных данных." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Подключения" />
      {inspector.connections.map((connection) => (
        <div
          key={connection.requirement_code}
          className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{connection.label}</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                {connectionTypeText(connection.connection_type)}
              </div>
            </div>
            <Badge variant={connection.status === "configured" ? "success" : "danger"}>
              {connectionStatusText(connection.status)}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {connection.remediation.map((action) => (
              <Button key={action.action} type="button" size="sm" variant="ghost">
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TestingTab({
  automationId,
  inspector,
  readOnly,
}: {
  readonly automationId: string;
  readonly inspector: StepInspectorDto;
  readonly readOnly: boolean;
}) {
  const testStep = useStepTest({
    automationId,
    nodeId: inspector.node.id,
  });

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Проверка шага" />
      <KeyValue
        label="Пример результата для настройки"
        value={statusText(inspector.test_state.sample_data_status)}
      />
      <KeyValue
        label="Проверка"
        value={
          inspector.test_state.disabled_reason ??
          (inspector.test_state.supports_step_test ? "Доступна" : "Недоступна")
        }
      />
      <Button
        type="button"
        size="sm"
        disabled={readOnly || Boolean(inspector.test_state.disabled_reason) || testStep.isPending}
        onClick={() =>
          testStep.mutate({
            mode: "selected_step",
            sample_data_mode: "auto",
            client_operation_id: createClientOperationId("test_step"),
          })
        }
      >
        {testStep.isPending ? <Loader2 aria-hidden /> : <Play aria-hidden />}
        Проверить шаг
      </Button>
      {testStep.data ? (
        <pre className="max-h-72 overflow-auto rounded-[8px] border border-[color:var(--line)] bg-black/25 p-3 text-xs leading-5 text-[color:var(--muted-strong)]">
          {JSON.stringify(testStep.data, null, 2)}
        </pre>
      ) : null}
      {testStep.isError ? (
        <EmptyPanel
          text={
            testStep.error instanceof Error
              ? testStep.error.message
              : "Проверка шага не прошла."
          }
        />
      ) : null}
    </div>
  );
}

function ErrorsTab({
  policy,
  node,
  issues,
  workflowHash,
  readOnly,
  onOperations,
}: {
  readonly policy: StepErrorPolicy;
  readonly node: WorkflowNode;
  readonly issues: readonly LexFrameWorkflowV2["validation"]["issues"][number][];
  readonly workflowHash: string;
  readonly readOnly: boolean;
  readonly onOperations: OperationDispatcher;
}) {
  const [mode, setMode] = React.useState(policy.mode);
  const [retryCount, setRetryCount] = React.useState(
    String(policy.retry_count ?? 2),
  );

  function save() {
    onOperations({
      operations: [
        {
          client_operation_id: createClientOperationId("update_error_policy"),
          operation_type: "UPDATE_NODE_CONFIG",
          operation_payload: {
            node_id: node.id,
            config: {
              error_policy: {
                mode,
                retry_count: Number.parseInt(retryCount, 10) || 0,
              },
            },
          },
          base_workflow_hash: workflowHash,
        },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Error policy" />
      <label className="flex flex-col gap-2 text-sm">
        Mode
        <select
          value={mode}
          disabled={readOnly}
          onChange={(event) => setMode(event.target.value as StepErrorPolicy["mode"])}
          className="h-10 rounded-[8px] border border-[color:var(--line)] bg-[#0b0f15] px-3 text-sm outline-none"
        >
          <option value="fail_workflow">Fail workflow</option>
          <option value="go_to_error_branch">Go to error branch</option>
          <option value="retry_then_fail">Retry then fail</option>
          <option value="create_manual_task">Create manual task</option>
          <option value="skip_if_optional">Skip if optional</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        Retry count
        <Input
          type="number"
          value={retryCount}
          disabled={readOnly}
          onChange={(event) => setRetryCount(event.target.value)}
          className="rounded-[8px]"
        />
      </label>
      <Button type="button" size="sm" disabled={readOnly} onClick={save}>
        <Save aria-hidden />
        Save error policy
      </Button>
      {issues.length > 0 ? (
        <div className="flex flex-col gap-2">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OutputsTab({
  workflow,
  inspector,
}: {
  readonly workflow: LexFrameWorkflowV2;
  readonly inspector: StepInspectorDto;
}) {
  const usage = React.useMemo(() => outputUsage(workflow), [workflow]);
  if (inspector.outputs.length === 0) {
    return <EmptyState title="Нет результата" text="Этот шаг не создаёт данные для следующих шагов." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Что создаёт шаг" />
      {inspector.outputs.map((output) => (
        <FieldCard
          key={output.key}
          field={output}
          action={
            <Badge variant="muted">
              Используется: {usage.get(`${inspector.node.id}:${output.key}`) ?? 0}
            </Badge>
          }
        />
      ))}
    </div>
  );
}

function PoliciesTab({ inspector }: { readonly inspector: StepInspectorDto }) {
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Риски и ограничения" />
      <KeyValue label="Риск" value={riskText(inspector.policy_summary.risk_level ?? "medium")} />
      <KeyValue
        label="Данные"
        value={classificationText(inspector.policy_summary.data_classification ?? "workspace_internal")}
      />
      <KeyValue
        label="Нужно согласование"
        value={booleanText(inspector.policy_summary.approval_required)}
      />
      <KeyValue
        label="Внешнее действие"
        value={booleanText(inspector.policy_summary.external_action)}
      />
      <KeyValue label="Использует AI" value={booleanText(inspector.policy_summary.uses_ai)} />
      {inspector.policy_summary.warnings.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function HistoryTab({ inspector }: { readonly inspector: StepInspectorDto }) {
  if (inspector.history_summary.events.length === 0) {
    return <EmptyState title="Истории пока нет" text="Изменения этого шага ещё не записаны." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="История шага" />
      {inspector.history_summary.events.map((event) => (
        <div
          key={event.id}
          className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{event.event_type}</div>
            <Badge variant={event.rejected ? "danger" : "muted"}>
              {event.rejected ? "Отклонено" : "Применено"}
            </Badge>
          </div>
          <div className="mt-2 text-xs leading-5 text-[color:var(--muted)]">
            {event.summary}
          </div>
          <div className="mt-2 text-[11px] text-[color:var(--muted)]">
            {event.created_at}
          </div>
        </div>
      ))}
    </div>
  );
}

function InspectorFooter({
  node,
  permissions,
  readOnly,
  workflowHash,
  onOperations,
  onOpenTab,
}: {
  readonly node: WorkflowNode;
  readonly permissions: StepInspectorPermissionsDto;
  readonly readOnly: boolean;
  readonly workflowHash: string;
  readonly onOperations: OperationDispatcher;
  readonly onOpenTab: (tab: StepInspectorTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-[color:var(--line)] p-3">
      <Button
        type="button"
        size="sm"
        variant="subtle"
        disabled={!permissions.can_test_step}
        onClick={() => onOpenTab("test")}
      >
        <Play aria-hidden />
        Test
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={readOnly || !permissions.can_delete_step}
        onClick={() =>
          onOperations({
            operations: [
              {
                client_operation_id: createClientOperationId("delete_node"),
                operation_type: "DELETE_NODE",
                operation_payload: { node_id: node.id },
                base_workflow_hash: workflowHash,
              },
            ],
          })
        }
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!permissions.can_open_advanced_mapping}
        onClick={() => onOpenTab("debug")}
      >
        <Shield aria-hidden />
        Advanced
      </Button>
    </div>
  );
}

function FallbackOverview({
  node,
  issues,
}: {
  readonly node: WorkflowNode;
  readonly issues: readonly LexFrameWorkflowV2["validation"]["issues"][number][];
}) {
  return (
    <div className="flex flex-col gap-3">
      <PanelTitle label="Обзор шага" />
      <KeyValue label="Название" value={node.display_name} />
      <KeyValue label="Тип" value={plainStepType(node.type)} />
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function BindingChip({
  binding,
  onDelete,
}: {
  readonly binding: StepInputBinding;
  readonly onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] border border-[color:var(--line)] bg-black/20 px-2 py-2 text-xs">
      <span className="min-w-0 truncate">{bindingLabel(binding)}</span>
      {onDelete ? (
        <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
          Очистить
        </Button>
      ) : null}
    </div>
  );
}

function DataSourcePreview({
  candidate,
}: {
  readonly candidate: CanvasDataSourceCandidate;
}) {
  return (
    <pre className="mt-2 max-h-20 overflow-auto rounded-[6px] bg-black/25 p-2 text-[11px] leading-4 text-[color:var(--muted)]">
      {JSON.stringify(candidate.preview, null, 2)}
    </pre>
  );
}

function FieldCard({
  field,
  action,
}: {
  readonly field: WorkflowDataField;
  readonly action?: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{field.label}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            {fieldType(field)}
            {field.required ? " / обязательно" : ""}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="muted">
          {classificationText(field.classification ?? "workspace_internal")}
        </Badge>
        {field.preview_policy ? <Badge variant="muted">{previewPolicyText(field.preview_policy)}</Badge> : null}
      </div>
    </div>
  );
}

function IssueCard({
  issue,
}: {
  readonly issue: LexFrameWorkflowV2["validation"]["issues"][number];
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-black/20 p-3 text-xs leading-5">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-3" aria-hidden />
        {issue.title}
      </div>
      <div className="mt-1 text-[color:var(--muted)]">{issue.message}</div>
      {issue.suggested_fix ? (
        <div className="mt-2 text-[color:var(--muted-strong)]">
          {issue.suggested_fix}
        </div>
      ) : null}
    </div>
  );
}

function BindingStatusBadge({
  status,
}: {
  readonly status: ReturnType<typeof bindingStatusFromState>;
}) {
  const danger =
    status === "invalid" ||
    status === "stale" ||
    status === "policy_blocked" ||
    status === "none";
  return <Badge variant={danger ? "danger" : "muted"}>{bindingStatusText(status)}</Badge>;
}

function StatusChip({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-1 truncate text-xs">{value}</div>
    </div>
  );
}

function PanelTitle({ label }: { readonly label: string }) {
  return <Badge variant="muted">{label}</Badge>;
}

function EmptyPanel({
  text,
  compact,
}: {
  readonly text: string;
  readonly compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[8px] border border-[color:var(--line)] bg-white/4 ${
        compact ? "p-2 text-xs" : "p-4 text-sm"
      } text-[color:var(--muted)]`}
    >
      {text}
    </div>
  );
}

function EmptyState({
  title,
  text,
}: {
  readonly title: string;
  readonly text: string;
}) {
  return (
    <div className="m-4 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-2 text-xs leading-5 text-[color:var(--muted)]">{text}</div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-[color:var(--line)] bg-white/4 p-4 text-sm text-[color:var(--muted)]">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Загружаем настройки шага
    </div>
  );
}

function KeyValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-[8px] border border-[color:var(--line)] bg-white/4 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </div>
      <div className="mt-2 break-words text-sm leading-6">{value}</div>
    </div>
  );
}

function RawDebugPanel({ value }: { readonly value: unknown }) {
  return (
    <pre className="max-h-[560px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-black/25 p-4 text-xs leading-5 text-[color:var(--muted-strong)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function riskText(risk: string) {
  const labels: Record<string, string> = {
    low: "Низкий риск",
    medium: "Средний риск",
    high: "Высокий риск",
    critical: "Критический риск",
  };
  return labels[risk] ?? risk;
}

function booleanText(value: boolean) {
  return value ? "Да" : "Нет";
}

function plainStepType(value: WorkflowNode["type"]) {
  const labels: Record<WorkflowNode["type"], string> = {
    trigger: "Запуск сценария",
    legalAction: "Юридическое действие",
    aiAction: "AI-действие",
    documentInput: "Документы и данные",
    condition: "Условие",
    loop: "Повторить для каждого",
    merge: "Объединение веток",
    approval: "Согласование",
    wait: "Ожидание",
    delivery: "Доставка результата",
    storage: "Сохранение",
    subworkflow: "Готовая процедура",
    errorHandler: "Обработка ошибки",
    end: "Результат сценария",
    note: "Заметка",
    group: "Группа шагов",
  };
  return labels[value] ?? "Шаг сценария";
}

function connectionTypeText(value: string) {
  const labels: Record<string, string> = {
    email: "почта",
    storage: "хранилище",
    ai: "AI-подключение",
    external_service: "внешний сервис",
  };
  return labels[value] ?? "подключение";
}

function connectionStatusText(value: string) {
  const labels: Record<string, string> = {
    configured: "настроено",
    missing: "не настроено",
    invalid: "нужно обновить",
    unavailable: "недоступно",
  };
  return labels[value] ?? value;
}

function compatibilityText(value: string) {
  const labels: Record<string, string> = {
    valid: "подходит",
    warning: "проверьте",
    invalid: "не подходит",
  };
  return labels[value] ?? value;
}

function bindingStatusText(value: string) {
  const labels: Record<string, string> = {
    valid: "Выбрано",
    warning: "Есть предупреждение",
    invalid: "Ошибка",
    stale: "Источник устарел",
    none: "Не выбрано",
    policy_blocked: "Заблокировано политикой",
  };
  return labels[value] ?? value;
}

function statusText(value: string) {
  const labels: Record<string, string> = {
    valid: "Готово",
    valid_with_warnings: "Есть предупреждения",
    invalid: "Есть ошибки",
    loading: "Загрузка",
    missing: "Нет примера",
    available: "Готово",
    stale: "Нужно обновить",
    pinned: "Используется пример результата",
    unsupported: "Недоступно",
  };
  return labels[value] ?? value;
}

function dataTypeText(value: string) {
  return fieldType({ key: "type", label: "type", data_type: value as WorkflowDataField["data_type"] });
}

function classificationText(value: string) {
  const labels: Record<string, string> = {
    public: "публичные данные",
    workspace_internal: "данные workspace",
    confidential: "конфиденциально",
    personal_data: "персональные данные",
    legal_secret: "адвокатская тайна",
    client_material: "материалы клиента",
  };
  return labels[value] ?? value;
}

function previewPolicyText(value: string) {
  const labels: Record<string, string> = {
    hidden: "пример скрыт",
    redacted: "пример очищен",
    sample_only: "пример для настройки",
  };
  return labels[value] ?? value;
}

function fieldType(field: WorkflowDataField) {
  const type = field.data_type ?? field.type ?? "unknown";
  const labels: Record<string, string> = {
    string: "текст",
    text: "текст",
    number: "число",
    boolean: "да/нет",
    object: "данные",
    array: "список",
    document: "документ",
    "document[]": "список документов",
    profile: "профиль",
    template: "шаблон",
    enum: "выбор",
  };
  return labels[String(type)] ?? String(type);
}

function bindingLabel(binding: StepInputBinding) {
  const source = binding.source;
  if (source.type === "workflow_input") {
    return `Вход сценария ← ${source.input_key ?? source.inputKey}`;
  }
  if (source.type === "step_output") {
    return `Результат шага ← ${source.node_id ?? source.sourceNodeId} / ${
      source.output_key ?? source.outputKey
    }`;
  }
  if (source.type === "manual_value" || source.type === "literal") {
    return "Указано вручную";
  }
  if (source.type === "connection") {
    return source.display_name ?? "Подключение workspace";
  }
  if (source.type === "secret_ref") {
    return source.display_name ?? "Секрет хранится на сервере";
  }
  if (source.type === "system_value") {
    return "Системное значение";
  }
  if (source.type === "expression") {
    return "Техническое выражение скрыто";
  }
  if (source.type === "transform") {
    return "Преобразованные данные";
  }
  return source.type;
}

function stringifyValue(value: unknown, prettyJson: boolean) {
  if (prettyJson && typeof value !== "string") {
    return JSON.stringify(value ?? {}, null, 2);
  }
  return typeof value === "string" ? value : String(value ?? "");
}

function coerceFieldValue(field: StepSettingsFieldDto, value: unknown) {
  if (field.control === "number") {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`${field.label} must be a number.`);
    }
    return parsed;
  }
  if (field.control === "checkbox") {
    return Boolean(value);
  }
  if (field.control === "json") {
    if (typeof value !== "string") {
      return value;
    }
    return JSON.parse(value);
  }
  return value;
}

function outputUsage(workflow: LexFrameWorkflowV2) {
  const usage = new Map<string, number>();
  for (const node of workflow.nodes) {
    for (const binding of node.input_bindings ?? []) {
      if (binding.source.type === "step_output") {
        const nodeId = binding.source.node_id ?? binding.source.sourceNodeId;
        const outputKey = binding.source.output_key ?? binding.source.outputKey;
        const key = `${nodeId}:${outputKey}`;
        usage.set(key, (usage.get(key) ?? 0) + 1);
      }
    }
  }
  return usage;
}

function permissionsFromCanvas(
  permissions: CanvasPermissions,
  readOnly: boolean,
): StepInspectorPermissionsDto {
  return {
    can_view: permissions.can_view,
    can_edit_display_name: permissions.can_edit && !readOnly,
    can_edit_config: permissions.can_edit && !readOnly,
    can_edit_bindings: permissions.can_edit && !readOnly,
    can_test_step: permissions.can_test,
    can_view_raw_data: permissions.can_debug,
    can_pin_data: permissions.can_edit && permissions.can_debug && !readOnly,
    can_edit_error_policy: permissions.can_edit && !readOnly,
    can_edit_security_policy: permissions.can_debug && !readOnly,
    can_delete_step: permissions.can_edit && !readOnly,
    can_open_advanced_mapping: permissions.can_open_advanced_builder,
  };
}
