import type {
  AiChatMessageSummary,
  AiChatSessionSummary,
  AiRequestEvent,
  AiRequestSummary,
  ClarificationRequiredResponse,
  PolicyBlockedResponse,
  RuntimePlanPreview,
  WorkflowDraftDetail,
  WorkflowDraftReadyResponse,
} from "../ai";
import type { LexFrameWorkflow } from "../ai";

const createdAt = "2026-04-21T14:30:00.000Z";

export const aiWorkflowFixture: LexFrameWorkflow = {
  schemaVersion: "lexframe.workflow.v1",
  id: "wf_draft_claim_001",
  title: "Подготовка претензии по материалам дела",
  description:
    "Анализ материалов, поиск практики, подготовка претензии и черновика письма клиенту.",
  intent:
    "Собрать воспроизводимый сценарий подготовки претензии на основе материалов дела.",
  jurisdiction: "ru",
  practiceArea: "contract_dispute",
  inputs: [
    {
      inputId: "case_documents",
      label: "Материалы дела",
      type: "document[]",
      required: true,
      source: "user_selection",
      dataClass: "confidential",
    },
    {
      inputId: "claim_template",
      label: "Шаблон претензии",
      type: "template",
      required: true,
      source: "template",
      dataClass: "internal",
    },
  ],
  outputs: [
    {
      outputId: "pretrial_claim_doc",
      label: "Документ претензии",
      type: "document",
      format: "docx",
    },
    {
      outputId: "client_email_draft",
      label: "Черновик письма клиенту",
      type: "message",
      format: "email",
    },
  ],
  steps: [
    {
      stepId: "s1",
      moduleCode: "legal.material-analysis",
      moduleVersion: "v1",
      title: "Анализ материалов дела",
      description: "Извлечь факты, стороны и риски из выбранных документов.",
      kind: "analyze",
      inputBindings: {
        documents: "$inputs.case_documents",
      },
      outputBindings: {
        facts: "$state.case_facts",
      },
      requiresApproval: false,
      dataPolicy: {
        maxClass: "confidential",
        allowedAiRoutes: ["xai_zdr", "local_mock"],
      },
      runtime: {
        requiredPiece: "@lexframe/document-analysis",
      },
      onError: {
        strategy: "stop_and_ask_user",
        message: "Не удалось извлечь факты из документов.",
      },
    },
    {
      stepId: "s2",
      moduleCode: "legal.case-search",
      moduleVersion: "v1",
      title: "Поиск практики",
      description: "Подобрать релевантную судебную практику.",
      kind: "analyze",
      inputBindings: {
        factDigest: "$state.case_facts",
      },
      outputBindings: {
        practice: "$state.practice_digest",
      },
      requiresApproval: false,
      dataPolicy: {
        maxClass: "internal",
        allowedAiRoutes: ["xai", "cometapi", "local_mock"],
      },
      runtime: {
        requiredPiece: "@lexframe/legal-search",
      },
    },
    {
      stepId: "s3",
      moduleCode: "document.pretrial-draft",
      moduleVersion: "v1",
      title: "Подготовка претензии",
      description: "Собрать черновик претензии по шаблону.",
      kind: "generate",
      inputBindings: {
        facts: "$state.case_facts",
        practice: "$state.practice_digest",
        templateId: "$inputs.claim_template",
      },
      outputBindings: {
        draft: "$outputs.pretrial_claim_doc",
      },
      requiresApproval: true,
      dataPolicy: {
        maxClass: "confidential",
        allowedAiRoutes: ["xai_zdr", "local_mock"],
      },
      runtime: {
        requiredPiece: "@lexframe/document-drafting",
      },
    },
    {
      stepId: "s4",
      moduleCode: "delivery.email-draft",
      moduleVersion: "v1",
      title: "Черновик письма клиенту",
      description: "Подготовить письмо клиенту без автоматической отправки.",
      kind: "deliver",
      inputBindings: {
        document: "$outputs.pretrial_claim_doc",
      },
      outputBindings: {
        emailDraft: "$outputs.client_email_draft",
      },
      requiresApproval: true,
      dataPolicy: {
        maxClass: "confidential",
        allowedAiRoutes: ["xai_zdr", "local_mock"],
      },
      runtime: {
        requiredPiece: "@lexframe/email-delivery",
        requiredConnection: "gmail",
      },
    },
  ],
  transitions: [
    { from: "s1", to: "s2", condition: "success" },
    { from: "s2", to: "s3", condition: "success" },
    { from: "s3", to: "s4", condition: "approved" },
  ],
  approvalPolicy: {
    externalActionsRequireApproval: true,
    documentGenerationRequiresReview: true,
  },
  securityLabels: ["contains_confidential_documents"],
  createdBy: "ai_planner",
  confidence: 0.86,
};

