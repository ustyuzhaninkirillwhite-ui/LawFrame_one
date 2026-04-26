const crypto = require("node:crypto");

const NOW = "2026-04-24T12:00:00.000Z";
const WORKSPACE_ID = "workspace_canvas_v2_qa";
const PROJECT_ID = "project_canvas_v2_qa";
const AUTOMATION_ID = "automation_canvas_v2_qa";

function field(key, label, type = "string", options = {}) {
  return {
    key,
    label,
    data_type: type,
    type,
    required: options.required === true,
    classification: options.classification ?? "workspace_internal",
    preview_policy: options.preview_policy ?? "summary",
  };
}

function validation(status = "valid", issues = []) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  const policyBlocks = issues.filter(
    (issue) => issue.severity === "policy_block",
  ).length;
  const canProceed = errors === 0 && policyBlocks === 0;
  const capabilities = {
    can_save: true,
    can_test: canProceed,
    can_compile: canProceed,
    can_publish: canProceed,
    can_run: canProceed,
    can_sync: canProceed,
  };
  return {
    status:
      status === "valid" && (errors > 0 || policyBlocks > 0)
        ? "invalid"
        : status,
    errors_count: errors,
    warnings_count: warnings,
    policy_blocks_count: policyBlocks,
    summary: {
      errors,
      warnings,
      policy_blocks: policyBlocks,
      suggestions: issues.reduce(
        (count, item) => count + (item.suggested_fixes?.length ?? 0),
        0,
      ),
    },
    capabilities,
    issues,
    ...capabilities,
  };
}

function issue(code, severity, scope, message, target = {}) {
  return {
    id: `${code}:${target.affected_node_id ?? target.affected_edge_id ?? "workflow"}`,
    severity,
    scope,
    code,
    title: message,
    message,
    affected_node_id: target.affected_node_id ?? null,
    affected_edge_id: target.affected_edge_id ?? null,
    affected_binding_id: target.affected_binding_id ?? null,
    affected_input_key: target.affected_input_key ?? null,
    suggested_fix: target.suggested_fix ?? null,
    suggested_transform: target.suggested_transform ?? null,
  };
}

function handle(code, label, direction, dataType = null, dataFieldKey = null) {
  return {
    code,
    label,
    direction,
    kind: direction === "input" ? "control_in" : "control_out",
    edge_types: ["control_flow", "approval_flow", "error_flow", "loop_flow"],
    data_type: dataType,
    data_field_key: dataFieldKey,
  };
}

function defaultHandles(type) {
  if (type === "trigger") {
    return [handle("main_output", "Далее", "output")];
  }
  if (type === "end") {
    return [handle("main_input", "Вход", "input")];
  }
  if (type === "condition") {
    return [
      handle("main_input", "Вход", "input"),
      handle("true_branch", "Да", "output"),
      handle("false_branch", "Нет", "output"),
      handle("otherwise", "Иначе", "output"),
    ];
  }
  if (type === "approval") {
    return [
      handle("main_input", "Вход", "input"),
      handle("approved", "Согласовано", "output"),
      handle("rejected", "Отклонено", "output"),
      handle("changes_requested", "Доработать", "output"),
    ];
  }
  if (type === "loop") {
    return [
      handle("main_input", "Вход", "input"),
      handle("loop_item", "Элемент", "output"),
      handle("after_loop", "После цикла", "output"),
    ];
  }
  if (type === "merge") {
    return [
      handle("merge_a", "Ветка A", "input"),
      handle("merge_b", "Ветка B", "input"),
      handle("main_output", "Далее", "output"),
    ];
  }
  if (type === "errorHandler") {
    return [
      handle("error_input", "Ошибка", "input"),
      handle("retry", "Повторить", "output"),
      handle("fallback", "Резерв", "output"),
      handle("stop", "Остановить", "output"),
    ];
  }
  return [
    handle("main_input", "Вход", "input"),
    handle("main_output", "Далее", "output"),
    handle("error_output", "Ошибка", "output"),
  ];
}

function runtimeFor(type, blockCode, options = {}) {
  const provider =
    options.provider ??
    (["note", "group", "end"].includes(type) ? "none" : "internal_worker");
  return {
    provider,
    can_compile: options.can_compile !== false,
    activepieces_piece: options.activepieces_piece ?? null,
    activepieces_action: options.activepieces_action ?? null,
    internal_route:
      provider === "internal_worker" ? `/canvas/runtime/${blockCode}` : null,
    supports_step_test: options.supports_step_test !== false,
    supports_partial_execution: options.supports_partial_execution !== false,
    supports_pinned_data: options.supports_pinned_data !== false,
    warnings: options.warnings ?? [],
  };
}

