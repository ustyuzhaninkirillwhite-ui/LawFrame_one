export type JsonSchema = Record<string, unknown>;

export const canvasBlockKinds = [
  "trigger",
  "legal_action",
  "ai_action",
  "document_input",
  "condition",
  "loop",
  "merge",
  "approval",
  "wait",
  "delivery",
  "storage",
  "subworkflow",
  "error_handler",
  "note",
  "group",
  "end",
] as const;

export type CanvasBlockKind = (typeof canvasBlockKinds)[number];

export const canvasBlockCategories = [
  "start_trigger",
  "legal_action",
  "ai_action",
  "document_data_input",
  "condition_router",
  "loop_batch",
  "merge",
  "human_approval",
  "wait_pause",
  "delivery",
  "storage_artifact",
  "subworkflow",
  "error_handler",
  "note_group",
  "end_output",
] as const;

export type CanvasBlockCategory = (typeof canvasBlockCategories)[number];

export const canvasNodeTypes = [
  "trigger",
  "legalAction",
  "aiAction",
  "documentInput",
  "condition",
  "loop",
  "merge",
  "approval",
  "wait",
  "delivery",
  "storage",
  "subworkflow",
  "errorHandler",
  "note",
  "group",
  "end",
] as const;

export type CanvasNodeType = (typeof canvasNodeTypes)[number];

export const canvasEdgeTypes = [
  "control_flow",
  "data_flow",
  "approval_flow",
  "error_flow",
  "loop_flow",
  "annotation_link",
  "invalid",
] as const;

export type CanvasEdgeType = (typeof canvasEdgeTypes)[number];

export const legacyCanvasEdgeTypes = [
  "control",
  "data",
  "approval",
  "error",
  "loop",
  "annotation",
] as const;

export type LegacyCanvasEdgeType = (typeof legacyCanvasEdgeTypes)[number];

export const canvasHandleCodes = [
  "main_input",
  "main_output",
  "error_input",
  "error_output",
  "true_branch",
  "false_branch",
  "otherwise",
  "branch_1",
  "branch_2",
  "branch_3",
  "loop_items",
  "loop_item",
  "after_loop",
  "merge_a",
  "merge_b",
  "merge_c",
  "approved",
  "rejected",
  "changes_requested",
  "expired",
  "resumed",
  "cancelled",
  "sent",
  "saved",
  "retry",
  "fallback",
  "stop",
  "notify",
  "in:control",
  "out:success",
  "out:error",
  "out:true",
  "out:false",
  "out:approved",
  "out:rejected",
  "out:item",
  "out:done",
] as const;

export type CanvasDataHandleCode =
  | `data:input:${string}`
  | `data:output:${string}`;
export type CanvasHandleCode =
  | (typeof canvasHandleCodes)[number]
  | CanvasDataHandleCode;

export type CanvasDataClassification =
  | "public"
  | "workspace_internal"
  | "confidential"
  | "personal_data"
  | "legal_secret"
  | "client_material"
  | "secret"
  | "runtime_only"
  | "internal";

export type CanvasHandleKind =
  | "control_in"
  | "control_out"
  | "data_in"
  | "data_out"
  | "error_in"
  | "error_out"
  | "approval_approved_out"
  | "approval_rejected_out"
  | "condition_true_out"
  | "condition_false_out"
  | "loop_item_out"
  | "loop_done_out"
  | "merge_in"
  | "subworkflow_out";

export type CanvasRiskLevel = "low" | "medium" | "high" | "critical";

export interface CanvasHandleDefinition {
  readonly code: CanvasHandleCode;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly kind?: CanvasHandleKind;
  readonly edgeTypes: readonly CanvasEdgeType[];
  readonly dataType?: string | null;
  readonly dataFieldKey?: string | null;
  readonly required?: boolean;
}

export interface CanvasDataFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly classification?: CanvasDataClassification | null;
  readonly allowedSources?: readonly StepInputBindingSource["type"][];
  readonly options?: readonly string[];
}

export type StepInputBindingSource =
  | { readonly type: "workflow_input"; readonly inputKey: string }
  | { readonly type: "workflow_input"; readonly input_key: string }
  | {
      readonly type: "step_output";
      readonly sourceNodeId: string;
      readonly outputKey: string;
      readonly path?: string;
    }
  | {
      readonly type: "step_output";
      readonly node_id: string;
      readonly output_key: string;
      readonly path?: string;
    }
  | {
      readonly type: "document";
      readonly documentId: string;
      readonly documentVersionId?: string;
    }
  | {
      readonly type: "document";
      readonly document_id: string;
      readonly document_version_id?: string;
      readonly access_mode?: "reference_only" | "runtime_scoped_token";
    }
  | {
      readonly type: "profile_snapshot";
      readonly profileSnapshotId: string;
    }
  | {
      readonly type: "profile" | "profile_snapshot";
      readonly profile_id?: string;
      readonly profile_snapshot_id?: string;
    }
  | { readonly type: "template"; readonly template_id: string }
  | { readonly type: "manual_value" | "literal"; readonly value: unknown }
  | { readonly type: "system_value"; readonly key: string }
  | {
      readonly type: "connection";
      readonly connection_id: string;
      readonly display_name?: string;
    }
  | {
      readonly type: "secret_ref";
      readonly secret_ref: string;
      readonly display_name?: string;
    }
  | {
      readonly type: "expression";
      readonly expression_language: "lexframe_expression_v1";
      readonly expression: string;
    }
  | {
      readonly type: "transform";
      readonly transform_type: string;
      readonly source: StepInputBindingSource;
      readonly config?: Record<string, unknown>;
    };

export type StepInputBindingTransformType =
  | "none"
  | "map"
  | "filter"
  | "format"
  | "join";

export interface StepInputBinding {
  readonly id?: string;
  readonly target?: {
    readonly node_id: string;
    readonly input_key: string;
  };
  readonly targetNodeId?: string;
  readonly targetInputKey?: string;
  readonly source: StepInputBindingSource;
  readonly selection?: Record<string, unknown>;
  readonly transform?: {
    readonly type: StepInputBindingTransformType | string;
    readonly config?: Record<string, unknown>;
  };
  readonly validation_state?: "valid" | "warning" | "invalid" | "stale" | "policy_blocked";
  readonly created_by?: "user" | "ai_assistant" | "system";
  readonly created_at?: string;
}

export interface CanvasValidationRule {
  readonly code: string;
  readonly category?:
    | "structure"
    | "schema"
    | "type_compatibility"
    | "semantic"
    | "security"
    | "policy"
    | "runtime"
    | "ux"
    | "performance";
  readonly severity: "info" | "error" | "warning" | "policy_block";
  readonly scope:
    | "block"
    | "connection"
    | "binding"
    | "workflow"
    | "runtime"
    | "node"
    | "edge";
  readonly blocks?: readonly (
    | "save"
    | "test_step"
    | "test_flow"
    | "compile"
    | "publish"
    | "run"
    | "sync"
  )[];
  readonly message: string;
}

