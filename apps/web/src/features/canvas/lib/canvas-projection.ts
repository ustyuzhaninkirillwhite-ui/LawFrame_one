import type {
  CanvasOperation,
  CanvasModuleCard,
  CanvasPermissions,
  LexFrameWorkflowV2,
  NoCodeNodePresentation,
  ValidationIssue,
  WorkflowEdge,
  WorkflowDataField,
  WorkflowHandle,
  WorkflowNode,
} from "@lexframe/contracts";
import type { CanvasBlockDefinition } from "@lexframe/workflow-dsl";
import type { Connection, Edge, Node, NodeChange } from "@xyflow/react";

export interface CanvasNodeBadge {
  readonly type:
    | "ai"
    | "external"
    | "approval"
    | "warning"
    | "error"
    | "connection"
    | "test"
    | "policy";
  readonly label: string;
}

export interface CanvasNodeHandleView {
  readonly code: string;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly kind?: WorkflowHandle["kind"];
}

export interface CanvasNodeData extends Record<string, unknown> {
  readonly workflowNodeId: string;
  readonly nodeKind: WorkflowNode["type"];
  readonly title: string;
  readonly subtitle?: string;
  readonly moduleCode?: string | null;
  readonly noCode?: NoCodeNodePresentation;
  readonly badges: readonly CanvasNodeBadge[];
  readonly inputSummary: { readonly required: number; readonly missing: number; readonly bound: number };
  readonly outputSummary: { readonly count: number; readonly mainOutputLabel?: string };
  readonly validation: {
    readonly state: "valid" | "warning" | "invalid" | "untested";
    readonly issueCount: number;
  };
  readonly policy: {
    readonly externalAction: boolean;
    readonly requiresApproval: boolean;
    readonly dataClassification: string;
  };
  readonly handles: readonly CanvasNodeHandleView[];
  readonly readOnly: boolean;
  readonly ariaLabel: string;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  readonly workflowEdgeId: string;
  readonly edgeType:
    | "control_flow"
    | "data_flow"
    | "error_flow"
    | "approval_flow"
    | "loop_flow"
    | "annotation_link"
    | "invalid"
    | "disabled";
  readonly label?: string;
  readonly validationState: "valid" | "warning" | "invalid";
  readonly readOnly: boolean;
  readonly issueCount: number;
  readonly inlineModules?: readonly CanvasModuleCard[];
  readonly onInlineAdd?: (edgeId: string, module: CanvasModuleCard) => void;
}

export interface CanvasReadOnlyState {
  readonly readOnly: boolean;
  readonly reason: string | null;
}

export interface CanvasValidationContext {
  readonly workflow: LexFrameWorkflowV2;
  readonly nodesById: ReadonlyMap<string, WorkflowNode>;
  readonly edges: readonly WorkflowEdge[];
}

export function resolveReadOnlyMode(input: {
  readonly workflow: LexFrameWorkflowV2;
  readonly permissions: CanvasPermissions;
  readonly lockReadOnly: boolean;
}): CanvasReadOnlyState {
  if (!input.permissions.can_edit) {
    return { readOnly: true, reason: "Недостаточно прав для редактирования Canvas." };
  }
  if (input.lockReadOnly) {
    return { readOnly: true, reason: "Черновик заблокирован другим пользователем." };
  }
  if (input.workflow.metadata.status === "archived") {
    return { readOnly: true, reason: "Архивную автоматизацию можно только просматривать." };
  }
  return { readOnly: false, reason: null };
}