function node(id, type, blockCode, displayName, options = {}) {
  return {
    id,
    type,
    node_type: type,
    block_code: blockCode,
    display_name: displayName,
    description: options.description ?? null,
    module_code: options.module_code ?? blockCode,
    module_version: options.module_version ?? "0.1.0",
    module_status: options.module_status ?? "published",
    module_schema_hash: options.module_schema_hash ?? hash(`${blockCode}:schema`),
    dynamic_outputs_status: options.dynamic_outputs_status ?? "static",
    trigger_kind: type === "trigger" ? blockCode : null,
    handles: options.handles ?? defaultHandles(type),
    inputs: options.inputs ?? [],
    outputs: options.outputs ?? [],
    bindings: options.bindings ?? {},
    input_bindings: options.input_bindings ?? [],
    config: options.config ?? {},
    policy: {
      data_classification: options.classification ?? "workspace_internal",
      risk_level: options.risk_level ?? "low",
      is_external_action: options.is_external_action === true,
      requires_approval: options.requires_approval === true,
      can_use_ai: type === "aiAction" || options.can_use_ai === true,
      can_use_documents: options.can_use_documents === true,
      ...options.policy,
    },
    runtime_mapping: runtimeFor(type, blockCode, options.runtime ?? {}),
    test_state: {
      sample_data_status: options.sample_data_status ?? "missing",
      last_tested_at: options.last_tested_at ?? null,
      pinned_output_id: options.pinned_output_id ?? null,
    },
    layout: {
      x: options.x ?? 160,
      y: options.y ?? 160,
      width: options.width ?? 288,
      height: options.height ?? 104,
    },
  };
}

function edge(id, source, target, options = {}) {
  return {
    id,
    type: options.type ?? "control_flow",
    edge_type: options.edge_type ?? options.type ?? "control_flow",
    source_node_id: source,
    source_handle: options.source_handle ?? "main_output",
    source_port_id: options.source_handle ?? "main_output",
    target_node_id: target,
    target_handle: options.target_handle ?? "main_input",
    target_port_id: options.target_handle ?? "main_input",
    label: options.label ?? null,
    condition: options.condition ?? null,
    validation_state: options.validation_state ?? "valid",
  };
}

function binding(targetNodeId, inputKey, source, options = {}) {
  return {
    id: options.id ?? `binding_${targetNodeId}_${inputKey}`,
    target: {
      node_id: targetNodeId,
      input_key: inputKey,
    },
    source,
    transform: options.transform ?? { type: "none" },
    validation_state: options.validation_state ?? "valid",
    created_by: options.created_by ?? "template",
    created_at: NOW,
  };
}

function workflow(name, title, nodes, edges, options = {}) {
  const issues = options.issues ?? [];
  const validationState = options.validation ?? validation(
    issues.length > 0 ? "invalid" : "valid",
    issues,
  );
  return {
    schema_version: "2.0",
    id: `workflow_${name}`,
    workspace_id: options.workspace_id ?? WORKSPACE_ID,
    project_id: options.project_id ?? PROJECT_ID,
    automation_id: options.automation_id ?? AUTOMATION_ID,
    draft_version_id: `draft_${name}`,
    published_version_id: options.published_version_id ?? null,
    revision_counter: options.revision_counter ?? 1,
    metadata: {
      title,
      description: options.description ?? null,
      status: options.status ?? "draft",
      canvas_mode: options.canvas_mode ?? "guided_vertical",
    },
    workflow_inputs: options.inputs ?? [],
    workflow_outputs: options.outputs ?? [],
    inputs: options.inputs ?? [],
    outputs: options.outputs ?? [],
    nodes,
    edges,
    variables: options.variables ?? [],
    secrets_policy: {
      frontend_exposure: "forbidden",
      secret_sources: ["connection_ref_only", "secret_ref_only"],
    },
    data_contracts: options.data_contracts ?? {},
    policies: {
      external_delivery_requires_approval: true,
      ai_sensitive_data_policy: "secure_route_or_block",
      raw_execution_data_policy: "redact_by_default",
      pinned_data_policy: "draft_test_only",
      secret_frontend_exposure: "forbidden",
      custom_expression_policy: "debug_permission_required",
    },
    validation: validationState,
    validation_state: validationState,
    runtime_projection: {
      status: options.runtime_status ?? "not_compiled",
      can_compile: validationState.can_compile,
      can_run: validationState.can_run,
      activepieces_flow_id: options.activepieces_flow_id ?? null,
      sync_hash: options.sync_hash ?? null,
      warnings: options.runtime_warnings ?? [],
    },
    canvas_layout: {
      layout_version: "canvas-v2-fixture",
      mode: options.canvas_mode ?? "guided_vertical",
      updated_at: NOW,
      nodes: {},
    },
    layout: {
      mode: options.canvas_mode ?? "guided_vertical",
      updated_at: NOW,
    },
    created_at: NOW,
    updated_at: NOW,
  };
}

