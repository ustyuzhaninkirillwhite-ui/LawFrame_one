import type { AiProviderRoute } from "./ai";
import type { DataClassification } from "./enums/data-classification";
import type {
  DocumentKind,
  DocumentSummary,
  DocumentVersionSummary,
  RunArtifact,
} from "./domain";
import type { PermissionCode } from "./permissions/permission-codes";

export type LegalWorkProfileType = "system" | "workspace" | "personal";

export type LegalWorkProfileStatus = "draft" | "active" | "archived";

export type LegalWorkProfileVersionStatus =
  | "draft"
  | "published"
  | "deprecated"
  | "archived";

export type ProfileMergeStrategy =
  | "deep_merge"
  | "replace_arrays"
  | "locked_sections_first";

export interface LegalWorkProfileSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ownerUserId: string | null;
  readonly profileType: LegalWorkProfileType;
  readonly name: string;
  readonly description: string | null;
  readonly status: LegalWorkProfileStatus;
  readonly currentVersionId: string | null;
  readonly currentVersionNo: number | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegalWorkProfileVersionSummary {
  readonly id: string;
  readonly profileId: string;
  readonly version: number;
  readonly schemaVersion: string;
  readonly status: LegalWorkProfileVersionStatus;
  readonly content: Record<string, unknown>;
  readonly contentHash: string;
  readonly changeNote: string | null;
  readonly createdBy: string | null;
  readonly publishedBy: string | null;
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

export interface ProfileValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly severity: "error" | "warning";
  readonly message: string;
}

export interface ProfileValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ProfileValidationIssue[];
  readonly normalizedContent: Record<string, unknown>;
}

export interface EffectiveProfileSnapshotSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly userId: string | null;
  readonly sourceProfileVersionIds: readonly string[];
  readonly effectiveContent: Record<string, unknown>;
  readonly effectiveHash: string;
  readonly createdForRunId: string | null;
  readonly createdForPreviewId: string | null;
  readonly createdAt: string;
}

export interface EffectiveProfilePreview {
  readonly previewId: string;
  readonly snapshot: EffectiveProfileSnapshotSummary;
  readonly validation: ProfileValidationResult;
}

export interface LegalWorkProfileDetail extends LegalWorkProfileSummary {
  readonly versions: readonly LegalWorkProfileVersionSummary[];
  readonly validation: ProfileValidationResult;
  readonly effectivePreview: EffectiveProfileSnapshotSummary | null;
}

export interface CreateLegalWorkProfileRequest {
  readonly workspaceId?: string | null;
  readonly ownerUserId?: string | null;
  readonly profileType: LegalWorkProfileType;
  readonly name: string;
  readonly description?: string | null;
  readonly content: Record<string, unknown>;
  readonly changeNote?: string | null;
}

export interface UpdateLegalWorkProfileDraftRequest {
  readonly name?: string;
  readonly description?: string | null;
  readonly content?: Record<string, unknown>;
  readonly changeNote?: string | null;
}

export interface PreviewEffectiveProfileRequest {
  readonly workspaceId?: string | null;
  readonly userId?: string | null;
  readonly profileId?: string | null;
  readonly automationOverrides?: Record<string, unknown>;
}

export interface RestoreLegalWorkProfileVersionRequest {
  readonly versionId: string;
  readonly changeNote?: string | null;
}

export interface DocumentTypeSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly code: string;
  readonly name: string;
  readonly jurisdiction: string | null;
  readonly practiceArea: string | null;
  readonly status: "draft" | "published" | "deprecated";
  readonly activeVersionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentStructureSection {
  readonly sectionId: string;
  readonly title: string;
  readonly kind:
    | "header"
    | "intro"
    | "facts"
    | "analysis"
    | "claims"
    | "attachments"
    | "signature"
    | "custom";
  readonly required: boolean;
  readonly order: number;
  readonly locked: boolean;
  readonly clauseIds: readonly string[];
  readonly placeholderCodes: readonly string[];
}