export interface CanvasBlockPolicy {
  readonly riskLevel: CanvasRiskLevel;
  readonly dataClassification: CanvasDataClassification;
  readonly requiresApproval: boolean;
  readonly isExternalAction: boolean;
  readonly canUseAi: boolean;
  readonly canUseDocuments: boolean;
  readonly canRunInDryRun: boolean;
  readonly canBePublishedAsTemplate: boolean;
  readonly allowedRoles: readonly string[];
  readonly requiredPermissions: readonly string[];
}

export interface CanvasRuntimeMapping {
  readonly provider:
    | "activepieces"
    | "internal_worker"
    | "ai_gateway"
    | "manual"
    | "none";
  readonly activepiecesPiece?: string;
  readonly activepiecesAction?: string;
  readonly internalRoute?: string;
  readonly supportsStepTest: boolean;
  readonly supportsPartialExecution: boolean;
  readonly supportsPinnedData: boolean;
  readonly notes: readonly string[];
}

export type CanvasInspectorTab =
  | "overview"
  | "inputs"
  | "settings"
  | "data"
  | "connections"
  | "test"
  | "outputs"
  | "errors"
  | "policies"
  | "debug";

export interface CanvasBlockUiSchema {
  readonly paletteCategory: string;
  readonly icon: string;
  readonly userFacingLevel: "basic" | "advanced" | "admin";
  readonly card: {
    readonly needs: readonly string[];
    readonly creates: readonly string[];
    readonly badges: readonly string[];
  };
  readonly inspectorTabs: readonly CanvasInspectorTab[];
  readonly hints: readonly string[];
}

export interface CanvasBlockDefinition {
  readonly code: string;
  readonly kind: CanvasBlockKind;
  readonly nodeType: CanvasNodeType;
  readonly category: CanvasBlockCategory;
  readonly displayName: string;
  readonly shortDescription: string;
  readonly longDescription?: string;
  readonly mvp: boolean;
  readonly enabled: boolean;
  readonly disabledReason?: string | null;
  readonly moduleCode?: string | null;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly configSchema: JsonSchema;
  readonly inputs: readonly CanvasDataFieldDefinition[];
  readonly outputs: readonly CanvasDataFieldDefinition[];
  readonly handles: readonly CanvasHandleDefinition[];
  readonly defaultConfig: Record<string, unknown>;
  readonly policies: CanvasBlockPolicy;
  readonly runtime: CanvasRuntimeMapping;
  readonly uiSchema: CanvasBlockUiSchema;
  readonly validationRules: readonly CanvasValidationRule[];
}

export interface CanvasConnectionRule {
  readonly sourceKind: CanvasBlockKind;
  readonly sourceHandle: CanvasHandleCode;
  readonly targetKind: CanvasBlockKind;
  readonly targetHandle: CanvasHandleCode;
  readonly edgeType: CanvasEdgeType;
  readonly allowed: boolean;
  readonly reasonIfDenied?: string;
  readonly requiresApprovalPath?: boolean;
}

export interface CanvasPolicyEvaluation {
  readonly status: "allowed" | "warning" | "blocked";
  readonly warnings: readonly CanvasPolicyMessage[];
  readonly blocks: readonly CanvasPolicyMessage[];
}

export interface CanvasPolicyMessage {
  readonly code: string;
  readonly message: string;
  readonly affectedBlockCode?: string;
}

export interface CanvasBlockValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CanvasPolicyMessage[];
  readonly policy: CanvasPolicyEvaluation;
}

export interface CanvasConnectionValidationResult {
  readonly allowed: boolean;
  readonly edgeType: CanvasEdgeType;
  readonly reason?: string | null;
  readonly policy: CanvasPolicyEvaluation;
}

const input = (
  code: CanvasHandleCode = "main_input",
  label = "Вход",
  edgeTypes: readonly CanvasEdgeType[] = ["control_flow"],
): CanvasHandleDefinition => ({
  code,
  label,
  direction: "input",
  edgeTypes,
});

const output = (
  code: CanvasHandleCode = "main_output",
  label = "Далее",
  edgeTypes: readonly CanvasEdgeType[] = ["control_flow"],
): CanvasHandleDefinition => ({
  code,
  label,
  direction: "output",
  edgeTypes,
});

const objectSchema = (properties: Record<string, unknown> = {}): JsonSchema => ({
  type: "object",
  properties,
  additionalProperties: true,
});

const arraySchema = (items: JsonSchema = { type: "object" }): JsonSchema => ({
  type: "array",
  items,
});

const baseTabs: readonly CanvasInspectorTab[] = [
  "overview",
  "inputs",
  "settings",
  "data",
  "connections",
  "test",
  "outputs",
  "errors",
  "policies",
];

const categoryLabels: Record<CanvasBlockCategory, string> = {
  start_trigger: "Старт",
  legal_action: "Юридические действия",
  ai_action: "AI действия",
  document_data_input: "Документы и данные",
  condition_router: "Условия",
  loop_batch: "Циклы",
  merge: "Объединение",
  human_approval: "Согласование",
  wait_pause: "Ожидание",
  delivery: "Доставка",
  storage_artifact: "Сохранение результата",
  subworkflow: "Под-сценарии",
  error_handler: "Ошибки",
  note_group: "Заметки",
  end_output: "Завершение",
};

export const canvasBlockCategoryDetails: readonly {
  readonly category: CanvasBlockCategory;
  readonly label: string;
  readonly description: string;
}[] = canvasBlockCategories.map((category) => ({
  category,
  label: categoryLabels[category],
  description:
    category === "start_trigger"
      ? "Определяет, когда и откуда запускается сценарий."
      : category === "delivery"
        ? "Выполняет внешнюю или внутреннюю доставку только через policy и approval."
        : `Группа no-code блоков Canvas: ${categoryLabels[category]}.`,
}));

function policy(inputPolicy: Partial<CanvasBlockPolicy>): CanvasBlockPolicy {
  return {
    riskLevel: inputPolicy.riskLevel ?? "medium",
    dataClassification: inputPolicy.dataClassification ?? "workspace_internal",
    requiresApproval: inputPolicy.requiresApproval ?? false,
    isExternalAction: inputPolicy.isExternalAction ?? false,
    canUseAi: inputPolicy.canUseAi ?? false,
    canUseDocuments: inputPolicy.canUseDocuments ?? false,
    canRunInDryRun: inputPolicy.canRunInDryRun ?? true,
    canBePublishedAsTemplate: inputPolicy.canBePublishedAsTemplate ?? true,
    allowedRoles: inputPolicy.allowedRoles ?? [
      "owner",
      "admin",
      "lawyer",
      "assistant",
    ],
    requiredPermissions: inputPolicy.requiredPermissions ?? ["canvas.edit"],
  };
}