function baseTrigger(id = "manual_start") {
  return node(id, "trigger", "manual_start", "Ручной запуск", {
    outputs: [
      field("run_context", "Контекст запуска", "runtime_context"),
      field("input_documents", "Материалы дела", "document_ref[]", {
        classification: "client_material",
      }),
    ],
    runtime: {
      provider: "activepieces",
      activepieces_piece: "@lexframe/piece-canvas-trigger",
      activepieces_action: "manualStart",
    },
  });
}

function endNode(id = "end_success") {
  return node(id, "end", "end_success", "Готово", {
    inputs: [field("workflow_result", "Результат", "json")],
  });
}

function analysisNode(id = "analysis") {
  return node(id, "legalAction", "case_material_analysis", "Анализ материалов", {
    inputs: [
      field("documents", "Документы", "document_ref[]", {
        required: true,
        classification: "client_material",
      }),
      field("profile_snapshot", "Профиль", "profile_snapshot", {
        required: true,
      }),
    ],
    outputs: [
      field("facts", "Факты", "fact_set"),
      field("risks", "Риски", "risk_report"),
    ],
    input_bindings: [
      binding(id, "documents", {
        type: "workflow_input",
        input_key: "case_documents",
      }),
      binding(id, "profile_snapshot", {
        type: "workflow_input",
        input_key: "profile_snapshot",
      }),
    ],
    can_use_documents: true,
    runtime: {
      activepieces_piece: "@lexframe/piece-legal-module",
      activepieces_action: "analyzeCaseMaterials",
    },
  });
}

function draftNode(id = "draft") {
  return node(id, "legalAction", "pretrial_claim_draft", "Подготовить претензию", {
    inputs: [
      field("facts", "Факты дела", "fact_set", { required: true }),
      field("template", "Шаблон", "template_ref", { required: true }),
    ],
    outputs: [
      field("draft_document", "Проект документа", "draft_document", {
        classification: "confidential",
      }),
    ],
    input_bindings: [
      binding(id, "facts", {
        type: "step_output",
        node_id: "analysis",
        output_key: "facts",
      }),
      binding(id, "template", {
        type: "workflow_input",
        input_key: "template_id",
      }),
    ],
    runtime: {
      activepieces_piece: "@lexframe/piece-legal-module",
      activepieces_action: "draftPretrialClaim",
    },
  });
}

function approvalNode(id = "approval") {
  return node(id, "approval", "human_approval", "Согласовать результат", {
    inputs: [field("artifact", "Артефакт", "draft_document", { required: true })],
    outputs: [field("decision", "Решение", "approval_decision")],
    input_bindings: [
      binding(id, "artifact", {
        type: "step_output",
        node_id: "draft",
        output_key: "draft_document",
      }),
    ],
    requires_approval: true,
    runtime: {
      activepieces_piece: "@lexframe/piece-approval",
      activepieces_action: "createApprovalTask",
    },
  });
}

function deliveryNode(id = "delivery") {
  return node(id, "delivery", "email_delivery", "Отправить e-mail", {
    inputs: [
      field("artifact", "Документ", "draft_document", { required: true }),
      field("recipients", "Получатели", "string", { required: true }),
    ],
    outputs: [field("delivery_receipt", "Квитанция", "json")],
    input_bindings: [
      binding(id, "artifact", {
        type: "step_output",
        node_id: "draft",
        output_key: "draft_document",
      }),
      binding(id, "recipients", {
        type: "manual_value",
        value: "qa@example.lexframe.local",
      }),
    ],
    is_external_action: true,
    risk_level: "high",
    runtime: {
      activepieces_piece: "@lexframe/piece-delivery",
      activepieces_action: "createDeliveryRequest",
    },
  });
}

function simpleWorkflow(name, title, middleNodes = [], middleEdges = []) {
  const nodes = [baseTrigger(), ...middleNodes, endNode()];
  const edges =
    middleEdges.length > 0
      ? middleEdges
      : [edge("edge_start_end", "manual_start", "end_success")];
  return workflow(name, title, nodes, edges, {
    inputs: [
      field("case_documents", "Материалы дела", "document_ref[]", {
        required: true,
        classification: "client_material",
      }),
      field("profile_snapshot", "Профиль", "profile_snapshot", {
        required: true,
      }),
      field("template_id", "Шаблон", "template_ref", { required: true }),
    ],
    outputs: [field("result", "Результат", "json")],
  });
}

