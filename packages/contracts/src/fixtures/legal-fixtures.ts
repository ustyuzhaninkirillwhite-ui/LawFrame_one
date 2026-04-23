import type {
  CreateLegalImportJobRequest,
  CreateSearchFeedbackRequest,
  LegalAnalysisOutput,
  LegalCitation,
  LegalChunkSummary,
  LegalImportJob,
  LegalSearchResponse,
  LegalSourceDetail,
  LegalSourceProviderSummary,
  LegalSourceSummary,
  RagAnalyzeRequest,
  RagRequestSummary,
  SearchFeedback,
} from "../legal";

const workspaceId = "ws_01hzyd70jqgr8k9gr6m4y80p81";
const ownerId = "usr_01hzyd6z9n0d8t02h0j1h0a1zz";
const documentId = "doc_01hzresearch";
const sourceId = "lsrc_01hzzlegalresearch";
const sourceVersionId = "lsrcv_01hzzlegalresearch_v1";
const chunkId = "lchk_01hzzlegalresearch_01";
const importJobId = "limport_01hzzlegalresearch";
const ragRequestId = "rag_01hzzlegalanalysis";

export const legalSourceProviderFixture: LegalSourceProviderSummary = {
  id: "lsp_01_user_upload",
  code: "user_upload",
  name: "User upload",
  providerType: "user_upload",
  jurisdiction: "RU",
  accessMode: "file_upload",
  isEnabled: true,
};

export const legalChunkFixture: LegalChunkSummary = {
  id: chunkId,
  sourceId,
  documentVersionId: sourceVersionId,
  chunkNo: 1,
  chunkType: "court_reasoning",
  text: "Суд пришел к выводу, что неустойка подлежит взысканию при наличии подтвержденной просрочки оплаты и надлежащего расчета суммы требований.",
  textHash: "chunk_hash_01",
  pageFrom: 3,
  pageTo: 4,
  charStart: 240,
  charEnd: 418,
  metadata: {
    court: "Арбитражный суд города Москвы",
    caseNumber: "А40-101/2026",
    procedureType: "commercial",
  },
  securityScope: "workspace_private",
  embeddingModel: "text-embedding-3-large",
  embeddingHash: "embed_hash_01",
  indexedAt: "2026-04-21T12:00:00.000Z",
};

export const legalSourceSummaryFixture: LegalSourceSummary = {
  id: sourceId,
  workspaceId,
  documentId,
  provider: legalSourceProviderFixture,
  sourceType: "court_decision",
  jurisdiction: "RU",
  title: "Постановление по делу о взыскании неустойки",
  canonicalUrl: "https://kad.arbitr.ru/Card/12345678-1234-1234-1234-123456789012",
  externalId: "A40-101/2026",
  licenseStatus: "allowed",
  visibility: "workspace_private",
  classification: "confidential",
  status: "indexed",
  ownerWorkspaceId: workspaceId,
  ownerUserId: ownerId,
  court: "Арбитражный суд города Москвы",
  caseNumber: "А40-101/2026",
  decisionDate: "2026-03-20",
  hasEmbeddings: true,
  indexedAt: "2026-04-21T12:00:00.000Z",
  lastUsedAt: "2026-04-21T12:15:00.000Z",
  createdAt: "2026-04-21T11:20:00.000Z",
  updatedAt: "2026-04-21T12:15:00.000Z",
};

export const legalImportJobFixture: LegalImportJob = {
  id: importJobId,
  providerId: legalSourceProviderFixture.id,
  workspaceId,
  sourceId,
  documentId,
  status: "completed",
  inputType: "document",
  inputRef: documentId,
  totalItems: 1,
  processedItems: 1,
  failedItems: 0,
  errorSummary: null,
  temporalWorkflowId: "wf-legal-import-01",
  startedAt: "2026-04-21T11:22:00.000Z",
  finishedAt: "2026-04-21T11:25:00.000Z",
  createdAt: "2026-04-21T11:22:00.000Z",
  updatedAt: "2026-04-21T11:25:00.000Z",
};

export const legalSourceDetailFixture: LegalSourceDetail = {
  ...legalSourceSummaryFixture,
  versions: [
    {
      id: sourceVersionId,
      sourceId,
      documentVersionId: "docv_01hzstage2research_v1",
      versionNo: 1,
      mimeType: "application/pdf",
      fileSize: 516096,
      language: "ru",
      status: "indexed",
      textHash: "text_hash_01",
      embeddingHash: "embed_hash_01",
      publishedAt: "2026-03-20T00:00:00.000Z",
      ingestedAt: "2026-04-21T11:25:00.000Z",
    },
  ],
  accessEntries: [
    {
      id: "lsacc_01",
      sourceId,
      workspaceId,
      userId: null,
      roleRequired: "lawyer",
      accessLevel: "manage",
      expiresAt: null,
      grantedBy: ownerId,
      createdAt: "2026-04-21T11:21:00.000Z",
    },
  ],
  importJobs: [legalImportJobFixture],
  extractionJobs: [
    {
      id: "lextract_01",
      documentVersionId: sourceVersionId,
      status: "completed",
      extractor: "tika",
      attempt: 1,
      errorCode: null,
      errorMessage: null,
      textHash: "text_hash_01",
      startedAt: "2026-04-21T11:22:30.000Z",
      finishedAt: "2026-04-21T11:23:00.000Z",
    },
  ],
  chunks: [legalChunkFixture],
  metadata: {
    court: "Арбитражный суд города Москвы",
    judge: "Иванов И.И.",
    result: "claim_partially_satisfied",
    procedureType: "commercial",
  },
  availableActions: {
    canManage: true,
    canRetry: true,
    canArchive: true,
    canUseInRag: true,
  },
};

