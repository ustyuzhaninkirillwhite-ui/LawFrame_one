import type {
  LexFrameWorkflow,
  LexFrameWorkflowStep,
  PermissionCode,
  Stage15UiStatus,
} from "@lexframe/contracts";

export type WorkflowCanvasKind =
  | "trigger"
  | "document"
  | "legal_analysis"
  | "generation"
  | "approval"
  | "delivery"
  | "storage"
  | "condition"
  | "custom";

export type WorkflowPolicyState =
  | "ok"
  | "external_action"
  | "requires_approval"
  | "missing_connection"
  | "blocked_by_policy";

export type AutomationBottomPanelMode = "chat";

export interface WorkflowCanvasPosition {
  readonly x: number;
  readonly y: number;
}

export interface WorkflowCanvasNode {
  readonly id: string;
  readonly kind: WorkflowCanvasKind;
  readonly title: string;
  readonly description: string;
  readonly prompt: string;
  readonly position: WorkflowCanvasPosition;
  readonly inputBindings: Record<string, string>;
  readonly outputBindings: Record<string, string>;
  readonly connectionBindings: Record<string, string>;
  readonly requiresApproval: boolean;
  readonly runtimeRequirement: string | null;
  readonly policyState: WorkflowPolicyState;
  readonly moduleCode?: string | null;
  readonly moduleSource?: "lexframe" | "activepieces" | "external" | "legacy";
  readonly moduleSourceLabel?: string | null;
  readonly moduleAvailability?: string | null;
  readonly moduleAvailabilityReason?: string | null;
}

export interface WorkflowCanvasEdge {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly condition: string | null;
}

export type AutomationComposerAttachmentType = "automation" | "document" | "file" | "source";

export interface AutomationComposerAttachment {
  readonly type: AutomationComposerAttachmentType;
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
}

export interface CanvasHudState {
  readonly status: Stage15UiStatus;
  readonly validationCount: number;
  readonly dirty: boolean;
  readonly canEdit: boolean;
  readonly canRun: boolean;
  readonly canOpenAdvanced: boolean;
}

export interface AutomationWorkbenchState {
  readonly selectedAutomationId: string | null;
  readonly selectedDraftId: string | null;
  readonly selectedNodeId: string | null;
  readonly status: Stage15UiStatus;
  readonly validationIssues: readonly CanvasValidationIssue[];
  readonly dirty: boolean;
  readonly conflict: boolean;
  readonly bottomPanelMode: AutomationBottomPanelMode;
}

export interface BlockPaletteItem {
  readonly kind: WorkflowCanvasKind;
  readonly label: string;
  readonly description: string;
  readonly defaultNode: Omit<WorkflowCanvasNode, "id" | "position">;
  readonly requiredPermissions: readonly PermissionCode[];
  readonly moduleCode?: string | null;
  readonly source?: "lexframe" | "activepieces" | "external" | "legacy";
  readonly sourceLabel?: string | null;
  readonly categoryLabel?: string | null;
  readonly availabilityStatus?: string | null;
  readonly disabledReason?: string | null;
  readonly tags?: readonly string[];
}

export type CanvasValidationCode =
  | "missing_trigger"
  | "missing_required_input"
  | "disconnected_node"
  | "cycle_detected"
  | "invalid_edge";