function buildValidFixtures() {
  const condition = node("condition", "condition", "condition", "Проверить риск", {
    inputs: [field("value", "Риск", "risk_report")],
    outputs: [field("matched_branch", "Ветка", "string")],
    input_bindings: [
      binding("condition", "value", {
        type: "step_output",
        node_id: "analysis",
        output_key: "risks",
      }),
    ],
  });
  const merge = node("merge", "merge", "merge", "Объединить ветки");
  const loop = node("loop", "loop", "loop_documents", "Для каждого документа", {
    config: { max_items: 25 },
    inputs: [field("items", "Документы", "document_ref[]", { required: true })],
    input_bindings: [
      binding("loop", "items", {
        type: "workflow_input",
        input_key: "case_documents",
      }),
    ],
  });
  const errorHandler = node(
    "error_handler",
    "errorHandler",
    "error_handler",
    "Обработать ошибку",
  );
  const subworkflow = node(
    "subworkflow",
    "subworkflow",
    "subworkflow_call",
    "Запустить под-сценарий",
    { config: { automation_id: "automation_reusable_review" } },
  );
  const ai = node("ai_gateway", "aiAction", "ai_gateway_analysis", "AI-анализ", {
    inputs: [field("prompt_context", "Контекст", "json", { required: true })],
    outputs: [field("summary", "Вывод", "json")],
    input_bindings: [
      binding("ai_gateway", "prompt_context", {
        type: "step_output",
        node_id: "analysis",
        output_key: "facts",
      }),
    ],
    risk_level: "medium",
    runtime: {
      provider: "ai_gateway",
      activepieces_piece: "@lexframe/piece-ai-gateway",
      activepieces_action: "summarizeCaseFacts",
    },
  });
  const storage = node("save", "storage", "save_to_documents", "Сохранить документ", {
    inputs: [field("artifact", "Документ", "draft_document", { required: true })],
    outputs: [field("document_record", "Карточка документа", "document_ref")],
    input_bindings: [
      binding("save", "artifact", {
        type: "step_output",
        node_id: "draft",
        output_key: "draft_document",
      }),
    ],
  });
  const wait = node("wait", "wait", "wait_for_document", "Ждать документ", {
    config: { timeout_hours: 24 },
  });
  const note = node("note_qa", "note", "note", "QA заметка", {
    runtime: { provider: "none" },
  });
  const group = node("group_legal", "group", "group", "Подготовка", {
    runtime: { provider: "none" },
  });

  return [
    {
      name: "empty-valid-workflow",
      kind: "valid",
      workflow: simpleWorkflow("empty_valid", "Пустой валидный сценарий"),
    },
    {
      name: "single-legal-action-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "single_legal_action",
        "Один юридический шаг",
        [analysisNode()],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_end", "analysis", "end_success"),
        ],
      ),
    },
    {
      name: "branching-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "branching",
        "Ветвление по риску",
        [analysisNode(), condition, merge],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_condition", "analysis", "condition"),
          edge("edge_condition_true", "condition", "merge", {
            source_handle: "true_branch",
            target_handle: "merge_a",
          }),
          edge("edge_condition_false", "condition", "merge", {
            source_handle: "otherwise",
            target_handle: "merge_b",
          }),
          edge("edge_merge_end", "merge", "end_success"),
        ],
      ),
    },
    {
      name: "loop-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "loop",
        "Цикл по документам",
        [loop, analysisNode()],
        [
          edge("edge_start_loop", "manual_start", "loop"),
          edge("edge_loop_item", "loop", "analysis", {
            source_handle: "loop_item",
            type: "loop_flow",
          }),
          edge("edge_loop_done", "loop", "end_success", {
            source_handle: "after_loop",
            type: "loop_flow",
          }),
        ],
      ),
    },
    {
      name: "approval-before-delivery-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "approval_delivery",
        "Согласование перед отправкой",
        [analysisNode(), draftNode(), approvalNode(), deliveryNode()],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_draft", "analysis", "draft"),
          edge("edge_draft_approval", "draft", "approval"),
          edge("edge_approval_delivery", "approval", "delivery", {
            source_handle: "approved",
            type: "approval_flow",
          }),
          edge("edge_delivery_end", "delivery", "end_success", {
            source_handle: "sent",
          }),
        ],
      ),
    },
    {
      name: "error-handler-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "error_handler",
        "Обработка ошибки",
        [analysisNode(), errorHandler],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_error", "analysis", "error_handler", {
            source_handle: "error_output",
            target_handle: "error_input",
            type: "error_flow",
          }),
          edge("edge_error_stop", "error_handler", "end_success", {
            source_handle: "stop",
            type: "error_flow",
          }),
        ],
      ),
    },
    {
      name: "subworkflow-workflow",
      kind: "valid",
      workflow: simpleWorkflow("subworkflow", "Под-сценарий", [subworkflow], [
        edge("edge_start_subworkflow", "manual_start", "subworkflow"),
        edge("edge_subworkflow_end", "subworkflow", "end_success"),
      ]),
    },
    {
      name: "ai-gateway-workflow",
      kind: "valid",
      workflow: simpleWorkflow("ai_gateway", "AI через gateway", [analysisNode(), ai], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_ai", "analysis", "ai_gateway"),
        edge("edge_ai_end", "ai_gateway", "end_success"),
      ]),
    },
    {
      name: "document-template-workflow",
      kind: "valid",
      workflow: simpleWorkflow("template", "Применить шаблон", [
        node("template", "legalAction", "document_template_apply", "Применить шаблон", {
          inputs: [field("template", "Шаблон", "template_ref", { required: true })],
          outputs: [field("document_draft", "Черновик", "draft_document")],
          input_bindings: [
            binding("template", "template", {
              type: "workflow_input",
              input_key: "template_id",
            }),
          ],
        }),
      ], [
        edge("edge_start_template", "manual_start", "template"),
        edge("edge_template_end", "template", "end_success"),
      ]),
    },
    {
      name: "save-document-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "save_document",
        "Сохранить документ",
        [analysisNode(), draftNode(), storage],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_draft", "analysis", "draft"),
          edge("edge_draft_save", "draft", "save"),
          edge("edge_save_end", "save", "end_success", { source_handle: "saved" }),
        ],
      ),
    },
    {
      name: "wait-workflow",
      kind: "valid",
      workflow: simpleWorkflow("wait", "Ожидание документа", [wait], [
        edge("edge_start_wait", "manual_start", "wait"),
        edge("edge_wait_end", "wait", "end_success"),
      ]),
    },
    {
      name: "merge-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "merge",
        "Объединение веток",
        [analysisNode("analysis_a"), analysisNode("analysis_b"), merge],
        [
          edge("edge_start_a", "manual_start", "analysis_a"),
          edge("edge_start_b", "manual_start", "analysis_b"),
          edge("edge_a_merge", "analysis_a", "merge", { target_handle: "merge_a" }),
          edge("edge_b_merge", "analysis_b", "merge", { target_handle: "merge_b" }),
          edge("edge_merge_end", "merge", "end_success"),
        ],
      ),
    },
    {
      name: "note-group-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "note_group",
        "С заметками и группой",
        [note, group, analysisNode()],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_end", "analysis", "end_success"),
          edge("edge_note_group", "note_qa", "group_legal", {
            type: "annotation_link",
            source_handle: "main_output",
            target_handle: "main_input",
          }),
        ],
      ),
    },
    {
      name: "readonly-preview-workflow",
      kind: "valid",
      workflow: simpleWorkflow("readonly_preview", "Readonly preview", [], [], {
        status: "published",
      }),
    },
    {
      name: "sync-ready-workflow",
      kind: "valid",
      workflow: simpleWorkflow("sync_ready", "Sync ready", [analysisNode()], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_end", "analysis", "end_success"),
      ]),
    },
    {
      name: "compile-warning-workflow",
      kind: "valid",
      workflow: simpleWorkflow("compile_warning", "Compile warning", [analysisNode()], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_end", "analysis", "end_success"),
      ]),
    },
    {
      name: "advanced-builder-workflow",
      kind: "valid",
      workflow: simpleWorkflow("advanced_builder", "Advanced builder", [analysisNode()], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_end", "analysis", "end_success"),
      ]),
    },
    {
      name: "dry-run-workflow",
      kind: "valid",
      workflow: simpleWorkflow(
        "dry_run",
        "Dry-run",
        [analysisNode(), draftNode(), approvalNode()],
        [
          edge("edge_start_analysis", "manual_start", "analysis"),
          edge("edge_analysis_draft", "analysis", "draft"),
          edge("edge_draft_approval", "draft", "approval"),
          edge("edge_approval_end", "approval", "end_success", {
            source_handle: "approved",
            type: "approval_flow",
          }),
        ],
      ),
    },
    {
      name: "public-template-workflow",
      kind: "valid",
      workflow: simpleWorkflow("public_template", "Публичный шаблон", [analysisNode()], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_end", "analysis", "end_success"),
      ]),
    },
    {
      name: "runtime-synced-workflow",
      kind: "valid",
      workflow: simpleWorkflow("runtime_synced", "Runtime synced", [analysisNode()], [
        edge("edge_start_analysis", "manual_start", "analysis"),
        edge("edge_analysis_end", "analysis", "end_success"),
      ]),
    },
  ];
}