function runtime(inputRuntime: Partial<CanvasRuntimeMapping>): CanvasRuntimeMapping {
  return {
    provider: inputRuntime.provider ?? "internal_worker",
    activepiecesPiece: inputRuntime.activepiecesPiece,
    activepiecesAction: inputRuntime.activepiecesAction,
    internalRoute: inputRuntime.internalRoute,
    supportsStepTest: inputRuntime.supportsStepTest ?? true,
    supportsPartialExecution: inputRuntime.supportsPartialExecution ?? true,
    supportsPinnedData: inputRuntime.supportsPinnedData ?? true,
    notes: inputRuntime.notes ?? [],
  };
}

function ui(inputUi: {
  readonly paletteCategory: string;
  readonly icon: string;
  readonly needs?: readonly string[];
  readonly creates?: readonly string[];
  readonly badges?: readonly string[];
  readonly inspectorTabs?: readonly CanvasInspectorTab[];
  readonly hints?: readonly string[];
  readonly userFacingLevel?: "basic" | "advanced" | "admin";
}): CanvasBlockUiSchema {
  return {
    paletteCategory: inputUi.paletteCategory,
    icon: inputUi.icon,
    userFacingLevel: inputUi.userFacingLevel ?? "basic",
    card: {
      needs: inputUi.needs ?? [],
      creates: inputUi.creates ?? [],
      badges: inputUi.badges ?? [],
    },
    inspectorTabs: inputUi.inspectorTabs ?? baseTabs,
    hints: inputUi.hints ?? [],
  };
}

function field(
  key: string,
  label: string,
  type: string,
  required = true,
  classification: CanvasDataClassification | null = "workspace_internal",
  allowedSources?: readonly StepInputBindingSource["type"][],
): CanvasDataFieldDefinition {
  return { key, label, type, required, classification, allowedSources };
}

function definition(
  block: Omit<CanvasBlockDefinition, "nodeType"> & {
    readonly nodeType?: CanvasNodeType;
  },
): CanvasBlockDefinition {
  return {
    ...block,
    nodeType: block.nodeType ?? nodeTypeForBlockKind(block.kind),
  };
}

export function nodeTypeForBlockKind(kind: CanvasBlockKind): CanvasNodeType {
  switch (kind) {
    case "legal_action":
      return "legalAction";
    case "ai_action":
      return "aiAction";
    case "document_input":
      return "documentInput";
    case "error_handler":
      return "errorHandler";
    default:
      return kind;
  }
}