export function workflowToFlowNodes(
  workflow: LexFrameWorkflowV2,
  permissions: CanvasPermissions,
  lockReadOnly: boolean,
  input?: {
    readonly noCodeNodes?: readonly NoCodeNodePresentation[];
  },
): Node<CanvasNodeData>[] {
  const { readOnly } = resolveReadOnlyMode({ workflow, permissions, lockReadOnly });
  const noCodeById = new Map(
    (input?.noCodeNodes ?? []).map((node) => [node.node_id, node]),
  );

  return workflow.nodes.map((node) => {
    const noCode = noCodeById.get(node.id);
    const issues = workflow.validation.issues.filter(
      (issue) => issue.affected_node_id === node.id,
    );
    const inputSummary = buildInputSummary(node, issues);
    const outputSummary = buildOutputSummary(node);
    const validation = validationState(issues, node);
    const data: CanvasNodeData = {
      workflowNodeId: node.id,
      nodeKind: node.type,
      title: noCode?.title ?? node.display_name,
      subtitle: noCode?.description ?? node.description ?? node.module_code ?? node.block_code,
      moduleCode: node.module_code ?? node.block_code,
      noCode,
      badges: noCode
        ? noCode.badges.map((label) => ({
            type: badgeTypeFromNoCode(label),
            label,
          }))
        : buildNodeBadges(node, issues),
      inputSummary,
      outputSummary,
      validation,
      policy: {
        externalAction: Boolean(node.policy.external_action),
        requiresApproval: Boolean(node.policy.approval_required),
        dataClassification: String(node.policy.data_classification ?? "workspace_internal"),
      },
      handles: node.handles.map((handle) => ({
        code: handle.code,
        label: handleLabel(handle.code, handle.label),
        direction: handle.direction,
        kind: handle.kind,
      })),
      readOnly,
      ariaLabel: [
        noCode?.aria_label ?? `Шаг: ${node.display_name}.`,
        `Статус: ${validation.state}.`,
        inputSummary.missing > 0
          ? `Не хватает входных данных: ${inputSummary.missing}.`
          : "Входные данные настроены.",
        node.policy.approval_required ? "Требует согласования." : null,
      ]
        .filter(Boolean)
        .join(" "),
    };

    return {
      id: node.id,
      type: node.type,
      position: {
        x: node.layout.x,
        y: node.layout.y,
      },
      data,
      draggable: !readOnly,
      selectable: true,
      deletable: !readOnly && node.type !== "trigger" && node.type !== "end",
    };
  });
}

export function workflowToFlowEdges(
  workflow: LexFrameWorkflowV2,
  permissions: CanvasPermissions,
  lockReadOnly: boolean,
  input?: {
    readonly inlineModules?: readonly CanvasModuleCard[];
    readonly onInlineAdd?: (edgeId: string, module: CanvasModuleCard) => void;
  },
): Edge<CanvasEdgeData>[] {
  const { readOnly } = resolveReadOnlyMode({ workflow, permissions, lockReadOnly });

  return workflow.edges.map((edge) => {
    const issues = workflow.validation.issues.filter(
      (issue) => issue.affected_edge_id === edge.id,
    );
    const edgeType = edgeViewType(edge, issues);
    return {
      id: edge.id,
      type: edgeRendererType(edgeType),
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      targetHandle: edge.target_handle,
      label: edge.label ?? conditionLabel(edge.condition),
      animated:
        edgeType === "error_flow" ||
        edgeType === "approval_flow" ||
        edgeType === "loop_flow",
      data: {
        workflowEdgeId: edge.id,
        edgeType,
        label: edge.label ?? conditionLabel(edge.condition),
        validationState:
          edge.validation_state === "invalid" || issues.some((issue) => issue.severity === "error")
            ? "invalid"
            : issues.length > 0
              ? "warning"
              : "valid",
        readOnly,
        issueCount: issues.length,
        inlineModules: input?.inlineModules,
        onInlineAdd: input?.onInlineAdd,
      },
    };
  });
}

export const toReactFlowNodes = workflowToFlowNodes;
export const toReactFlowEdges = workflowToFlowEdges;