export interface CanvasValidationIssue {
  readonly code: CanvasValidationCode;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface WorkflowCanvasDraft {
  readonly nodes: readonly WorkflowCanvasNode[];
  readonly edges: readonly WorkflowCanvasEdge[];
}

const defaultNodeX = 520;
const defaultNodeY = 80;
const defaultNodeYGap = 170;

const triggerNode: WorkflowCanvasNode = {
  id: "trigger_manual",
  kind: "trigger",
  title: "Триггер",
  description: "Запуск сценария вручную из проекта или по подтвержденному событию.",
  prompt:
    "Опиши, как называется автоматизация, какие документы она принимает и при каком событии стартует.",
  position: {
    x: defaultNodeX,
    y: defaultNodeY,
  },
  inputBindings: {},
  outputBindings: {
    case: "$state.case",
  },
  connectionBindings: {},
  requiresApproval: false,
  runtimeRequirement: null,
  policyState: "ok",
};

export const legalBlockPalette: readonly BlockPaletteItem[] = [
  {
    kind: "custom",
    label: "Свой блок",
    description: "Пустой модуль, который можно назвать и настроить под собственную логику.",
    requiredPermissions: ["automation.edit"],
    defaultNode: {
      kind: "custom",
      title: "Свой блок",
      description: "Опишите, что должен сделать этот модуль.",
      prompt: "Опишите задачу модуля, входные данные, ожидаемый результат и ограничения.",
      inputBindings: {},
      outputBindings: {
        result: "$state.custom_result",
      },
      connectionBindings: {},
      requiresApproval: false,
      runtimeRequirement: null,
      policyState: "ok",
    },
  },
  {
    kind: "document",
    label: "Проверить документы",
    description: "Собрать и проверить материалы дела перед анализом.",
    requiredPermissions: ["automation.edit"],
    defaultNode: {
      kind: "document",
      title: "Проверить документы",
      description: "Проверить комплектность, формат и релевантность документов.",
      prompt:
        "Проверь входящие документы, найди недостающие материалы и подготовь структурированную выжимку.",
      inputBindings: {
        case: "$state.case",
      },
      outputBindings: {
        documents: "$state.documents",
      },
      connectionBindings: {},
      requiresApproval: false,
      runtimeRequirement: "@lexframe/document-intake",
      policyState: "ok",
    },
  },
  {
    kind: "legal_analysis",
    label: "Найти практику",
    description: "Найти судебную практику и выделить позицию по делу.",
    requiredPermissions: ["automation.edit", "legal_rag.use"],
    defaultNode: {
      kind: "legal_analysis",
      title: "Найти практику",
      description: "Подобрать релевантную судебную практику и аргументы.",
      prompt:
        "Найди практику по фактам дела, сгруппируй аргументы и укажи риски слабой позиции.",
      inputBindings: {
        documents: "$state.documents",
      },
      outputBindings: {
        practice: "$state.practice",
      },
      connectionBindings: {},
      requiresApproval: false,
      runtimeRequirement: "@lexframe/legal-search",
      policyState: "ok",
    },
  },
  {
    kind: "generation",
    label: "Подготовить претензию",
    description: "Сгенерировать юридический документ по материалам и практике.",
    requiredPermissions: ["automation.edit", "ai.workflow.create"],
    defaultNode: {
      kind: "generation",
      title: "Подготовить претензию",
      description: "Собрать проект претензии на основе фактов, практики и шаблона.",
      prompt:
        "Подготовь претензию в деловом стиле, сохрани структуру требований и явно отметь спорные факты.",
      inputBindings: {
        facts: "$state.analysis",
        practice: "$state.practice",
      },
      outputBindings: {
        draft: "$outputs.claim_document",
      },
      connectionBindings: {},
      requiresApproval: true,
      runtimeRequirement: "@lexframe/document-drafting",
      policyState: "requires_approval",
    },
  },
  {
    kind: "approval",
    label: "Согласование",
    description: "Передать результат на проверку юристу или ответственному.",
    requiredPermissions: ["automation.edit"],
    defaultNode: {
      kind: "approval",
      title: "Согласование",
      description: "Остановить сценарий до ручного подтверждения результата.",
      prompt:
        "Сформируй краткую карточку согласования: что изменилось, какие риски есть, что нужно подтвердить.",
      inputBindings: {
        draft: "$outputs.claim_document",
      },
      outputBindings: {
        approval: "$state.approval",
      },
      connectionBindings: {},
      requiresApproval: true,
      runtimeRequirement: null,
      policyState: "requires_approval",
    },
  },
  {
    kind: "delivery",
    label: "Отправить результат",
    description: "Подготовить внешнюю отправку или сохранить результат.",
    requiredPermissions: ["automation.edit", "automation.approve_external"],
    defaultNode: {
      kind: "delivery",
      title: "Отправить результат",
      description: "Подготовить доставку результата после явного подтверждения.",
      prompt:
        "Подготовь черновик доставки результата, но не отправляй его без отдельного подтверждения.",
      inputBindings: {
        approval: "$state.approval",
        document: "$outputs.claim_document",
      },
      outputBindings: {
        delivery: "$outputs.delivery_draft",
      },
      connectionBindings: {
        gmail: "$connections.gmail",
      },
      requiresApproval: true,
      runtimeRequirement: "gmail",
      policyState: "external_action",
    },
  },
];

export function createEmptyWorkflowCanvas(): WorkflowCanvasDraft {
  return {
    nodes: [],
    edges: [],
  };
}

export function createDefaultWorkflowCanvas(): WorkflowCanvasDraft {
  const nodes: readonly WorkflowCanvasNode[] = [
    triggerNode,
    createCanvasNode({
      id: "documents",
      kind: "document",
      title: "Документы",
      description: "Проверить комплект документов и подготовить их к анализу.",
      prompt:
        "Проверь комплект документов, выдели ключевые факты и отметь, чего не хватает для позиции.",
      inputBindings: {
        case: "$state.case",
      },
      outputBindings: {
        documents: "$state.documents",
      },
      connectionBindings: {},
      requiresApproval: false,
      runtimeRequirement: "@lexframe/document-intake",
      policyState: "ok",
    }, 1),
    createCanvasNode({
      id: "legal_analysis",
      kind: "legal_analysis",
      title: "Юридический анализ",
      description: "Извлечь факты, риски и применимую практику.",
      prompt:
        "Проанализируй факты, найди применимую практику, отдели сильные аргументы от рискованных.",
      inputBindings: {
        documents: "$state.documents",
      },
      outputBindings: {
        analysis: "$state.analysis",
      },
      connectionBindings: {},
      requiresApproval: false,
      runtimeRequirement: "@lexframe/document-analysis",
      policyState: "ok",
    }, 2),
    createCanvasNode({
      id: "generation",
      kind: "generation",
      title: "Генерация",
      description: "Подготовить проект юридического результата.",
      prompt:
        "Собери проект документа на основе анализа, сохрани юридическую структуру и понятный язык.",
      inputBindings: {
        analysis: "$state.analysis",
      },
      outputBindings: {
        draft: "$outputs.claim_document",
      },
      connectionBindings: {},
      requiresApproval: true,
      runtimeRequirement: "@lexframe/document-drafting",
      policyState: "requires_approval",
    }, 3),
    createCanvasNode({
      id: "approval",
      kind: "approval",
      title: "Согласование",
      description: "Остановить выполнение до ручного подтверждения.",
      prompt:
        "Покажи юристу краткое резюме результата, риски и кнопки подтверждения перед продолжением.",
      inputBindings: {
        draft: "$outputs.claim_document",
      },
      outputBindings: {
        approval: "$state.approval",
      },
      connectionBindings: {},
      requiresApproval: true,
      runtimeRequirement: null,
      policyState: "requires_approval",
    }, 4),
    createCanvasNode({
      id: "delivery",
      kind: "delivery",
      title: "Отправка/Сохранение",
      description: "Сохранить результат или подготовить внешнюю отправку.",
      prompt:
        "Подготовь результат к сохранению или доставке, но не запускай внешнее действие без подтверждения.",
      inputBindings: {
        approval: "$state.approval",
      },
      outputBindings: {
        result: "$outputs.delivery_draft",
      },
      connectionBindings: {
        gmail: "$connections.gmail",
      },
      requiresApproval: true,
      runtimeRequirement: "gmail",
      policyState: "external_action",
    }, 5),
  ];

  return {
    nodes,
    edges: buildLinearEdges(nodes),
  };
}

export function workflowToCanvas(workflow: LexFrameWorkflow): WorkflowCanvasDraft {
  const workflowNodes = workflow.steps.map((step, index) => stepToCanvasNode(step, index + 1));
  const nodes = [triggerNode, ...workflowNodes];
  const workflowEdges =
    workflow.transitions.length > 0
      ? workflow.transitions.map((transition) => ({
          id: `edge_${transition.from}_${transition.to}`,
          sourceNodeId: transition.from,
          targetNodeId: transition.to,
          condition: transition.condition,
        }))
      : buildLinearEdges(workflowNodes);

  const firstStep = workflowNodes[0];
  const triggerEdge = firstStep
    ? [
        {
          id: `edge_${triggerNode.id}_${firstStep.id}`,
          sourceNodeId: triggerNode.id,
          targetNodeId: firstStep.id,
          condition: "manual",
        },
      ]
    : [];

  return {
    nodes,
    edges: [...triggerEdge, ...workflowEdges],
  };
}

export function insertPaletteNodeAfter(
  draft: WorkflowCanvasDraft,
  afterNodeId: string,
  item: BlockPaletteItem,
  nodeId: string,
): WorkflowCanvasDraft {
  const nextEdge = draft.edges.find((edge) => edge.sourceNodeId === afterNodeId);
  const nextNodeId = nextEdge?.targetNodeId ?? null;
  const afterNode = draft.nodes.find((node) => node.id === afterNodeId);
  const nextIndex = nextNodeId
    ? draft.nodes.findIndex((node) => node.id === nextNodeId)
    : draft.nodes.findIndex((node) => node.id === afterNodeId) + 1;
  const insertIndex = nextIndex >= 0 ? nextIndex : draft.nodes.length;
  const newNode: WorkflowCanvasNode = {
    id: nodeId,
    position: {
      x: afterNode ? afterNode.position.x + 380 : defaultNodeX,
      y: afterNode ? afterNode.position.y + 28 : defaultNodeY,
    },
    ...item.defaultNode,
  };

  const nodes = [
    ...draft.nodes.slice(0, insertIndex),
    newNode,
    ...draft.nodes.slice(insertIndex),
  ];
  const edgesWithoutRewired = draft.edges.filter((edge) => edge.id !== nextEdge?.id);
  const edges: WorkflowCanvasEdge[] = [
    ...edgesWithoutRewired,
    {
      id: `edge_${afterNodeId}_${newNode.id}`,
      sourceNodeId: afterNodeId,
      targetNodeId: newNode.id,
      condition: "success",
    },
  ];

  if (nextNodeId) {
    edges.push({
      id: `edge_${newNode.id}_${nextNodeId}`,
      sourceNodeId: newNode.id,
      targetNodeId: nextNodeId,
      condition: nextEdge?.condition ?? "success",
    });
  }

  return {
    nodes,
    edges: sortEdgesForNodeOrder(nodes, edges),
  };
}

export function addPaletteNodeToCanvas(
  draft: WorkflowCanvasDraft,
  item: BlockPaletteItem,
  nodeId: string,
  position: WorkflowCanvasPosition,
): WorkflowCanvasDraft {
  return {
    ...draft,
    nodes: [
      ...draft.nodes,
      createWorkflowCanvasNodeFromPalette(item, nodeId, position),
    ],
  };
}

export function insertPaletteNodeOnEdge(
  draft: WorkflowCanvasDraft,
  edgeId: string,
  item: BlockPaletteItem,
  nodeId: string,
): WorkflowCanvasDraft {
  const edge = draft.edges.find((candidate) => candidate.id === edgeId);

  if (!edge) {
    return draft;
  }

  const sourceNode = draft.nodes.find((node) => node.id === edge.sourceNodeId);
  const targetNode = draft.nodes.find((node) => node.id === edge.targetNodeId);
  const newNode = createWorkflowCanvasNodeFromPalette(item, nodeId, {
    x: sourceNode && targetNode ? (sourceNode.position.x + targetNode.position.x) / 2 + 120 : defaultNodeX,
    y: sourceNode && targetNode ? (sourceNode.position.y + targetNode.position.y) / 2 : defaultNodeY,
  });

  return {
    nodes: [...draft.nodes, newNode],
    edges: [
      ...draft.edges.filter((candidate) => candidate.id !== edgeId),
      {
        id: `edge_${edge.sourceNodeId}_${newNode.id}`,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: newNode.id,
        condition: "success",
      },
      {
        id: `edge_${newNode.id}_${edge.targetNodeId}`,
        sourceNodeId: newNode.id,
        targetNodeId: edge.targetNodeId,
        condition: edge.condition ?? "success",
      },
    ],
  };
}

export function removeCanvasNode(
  draft: WorkflowCanvasDraft,
  nodeId: string,
): WorkflowCanvasDraft {
  return {
    nodes: draft.nodes.filter((node) => node.id !== nodeId),
    edges: draft.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
  };
}

export function removeCanvasEdge(
  draft: WorkflowCanvasDraft,
  edgeId: string,
): WorkflowCanvasDraft {
  return {
    ...draft,
    edges: draft.edges.filter((edge) => edge.id !== edgeId),
  };
}

export function updateCanvasEdge(
  draft: WorkflowCanvasDraft,
  edgeId: string,
  changes: Partial<Omit<WorkflowCanvasEdge, "id" | "sourceNodeId" | "targetNodeId">>,
): WorkflowCanvasDraft {
  return {
    ...draft,
    edges: draft.edges.map((edge) =>
      edge.id === edgeId
        ? {
            ...edge,
            ...changes,
          }
        : edge,
    ),
  };
}

export function createsCycleWithEdge(
  nodes: readonly WorkflowCanvasNode[],
  edges: readonly WorkflowCanvasEdge[],
  edge: WorkflowCanvasEdge,
): boolean {
  return hasCycle(nodes, [...edges, edge]);
}

export function updateCanvasNode(
  draft: WorkflowCanvasDraft,
  nodeId: string,
  changes: Partial<Omit<WorkflowCanvasNode, "id">>,
): WorkflowCanvasDraft {
  return {
    ...draft,
    nodes: draft.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            ...changes,
          }
        : node,
    ),
  };
}