export const canvasBlockDefinitions: readonly CanvasBlockDefinition[] = [
  definition({
    code: "manual_start",
    kind: "trigger",
    category: "start_trigger",
    displayName: "Запуск вручную",
    shortDescription: "Пользователь запускает сценарий из LexFrame.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema({
      workflow_inputs: arraySchema(),
    }),
    outputSchema: objectSchema({
      run_context: { type: "object" },
      input_documents: { type: "array" },
      profile_snapshot: { type: "object" },
    }),
    configSchema: objectSchema(),
    inputs: [],
    outputs: [
      field("run_context", "Контекст запуска", "run_context"),
      field("input_documents", "Выбранные документы", "document[]", false, "client_material"),
      field("profile_snapshot", "Профиль работы", "profile_snapshot", false),
    ],
    handles: [output()],
    defaultConfig: {},
    policies: policy({ riskLevel: "low", canBePublishedAsTemplate: true }),
    runtime: runtime({
      provider: "activepieces",
      activepiecesPiece: "@lexframe/trigger",
      activepiecesAction: "manual_start",
      notes: ["Trigger may be projected to Activepieces webhook trigger."],
    }),
    uiSchema: ui({
      paletteCategory: "Старт",
      icon: "Play",
      creates: ["Контекст запуска", "Входы сценария"],
      badges: ["manual"],
    }),
    validationRules: [],
  }),
  definition({
    code: "select_documents",
    kind: "document_input",
    category: "document_data_input",
    displayName: "Выбрать материалы дела",
    shortDescription: "Запрашивает у пользователя документы для сценария.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({
      selected_documents: { type: "array" },
    }),
    configSchema: objectSchema({
      min_documents: { type: "number" },
      max_documents: { type: "number" },
    }),
    inputs: [],
    outputs: [
      field("selected_documents", "Выбранные документы", "document[]", true, "client_material"),
    ],
    handles: [input(), output()],
    defaultConfig: { min_documents: 1, max_documents: 20 },
    policies: policy({
      riskLevel: "medium",
      dataClassification: "client_material",
      canUseDocuments: true,
    }),
    runtime: runtime({
      provider: "internal_worker",
      internalRoute: "documents.resolve_selection",
      notes: ["Resolved references are passed to runtime, not raw files."],
    }),
    uiSchema: ui({
      paletteCategory: "Документы и данные",
      icon: "Files",
      needs: ["Выбор пользователя"],
      creates: ["Список документов"],
      badges: ["documents"],
    }),
    validationRules: [{ code: "required_input", severity: "error", scope: "block", message: "Document selection must be configured." }],
  }),
  definition({
    code: "select_profile",
    kind: "document_input",
    category: "document_data_input",
    displayName: "Выбрать профиль работы",
    shortDescription: "Фиксирует профиль юридической работы для запуска.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({
      profile_snapshot: { type: "object" },
    }),
    configSchema: objectSchema(),
    inputs: [],
    outputs: [field("profile_snapshot", "Профиль работы", "profile_snapshot")],
    handles: [input(), output()],
    defaultConfig: {},
    policies: policy({ riskLevel: "low" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "profiles.snapshot" }),
    uiSchema: ui({
      paletteCategory: "Шаблоны и профиль",
      icon: "UserRound",
      creates: ["Профиль работы"],
    }),
    validationRules: [],
  }),
  definition({
    code: "case_law_search",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Найти судебную практику",
    shortDescription: "Подбирает релевантную практику по вопросу и профилю.",
    mvp: true,
    enabled: true,
    moduleCode: "case_law_search",
    inputSchema: objectSchema({
      query: { type: "string" },
      profile_snapshot: { type: "object" },
    }),
    outputSchema: objectSchema({
      selected_sources: { type: "array" },
      search_report: { type: "object" },
    }),
    configSchema: objectSchema({ limit: { type: "number" } }),
    inputs: [
      field("query", "Правовой вопрос", "string", true, "workspace_internal", ["workflow_input", "literal", "step_output"]),
      field("profile_snapshot", "Профиль работы", "profile_snapshot", false, "workspace_internal", ["workflow_input", "step_output", "profile_snapshot"]),
    ],
    outputs: [
      field("selected_sources", "Подобранная практика", "legal_source[]"),
      field("search_report", "Отчет поиска", "search_report", false),
    ],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: { limit: 10 },
    policies: policy({ riskLevel: "medium" }),
    runtime: runtime({
      provider: "internal_worker",
      internalRoute: "legal_search.query",
      activepiecesPiece: "@lexframe/legal-search",
      activepiecesAction: "case_law_search",
    }),
    uiSchema: ui({
      paletteCategory: "Правовой поиск",
      icon: "Search",
      needs: ["Правовой вопрос", "Профиль"],
      creates: ["Судебная практика"],
    }),
    validationRules: [{ code: "required_input", severity: "error", scope: "binding", message: "Legal search query is required." }],
  }),
  definition({
    code: "case_material_analysis",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Проанализировать материалы дела",
    shortDescription: "Извлекает факты, риски и недостающие данные.",
    mvp: true,
    enabled: true,
    moduleCode: "case_material_analysis",
    inputSchema: objectSchema({ documents: { type: "array" } }),
    outputSchema: objectSchema({
      facts: { type: "object" },
      risks: { type: "object" },
      missing_data: { type: "array" },
    }),
    configSchema: objectSchema(),
    inputs: [
      field("documents", "Документы для анализа", "document[]", true, "client_material", ["workflow_input", "step_output", "document"]),
      field("profile_snapshot", "Профиль работы", "profile_snapshot", false, "workspace_internal", ["workflow_input", "step_output", "profile_snapshot"]),
    ],
    outputs: [
      field("facts", "Факты дела", "legal_facts", true, "confidential"),
      field("risks", "Риски", "risk_report", false, "confidential"),
      field("missing_data", "Недостающие данные", "checklist", false, "workspace_internal"),
    ],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: {},
    policies: policy({
      riskLevel: "high",
      dataClassification: "client_material",
      canUseDocuments: true,
      canUseAi: true,
    }),
    runtime: runtime({
      provider: "ai_gateway",
      internalRoute: "ai_gateway.case_material_analysis",
      notes: ["AI route is resolved by workspace policy; provider keys are never exposed."],
    }),
    uiSchema: ui({
      paletteCategory: "Анализ материалов",
      icon: "Bot",
      needs: ["Документы дела"],
      creates: ["Факты", "Риски", "Недостающие данные"],
      badges: ["AI gateway", "client material"],
    }),
    validationRules: [
      { code: "no_direct_ai_provider", severity: "policy_block", scope: "runtime", message: "AI actions must route through LexFrame AI Gateway." },
    ],
  }),
  definition({
    code: "pretrial_claim_draft",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Подготовить претензию",
    shortDescription: "Создает проект претензии на основе фактов, практики и шаблона.",
    mvp: true,
    enabled: true,
    moduleCode: "pretrial_claim_draft",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ draft_document: { type: "object" } }),
    configSchema: objectSchema(),
    inputs: [
      field("facts", "Факты дела", "legal_facts", true, "confidential", ["step_output"]),
      field("legal_sources", "Подобранная практика", "legal_source[]", false, "workspace_internal", ["step_output"]),
      field("template_id", "Шаблон претензии", "document_template", true, "workspace_internal", ["workflow_input", "literal"]),
      field("profile_snapshot", "Профиль работы", "profile_snapshot", true, "workspace_internal", ["workflow_input", "step_output", "profile_snapshot"]),
    ],
    outputs: [
      field("draft_document", "Проект претензии", "document_draft", true, "confidential"),
      field("missing_data", "Недостающие данные", "checklist", false),
      field("validation_report", "Отчет проверки", "validation_report", false),
    ],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: {},
    policies: policy({
      riskLevel: "high",
      dataClassification: "confidential",
      requiresApproval: true,
      canUseDocuments: true,
      canUseAi: true,
    }),
    runtime: runtime({
      provider: "internal_worker",
      internalRoute: "document_generation.pretrial_claim",
      activepiecesPiece: "@lexframe/document-generation",
      activepiecesAction: "pretrial_claim_draft",
    }),
    uiSchema: ui({
      paletteCategory: "Подготовка документов",
      icon: "FileText",
      needs: ["Факты", "Шаблон", "Профиль"],
      creates: ["Проект претензии"],
      badges: ["high risk", "approval"],
      hints: ["Добавить анализ материалов", "Добавить поиск судебной практики", "Выбрать шаблон"],
    }),
    validationRules: [
      { code: "required_input", severity: "error", scope: "binding", message: "Facts, template and profile are required for pretrial claim draft." },
    ],
  }),
  definition({
    code: "document_template_apply",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Применить шаблон",
    shortDescription: "Приводит документ к выбранному шаблону.",
    mvp: true,
    enabled: true,
    moduleCode: "document_template_apply",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ templated_document: { type: "object" } }),
    configSchema: objectSchema(),
    inputs: [
      field("draft_document", "Проект документа", "document_draft", true, "confidential", ["step_output"]),
      field("template_id", "Шаблон", "document_template", true, "workspace_internal", ["workflow_input", "literal"]),
    ],
    outputs: [field("templated_document", "Документ по шаблону", "document_draft", true, "confidential")],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: {},
    policies: policy({ riskLevel: "medium", dataClassification: "confidential", canUseDocuments: true }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "document_templates.apply" }),
    uiSchema: ui({
      paletteCategory: "Шаблоны и профиль",
      icon: "PanelTop",
      needs: ["Проект документа", "Шаблон"],
      creates: ["Документ по шаблону"],
    }),
    validationRules: [{ code: "required_input", severity: "error", scope: "binding", message: "Template and draft document are required." }],
  }),
  definition({
    code: "document_structure_check",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Проверить структуру документа",
    shortDescription: "Проверяет документ и формирует отчет замечаний.",
    mvp: true,
    enabled: true,
    moduleCode: "document_structure_check",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ validation_report: { type: "object" } }),
    configSchema: objectSchema(),
    inputs: [field("document", "Документ", "document_draft", true, "confidential", ["step_output", "document"])],
    outputs: [
      field("validation_report", "Отчет проверки", "validation_report"),
      field("has_errors", "Есть ошибки", "boolean", false),
    ],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: {},
    policies: policy({ riskLevel: "medium", dataClassification: "confidential", canUseDocuments: true }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "document_validation.structure_check" }),
    uiSchema: ui({
      paletteCategory: "Проверка документов",
      icon: "CheckSquare",
      needs: ["Документ"],
      creates: ["Отчет проверки"],
    }),
    validationRules: [],
  }),
  definition({
    code: "condition",
    kind: "condition",
    category: "condition_router",
    displayName: "Условие",
    shortDescription: "Ветвит сценарий по формальному условию.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema({ value: true }),
    outputSchema: objectSchema({ true_branch: { type: "boolean" }, false_branch: { type: "boolean" } }),
    configSchema: objectSchema({
      operator: { type: "string" },
      fallback: { type: "string" },
    }),
    inputs: [field("value", "Что проверяем", "any", true, "workspace_internal", ["workflow_input", "step_output", "literal"])],
    outputs: [],
    handles: [
      input(),
      output("true_branch", "Да"),
      output("false_branch", "Нет"),
      output("otherwise", "Иначе"),
    ],
    defaultConfig: { operator: "field_exists" },
    policies: policy({ riskLevel: "low" }),
    runtime: runtime({ provider: "activepieces", activepiecesPiece: "@activepieces/router", activepiecesAction: "branch" }),
    uiSchema: ui({
      paletteCategory: "Условия",
      icon: "GitBranch",
      needs: ["Данные для проверки"],
      creates: ["Ветки Да/Нет"],
      inspectorTabs: [...baseTabs, "debug"],
      hints: ["Добавить ветку Иначе"],
    }),
    validationRules: [
      { code: "router_requires_fallback", severity: "warning", scope: "connection", message: "Router should have fallback otherwise branch." },
    ],
  }),
  definition({
    code: "human_approval",
    kind: "approval",
    category: "human_approval",
    displayName: "Согласовать",
    shortDescription: "Создает задачу согласования и ждет решение.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ decision: { type: "string" }, comment: { type: "string" } }),
    configSchema: objectSchema({ approver_role: { type: "string" }, timeout_hours: { type: "number" } }),
    inputs: [
      field("approval_object", "Что согласовать", "document | delivery_request | ai_result | workflow_change", true, "confidential", ["step_output"]),
      field("risk_report", "Риск", "risk_report", false, "confidential", ["step_output"]),
    ],
    outputs: [
      field("decision", "Решение", "approval_decision"),
      field("comment", "Комментарий", "string", false),
    ],
    handles: [
      input(),
      output("approved", "Одобрено", ["approval_flow"]),
      output("rejected", "Отклонено", ["approval_flow"]),
      output("changes_requested", "На доработку", ["approval_flow"]),
      output("expired", "Истек срок", ["approval_flow"]),
    ],
    defaultConfig: { approver_role: "senior_lawyer", timeout_hours: 72 },
    policies: policy({ riskLevel: "high", dataClassification: "confidential", requiresApproval: false, canRunInDryRun: true }),
    runtime: runtime({
      provider: "manual",
      internalRoute: "approvals.create_task",
      supportsPartialExecution: false,
      supportsPinnedData: false,
      notes: ["LexFrame backend owns approval business state and audit."],
    }),
    uiSchema: ui({
      paletteCategory: "Согласование",
      icon: "CheckCircle",
      needs: ["Документ или действие"],
      creates: ["Решение согласования"],
      badges: ["manual gate"],
    }),
    validationRules: [],
  }),
  definition({
    code: "save_to_documents",
    kind: "storage",
    category: "storage_artifact",
    displayName: "Сохранить документ",
    shortDescription: "Сохраняет результат как управляемый документ или артефакт.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ document_id: { type: "string" }, document_version_id: { type: "string" } }),
    configSchema: objectSchema({ destination: { type: "string" } }),
    inputs: [field("artifact", "Что сохранить", "document_draft | file | report", true, "confidential", ["step_output"])],
    outputs: [
      field("document_id", "Документ", "document_id", true, "workspace_internal"),
      field("document_version_id", "Версия документа", "document_version_id", true, "workspace_internal"),
    ],
    handles: [input(), output("saved", "Сохранено")],
    defaultConfig: { destination: "project_documents" },
    policies: policy({ riskLevel: "medium", dataClassification: "confidential", canUseDocuments: true }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "documents.save_artifact" }),
    uiSchema: ui({
      paletteCategory: "Сохранение результата",
      icon: "Archive",
      needs: ["Артефакт"],
      creates: ["Документ LexFrame"],
    }),
    validationRules: [
      { code: "no_signed_url_output", severity: "policy_block", scope: "runtime", message: "Signed URLs must not be stored as workflow outputs." },
    ],
  }),
  definition({
    code: "email_delivery",
    kind: "delivery",
    category: "delivery",
    displayName: "Отправить e-mail",
    shortDescription: "Готовит и отправляет внешнее письмо через LexFrame delivery service.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ delivery_request: { type: "object" }, delivery_status: { type: "object" } }),
    configSchema: objectSchema({ channel: { const: "email" } }),
    inputs: [
      field("recipient", "Получатель", "recipient", true, "personal_data", ["workflow_input", "literal", "step_output"]),
      field("subject", "Тема", "string", true, "workspace_internal", ["literal", "step_output"]),
      field("body", "Текст сообщения", "string", true, "confidential", ["literal", "step_output"]),
      field("attachments", "Вложения", "document[]", false, "confidential", ["step_output", "document"]),
      field("approval_decision", "Решение согласования", "approval_decision", true, "workspace_internal", ["step_output"]),
    ],
    outputs: [
      field("delivery_request", "Заявка на доставку", "delivery_request", true, "confidential"),
      field("delivery_status", "Статус отправки", "delivery_status", true, "workspace_internal"),
    ],
    handles: [input(), output("sent", "Отправлено"), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: { channel: "email", preview_required: true },
    policies: policy({
      riskLevel: "critical",
      dataClassification: "confidential",
      requiresApproval: true,
      isExternalAction: true,
      canRunInDryRun: false,
      requiredPermissions: ["canvas.edit", "automation.run"],
    }),
    runtime: runtime({
      provider: "internal_worker",
      internalRoute: "delivery.email",
      supportsStepTest: true,
      supportsPartialExecution: false,
      notes: ["Dry-run may preview only; actual send requires approval."],
    }),
    uiSchema: ui({
      paletteCategory: "Доставка",
      icon: "Mail",
      needs: ["Получатель", "Текст", "Approval"],
      creates: ["Статус доставки"],
      badges: ["external", "approval required"],
      hints: ["Добавить согласование документа", "Добавить preview письма"],
    }),
    validationRules: [
      { code: "external_delivery_requires_approval", severity: "policy_block", scope: "connection", message: "External delivery requires approval before send." },
    ],
  }),
  definition({
    code: "error_handler",
    kind: "error_handler",
    category: "error_handler",
    displayName: "Обработать ошибку",
    shortDescription: "Задает retry, fallback, notification или stop при ошибке.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema({ error: { type: "object" } }),
    outputSchema: objectSchema({ handled: { type: "boolean" }, fallback_result: { type: "object" } }),
    configSchema: objectSchema({ retry_limit: { type: "number" }, action: { type: "string" } }),
    inputs: [field("error", "Ошибка", "error_event", true, "workspace_internal", ["step_output"])],
    outputs: [
      field("handled", "Ошибка обработана", "boolean"),
      field("fallback_result", "Результат fallback", "object", false),
    ],
    handles: [
      input("error_input", "Ошибка", ["error_flow"]),
      output("retry", "Повторить"),
      output("fallback", "Fallback"),
      output("stop", "Остановить"),
      output("notify", "Уведомить"),
    ],
    defaultConfig: { retry_limit: 2, action: "notify_user" },
    policies: policy({ riskLevel: "medium" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "runtime.error_handler" }),
    uiSchema: ui({
      paletteCategory: "Ошибки",
      icon: "TriangleAlert",
      needs: ["Ошибка"],
      creates: ["Решение обработки"],
    }),
    validationRules: [],
  }),
  definition({
    code: "end_success",
    kind: "end",
    category: "end_output",
    displayName: "Завершить сценарий",
    shortDescription: "Фиксирует успешное завершение и workflow-level outputs.",
    mvp: true,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema(),
    configSchema: objectSchema({ status: { const: "success" } }),
    inputs: [field("final_artifacts", "Итоговые результаты", "artifact[]", false, "workspace_internal", ["step_output"])],
    outputs: [],
    handles: [input()],
    defaultConfig: { status: "success" },
    policies: policy({ riskLevel: "low", canRunInDryRun: true }),
    runtime: runtime({ provider: "none", supportsStepTest: false, supportsPartialExecution: false, supportsPinnedData: false }),
    uiSchema: ui({
      paletteCategory: "Завершение",
      icon: "CircleStop",
      needs: ["Итоговые результаты"],
      creates: ["Workflow output"],
    }),
    validationRules: [
      { code: "end_has_no_outgoing", severity: "error", scope: "connection", message: "End block cannot have outgoing control-flow edges." },
    ],
  }),
  definition({
    code: "ai_extract_facts",
    kind: "ai_action",
    category: "ai_action",
    displayName: "AI-извлечение фактов",
    shortDescription: "Извлекает факты из документов через AI gateway.",
    mvp: false,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ facts: { type: "object" } }),
    configSchema: objectSchema(),
    inputs: [field("documents", "Документы", "document[]", true, "client_material", ["step_output", "document"])],
    outputs: [field("facts", "Факты", "legal_facts", true, "confidential")],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: {},
    policies: policy({ riskLevel: "high", dataClassification: "client_material", canUseAi: true, canUseDocuments: true }),
    runtime: runtime({ provider: "ai_gateway", internalRoute: "ai_gateway.extract_facts" }),
    uiSchema: ui({
      paletteCategory: "AI действия",
      icon: "Sparkles",
      needs: ["Документы"],
      creates: ["Факты"],
      badges: ["AI gateway"],
    }),
    validationRules: [{ code: "no_direct_ai_provider", severity: "policy_block", scope: "runtime", message: "AI provider is resolved only by backend policy." }],
  }),
  definition({
    code: "loop_batch",
    kind: "loop",
    category: "loop_batch",
    displayName: "Для каждого элемента",
    shortDescription: "Обрабатывает массив документов, источников или контрагентов.",
    mvp: false,
    enabled: false,
    disabledReason: "Flow-control body editing is planned after the MVP block registry.",
    inputSchema: objectSchema({ items: { type: "array" } }),
    outputSchema: objectSchema({ results: { type: "array" }, failed_items: { type: "array" } }),
    configSchema: objectSchema({ max_items: { type: "number" }, mode: { enum: ["sequential", "parallel"] } }),
    inputs: [field("items", "Список объектов", "array", true, "workspace_internal", ["step_output", "workflow_input"])],
    outputs: [field("results", "Результаты", "array"), field("failed_items", "Ошибочные элементы", "array", false)],
    handles: [input(), output("loop_item", "Элемент", ["loop_flow"]), output("after_loop", "После цикла"), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: { max_items: 50, mode: "sequential" },
    policies: policy({ riskLevel: "medium" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "runtime.loop_batch" }),
    uiSchema: ui({ paletteCategory: "Циклы", icon: "Repeat2", needs: ["Массив"], creates: ["Результаты"] }),
    validationRules: [{ code: "loop_requires_limit", severity: "error", scope: "block", message: "Loop must define max item limit." }],
  }),
  definition({
    code: "merge_results",
    kind: "merge",
    category: "merge",
    displayName: "Объединить ветки",
    shortDescription: "Собирает результаты нескольких веток.",
    mvp: false,
    enabled: false,
    disabledReason: "Merge UI is described in 16.2 and enabled with branching work.",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ merged_context: { type: "object" } }),
    configSchema: objectSchema({ mode: { enum: ["wait_all", "wait_any", "append_arrays", "merge_objects", "manual_mapping"] } }),
    inputs: [
      field("branch_a", "Ветка A", "any", true, "workspace_internal", ["step_output"]),
      field("branch_b", "Ветка B", "any", true, "workspace_internal", ["step_output"]),
    ],
    outputs: [field("merged_context", "Объединенный контекст", "object")],
    handles: [input("merge_a", "Ветка A"), input("merge_b", "Ветка B"), input("merge_c", "Ветка C"), output()],
    defaultConfig: { mode: "wait_all" },
    policies: policy({ riskLevel: "medium" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "runtime.merge" }),
    uiSchema: ui({ paletteCategory: "Объединение", icon: "Combine", needs: ["Две ветки"], creates: ["Контекст"] }),
    validationRules: [],
  }),
  definition({
    code: "wait_for_document_upload",
    kind: "wait",
    category: "wait_pause",
    displayName: "Ждать документ",
    shortDescription: "Приостанавливает сценарий до загрузки документа или timeout.",
    mvp: false,
    enabled: false,
    disabledReason: "Runtime pause semantics are planned after 16.2 model lock.",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ resume_event: { type: "object" } }),
    configSchema: objectSchema({ timeout_hours: { type: "number" } }),
    inputs: [field("wait_condition", "Условие продолжения", "wait_condition", true, "workspace_internal", ["literal"])],
    outputs: [field("resume_event", "Событие продолжения", "resume_event")],
    handles: [input(), output("resumed", "Продолжить"), output("expired", "Истек срок"), output("cancelled", "Отменено")],
    defaultConfig: { timeout_hours: 72 },
    policies: policy({ riskLevel: "medium" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "runtime.wait" }),
    uiSchema: ui({ paletteCategory: "Ожидание", icon: "Clock", needs: ["Условие"], creates: ["Событие"] }),
    validationRules: [],
  }),
  definition({
    code: "call_subworkflow",
    kind: "subworkflow",
    category: "subworkflow",
    displayName: "Вызвать под-сценарий",
    shortDescription: "Вызывает разрешенную automation version в workspace.",
    mvp: false,
    enabled: false,
    disabledReason: "Subworkflow selection is guarded until version policy is implemented.",
    inputSchema: objectSchema(),
    outputSchema: objectSchema({ subworkflow_result: { type: "object" } }),
    configSchema: objectSchema({ automation_id: { type: "string" }, version_id: { type: "string" } }),
    inputs: [field("subworkflow_inputs", "Входы под-сценария", "object", true, "workspace_internal", ["step_output", "workflow_input", "literal"])],
    outputs: [field("subworkflow_result", "Результат под-сценария", "object")],
    handles: [input(), output(), output("error_output", "Ошибка", ["error_flow"])],
    defaultConfig: { wait_for_completion: true },
    policies: policy({ riskLevel: "high", dataClassification: "confidential" }),
    runtime: runtime({ provider: "internal_worker", internalRoute: "automations.invoke_subworkflow" }),
    uiSchema: ui({ paletteCategory: "Под-сценарии", icon: "Workflow", needs: ["Automation"], creates: ["Результат"] }),
    validationRules: [{ code: "subworkflow_no_cycle", severity: "error", scope: "workflow", message: "Subworkflow calls must not create A -> B -> A cycles." }],
  }),
  definition({
    code: "activepieces_action",
    kind: "legal_action",
    category: "legal_action",
    displayName: "Activepieces action",
    shortDescription: "Technical bridge block for DB-backed Activepieces catalog entries.",
    mvp: false,
    enabled: false,
    disabledReason: "Use concrete Activepieces catalog module codes instead of adding this bridge block directly.",
    inputSchema: objectSchema({
      config: { type: "object" },
    }),
    outputSchema: objectSchema({
      result: { type: "object" },
    }),
    configSchema: objectSchema({
      piece_name: { type: "string" },
      action_name: { type: "string" },
      connection_id: { type: "string" },
      props: { type: "object" },
    }),
    inputs: [
      field("config", "Runtime configuration", "object", false, "internal", ["literal", "workflow_input", "step_output"]),
    ],
    outputs: [field("result", "Action result", "object", false, "runtime_only")],
    handles: [input(), output(), output("error_output", "Error", ["error_flow"])],
    defaultConfig: { props: {} },
    policies: policy({
      riskLevel: "medium",
      dataClassification: "internal",
      isExternalAction: true,
      canRunInDryRun: false,
      canBePublishedAsTemplate: false,
    }),
    runtime: runtime({
      provider: "activepieces",
      supportsStepTest: false,
      supportsPartialExecution: false,
      supportsPinnedData: false,
      notes: ["Resolved at node creation from app.activepieces_action_registry."],
    }),
    uiSchema: ui({
      paletteCategory: "Activepieces",
      icon: "Workflow",
      needs: ["Connection and action props"],
      creates: ["Runtime result"],
      badges: ["activepieces", "dynamic"],
      userFacingLevel: "advanced",
    }),
    validationRules: [
      {
        code: "activepieces_dynamic_mapping_required",
        severity: "error",
        scope: "runtime",
        blocks: ["compile", "publish", "run", "sync"],
        message: "Dynamic Activepieces nodes must keep piece/action runtime mapping.",
      },
    ],
  }),
  definition({
    code: "note",
    kind: "note",
    category: "note_group",
    displayName: "Заметка",
    shortDescription: "Комментирует схему и не влияет на runtime.",
    mvp: false,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema(),
    configSchema: objectSchema({ text: { type: "string" } }),
    inputs: [],
    outputs: [],
    handles: [],
    defaultConfig: { text: "" },
    policies: policy({ riskLevel: "low", canRunInDryRun: false }),
    runtime: runtime({ provider: "none", supportsStepTest: false, supportsPartialExecution: false, supportsPinnedData: false, notes: ["UI only."] }),
    uiSchema: ui({ paletteCategory: "Заметки", icon: "StickyNote", creates: ["Комментарий"] }),
    validationRules: [],
  }),
  definition({
    code: "group",
    kind: "group",
    category: "note_group",
    displayName: "Группа",
    shortDescription: "Группирует блоки для читаемости и не меняет порядок исполнения.",
    mvp: false,
    enabled: true,
    inputSchema: objectSchema(),
    outputSchema: objectSchema(),
    configSchema: objectSchema({ title: { type: "string" } }),
    inputs: [],
    outputs: [],
    handles: [],
    defaultConfig: { title: "Группа" },
    policies: policy({ riskLevel: "low", canRunInDryRun: false }),
    runtime: runtime({ provider: "none", supportsStepTest: false, supportsPartialExecution: false, supportsPinnedData: false }),
    uiSchema: ui({ paletteCategory: "Заметки", icon: "Folder", creates: ["Область процесса"] }),
    validationRules: [],
  }),
];