export interface DocumentTypeVersionSummary {
  readonly id: string;
  readonly documentTypeId: string;
  readonly version: number;
  readonly status: "draft" | "published" | "deprecated";
  readonly schemaVersion: string;
  readonly structure: readonly DocumentStructureSection[];
  readonly attachmentDefaults: readonly string[];
  readonly validationRules: Record<string, unknown>;
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

export interface DocumentTypeDetail extends DocumentTypeSummary {
  readonly versions: readonly DocumentTypeVersionSummary[];
}

export interface DocumentStructureRecord {
  readonly id: string;
  readonly documentTypeId: string;
  readonly documentTypeVersionId: string;
  readonly sections: readonly DocumentStructureSection[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateDocumentTypeRequest {
  readonly workspaceId?: string | null;
  readonly code: string;
  readonly name: string;
  readonly jurisdiction?: string | null;
  readonly practiceArea?: string | null;
  readonly structure: readonly DocumentStructureSection[];
  readonly attachmentDefaults?: readonly string[];
  readonly validationRules?: Record<string, unknown>;
}

export interface UpdateDocumentTypeRequest {
  readonly name?: string;
  readonly jurisdiction?: string | null;
  readonly practiceArea?: string | null;
  readonly structure?: readonly DocumentStructureSection[];
  readonly attachmentDefaults?: readonly string[];
  readonly validationRules?: Record<string, unknown>;
}

export interface CreateDocumentStructureRequest {
  readonly documentTypeId: string;
  readonly documentTypeVersionId?: string | null;
  readonly sections: readonly DocumentStructureSection[];
}

export interface UpdateDocumentStructureRequest {
  readonly sections: readonly DocumentStructureSection[];
}

export interface ClauseLibraryItemSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ownerUserId: string | null;
  readonly scope: "system" | "workspace" | "personal";
  readonly title: string;
  readonly tags: readonly string[];
  readonly status: "draft" | "published" | "archived";
  readonly richText: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PhraseRuleSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ownerUserId: string | null;
  readonly ruleType: "preferred" | "forbidden";
  readonly phrase: string;
  readonly rationale: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateClauseLibraryItemRequest {
  readonly workspaceId?: string | null;
  readonly ownerUserId?: string | null;
  readonly scope: ClauseLibraryItemSummary["scope"];
  readonly title: string;
  readonly tags?: readonly string[];
  readonly richText: Record<string, unknown>;
}

export interface UpdateClauseLibraryItemRequest {
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly richText?: Record<string, unknown>;
  readonly status?: ClauseLibraryItemSummary["status"];
}

export interface CreatePhraseRuleRequest {
  readonly workspaceId?: string | null;
  readonly ownerUserId?: string | null;
  readonly ruleType: PhraseRuleSummary["ruleType"];
  readonly phrase: string;
  readonly rationale?: string | null;
}

export interface UpdatePhraseRuleRequest {
  readonly phrase?: string;
  readonly rationale?: string | null;
}

export interface DocumentTemplatePlaceholder {
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly sourceType:
    | "fact"
    | "profile"
    | "clause"
    | "document"
    | "document_type"
    | "computed";
  readonly exampleValue?: string | null;
}

export interface DocumentTemplateMapping {
  readonly placeholderCode: string;
  readonly sourcePath: string;
  readonly fallbackValue?: string | null;
  readonly required: boolean;
}

export interface DocumentTemplateSummary {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly ownerUserId: string | null;
  readonly documentTypeId: string | null;
  readonly sourceDocumentId: string;
  readonly sourceDocumentVersionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: "workspace" | "personal" | "public" | "system";
  readonly status: "draft" | "published" | "deprecated" | "archived";
  readonly activeVersionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentTemplateVersionSummary {
  readonly id: string;
  readonly templateId: string;
  readonly version: number;
  readonly status: "draft" | "published" | "deprecated";
  readonly sourceDocumentVersionId: string;
  readonly previewDocumentVersionId: string | null;
  readonly placeholders: readonly DocumentTemplatePlaceholder[];
  readonly mappings: readonly DocumentTemplateMapping[];
  readonly createdAt: string;
  readonly publishedAt: string | null;
}

export interface DocumentTemplateDetail extends DocumentTemplateSummary {
  readonly versions: readonly DocumentTemplateVersionSummary[];
}

export interface CreateDocumentTemplateRequest {
  readonly workspaceId?: string | null;
  readonly ownerUserId?: string | null;
  readonly documentTypeId?: string | null;
  readonly sourceDocumentId: string;
  readonly sourceDocumentVersionId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly visibility: DocumentTemplateSummary["visibility"];
  readonly placeholders?: readonly DocumentTemplatePlaceholder[];
  readonly mappings?: readonly DocumentTemplateMapping[];
}

export interface UpdateDocumentTemplateRequest {
  readonly title?: string;
  readonly description?: string | null;
  readonly documentTypeId?: string | null;
  readonly visibility?: DocumentTemplateSummary["visibility"];
  readonly placeholders?: readonly DocumentTemplatePlaceholder[];
  readonly mappings?: readonly DocumentTemplateMapping[];
}

export interface ParseDocumentTemplatePlaceholdersResponse {
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly placeholders: readonly DocumentTemplatePlaceholder[];
  readonly detectedTags: readonly string[];
}

export interface PublishDocumentTemplateVersionRequest {
  readonly versionId?: string | null;
}

export interface DocumentGenerationInput {
  readonly facts?: Record<string, unknown>;
  readonly params?: Record<string, unknown>;
  readonly sourceDocumentIds?: readonly string[];
}

export interface DocumentGenerationPreviewRequest {
  readonly templateId: string;
  readonly templateVersionId?: string | null;
  readonly profileId?: string | null;
  readonly documentTypeId?: string | null;
  readonly approvalRouteId?: string | null;
  readonly workflowRunId?: string | null;
  readonly input: DocumentGenerationInput;
  readonly aiSectionCodes?: readonly string[];
}

export interface DocumentGenerationJobSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly templateId: string;
  readonly templateVersionId: string;
  readonly profileSnapshotId: string | null;
  readonly workflowRunId: string | null;
  readonly approvalRouteId: string | null;
  readonly status:
    | "queued"
    | "preview_ready"
    | "waiting_approval"
    | "finalized"
    | "failed";
  readonly previewDocumentId: string | null;
  readonly previewDocumentVersionId: string | null;
  readonly finalDocumentId: string | null;
  readonly finalDocumentVersionId: string | null;
  readonly validationReportId: string | null;
  readonly missingFieldCodes: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentGenerationJobDetail extends DocumentGenerationJobSummary {
  readonly previewDocument: DocumentSummary | null;
  readonly finalDocument: DocumentSummary | null;
  readonly artifacts: readonly RunArtifact[];
}

export interface FinalizeDocumentGenerationRequest {
  readonly generationJobId?: string | null;
  readonly approvalDecisionComment?: string | null;
}

export interface DocumentValidationIssue {
  readonly id: string;
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly path: string;
  readonly message: string;
  readonly suggestedFix: string | null;
  readonly resolved: boolean;
}

export interface DocumentValidationReportSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly generationJobId: string | null;
  readonly documentId: string | null;
  readonly documentVersionId: string | null;
  readonly status: "valid" | "invalid" | "warning";
  readonly issueCount: number;
  readonly blockingIssueCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DocumentValidationReportDetail
  extends DocumentValidationReportSummary {
  readonly issues: readonly DocumentValidationIssue[];
}

export interface RecheckDocumentValidationRequest {
  readonly generationJobId?: string | null;
  readonly profileId?: string | null;
  readonly templateVersionId?: string | null;
}

export interface ApprovalRouteStep {
  readonly stepId: string;
  readonly order: number;
  readonly approverRole?: string | null;
  readonly approverUserId?: string | null;
  readonly title: string;
  readonly requiresComment: boolean;
  readonly dueInHours?: number | null;
}

export interface ApprovalRouteSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "draft" | "active" | "archived";
  readonly appliesToDocumentTypes: readonly string[];
  readonly steps: readonly ApprovalRouteStep[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ApprovalRouteDetail = ApprovalRouteSummary;

export interface CreateApprovalRouteRequest {
  readonly name: string;
  readonly description?: string | null;
  readonly appliesToDocumentTypes?: readonly string[];
  readonly steps: readonly ApprovalRouteStep[];
}

export interface UpdateApprovalRouteRequest {
  readonly name?: string;
  readonly description?: string | null;
  readonly status?: ApprovalRouteSummary["status"];
  readonly appliesToDocumentTypes?: readonly string[];
  readonly steps?: readonly ApprovalRouteStep[];
}

export interface ApprovalTaskSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly routeId: string | null;
  readonly generationJobId: string | null;
  readonly workflowRunId: string | null;
  readonly title: string;
  readonly status:
    | "pending"
    | "approved"
    | "rejected"
    | "changes_requested"
    | "expired"
    | "cancelled"
    | "superseded";
  readonly approverUserId: string | null;
  readonly approverRole: string | null;
  readonly dueAt: string | null;
  readonly decisionComment: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

export interface ApprovalTaskDecisionRequest {
  readonly comment?: string | null;
}

export interface ProfileImportJobSummary {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceDocumentId: string;
  readonly sourceDocumentVersionId: string;
  readonly targetProfileId: string | null;
  readonly status:
    | "queued"
    | "analyzing"
    | "draft_ready"
    | "failed"
    | "applied";
  readonly inferredProfileContent: Record<string, unknown> | null;
  readonly inferredTemplateTitle: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProfileImportJobRequest {
  readonly sourceDocumentId: string;
  readonly sourceDocumentVersionId: string;
  readonly targetProfileId?: string | null;
}

export interface WorkflowRuntimeDocumentTemplateExecuteRequest {
  readonly installedAutomationId: string;
  readonly workflowRunId: string;
  readonly templateId: string;
  readonly templateVersionId?: string | null;
  readonly profileId?: string | null;
  readonly input: DocumentGenerationInput;
}

export interface WorkflowRuntimeDocumentValidationExecuteRequest {
  readonly workflowRunId: string;
  readonly generationJobId: string;
}

export interface WorkflowRuntimeApprovalRequestExecuteRequest {
  readonly workflowRunId: string;
  readonly generationJobId: string;
  readonly approvalRouteId?: string | null;
  readonly title: string;
}

export interface Stage7CapabilitySummary {
  readonly availableDocumentKinds: readonly DocumentKind[];
  readonly restrictedAiRoutes: readonly AiProviderRoute[];
  readonly requiredPermissions: readonly PermissionCode[];
  readonly supportedGenerationStates: readonly DocumentGenerationJobSummary["status"][];
  readonly sourceDocuments: readonly Pick<
    DocumentVersionSummary,
    "id" | "documentId" | "mimeType" | "versionNo"
  >[];
  readonly sensitivityClasses: readonly DataClassification[];
}