export function updateCanvasNodePosition(
  draft: WorkflowCanvasDraft,
  nodeId: string,
  position: WorkflowCanvasPosition,
): WorkflowCanvasDraft {
  return updateCanvasNode(draft, nodeId, { position });
}

export function addComposerAttachment(
  attachments: readonly AutomationComposerAttachment[],
  attachment: AutomationComposerAttachment,
): readonly AutomationComposerAttachment[] {
  if (attachments.some((item) => item.type === attachment.type && item.id === attachment.id)) {
    return attachments;
  }

  return [...attachments, attachment];
}

export function removeComposerAttachment(
  attachments: readonly AutomationComposerAttachment[],
  attachment: Pick<AutomationComposerAttachment, "id" | "type">,
): readonly AutomationComposerAttachment[] {
  return attachments.filter(
    (item) => item.type !== attachment.type || item.id !== attachment.id,
  );
}

export function validateCanvasGraph(
  nodes: readonly WorkflowCanvasNode[],
  edges: readonly WorkflowCanvasEdge[],
): readonly CanvasValidationIssue[] {
  const issues: CanvasValidationIssue[] = [];

  if (nodes.length === 0) {
    return issues;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const triggerIds = nodes.filter((node) => node.kind === "trigger").map((node) => node.id);

  if (triggerIds.length !== 1) {
    issues.push({
      code: "missing_trigger",
      message: "В сценарии должен быть ровно один стартовый триггер.",
    });
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      issues.push({
        code: "invalid_edge",
        edgeId: edge.id,
        message: "Связь указывает на несуществующий блок.",
      });
    }
  }

  const incoming = countEdges(edges, "targetNodeId");
  const outgoing = countEdges(edges, "sourceNodeId");
  const terminalKinds = new Set<WorkflowCanvasKind>(["delivery", "storage"]);

  for (const node of nodes) {
    const inboundCount = incoming.get(node.id) ?? 0;
    const outboundCount = outgoing.get(node.id) ?? 0;

    if (node.kind !== "trigger" && inboundCount === 0) {
      issues.push({
        code: "disconnected_node",
        nodeId: node.id,
        message: `Блок "${node.title}" не подключен к основной цепочке.`,
      });
    }

    if (!terminalKinds.has(node.kind) && outboundCount === 0) {
      issues.push({
        code: "disconnected_node",
        nodeId: node.id,
        message: `После блока "${node.title}" нет следующего шага.`,
      });
    }

    if (node.kind !== "trigger" && Object.keys(node.inputBindings).length === 0) {
      issues.push({
        code: "missing_required_input",
        nodeId: node.id,
        message: `Для блока "${node.title}" не настроены входные данные.`,
      });
    }
  }

  if (hasCycle(nodes, edges)) {
    issues.push({
      code: "cycle_detected",
      message: "В сценарии обнаружен цикл. Builder v1 не запускает циклические сценарии.",
    });
  }

  return issues;
}

