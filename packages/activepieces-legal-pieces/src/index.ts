export const ACTIVEPIECES_LEGAL_PIECES_VERSION = "0.1.0";

export const activepiecesCompatibilityNotes = [
  "Pin the vendor Activepieces image and the legal pieces package to the same release manifest.",
  "Run smoke flows against staging before allowing production sync.",
  "Rollback is performed by restoring the previous pinned piece version and flow snapshot.",
] as const;

export const activepiecesSmokeFlows = [
  {
    code: "legal-research-to-draft",
    title: "Research to draft smoke",
    requiredPieces: [
      "@lexframe/piece-legal-search",
      "@lexframe/piece-legal-rag",
      "@lexframe/piece-document-template",
      "@lexframe/piece-document-validation",
      "@lexframe/piece-approval-request",
    ],
  },
] as const;

export const activepiecesRollbackPolicy = {
  requirePinnedVersion: true,
  requireSmokeBeforeProductionSync: true,
  rollbackPath: "restore previous vendor container tag and previous legal pieces package version",
} as const;

export interface LegalSearchPieceInput {
  readonly query: string;
  readonly mode: "keyword" | "semantic" | "hybrid";
  readonly limit?: number;
  readonly offset?: number;
  readonly selectedSourceIds?: readonly string[];
}

export interface LegalRagPieceInput {
  readonly taskType: string;
  readonly question: string;
  readonly sourceSelection: {
    readonly mode: "selected_only" | "selected_and_search" | "search_only";
    readonly selectedSourceIds?: readonly string[];
    readonly searchQuery?: string;
  };
  readonly options?: {
    readonly maxContextChunks?: number;
    readonly requireCitations?: boolean;
    readonly includeUnsupportedClaims?: boolean;
  };
}

export interface DocumentTemplatePieceInput {
  readonly templateId: string;
  readonly templateVersionId?: string | null;
  readonly profileId?: string | null;
  readonly input: {
    readonly facts?: Record<string, unknown>;
    readonly params?: Record<string, unknown>;
    readonly sourceDocumentIds?: readonly string[];
  };
}

export interface DocumentValidationPieceInput {
  readonly workflowRunId: string;
  readonly generationJobId: string;
}

export interface ApprovalRequestPieceInput {
  readonly workflowRunId: string;
  readonly generationJobId: string;
  readonly approvalRouteId?: string | null;
  readonly title: string;
}

export interface RuntimePieceDefinition<TInput> {
  readonly packageName: string;
  readonly displayName: string;
  readonly description: string;
  readonly endpoint: string;
  readonly requiredPermission: string;
  readonly runtimeAuth: "workspace_token";
  readonly writesArtifactType: string;
  readonly defaultInput: TInput;
}

export const legalSearchPiece: RuntimePieceDefinition<LegalSearchPieceInput> = {
  packageName: "@lexframe/piece-legal-search",
  displayName: "Legal Search",
  description:
    "Executes backend-scoped legal search and returns product JSON results with citations.",
  endpoint: "/workflow-runtime/legal-search/execute",
  requiredPermission: "legal_search.use",
  runtimeAuth: "workspace_token",
  writesArtifactType: "legal_search_results",
  defaultInput: {
    query: "",
    mode: "hybrid",
    limit: 10,
  },
};

export const legalRagPiece: RuntimePieceDefinition<LegalRagPieceInput> = {
  packageName: "@lexframe/piece-legal-rag",
  displayName: "Legal RAG",
  description:
    "Builds context from scoped legal sources and returns citation-validated analysis.",
  endpoint: "/workflow-runtime/legal-rag/analyze",
  requiredPermission: "legal_rag.use",
  runtimeAuth: "workspace_token",
  writesArtifactType: "legal_rag_analysis",
  defaultInput: {
    taskType: "legal_position_analysis",
    question: "",
    sourceSelection: {
      mode: "search_only",
    },
    options: {
      maxContextChunks: 6,
      requireCitations: true,
      includeUnsupportedClaims: true,
    },
  },
};

export const documentTemplatePiece: RuntimePieceDefinition<DocumentTemplatePieceInput> = {
  packageName: "@lexframe/piece-document-template",
  displayName: "Document Template",
  description:
    "Executes the Stage 7 document template pipeline and writes preview/final artifacts into the canonical document domain.",
  endpoint: "/workflow-runtime/document-template/execute",
  requiredPermission: "document.generate",
  runtimeAuth: "workspace_token",
  writesArtifactType: "document_preview",
  defaultInput: {
    templateId: "",
    input: {
      facts: {},
      params: {},
      sourceDocumentIds: [],
    },
  },
};

export const documentValidationPiece: RuntimePieceDefinition<DocumentValidationPieceInput> = {
  packageName: "@lexframe/piece-document-validation",
  displayName: "Document Validation",
  description:
    "Recomputes Stage 7 document validation rules and persists blocking issues in canonical validation reports.",
  endpoint: "/workflow-runtime/document-validation/execute",
  requiredPermission: "document.validation.read",
  runtimeAuth: "workspace_token",
  writesArtifactType: "document_validation_report",
  defaultInput: {
    workflowRunId: "",
    generationJobId: "",
  },
};

export const approvalRequestPiece: RuntimePieceDefinition<ApprovalRequestPieceInput> = {
  packageName: "@lexframe/piece-approval-request",
  displayName: "Approval Request",
  description:
    "Creates a Stage 7 approval inbox task before high-risk document finalization or external delivery.",
  endpoint: "/workflow-runtime/approval-request/execute",
  requiredPermission: "approval.task.read",
  runtimeAuth: "workspace_token",
  writesArtifactType: "approval_task",
  defaultInput: {
    workflowRunId: "",
    generationJobId: "",
    approvalRouteId: null,
    title: "",
  },
};

export const legalResearchWorkflowPreset = {
  code: "legal-research-to-draft",
  title: "Find practice, analyze, transfer to draft",
  steps: [
    {
      code: "legal_search",
      piece: legalSearchPiece.packageName,
      artifactType: legalSearchPiece.writesArtifactType,
    },
    {
      code: "legal_rag",
      piece: legalRagPiece.packageName,
      artifactType: legalRagPiece.writesArtifactType,
    },
    {
      code: "draft_handoff",
      piece: "@lexframe/piece-document",
      artifactType: "draft_document",
    },
    {
      code: "document_template",
      piece: documentTemplatePiece.packageName,
      artifactType: documentTemplatePiece.writesArtifactType,
    },
    {
      code: "document_validation",
      piece: documentValidationPiece.packageName,
      artifactType: documentValidationPiece.writesArtifactType,
    },
    {
      code: "approval_request",
      piece: approvalRequestPiece.packageName,
      artifactType: approvalRequestPiece.writesArtifactType,
    },
  ],
} as const;