function mutateWorkflow(source, name, mutator, issueCode, schemaValid = true) {
  const workflowCopy = JSON.parse(JSON.stringify(source));
  mutator(workflowCopy);
  return {
    name,
    kind: "invalid",
    schemaValid,
    workflow: workflowCopy,
    expectedValidationCodes: [issueCode],
  };
}

function buildInvalidFixtures(validFixtures) {
  const base = validFixtures.find((item) => item.name === "single-legal-action-workflow").workflow;
  const approvalDelivery = validFixtures.find(
    (item) => item.name === "approval-before-delivery-workflow",
  ).workflow;
  const branching = validFixtures.find((item) => item.name === "branching-workflow").workflow;
  const loopWorkflow = validFixtures.find((item) => item.name === "loop-workflow").workflow;
  const mergeWorkflow = validFixtures.find((item) => item.name === "merge-workflow").workflow;

  return [
    mutateWorkflow(base, "no-trigger.invalid", (wf) => {
      wf.nodes = wf.nodes.filter((node) => node.type !== "trigger");
    }, "WF_STRUCTURE_001_TRIGGER_REQUIRED"),
    mutateWorkflow(base, "no-end.invalid", (wf) => {
      wf.nodes = wf.nodes.filter((node) => node.type !== "end");
    }, "WF_STRUCTURE_003_END_NODE_REQUIRED"),
    mutateWorkflow(base, "duplicate-node-id.invalid", (wf) => {
      wf.nodes.push({ ...wf.nodes[1], display_name: "Duplicate" });
    }, "WF_STRUCTURE_011_DUPLICATE_NODE_ID"),
    mutateWorkflow(base, "edge-missing-source.invalid", (wf) => {
      wf.edges[0].source_node_id = "missing_node";
    }, "WF_STRUCTURE_005_EDGE_TARGET_EXISTS"),
    mutateWorkflow(base, "self-loop.invalid", (wf) => {
      wf.edges.push(edge("edge_self_loop", "analysis", "analysis"));
    }, "WF_STRUCTURE_007_NO_UNSUPPORTED_CYCLE"),
    mutateWorkflow(base, "invalid-schema-version.invalid", (wf) => {
      wf.schema_version = "3.0";
    }, "WF_SCHEMA_001_WORKFLOW_SCHEMA_INVALID", false),
    mutateWorkflow(base, "unknown-node-type.invalid", (wf) => {
      wf.nodes[1].type = "rawHttp";
      wf.nodes[1].node_type = "rawHttp";
    }, "WF_SCHEMA_002_NODE_SCHEMA_INVALID", false),
    mutateWorkflow(base, "unknown-edge-type.invalid", (wf) => {
      wf.edges[0].type = "magic_edge";
      wf.edges[0].edge_type = "magic_edge";
    }, "WF_SCHEMA_003_EDGE_SCHEMA_INVALID", false),
    mutateWorkflow(base, "missing-required-field.invalid", (wf) => {
      delete wf.metadata;
    }, "WF_SCHEMA_001_WORKFLOW_SCHEMA_INVALID", false),
    mutateWorkflow(base, "missing-required-input.invalid", (wf) => {
      wf.nodes[1].input_bindings = [];
    }, "WF_TYPE_001_REQUIRED_INPUT_MISSING"),
    mutateWorkflow(approvalDelivery, "unsafe-delivery.invalid", (wf) => {
      wf.nodes = wf.nodes.filter((node) => node.type !== "approval");
      wf.edges = wf.edges.filter(
        (item) => item.source_node_id !== "approval" && item.target_node_id !== "approval",
      );
      wf.edges.push(edge("edge_draft_delivery_unsafe", "draft", "delivery"));
    }, "WF_POLICY_002_EXTERNAL_DELIVERY_APPROVAL_REQUIRED"),
    mutateWorkflow(base, "cross-workspace-document.invalid", (wf) => {
      wf.nodes[1].input_bindings[0].source = {
        type: "document",
        document_id: "document_workspace_b",
        workspace_id: "workspace_b",
      };
    }, "WF_POLICY_004_CROSS_WORKSPACE_REFERENCE"),
    mutateWorkflow(base, "secret-in-config.invalid", (wf) => {
      wf.nodes[1].config.api_key = "sk-test-leaked";
    }, "WF_POLICY_005_SECRET_VALUE_IN_CONFIG"),
    mutateWorkflow(base, "signed-url-output.invalid", (wf) => {
      wf.nodes[1].outputs.push(field("signed_url", "Signed URL", "string"));
    }, "WF_POLICY_010_SIGNED_URL_IN_CONFIG_FORBIDDEN"),
    mutateWorkflow(base, "direct-ai-provider.invalid", (wf) => {
      wf.nodes[1].runtime_mapping.provider = "openai";
      wf.nodes[1].runtime_mapping.activepieces_piece = "@activepieces/piece-openai";
    }, "WF_POLICY_011_DIRECT_AI_PROVIDER_FORBIDDEN"),
    mutateWorkflow(base, "raw-http-runtime.invalid", (wf) => {
      wf.nodes[1].config.url = "https://unknown.example.com/send";
    }, "WF_POLICY_007_UNKNOWN_HTTP_DOMAIN"),
    mutateWorkflow(loopWorkflow, "loop-without-limit.invalid", (wf) => {
      delete wf.nodes.find((item) => item.type === "loop").config.max_items;
    }, "WF_STRUCTURE_009_LOOP_BODY_REQUIRED"),
    mutateWorkflow(branching, "branch-without-fallback.invalid", (wf) => {
      wf.edges = wf.edges.filter((item) => item.source_handle !== "otherwise");
    }, "WF_STRUCTURE_008_ROUTER_FALLBACK_REQUIRED"),
    mutateWorkflow(mergeWorkflow, "merge-single-input.invalid", (wf) => {
      wf.edges = wf.edges.filter((item) => item.target_handle !== "merge_b");
    }, "WF_STRUCTURE_010_MERGE_INPUTS_REQUIRED"),
    mutateWorkflow(base, "disconnected-node.invalid", (wf) => {
      wf.nodes.push(node("orphan", "legalAction", "case_law_search", "Изолированный поиск"));
    }, "WF_STRUCTURE_004_NO_DISCONNECTED_NODE"),
    mutateWorkflow(base, "unsupported-runtime-node.invalid", (wf) => {
      wf.nodes[1].runtime_mapping.can_compile = false;
    }, "WF_RUNTIME_001_UNSUPPORTED_NODE"),
  ];
}