export const mvpCanvasBlockCodes = canvasBlockDefinitions
  .filter((block) => block.mvp)
  .map((block) => block.code);

export const canvasConnectionRules: readonly CanvasConnectionRule[] = [
  allow("trigger", "main_output", "legal_action", "main_input"),
  allow("trigger", "main_output", "document_input", "main_input"),
  deny("trigger", "main_output", "trigger", "main_input", "Workflow cannot connect trigger to trigger."),
  allow("document_input", "main_output", "legal_action", "main_input"),
  allow("document_input", "main_output", "condition", "main_input"),
  allow("legal_action", "main_output", "legal_action", "main_input"),
  allow("legal_action", "main_output", "condition", "main_input"),
  allow("legal_action", "main_output", "approval", "main_input"),
  allow("legal_action", "main_output", "storage", "main_input"),
  allow("legal_action", "main_output", "delivery", "main_input", "control_flow", true),
  allow("legal_action", "error_output", "error_handler", "error_input", "error_flow"),
  allow("ai_action", "main_output", "legal_action", "main_input"),
  allow("ai_action", "error_output", "error_handler", "error_input", "error_flow"),
  allow("condition", "true_branch", "legal_action", "main_input"),
  allow("condition", "false_branch", "legal_action", "main_input"),
  allow("condition", "otherwise", "legal_action", "main_input"),
  allow("condition", "true_branch", "merge", "merge_a"),
  allow("condition", "false_branch", "merge", "merge_b"),
  allow("loop", "loop_item", "legal_action", "main_input", "loop_flow"),
  allow("loop", "after_loop", "merge", "merge_a"),
  allow("merge", "main_output", "legal_action", "main_input"),
  allow("approval", "approved", "delivery", "main_input", "approval_flow"),
  deny("approval", "rejected", "delivery", "main_input", "Rejected approval cannot continue to delivery."),
  allow("approval", "changes_requested", "legal_action", "main_input", "approval_flow"),
  allow("delivery", "sent", "end", "main_input"),
  allow("storage", "saved", "delivery", "main_input"),
  allow("storage", "saved", "end", "main_input"),
  allow("error_handler", "fallback", "legal_action", "main_input"),
  allow("error_handler", "stop", "end", "main_input"),
  deny("end", "main_output", "legal_action", "main_input", "End block cannot have outgoing connections."),
];