export function buildNodeBadges(
  node: WorkflowNode,
  issues: readonly ValidationIssue[],
): readonly CanvasNodeBadge[] {
  const badges: CanvasNodeBadge[] = [];
  if (node.policy.ai_action) {
    badges.push({ type: "ai", label: "AI" });
  }
  if (node.policy.external_action) {
    badges.push({ type: "external", label: "Внешнее действие" });
  }
  if (node.policy.approval_required) {
    badges.push({ type: "approval", label: "Согласование" });
  }
  if (node.policy.risk_level === "high" || node.policy.risk_level === "critical") {
    badges.push({ type: "policy", label: `Риск: ${node.policy.risk_level}` });
  }
  if ((node.input_bindings?.length ?? 0) > 0) {
    badges.push({ type: "connection", label: `${node.input_bindings?.length ?? 0} связей` });
  }
  if (node.test_state?.sample_data_status === "pinned") {
    badges.push({ type: "test", label: "Пример результата" });
  }
  if (issues.some((issue) => issue.severity === "policy_block")) {
    badges.push({ type: "error", label: "Блокирует публикацию" });
  } else if (issues.some((issue) => issue.severity === "error")) {
    badges.push({ type: "error", label: "Ошибка" });
  } else if (issues.length > 0) {
    badges.push({ type: "warning", label: "Предупреждение" });
  }
  return badges;
}

function badgeTypeFromNoCode(label: string): CanvasNodeBadge["type"] {
  const normalized = label.toLocaleLowerCase("ru-RU");
  if (
    normalized.includes("ошиб") ||
    normalized.includes("блок") ||
    normalized.includes("крит")
  ) {
    return "error";
  }
  if (normalized.includes("внеш") || normalized.includes("отправ")) {
    return "external";
  }
  if (normalized.includes("ai")) {
    return "ai";
  }
  if (normalized.includes("соглас")) {
    return "approval";
  }
  if (normalized.includes("риск") || normalized.includes("policy")) {
    return "policy";
  }
  if (normalized.includes("тест") || normalized.includes("провер")) {
    return "test";
  }
  return "connection";
}

export function connectionToAddEdgeOperation(
  connection: Connection,
): CanvasOperation | null {
  if (!connection.source || !connection.target) {
    return null;
  }

  const sourceHandle = connection.sourceHandle ?? "main_output";
  const targetHandle = connection.targetHandle ?? "main_input";
  const edgeType = edgeTypeForHandles(sourceHandle, targetHandle);
  const edge: WorkflowEdge = {
    id: `${connection.source}:${sourceHandle}:${connection.target}:${targetHandle}`,
    type: legacyEdgeType(edgeType),
    edge_type: edgeType,
    source_node_id: connection.source,
    source_handle: sourceHandle as WorkflowEdge["source_handle"],
    source_port_id: sourceHandle as WorkflowEdge["source_port_id"],
    target_node_id: connection.target,
    target_handle: targetHandle as WorkflowEdge["target_handle"],
    target_port_id: targetHandle as WorkflowEdge["target_port_id"],
    label: null,
    condition: null,
    validation_state: "valid",
  };

  return {
    client_operation_id: createClientOperationId("edge"),
    operation_type: "ADD_EDGE",
    operation_payload: { edge },
  };
}

export const fromConnectionToCanvasOperation = connectionToAddEdgeOperation;

export function explainInvalidConnection(
  connection: Connection,
  ctx: CanvasValidationContext,
): string | null {
  if (!connection.source || !connection.target) {
    return "Выберите исходный и целевой блок.";
  }

  const source = ctx.nodesById.get(connection.source);
  const target = ctx.nodesById.get(connection.target);
  if (!source || !target) {
    return "Связь указывает на отсутствующий блок.";
  }
  if (source.id === target.id) {
    return "Нельзя соединить блок сам с собой.";
  }
  if (source.type === "end") {
    return "Конечный блок не может быть источником связи.";
  }
  if (target.type === "trigger") {
    return "Стартовый блок не может быть целью связи.";
  }

  const sourceHandle = connection.sourceHandle ?? "main_output";
  const targetHandle = connection.targetHandle ?? "main_input";
  if (!hasHandle(source, sourceHandle, "output")) {
    return "Выбранный исходящий порт недоступен для этого блока.";
  }
  if (!hasHandle(target, targetHandle, "input")) {
    return "Выбранный входящий порт недоступен для этого блока.";
  }
  if (hasDuplicateSingleInput(ctx.edges, target.id, targetHandle)) {
    return "Этот вход уже подключён. Сначала удалите существующую связь.";
  }
  if (wouldCreateForbiddenCycle(source.id, target.id, ctx)) {
    return "Такая связь создаёт запрещённый цикл.";
  }
  if (isErrorHandle(sourceHandle) && !isAllowedErrorTarget(target)) {
    return "Маршрут ошибки должен вести в обработчик ошибки или допустимый recovery-блок.";
  }
  if (
    target.type === "delivery" &&
    target.policy.approval_required !== false &&
    !sourceOrPathHasApproval(ctx.workflow, source.id)
  ) {
    return "Нельзя подключить внешнюю доставку без блока согласования перед ней.";
  }

  return null;
}