function buildLargeWorkflow(name, count, options = {}) {
  const nodes = [baseTrigger()];
  const edges = [];
  let previous = "manual_start";
  for (let index = 0; index < count; index += 1) {
    const id = `legal_${index + 1}`;
    nodes.push(
      node(id, "legalAction", index % 2 === 0 ? "case_law_search" : "case_material_analysis", `Юридический шаг ${index + 1}`, {
        y: 160 + index * 112,
        runtime: {
          activepieces_piece:
            index % 2 === 0
              ? "@lexframe/piece-legal-search"
              : "@lexframe/piece-legal-module",
          activepieces_action: index % 2 === 0 ? "searchCaseLaw" : "analyzeCaseMaterials",
        },
      }),
    );
    edges.push(edge(`edge_${previous}_${id}`, previous, id));
    previous = id;
  }
  nodes.push(endNode());
  edges.push(edge(`edge_${previous}_end`, previous, "end_success"));
  const wf = workflow(name, `${count} node Canvas fixture`, nodes, edges, {
    inputs: [field("case_documents", "Материалы дела", "document_ref[]", { required: true })],
    outputs: [field("result", "Результат", "json")],
  });
  if (options.invalidManyErrors) {
    wf.nodes.slice(10).forEach((item) => {
      item.input_bindings = [];
      item.config.api_key = "sk-large-fixture-redacted";
    });
    wf.validation = validation("invalid", [
      issue("WF_TYPE_001_REQUIRED_INPUT_MISSING", "error", "binding", "Required input is not bound."),
      issue("WF_POLICY_005_SECRET_VALUE_IN_CONFIG", "policy_block", "node", "Secret value is forbidden."),
    ]);
    wf.validation_state = wf.validation;
  }
  return {
    name: `workflow-${count}${options.invalidManyErrors ? "-invalid-many-errors" : ""}`,
    kind: options.invalidManyErrors ? "performance-invalid" : "performance",
    nodeCount: nodes.length,
    workflow: wf,
  };
}