export function isBlockingCanvasIssue(issue: CanvasValidationIssue): boolean {
  return issue.code !== "disconnected_node";
}

export function deriveCanvasStatus(
  issues: readonly CanvasValidationIssue[],
  missingConnections: readonly string[],
  dirty: boolean,
  conflict: boolean,
): Stage15UiStatus {
  if (conflict) {
    return "conflict";
  }

  if (missingConnections.length > 0) {
    return "missing_connection";
  }

  if (issues.some(isBlockingCanvasIssue)) {
    return "validation_failed";
  }

  return dirty ? "draft" : "saved";
}

function createCanvasNode(
  node: Omit<WorkflowCanvasNode, "position">,
  index: number,
): WorkflowCanvasNode {
  return {
    ...node,
    position: {
      x: defaultNodeX,
      y: defaultNodeY + index * defaultNodeYGap,
    },
  };
}

function createWorkflowCanvasNodeFromPalette(
  item: BlockPaletteItem,
  nodeId: string,
  position: WorkflowCanvasPosition,
): WorkflowCanvasNode {
  return {
    id: nodeId,
    position,
    ...item.defaultNode,
  };
}

function buildLinearEdges(nodes: readonly WorkflowCanvasNode[]): readonly WorkflowCanvasEdge[] {
  return nodes.slice(0, -1).map((node, index) => {
    const next = nodes[index + 1]!;
    return {
      id: `edge_${node.id}_${next.id}`,
      sourceNodeId: node.id,
      targetNodeId: next.id,
      condition: index === 0 && node.kind === "trigger" ? "manual" : "success",
    };
  });
}