export function isValidConnection(
  connection: Connection,
  ctx: CanvasValidationContext,
): boolean {
  return explainInvalidConnection(connection, ctx) === null;
}

export function wouldCreateForbiddenCycle(
  sourceNodeId: string,
  targetNodeId: string,
  ctx: CanvasValidationContext,
): boolean {
  const adjacency = new Map<string, string[]>();
  for (const edge of ctx.edges) {
    if (edge.type === "data" || edge.type === "data_flow" || edge.type === "invalid") {
      continue;
    }
    adjacency.set(edge.source_node_id, [
      ...(adjacency.get(edge.source_node_id) ?? []),
      edge.target_node_id,
    ]);
  }
  adjacency.set(sourceNodeId, [
    ...(adjacency.get(sourceNodeId) ?? []),
    targetNodeId,
  ]);

  const visited = new Set<string>();
  const stack = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (stack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    stack.delete(nodeId);
    return false;
  };

  return ctx.workflow.nodes.some((node) => visit(node.id));
}

export function fromNodeChangeToCanvasOperation(
  change: NodeChange,
): CanvasOperation | null {
  if (change.type !== "position" || !change.position || change.dragging) {
    return null;
  }

  return {
    client_operation_id: createClientOperationId("move"),
    operation_type: "MOVE_NODE",
    operation_payload: {
      node_id: change.id,
      x: change.position.x,
      y: change.position.y,
    },
  };
}

export function createClientOperationId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createPlaceholderNode(input: {
  readonly block: CanvasBlockDefinition;
  readonly x: number;
  readonly y: number;
}): WorkflowNode {
  const id = `${input.block.code.replace(/[^a-z0-9]+/gi, "_")}_${Date.now()}`;

  const inputs = input.block.inputs.map((field) => normalizeField(field));
  const outputs = input.block.outputs.map((field) => normalizeField(field));
  const handles = input.block.handles.map((handle) => ({
    code: handle.code,
    label: handleLabel(handle.code, handle.label),
    direction: handle.direction,
    kind: handle.kind,
    edge_types: handle.edgeTypes,
    data_type: handle.dataType ?? null,
    data_field_key: handle.dataFieldKey ?? null,
  })) satisfies WorkflowHandle[];

  return {
    id,
    type: input.block.nodeType,
    block_code: input.block.code,
    display_name: input.block.displayName,
    description: input.block.shortDescription,
    module_code: input.block.moduleCode ?? null,
    module_version: null,
    module_schema_hash: null,
    dynamic_outputs_status: "static",
    trigger_kind: input.block.kind === "trigger" ? input.block.code : null,
    handles: withDataHandles(handles, inputs, outputs),
    inputs,
    outputs,
    bindings: {},
    input_bindings: [],
    config: input.block.defaultConfig,
    policy: {
      approval_required: input.block.policies.requiresApproval,
      external_action: input.block.policies.isExternalAction,
      ai_action: input.block.policies.canUseAi,
      data_classification: input.block.policies.dataClassification,
      risk_level: input.block.policies.riskLevel,
      can_use_documents: input.block.policies.canUseDocuments,
      can_run_in_dry_run: input.block.policies.canRunInDryRun,
      can_be_published_as_template:
        input.block.policies.canBePublishedAsTemplate,
      required_permissions: input.block.policies.requiredPermissions,
    },
    runtime_mapping: {
      module_code: input.block.moduleCode ?? input.block.code,
      provider: input.block.runtime.provider,
      activepieces_piece: input.block.runtime.activepiecesPiece ?? null,
      activepieces_action: input.block.runtime.activepiecesAction ?? null,
      internal_route: input.block.runtime.internalRoute ?? null,
      can_compile: input.block.runtime.provider !== "none",
      supports_step_test: input.block.runtime.supportsStepTest,
      supports_partial_execution: input.block.runtime.supportsPartialExecution,
      supports_pinned_data: input.block.runtime.supportsPinnedData,
      warnings: input.block.runtime.notes,
    },
    test_state: {
      sample_data_status: "missing",
    },
    layout: {
      x: input.x,
      y: input.y,
      width: input.block.kind === "group" ? 420 : 288,
      height: 112,
    },
  };
}