export const aiRuntimePlanFixture: RuntimePlanPreview = {
  runnable: false,
  missingRuntimeBindings: [
    {
      stepId: "s4",
      requiredPiece: "@lexframe/email-delivery",
      requiredConnection: "gmail",
      reason: "Для шага доставки нужен workspace connection gmail.",
    },
  ],
  activepiecesCandidateSteps: ["s1", "s2", "s3", "s4"],
};

export const aiDraftFixture: WorkflowDraftDetail = {
  id: "draft_01hzyfstage5",
  workspaceId: "ws_01hzyd70jqgr8k9gr6m4y80p81",
  ownerId: "usr_01hzyd6z9n0d8t02h0j1h0a1zz",
  source: "ai_chat",
  status: "ready_for_review",
  title: aiWorkflowFixture.title,
  currentVersionId: "draftv_01hzyfstage5_v1",
  linkedAutomationId: null,
  linkedSessionId: "aisess_01hzyfstage5",
  updatedAt: createdAt,
  createdAt,
  workflow: aiWorkflowFixture,
  validationReport: {
    valid: true,
    blockingErrors: [],
    warnings: [
      {
        code: "external_send_requires_approval",
        path: "$.steps[3]",
        message: "Шаг доставки требует ручного подтверждения.",
        severity: "warning",
      },
    ],
    infos: [],
  },
  policyReport: {
    valid: true,
    dataClass: "C_CONFIDENTIAL_CLIENT",
    providerRoute: "xai_zdr",
    externalActionsRequireApproval: true,
    violations: [],
    warnings: ["CometAPI недоступен для этого workflow."],
  },
  runtimePlanPreview: aiRuntimePlanFixture,
  versions: [
    {
      id: "draftv_01hzyfstage5_v1",
      draftId: "draft_01hzyfstage5",
      versionNo: 1,
      schemaVersion: "lexframe.workflow.v1",
      promptVersion: "workflow_planning_v1",
      aiRequestId: "aireq_01hzyfstage5",
      workflow: aiWorkflowFixture,
      validationReport: {
        valid: true,
        blockingErrors: [],
        warnings: [],
        infos: [],
      },
      policyReport: {
        valid: true,
        dataClass: "C_CONFIDENTIAL_CLIENT",
        providerRoute: "xai_zdr",
        externalActionsRequireApproval: true,
        violations: [],
        warnings: [],
      },
      runtimePlanPreview: aiRuntimePlanFixture,
      createdAt,
    },
  ],
  clarificationQuestions: [],
  patch: null,
  diff: null,
};

export const aiChatSessionsFixture: readonly AiChatSessionSummary[] = [
  {
    id: "aisess_01hzyfstage5",
    workspaceId: "ws_01hzyd70jqgr8k9gr6m4y80p81",
    source: "global_chat",
    mode: "create_workflow",
    status: "active",
    title: "Подготовка претензии",
    currentAutomationId: null,
    selectedDocumentIds: ["doc_01hzstage2claim"],
    selectedTemplateIds: ["tpl_pretenziya_001"],
    selectedProfileId: null,
    contentStorageMode: "metadata_only",
    allowedModes: ["create_workflow", "modify_workflow", "explain_workflow"],
    aiPolicySummary: {
      externalAiEnabled: true,
      confidentialDataAllowed: true,
      cometapiAllowedForPublicData: true,
    },
    lastMessageAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  },
];

