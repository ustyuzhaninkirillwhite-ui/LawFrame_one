import type { AiProviderRoute } from "./ai";
import type { DataClassification } from "./enums/data-classification";

export type LegalSourceType =
  | "court_decision"
  | "statute"
  | "regulation"
  | "contract_template"
  | "user_document"
  | "internal_memo"
  | "analysis_result";

export type LegalSourceVisibility =
  | "public"
  | "product_private"
  | "workspace_private"
  | "user_private"
  | "restricted_provider";

export type LegalSourceStatus =
  | "draft"
  | "pending_processing"
  | "processed"
  | "indexed"
  | "index_failed"
  | "deprecated"
  | "archived"
  | "deleted";

export type LegalLicenseStatus =
  | "allowed"
  | "restricted"
  | "unknown"
  | "requires_contract"
  | "forbidden";

export type LegalImportJobStatus =
  | "queued"
  | "fetching"
  | "stored"
  | "extracting_text"
  | "normalizing"
  | "chunking"
  | "embedding"
  | "indexing"
  | "completed"
  | "failed"
  | "partially_failed"
  | "cancelled";

export type LegalExtractionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "requires_ocr";

export type LegalChunkType =
  | "facts"
  | "claims"
  | "court_reasoning"
  | "holding"
  | "procedural_history"
  | "citations"
  | "operative_part"
  | "unknown";

export type LegalSearchMode = "keyword" | "semantic" | "hybrid";

export type RagRequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type RagValidationStatus = "valid" | "invalid" | "warning";

export type SearchFeedbackType =
  | "useful"
  | "irrelevant"
  | "wrong_citation"
  | "missing_source"
  | "hallucination_suspected"
  | "conflicting_sources";

export interface LegalSourceProviderSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly providerType:
    | "user_upload"
    | "workspace_private"
    | "product_curated"
    | "official_feed"
    | "external_paid"
    | "manual_import";
  readonly jurisdiction: string | null;
  readonly accessMode: "file_upload" | "api_import" | "seeded" | "manual";
  readonly isEnabled: boolean;
}

export interface LegalSourceVersionSummary {
  readonly id: string;
  readonly sourceId: string;
  readonly documentVersionId: string | null;
  readonly versionNo: number;
  readonly mimeType: string | null;
  readonly fileSize: number | null;
  readonly language: string | null;
  readonly status: LegalSourceStatus;
  readonly textHash: string | null;
  readonly embeddingHash: string | null;
  readonly publishedAt: string | null;
  readonly ingestedAt: string | null;
}

export interface LegalChunkSummary {
  readonly id: string;
  readonly sourceId: string;
  readonly documentVersionId: string;
  readonly chunkNo: number;
  readonly chunkType: LegalChunkType;
  readonly text: string;
  readonly textHash: string;
  readonly pageFrom: number | null;
  readonly pageTo: number | null;
  readonly charStart: number | null;
  readonly charEnd: number | null;
  readonly metadata: Record<string, unknown>;
  readonly securityScope: LegalSourceVisibility;
  readonly embeddingModel: string | null;
  readonly embeddingHash: string | null;
  readonly indexedAt: string | null;
}

export interface LegalSourceAccessEntry {
  readonly id: string;
  readonly sourceId: string;
  readonly workspaceId: string | null;
  readonly userId: string | null;
  readonly roleRequired: string | null;
  readonly accessLevel: "read" | "rag" | "manage";
  readonly expiresAt: string | null;
  readonly grantedBy: string | null;
  readonly createdAt: string;
}