export function cloneNodeForDuplicate(
  node: WorkflowNode,
  offset = 36,
): WorkflowNode {
  const id = `${node.id}_copy_${Date.now()}`;
  return {
    ...node,
    id,
    display_name: `${node.display_name} (копия)`,
    layout: {
      ...node.layout,
      x: node.layout.x + offset,
      y: node.layout.y + offset,
    },
    input_bindings: [],
  };
}

export function createInverseOperations(
  workflow: LexFrameWorkflowV2,
  operations: readonly CanvasOperation[],
): readonly CanvasOperation[] {
  const inverse: CanvasOperation[] = [];
  for (const operation of operations) {
    const payload = operation.operation_payload;
    if (operation.operation_type === "ADD_NODE") {
      const node = payload.node as WorkflowNode | undefined;
      if (node?.id) {
        inverse.unshift({
          client_operation_id: createClientOperationId("undo_add_node"),
          operation_type: "DELETE_NODE",
          operation_payload: { node_id: node.id },
        });
      }
    }
    if (operation.operation_type === "DELETE_NODE") {
      const nodeId = stringValue(payload.node_id);
      const node = nodeId ? workflow.nodes.find((item) => item.id === nodeId) : null;
      if (node) {
        const connectedEdges = workflow.edges.filter(
          (edge) => edge.source_node_id === node.id || edge.target_node_id === node.id,
        );
        inverse.unshift(
          ...connectedEdges.map((edge) => ({
            client_operation_id: createClientOperationId("undo_delete_edge"),
            operation_type: "ADD_EDGE" as const,
            operation_payload: { edge },
          })),
        );
        inverse.unshift({
          client_operation_id: createClientOperationId("undo_delete_node"),
          operation_type: "ADD_NODE",
          operation_payload: { node },
        });
      }
    }
    if (operation.operation_type === "ADD_EDGE") {
      const edge = payload.edge as WorkflowEdge | undefined;
      if (edge?.id) {
        inverse.unshift({
          client_operation_id: createClientOperationId("undo_add_edge"),
          operation_type: "DELETE_EDGE",
          operation_payload: { edge_id: edge.id },
        });
      }
    }
    if (operation.operation_type === "DELETE_EDGE") {
      const edgeId = stringValue(payload.edge_id);
      const edge = edgeId ? workflow.edges.find((item) => item.id === edgeId) : null;
      if (edge) {
        inverse.unshift({
          client_operation_id: createClientOperationId("undo_delete_edge"),
          operation_type: "ADD_EDGE",
          operation_payload: { edge },
        });
      }
    }
    if (operation.operation_type === "MOVE_NODE") {
      const nodeId = stringValue(payload.node_id);
      const node = nodeId ? workflow.nodes.find((item) => item.id === nodeId) : null;
      if (node) {
        inverse.unshift({
          client_operation_id: createClientOperationId("undo_move_node"),
          operation_type: "MOVE_NODE",
          operation_payload: {
            node_id: node.id,
            x: node.layout.x,
            y: node.layout.y,
          },
        });
      }
    }
  }
  return inverse;
}

export function withBaseGuards(
  operations: readonly CanvasOperation[],
  workflowHash: string,
  revisionCounter?: number,
): readonly CanvasOperation[] {
  return operations.map((operation) => ({
    ...operation,
    base_workflow_hash: operation.base_workflow_hash ?? workflowHash,
    base_revision_counter:
      operation.base_revision_counter ?? revisionCounter ?? null,
  }));
}