export const legalCitationFixture: LegalCitation = {
  citationId: "cit_01",
  sourceId,
  chunkId,
  documentVersionId: sourceVersionId,
  title: legalSourceSummaryFixture.title,
  quote:
    "Суд пришел к выводу, что неустойка подлежит взысканию при наличии подтвержденной просрочки оплаты.",
  pageFrom: 3,
  pageTo: 4,
  court: legalSourceSummaryFixture.court,
  caseNumber: legalSourceSummaryFixture.caseNumber,
  decisionDate: legalSourceSummaryFixture.decisionDate,
  score: 0.92,
};

export const legalSearchResponseFixture: LegalSearchResponse = {
  mode: "hybrid",
  total: 1,
  facets: [
    {
      name: "court",
      label: "Court",
      buckets: [
        {
          value: "Арбитражный суд города Москвы",
          count: 1,
        },
      ],
    },
    {
      name: "visibility",
      label: "Visibility",
      buckets: [
        {
          value: "workspace_private",
          count: 1,
        },
      ],
    },
  ],
  results: [
    {
      rank: 1,
      score: 0.92,
      scoreComponents: {
        lexical: 0.86,
        semantic: 0.98,
        combined: 0.92,
      },
      source: legalSourceSummaryFixture,
      chunk: legalChunkFixture,
      snippet:
        "…Суд пришел к выводу, что неустойка подлежит взысканию при наличии подтвержденной просрочки оплаты…",
      highlights: ["неустойка", "просрочка оплаты"],
      citation: legalCitationFixture,
    },
  ],
  debug: {
    indexAlias: "legal_chunks_current",
    normalized: true,
    aclApplied: true,
  },
};

export const legalAnalysisOutputFixture: LegalAnalysisOutput = {
  summary:
    "Судебная практика подтверждает возможность взыскания неустойки при доказанной просрочке оплаты и корректном расчете требования.",
  facts: [
    {
      text: "В споре установлена просрочка оплаты по договору поставки.",
      citations: [legalCitationFixture.citationId],
    },
  ],
  legalIssues: [
    {
      issue: "Возможность взыскания договорной неустойки",
      analysis:
        "При наличии подтвержденной просрочки и надлежащего расчета суд поддерживает требование о взыскании неустойки.",
      citations: [legalCitationFixture.citationId],
    },
  ],
  arguments: [
    {
      position: "Требование о неустойке имеет судебную поддержку.",
      analysis:
        "Решение по аналогичному спору указывает на допустимость взыскания неустойки в коммерческом споре.",
      supportingSources: [sourceId],
      strength: "high",
      citations: [legalCitationFixture.citationId],
    },
  ],
  citations: [legalCitationFixture],
  unsupportedClaims: [],
  riskFlags: ["workspace_private_source"],
};

export const ragRequestFixture: RagRequestSummary = {
  id: ragRequestId,
  workspaceId,
  userId: ownerId,
  taskType: "legal_position_analysis",
  question:
    "Какая практика подтверждает взыскание неустойки при просрочке оплаты?",
  queryHash: "rag_query_hash_01",
  selectedSourceIds: [sourceId],
  selectedDocumentIds: [documentId],
  aiRoute: "xai_zdr",
  dataClassification: "confidential",
  status: "completed",
  validationStatus: "valid",
  citationValidationStatus: "valid",
  unsupportedCount: 0,
  riskFlags: ["workspace_private_source"],
  output: legalAnalysisOutputFixture,
  createdAt: "2026-04-21T12:05:00.000Z",
  updatedAt: "2026-04-21T12:05:45.000Z",
  completedAt: "2026-04-21T12:05:45.000Z",
};

export const searchFeedbackFixture: SearchFeedback = {
  id: "sfb_01",
  queryId: "search_01",
  resultId: chunkId,
  userId: ownerId,
  workspaceId,
  feedbackType: "useful",
  comment: "Подходит для аргументации по неустойке.",
  createdAt: "2026-04-21T12:20:00.000Z",
};

export const createLegalImportJobFixture: CreateLegalImportJobRequest = {
  providerCode: "user_upload",
  workspaceId,
  inputType: "document",
  documentType: "court_decision",
  classification: "confidential",
  documentId,
  metadata: {
    title: legalSourceSummaryFixture.title,
    caseNumber: legalSourceSummaryFixture.caseNumber,
  },
};

export const ragAnalyzeFixture: RagAnalyzeRequest = {
  taskType: "legal_position_analysis",
  question:
    "Какая практика подтверждает взыскание неустойки при просрочке оплаты?",
  sourceSelection: {
    mode: "selected_and_search",
    selectedSourceIds: [sourceId],
    searchQuery: "неустойка просрочка оплаты договор поставки",
    filters: {
      court: ["Арбитражный суд города Москвы"],
      dateFrom: "2024-01-01",
    },
  },
  workspaceDocumentIds: [documentId],
  options: {
    maxContextChunks: 8,
    requireCitations: true,
    includeUnsupportedClaims: true,
  },
};

export const createSearchFeedbackFixture: CreateSearchFeedbackRequest = {
  queryId: "search_01",
  resultId: chunkId,
  feedbackType: "useful",
  comment: "Хороший прецедент для подборки аргументов.",
};