function allow(
  sourceKind: CanvasBlockKind,
  sourceHandle: CanvasHandleCode,
  targetKind: CanvasBlockKind,
  targetHandle: CanvasHandleCode,
  edgeType: CanvasEdgeType = "control_flow",
  requiresApprovalPath = false,
): CanvasConnectionRule {
  return {
    sourceKind,
    sourceHandle,
    targetKind,
    targetHandle,
    edgeType,
    allowed: true,
    requiresApprovalPath,
  };
}

function deny(
  sourceKind: CanvasBlockKind,
  sourceHandle: CanvasHandleCode,
  targetKind: CanvasBlockKind,
  targetHandle: CanvasHandleCode,
  reasonIfDenied: string,
  edgeType: CanvasEdgeType = "control_flow",
): CanvasConnectionRule {
  return {
    sourceKind,
    sourceHandle,
    targetKind,
    targetHandle,
    edgeType,
    allowed: false,
    reasonIfDenied,
  };
}

export function getCanvasBlockDefinitions(): readonly CanvasBlockDefinition[] {
  return canvasBlockDefinitions;
}

export function getMvpCanvasBlockDefinitions(): readonly CanvasBlockDefinition[] {
  return canvasBlockDefinitions.filter((block) => block.mvp);
}

export function findCanvasBlockDefinition(
  code: string,
): CanvasBlockDefinition | null {
  return canvasBlockDefinitions.find((block) => block.code === code) ?? null;
}