function buildInputSummary(
  node: WorkflowNode,
  issues: readonly ValidationIssue[],
) {
  const required = node.inputs.filter((input) => input.required).length;
  const boundKeys = new Set(
    (node.input_bindings ?? []).map(
      (binding) => binding.target?.input_key ?? binding.targetInputKey,
    ),
  );
  const missing = new Set(
    issues
      .filter((issue) => issue.scope === "binding" && issue.affected_input_key)
      .map((issue) => issue.affected_input_key),
  );
  return {
    required,
    missing: missing.size,
    bound: boundKeys.size,
  };
}

function buildOutputSummary(node: WorkflowNode) {
  return {
    count: node.outputs.length,
    mainOutputLabel: node.outputs[0]?.label,
  };
}

function validationState(
  issues: readonly ValidationIssue[],
  node: WorkflowNode,
): CanvasNodeData["validation"] {
  if (issues.some((issue) => issue.severity === "error" || issue.severity === "policy_block")) {
    return { state: "invalid", issueCount: issues.length };
  }
  if (issues.length > 0) {
    return { state: "warning", issueCount: issues.length };
  }
  if (node.test_state?.sample_data_status === "missing" && node.type !== "trigger" && node.type !== "end") {
    return { state: "untested", issueCount: 0 };
  }
  return { state: "valid", issueCount: 0 };
}

function conditionLabel(condition: WorkflowEdge["condition"]) {
  if (!condition) {
    return undefined;
  }
  if (typeof condition === "string") {
    return condition;
  }
  if (condition.type === "comparison") {
    return `${condition.operator}`;
  }
  return condition.type;
}

function edgeViewType(
  edge: WorkflowEdge,
  issues: readonly ValidationIssue[],
): CanvasEdgeData["edgeType"] {
  if (edge.type === "invalid" || edge.edge_type === "invalid" || issues.some((issue) => issue.severity === "error")) {
    return "invalid";
  }
  const type = edge.edge_type ?? edge.type;
  if (type === "data" || type === "data_flow") {
    return "data_flow";
  }
  if (type === "error" || type === "error_flow") {
    return "error_flow";
  }
  if (type === "approval" || type === "approval_flow") {
    return "approval_flow";
  }
  if (type === "loop" || type === "loop_flow") {
    return "loop_flow";
  }
  if (type === "annotation" || type === "annotation_link") {
    return "annotation_link";
  }
  return "control_flow";
}

function edgeRendererType(type: CanvasEdgeData["edgeType"]) {
  if (type === "invalid") {
    return "invalid";
  }
  if (type === "data_flow") {
    return "data";
  }
  if (type === "error_flow") {
    return "error";
  }
  if (type === "approval_flow") {
    return "approval";
  }
  if (type === "loop_flow") {
    return "loop";
  }
  if (type === "disabled") {
    return "disabled";
  }
  return "control";
}

function edgeTypeForHandles(
  sourceHandle: string,
  targetHandle: string,
): NonNullable<WorkflowEdge["edge_type"]> {
  if (isDataHandle(sourceHandle) || isDataHandle(targetHandle)) {
    return "data_flow";
  }
  if (isErrorHandle(sourceHandle) || targetHandle === "error_input") {
    return "error_flow";
  }
  if (["approved", "rejected", "changes_requested", "out:approved", "out:rejected"].includes(sourceHandle)) {
    return "approval_flow";
  }
  if (["loop_item", "after_loop", "out:item", "out:done"].includes(sourceHandle)) {
    return "loop_flow";
  }
  return "control_flow";
}

function legacyEdgeType(type: NonNullable<WorkflowEdge["edge_type"]>): WorkflowEdge["type"] {
  switch (type) {
    case "data_flow":
      return "data";
    case "error_flow":
      return "error";
    case "approval_flow":
      return "approval";
    case "loop_flow":
      return "loop";
    case "annotation_link":
      return "annotation";
    default:
      return "control";
  }
}

function normalizeField(
  field: CanvasBlockDefinition["inputs"][number],
): WorkflowDataField {
  return {
    key: field.key,
    label: field.label,
    description:
      "description" in field && typeof field.description === "string"
        ? field.description
        : null,
    data_type: field.type,
    type: field.type,
    required: field.required,
    classification: field.classification ?? null,
    allowed_sources: field.allowedSources,
    allowedSources: field.allowedSources,
  };
}