export interface LegalImportJob {
  readonly id: string;
  readonly providerId: string;
  readonly workspaceId: string | null;
  readonly sourceId: string | null;
  readonly documentId: string | null;
  readonly status: LegalImportJobStatus;
  readonly inputType: string;
  readonly inputRef: string | null;
  readonly totalItems: number;
  readonly processedItems: number;
  readonly failedItems: number;
  readonly errorSummary: string | null;
  readonly temporalWorkflowId: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegalExtractionJob {
  readonly id: string;
  readonly documentVersionId: string;
  readonly status: LegalExtractionStatus;
  readonly extractor: string;
  readonly attempt: number;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly textHash: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
}

export interface LegalSourceSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly documentId: string | null;
  readonly provider: LegalSourceProviderSummary;
  readonly sourceType: LegalSourceType;
  readonly jurisdiction: string | null;
  readonly title: string;
  readonly canonicalUrl: string | null;
  readonly externalId: string | null;
  readonly licenseStatus: LegalLicenseStatus;
  readonly visibility: LegalSourceVisibility;
  readonly classification: DataClassification;
  readonly status: LegalSourceStatus;
  readonly ownerWorkspaceId: string | null;
  readonly ownerUserId: string | null;
  readonly court: string | null;
  readonly caseNumber: string | null;
  readonly decisionDate: string | null;
  readonly hasEmbeddings: boolean;
  readonly indexedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegalSourceDetail extends LegalSourceSummary {
  readonly versions: readonly LegalSourceVersionSummary[];
  readonly accessEntries: readonly LegalSourceAccessEntry[];
  readonly importJobs: readonly LegalImportJob[];
  readonly extractionJobs: readonly LegalExtractionJob[];
  readonly chunks: readonly LegalChunkSummary[];
  readonly metadata: Record<string, unknown>;
  readonly availableActions: {
    readonly canManage: boolean;
    readonly canRetry: boolean;
    readonly canArchive: boolean;
    readonly canUseInRag: boolean;
  };
}

export interface CreateLegalImportJobRequest {
  readonly providerCode: string;
  readonly workspaceId?: string;
  readonly inputType: "files" | "document" | "seed" | "external_payload";
  readonly documentType: LegalSourceType;
  readonly classification: DataClassification;
  readonly files?: readonly {
    readonly uploadId: string;
    readonly title: string;
    readonly mimeType: string;
  }[];
  readonly documentId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LegalSearchFilters {
  readonly sourceType?: readonly LegalSourceType[];
  readonly visibility?: readonly LegalSourceVisibility[];
  readonly court?: readonly string[];
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly category?: readonly string[];
  readonly workspaceId?: string;
  readonly caseNumber?: string;
}

export interface LegalSearchQuery {
  readonly query: string;
  readonly mode: LegalSearchMode;
  readonly filters?: LegalSearchFilters;
  readonly limit?: number;
  readonly offset?: number;
  readonly selectedSourceIds?: readonly string[];
}

export interface LegalSearchFacetBucket {
  readonly value: string;
  readonly count: number;
}

export interface LegalSearchFacet {
  readonly name: string;
  readonly label: string;
  readonly buckets: readonly LegalSearchFacetBucket[];
}

export interface LegalCitation {
  readonly citationId: string;
  readonly sourceId: string;
  readonly chunkId: string;
  readonly documentVersionId: string;
  readonly title: string;
  readonly quote: string;
  readonly pageFrom: number | null;
  readonly pageTo: number | null;
  readonly court: string | null;
  readonly caseNumber: string | null;
  readonly decisionDate: string | null;
  readonly score: number;
}

export interface LegalSearchResult {
  readonly rank: number;
  readonly score: number;
  readonly scoreComponents: {
    readonly lexical: number;
    readonly semantic: number;
    readonly combined: number;
  };
  readonly source: LegalSourceSummary;
  readonly chunk: LegalChunkSummary;
  readonly snippet: string;
  readonly highlights: readonly string[];
  readonly citation: LegalCitation;
}

export interface LegalSearchResponse {
  readonly mode: LegalSearchMode;
  readonly total: number;
  readonly facets: readonly LegalSearchFacet[];
  readonly results: readonly LegalSearchResult[];
  readonly debug: {
    readonly indexAlias: string;
    readonly normalized: boolean;
    readonly aclApplied: boolean;
  };
}

export interface RagAnalyzeRequest {
  readonly taskType: string;
  readonly question: string;
  readonly sourceSelection: {
    readonly mode: "selected_only" | "selected_and_search" | "search_only";
    readonly selectedSourceIds?: readonly string[];
    readonly searchQuery?: string;
    readonly filters?: LegalSearchFilters;
  };
  readonly workspaceDocumentIds?: readonly string[];
  readonly options?: {
    readonly maxContextChunks?: number;
    readonly requireCitations?: boolean;
    readonly includeUnsupportedClaims?: boolean;
  };
}

export interface LegalAnalysisFact {
  readonly text: string;
  readonly citations: readonly string[];
}

export interface LegalAnalysisIssue {
  readonly issue: string;
  readonly analysis: string;
  readonly citations: readonly string[];
}

export interface LegalAnalysisArgument {
  readonly position: string;
  readonly analysis: string;
  readonly supportingSources: readonly string[];
  readonly strength: "low" | "medium" | "high";
  readonly citations: readonly string[];
}

export interface LegalAnalysisOutput {
  readonly summary: string;
  readonly facts: readonly LegalAnalysisFact[];
  readonly legalIssues: readonly LegalAnalysisIssue[];
  readonly arguments: readonly LegalAnalysisArgument[];
  readonly citations: readonly LegalCitation[];
  readonly unsupportedClaims: readonly string[];
  readonly riskFlags: readonly string[];
}

export interface RagRequestSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly taskType: string;
  readonly question: string;
  readonly queryHash: string;
  readonly selectedSourceIds: readonly string[];
  readonly selectedDocumentIds: readonly string[];
  readonly aiRoute: AiProviderRoute | "blocked";
  readonly dataClassification: DataClassification;
  readonly status: RagRequestStatus;
  readonly validationStatus: RagValidationStatus;
  readonly citationValidationStatus: RagValidationStatus;
  readonly unsupportedCount: number;
  readonly riskFlags: readonly string[];
  readonly output: LegalAnalysisOutput | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface SearchFeedback {
  readonly id: string;
  readonly queryId: string;
  readonly resultId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly feedbackType: SearchFeedbackType;
  readonly comment: string | null;
  readonly createdAt: string;
}

export interface CreateSearchFeedbackRequest {
  readonly queryId: string;
  readonly resultId: string;
  readonly feedbackType: SearchFeedbackType;
  readonly comment?: string;
}