export function evaluateCanvasBlockPolicy(input: {
  readonly block: CanvasBlockDefinition;
  readonly roleCodes?: readonly string[];
  readonly permissions?: readonly string[];
  readonly workspaceAiAllowed?: boolean;
  readonly hasApprovalPath?: boolean;
}): CanvasPolicyEvaluation {
  const warnings: CanvasPolicyMessage[] = [];
  const blocks: CanvasPolicyMessage[] = [];
  const roles = new Set(input.roleCodes ?? []);
  const permissions = new Set(input.permissions ?? []);

  if (!input.block.enabled) {
    blocks.push({
      code: "BLOCK_UNSUPPORTED",
      message: input.block.disabledReason ?? "This block is not enabled.",
      affectedBlockCode: input.block.code,
    });
  }

  if (
    input.block.policies.allowedRoles.length > 0 &&
    roles.size > 0 &&
    !input.block.policies.allowedRoles.some((role) => roles.has(role))
  ) {
    blocks.push({
      code: "ROLE_NOT_ALLOWED",
      message: "Current role cannot use this Canvas block.",
      affectedBlockCode: input.block.code,
    });
  }

  for (const permission of input.block.policies.requiredPermissions) {
    if (permissions.size > 0 && !permissions.has(permission)) {
      blocks.push({
        code: "PERMISSION_MISSING",
        message: `Missing permission: ${permission}.`,
        affectedBlockCode: input.block.code,
      });
    }
  }

  if (input.block.policies.canUseAi && input.workspaceAiAllowed === false) {
    blocks.push({
      code: "AI_ROUTE_FORBIDDEN_FOR_CLIENT_MATERIAL",
      message:
        "Workspace policy blocks AI processing for this data classification.",
      affectedBlockCode: input.block.code,
    });
  }

  if (input.block.policies.requiresApproval && !input.hasApprovalPath) {
    warnings.push({
      code: "HIGH_RISK_REQUIRES_APPROVAL",
      message:
        "This block creates a legal or external effect and requires approval before execution.",
      affectedBlockCode: input.block.code,
    });
  }

  return {
    status: blocks.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "allowed",
    warnings,
    blocks,
  };
}