function withDataHandles(
  handles: readonly WorkflowHandle[],
  inputs: readonly WorkflowDataField[],
  outputs: readonly WorkflowDataField[],
) {
  const existing = new Set(handles.map((handle) => handle.code));
  return [
    ...handles,
    ...inputs
      .map(
        (field): WorkflowHandle => ({
          code: `data:input:${field.key}`,
          label: field.label,
          direction: "input",
          kind: "data_in",
          edge_types: ["data_flow"],
          data_type: field.data_type ?? field.type ?? "unknown",
          data_field_key: field.key,
        }),
      )
      .filter((handle) => !existing.has(handle.code)),
    ...outputs
      .map(
        (field): WorkflowHandle => ({
          code: `data:output:${field.key}`,
          label: field.label,
          direction: "output",
          kind: "data_out",
          edge_types: ["data_flow"],
          data_type: field.data_type ?? field.type ?? "unknown",
          data_field_key: field.key,
        }),
      )
      .filter((handle) => !existing.has(handle.code)),
  ];
}

function hasHandle(
  node: WorkflowNode,
  code: string,
  direction: "input" | "output",
) {
  return node.handles.some(
    (handle) =>
      handle.direction === direction &&
      (handle.code === code || handleAlias(handle.code) === handleAlias(code)),
  );
}

function hasDuplicateSingleInput(
  edges: readonly WorkflowEdge[],
  targetNodeId: string,
  targetHandle: string,
) {
  if (isDataHandle(targetHandle)) {
    return false;
  }
  return edges.some(
    (edge) =>
      edge.target_node_id === targetNodeId &&
      handleAlias(edge.target_handle) === handleAlias(targetHandle) &&
      edge.type !== "invalid",
  );
}

function sourceOrPathHasApproval(workflow: LexFrameWorkflowV2, sourceNodeId: string) {
  const source = workflow.nodes.find((node) => node.id === sourceNodeId);
  if (source?.type === "approval") {
    return true;
  }
  return hasApprovalBefore(workflow, sourceNodeId);
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  const reverseEdges = new Map<string, readonly string[]>();
  for (const edge of workflow.edges) {
    reverseEdges.set(edge.target_node_id, [
      ...(reverseEdges.get(edge.target_node_id) ?? []),
      edge.source_node_id,
    ]);
  }

  const visited = new Set<string>();
  const queue = [...(reverseEdges.get(targetNodeId) ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    const node = workflow.nodes.find((item) => item.id === nodeId);
    if (node?.type === "approval") {
      return true;
    }
    queue.push(...(reverseEdges.get(nodeId) ?? []));
  }
  return false;
}

function isAllowedErrorTarget(node: WorkflowNode) {
  return (
    node.type === "errorHandler" ||
    node.type === "approval" ||
    node.type === "wait" ||
    node.type === "legalAction"
  );
}

function isDataHandle(code: string) {
  return code.startsWith("data:input:") || code.startsWith("data:output:");
}

function isErrorHandle(code: string) {
  return code === "error_output" || code === "out:error";
}

export function handleAlias(code: string) {
  switch (code) {
    case "in:control":
      return "main_input";
    case "out:success":
      return "main_output";
    case "out:error":
      return "error_output";
    case "out:true":
      return "true_branch";
    case "out:false":
      return "false_branch";
    case "out:approved":
      return "approved";
    case "out:rejected":
      return "rejected";
    case "out:item":
      return "loop_item";
    case "out:done":
      return "after_loop";
    default:
      return code;
  }
}

export function handleLabel(code: string, fallback: string) {
  switch (handleAlias(code)) {
    case "main_input":
      return "Вход";
    case "main_output":
      return "Дальше";
    case "error_output":
      return "При ошибке";
    case "true_branch":
      return "Да";
    case "false_branch":
      return "Нет";
    case "approved":
      return "Согласовано";
    case "rejected":
      return "Отклонено";
    case "changes_requested":
      return "На доработку";
    case "loop_item":
      return "Для каждого";
    case "after_loop":
      return "После цикла";
    default:
      return fallback;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