function buildRuntimeSnapshots() {
  return [
    runtimeSnapshot("safe-label-change", [
      runtimeNode("step_1", "@lexframe/piece-legal-module", "analyzeCaseMaterials", {
        displayName: "Анализ материалов v2",
      }),
    ]),
    runtimeSnapshot("unknown-runtime-node", [
      runtimeNode("unknown_1", "@vendor/custom-piece", "doSomething"),
    ]),
    runtimeSnapshot("code-step", [
      runtimeNode("code_1", null, null, { runtimeType: "CODE" }),
    ]),
    runtimeSnapshot("raw-http", [
      runtimeNode("http_1", "@activepieces/piece-http", "sendRequest", {
        input: { url: "https://unknown.example.com/send" },
      }),
    ]),
    runtimeSnapshot("direct-ai-provider", [
      runtimeNode("openai_1", "@activepieces/piece-openai", "chatCompletion"),
    ]),
    runtimeSnapshot("approval-removed-before-delivery", [
      runtimeNode("delivery_1", "@lexframe/piece-delivery", "sendEmail"),
    ]),
  ];
}

function runtimeSnapshot(name, nodes) {
  return {
    name,
    runtimeGraph: {
      provider: "activepieces",
      flowId: `flow_${name}`,
      flowVersionId: `flow_version_${name}`,
      nodes,
      edges: [],
      snapshotHash: hash({ name, nodes }),
    },
  };
}

