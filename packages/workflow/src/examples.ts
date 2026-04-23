import type { LexFrameWorkflow, LexFrameWorkflowPatch } from "@lexframe/contracts";

export const validWorkflowExample: LexFrameWorkflow = {
  schemaVersion: "lexframe.workflow.v1",
  id: "pretrial-claim-flow",
  title: "Подготовка претензии и письма клиенту",
  description:
    "Проанализировать материалы, найти практику, подготовить претензию и черновик письма клиенту.",
  intent: "Подготовить воспроизводимый сценарий претензионной работы.",
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
      outputId: "claim_document",
      label: "Документ претензии",
      type: "document",
      format: "docx",
    },
    {
      outputId: "delivery_draft",
      label: "Черновик письма",
      type: "message",
      format: "email",
    },
  ],
  steps: [
    {
      stepId: "analyze-materials",
      moduleCode: "legal.material-analysis",
      moduleVersion: "v1",
      title: "Анализ материалов",
      description: "Извлечь факты и ключевые риски из документов.",
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
    },
    {
      stepId: "search-practice",
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
      stepId: "draft-claim",
      moduleCode: "document.pretrial-draft",
      moduleVersion: "v1",
      title: "Подготовка претензии",
      description: "Собрать претензию по фактам, практике и шаблону.",
      kind: "generate",
      inputBindings: {
        facts: "$state.case_facts",
        practice: "$state.practice_digest",
        templateId: "$inputs.claim_template",
      },
      outputBindings: {
        draft: "$outputs.claim_document",
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
      stepId: "draft-delivery",
      moduleCode: "delivery.email-draft",
      moduleVersion: "v1",
      title: "Черновик письма клиенту",
      description: "Подготовить письмо клиенту без автоматической отправки.",
      kind: "deliver",
      inputBindings: {
        document: "$outputs.claim_document",
      },
      outputBindings: {
        emailDraft: "$outputs.delivery_draft",
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
    {
      from: "analyze-materials",
      to: "search-practice",
      condition: "success",
    },
    {
      from: "search-practice",
      to: "draft-claim",
      condition: "success",
    },
    {
      from: "draft-claim",
      to: "draft-delivery",
      condition: "approved",
    },
  ],
  approvalPolicy: {
    externalActionsRequireApproval: true,
    documentGenerationRequiresReview: true,
  },
  securityLabels: ["contains_confidential_documents"],
  createdBy: "ai_planner",
  confidence: 0.82,
};

export const invalidWorkflowExample = {
  schemaVersion: "lexframe.workflow.v1",
  id: "bad-flow",
  title: "Некорректный сценарий",
  description: "Намеренно сломанный workflow для тестов.",
  intent: "Проверка негативного сценария.",
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
  ],
  outputs: [
    {
      outputId: "claim_document",
      label: "Документ претензии",
      type: "document",
      format: "docx",
    },
  ],
  steps: [
    {
      stepId: "unsafe-delivery",
      moduleCode: "workflow.external-notify",
      moduleVersion: "v1",
      title: "Небезопасная отправка",
      description: "Отправить письмо без approval.",
      kind: "deliver",
      inputBindings: {
        document: "$inputs.case_documents",
      },
      outputBindings: {
        result: "$outputs.claim_document",
      },
      requiresApproval: false,
      dataPolicy: {
        maxClass: "confidential",
        allowedAiRoutes: ["cometapi"],
      },
      runtime: {
        requiredPiece: "@lexframe/email-delivery",
      },
    },
  ],
  transitions: [
    {
      from: "missing-step",
      to: "unsafe-delivery",
      condition: "success",
    },
  ],
  approvalPolicy: {
    externalActionsRequireApproval: true,
    documentGenerationRequiresReview: true,
  },
  securityLabels: ["contains_confidential_documents"],
  createdBy: "ai_planner",
  confidence: 0.45,
} as const;

export const validWorkflowPatchExample: LexFrameWorkflowPatch = {
  patchVersion: "lexframe.workflow_patch.v1",
  baseWorkflowVersionId: "draftv_01",
  operations: [
    {
      op: "add_step",
      afterStepId: "search-practice",
      step: {
        stepId: "limitation-check",
        moduleCode: "legal.material-analysis",
        moduleVersion: "v1",
        title: "Проверка давности",
        description: "Отдельно проверить срок исковой давности по фактам.",
        kind: "review",
        inputBindings: {
          facts: "$state.case_facts",
        },
        outputBindings: {
          limitationSummary: "$state.limitation_summary",
        },
        requiresApproval: false,
        dataPolicy: {
          maxClass: "internal",
          allowedAiRoutes: ["xai", "local_mock"],
        },
        runtime: {},
      },
    },
  ],
  explanation: "Добавлен шаг проверки срока исковой давности после поиска практики.",
  riskChange: "low_to_medium",
};