export function validateCanvasBlock(input: {
  readonly block: CanvasBlockDefinition;
  readonly targetNodeId?: string;
  readonly config?: Record<string, unknown>;
  readonly bindings?: readonly StepInputBinding[];
  readonly roleCodes?: readonly string[];
  readonly permissions?: readonly string[];
  readonly hasApprovalPath?: boolean;
}): CanvasBlockValidationResult {
  const policyResult = evaluateCanvasBlockPolicy({
    block: input.block,
    roleCodes: input.roleCodes,
    permissions: input.permissions,
    hasApprovalPath: input.hasApprovalPath,
  });
  const targetNodeId = input.targetNodeId ?? input.block.code;
  const bindingKeys = new Set(
    (input.bindings ?? [])
      .filter((binding) => bindingTargetNodeId(binding) === targetNodeId)
      .map((binding) => bindingTargetInputKey(binding)),
  );
  const issues: CanvasPolicyMessage[] = [];

  for (const fieldDefinition of input.block.inputs) {
    if (fieldDefinition.required && !bindingKeys.has(fieldDefinition.key)) {
      issues.push({
        code: "REQUIRED_INPUT_MISSING",
        message: `Required input is missing: ${fieldDefinition.label}.`,
        affectedBlockCode: input.block.code,
      });
    }
  }

  return {
    valid: policyResult.status !== "blocked" && issues.length === 0,
    issues,
    policy: policyResult,
  };
}

function bindingTargetNodeId(binding: StepInputBinding): string | undefined {
  return binding.target?.node_id ?? binding.targetNodeId;
}

function bindingTargetInputKey(binding: StepInputBinding): string | undefined {
  return binding.target?.input_key ?? binding.targetInputKey;
}

export function validateCanvasConnection(input: {
  readonly sourceBlock: CanvasBlockDefinition;
  readonly sourceHandle: CanvasHandleCode;
  readonly targetBlock: CanvasBlockDefinition;
  readonly targetHandle: CanvasHandleCode;
  readonly edgeType?: CanvasEdgeType;
  readonly hasApprovalPath?: boolean;
}): CanvasConnectionValidationResult {
  const edgeType = input.edgeType ?? "control_flow";

  if (input.sourceBlock.kind === "end") {
    return deniedConnection(edgeType, "End block cannot have outgoing connections.");
  }

  if (input.sourceBlock.kind === "trigger" && input.targetBlock.kind === "trigger") {
    return deniedConnection(edgeType, "Workflow cannot connect trigger to trigger.");
  }

  const sourceHandleDefinition = input.sourceBlock.handles.find(
    (handle) => handle.code === input.sourceHandle && handle.direction === "output",
  );
  const targetHandleDefinition = input.targetBlock.handles.find(
    (handle) => handle.code === input.targetHandle && handle.direction === "input",
  );

  if (!sourceHandleDefinition || !targetHandleDefinition) {
    return deniedConnection(edgeType, "Source or target handle does not exist.");
  }

  if (!sourceHandleDefinition.edgeTypes.includes(edgeType)) {
    return deniedConnection(edgeType, "Source handle does not support this edge type.");
  }

  const explicitRule = canvasConnectionRules.find(
    (rule) =>
      rule.sourceKind === input.sourceBlock.kind &&
      rule.sourceHandle === input.sourceHandle &&
      rule.targetKind === input.targetBlock.kind &&
      rule.targetHandle === input.targetHandle,
  );

  if (explicitRule && !explicitRule.allowed) {
    return deniedConnection(edgeType, explicitRule.reasonIfDenied ?? "Connection is denied.");
  }

  if (explicitRule?.requiresApprovalPath && !input.hasApprovalPath) {
    return deniedConnection(
      edgeType,
      "External delivery must be preceded by an approval path.",
      "EXTERNAL_DELIVERY_REQUIRES_APPROVAL",
    );
  }

  return {
    allowed: true,
    edgeType,
    reason: null,
    policy: { status: "allowed", warnings: [], blocks: [] },
  };
}

function deniedConnection(
  edgeType: CanvasEdgeType,
  reason: string,
  code = "INVALID_CONNECTION",
): CanvasConnectionValidationResult {
  return {
    allowed: false,
    edgeType,
    reason,
    policy: {
      status: "blocked",
      warnings: [],
      blocks: [{ code, message: reason }],
    },
  };
}

export function previewCanvasBlockRuntimeMapping(
  block: CanvasBlockDefinition,
): CanvasRuntimeMapping {
  return block.runtime;
}