function stepToCanvasNode(step: LexFrameWorkflowStep, index: number): WorkflowCanvasNode {
  return createCanvasNode(
    {
      id: step.stepId,
      kind: mapStepKind(step),
      title: step.title,
      description: step.description,
      prompt: step.description,
      inputBindings: step.inputBindings,
      outputBindings: step.outputBindings,
      connectionBindings: step.runtime.requiredConnection
        ? {
            [step.runtime.requiredConnection]: `$connections.${step.runtime.requiredConnection}`,
          }
        : {},
      requiresApproval: step.requiresApproval,
      runtimeRequirement: step.runtime.requiredConnection ?? step.runtime.requiredPiece ?? null,
      policyState: derivePolicyState(step),
    },
    index,
  );
}

function mapStepKind(step: LexFrameWorkflowStep): WorkflowCanvasKind {
  if (step.kind === "ingest") {
    return "document";
  }

  if (step.kind === "analyze") {
    return "legal_analysis";
  }

  if (step.kind === "generate") {
    return "generation";
  }

  if (step.kind === "review") {
    return "approval";
  }

  if (step.kind === "deliver") {
    return "delivery";
  }

  return "storage";
}

function derivePolicyState(step: LexFrameWorkflowStep): WorkflowPolicyState {
  if (step.runtime.requiredConnection) {
    return "external_action";
  }

  if (step.requiresApproval) {
    return "requires_approval";
  }

  return "ok";
}

function countEdges(
  edges: readonly WorkflowCanvasEdge[],
  key: "sourceNodeId" | "targetNodeId",
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const edge of edges) {
    counts.set(edge[key], (counts.get(edge[key]) ?? 0) + 1);
  }

  return counts;
}

function hasCycle(
  nodes: readonly WorkflowCanvasNode[],
  edges: readonly WorkflowCanvasEdge[],
): boolean {
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (adjacency.has(edge.sourceNodeId)) {
      adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      if (visit(nextNodeId)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodes.some((node) => visit(node.id));
}

function sortEdgesForNodeOrder(
  nodes: readonly WorkflowCanvasNode[],
  edges: readonly WorkflowCanvasEdge[],
): readonly WorkflowCanvasEdge[] {
  const order = new Map(nodes.map((node, index) => [node.id, index]));

  return [...edges].sort(
    (left, right) =>
      (order.get(left.sourceNodeId) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.sourceNodeId) ?? Number.MAX_SAFE_INTEGER),
  );
}