function runtimeNode(id, pieceName, actionName, options = {}) {
  return {
    runtimeNodeId: id,
    runtimeType: options.runtimeType ?? "PIECE",
    displayName: options.displayName ?? id,
    pieceName,
    actionName,
    triggerName: null,
    pieceVersion: "0.1.0",
    input: options.input ?? {
      lexframe: {
        node_id: id,
        module_code: "case_material_analysis",
      },
    },
    metadata: options.metadata ?? {
      lexframeSourceNodeId: id,
    },
  };
}

const mswFixtures = {
  endpoints: [
    "GET /automations/:id/canvas",
    "POST /automations/:id/canvas/operations",
    "POST /automations/:id/canvas/validate",
    "POST /automations/:id/canvas/test-step",
    "POST /automations/:id/canvas/test-flow",
    "POST /automations/:id/canvas/compile-preview",
    "POST /automations/:id/canvas/publish",
    "GET /automations/:id/canvas/versions",
    "GET /automations/:id/canvas/runtime/sync-status",
    "POST /automations/:id/canvas/runtime/import-preview",
    "POST /activepieces/embed-token",
  ],
  errors: [
    { status: 403, code: "CANVAS_PERMISSION_DENIED" },
    { status: 409, code: "CANVAS_DRAFT_LOCKED" },
    { status: 409, code: "CANVAS_VERSION_CONFLICT" },
    { status: 422, code: "CANVAS_VALIDATION_FAILED" },
    { status: 422, code: "CANVAS_POLICY_BLOCKED" },
    { status: 424, code: "ACTIVEPIECES_RUNTIME_UNAVAILABLE" },
    { status: 424, code: "CONNECTION_MISSING" },
    { status: 500, code: "CANVAS_INTERNAL_ERROR" },
  ],
};

const releaseGateMatrix = [
  { gate: "Contract", blocksOn: ["schema_invalid", "openapi_mismatch", "raw_fetch"] },
  { gate: "Validation", blocksOn: ["invalid_publish", "unsafe_delivery", "unsupported_compile"] },
  { gate: "Security", blocksOn: ["secret_leak", "rbac_bypass", "direct_ai"] },
  { gate: "Runtime", blocksOn: ["compile_failure", "sync_failure", "unsafe_reverse_sync"] },
  { gate: "E2E", blocksOn: ["baseline_user_journey_failed"] },
  { gate: "Integrated Readiness", blocksOn: ["readiness_blocked", "worker_unavailable"] },
  { gate: "Performance", blocksOn: ["freeze", "memory_leak", "budget_exceeded"] },
  { gate: "Manifest", blocksOn: ["missing_canvas_version", "missing_rollback_plan"] },
];

const performanceBudgets = {
  initialLoad25NodesP95Ms: 1500,
  initialLoad100NodesP95Ms: 3000,
  operationApplyP95Ms: 200,
  validationAfterSmallOperationP95Ms: 500,
  autosaveBackendP95Ms: 1000,
  compilePreview50NodesP95Ms: 3000,
};

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const validFixtures = buildValidFixtures();
const invalidFixtures = buildInvalidFixtures(validFixtures);
const largeFixtures = [
  buildLargeWorkflow("large_10_linear", 10),
  buildLargeWorkflow("large_25_branching", 25),
  buildLargeWorkflow("large_50_mixed", 50),
  buildLargeWorkflow("large_100", 100),
  buildLargeWorkflow("large_100_invalid_many_errors", 100, {
    invalidManyErrors: true,
  }),
];
const runtimeSnapshots = buildRuntimeSnapshots();

module.exports = {
  validFixtures,
  invalidFixtures,
  largeFixtures,
  runtimeSnapshots,
  mswFixtures,
  releaseGateMatrix,
  performanceBudgets,
  helpers: {
    field,
    node,
    edge,
    binding,
    workflow,
    validation,
    issue,
    hash,
  },
};