export const aiChatMessagesFixture: readonly AiChatMessageSummary[] = [
  {
    id: "aimsg_user_01",
    sessionId: "aisess_01hzyfstage5",
    role: "user",
    responseType: null,
    contentText: null,
    contentPreview:
      "Собери сценарий: проанализировать материалы, найти практику и подготовить претензию.",
    contentStorageMode: "metadata_only",
    metadata: {
      messageHash: "sha256:user01",
    },
    createdAt,
  },
  {
    id: "aimsg_assistant_01",
    sessionId: "aisess_01hzyfstage5",
    role: "assistant",
    responseType: "workflow_draft_ready",
    contentText: null,
    contentPreview: "Сформирован draft workflow с 4 шагами и обязательным approval.",
    contentStorageMode: "metadata_only",
    metadata: {
      draftId: "draft_01hzyfstage5",
    },
    createdAt,
  },
];

export const aiDraftReadyFixture: WorkflowDraftReadyResponse = {
  status: "workflow_draft_ready",
  sessionId: "aisess_01hzyfstage5",
  messageId: "aimsg_assistant_01",
  draftId: aiDraftFixture.id,
  draftVersionId: aiDraftFixture.currentVersionId,
  workflow: aiWorkflowFixture,
  validationReport: aiDraftFixture.validationReport,
  policyReport: aiDraftFixture.policyReport,
  runtimePlanPreview: aiDraftFixture.runtimePlanPreview,
  warnings: aiDraftFixture.policyReport.warnings,
};

export const aiClarificationFixture: ClarificationRequiredResponse = {
  status: "clarification_required",
  sessionId: "aisess_01hzyfstage5",
  messageId: "aimsg_assistant_02",
  draftId: "draft_01clarify",
  questions: [
    {
      field: "claim_template",
      label: "Какой шаблон претензии использовать?",
      type: "template",
      required: true,
    },
    {
      field: "recipient_email",
      label: "Кому показать письмо перед отправкой?",
      type: "email",
      required: false,
    },
  ],
  validationReport: {
    valid: false,
    blockingErrors: [
      {
        code: "missing_required_template",
        path: "$.steps[2].inputBindings.templateId",
        message: "Для подготовки претензии требуется шаблон.",
        severity: "error",
      },
    ],
    warnings: [],
    infos: [],
  },
  policyReport: {
    valid: true,
    dataClass: "B_INTERNAL_WORKSPACE",
    providerRoute: "xai",
    externalActionsRequireApproval: true,
    violations: [],
    warnings: [],
  },
};

export const aiPolicyBlockedFixture: PolicyBlockedResponse = {
  status: "blocked_by_policy",
  reasonCode: "EXTERNAL_AI_DISABLED_FOR_CONFIDENTIAL_DATA",
  message:
    "Для выбранных документов workspace запрещает внешний AI-route без обезличивания.",
  allowedActions: ["remove_documents", "use_anonymized_mode", "contact_workspace_admin"],
  policyReport: {
    valid: false,
    dataClass: "D_AI_EXTERNAL_FORBIDDEN",
    providerRoute: "blocked",
    externalActionsRequireApproval: true,
    violations: [
      {
        code: "external_ai_disabled",
        message: "Внешний AI запрещён для выбранного класса данных.",
        action: "block",
      },
    ],
    warnings: [],
  },
};

export const aiRequestsFixture: readonly AiRequestSummary[] = [
  {
    id: "aireq_01hzyfstage5",
    workspaceId: "ws_01hzyd70jqgr8k9gr6m4y80p81",
    sessionId: "aisess_01hzyfstage5",
    taskType: "workflow_planning",
    dataClass: "C_CONFIDENTIAL_CLIENT",
    provider: "xai",
    model: "grok-code-fast",
    routeReason: "structured_output_sensitive",
    promptHash: "sha256:prompt01",
    responseHash: "sha256:response01",
    schemaVersion: "lexframe.workflow.v1",
    promptVersion: "workflow_planning_v1",
    status: "completed",
    errorCode: null,
    latencyMs: 1480,
    inputTokens: 820,
    outputTokens: 410,
    costUsd: 0.06,
    createdAt,
  },
];

export const aiRequestEventsFixture: readonly AiRequestEvent[] = [
  {
    id: "aievt_01",
    requestId: "aireq_01hzyfstage5",
    type: "ai.classification.started",
    payload: {
      status: "started",
    },
    createdAt,
  },
  {
    id: "aievt_02",
    requestId: "aireq_01hzyfstage5",
    type: "ai.workflow.ready",
    payload: {
      draftId: "draft_01hzyfstage5",
    },
    createdAt,
  },
];
