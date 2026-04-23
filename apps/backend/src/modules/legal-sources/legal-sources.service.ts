import type {
  LegalChunkSummary,
  LegalExtractionJob,
  LegalImportJob,
  LegalSourceAccessEntry,
  LegalSourceDetail,
  LegalSourceProviderSummary,
  LegalSourceSummary,
  LegalSourceVersionSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LegalIndexingService } from '../legal-indexing/legal-indexing.service';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface SourceSummaryRow {
  readonly source_id: string;
  readonly workspace_id: string | null;
  readonly document_id: string | null;
  readonly source_type: LegalSourceSummary['sourceType'];
  readonly jurisdiction: string | null;
  readonly title: string;
  readonly canonical_url: string | null;
  readonly external_id: string | null;
  readonly license_status: LegalSourceSummary['licenseStatus'];
  readonly visibility: LegalSourceSummary['visibility'];
  readonly classification: LegalSourceSummary['classification'];
  readonly status: LegalSourceSummary['status'];
  readonly owner_workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly metadata: Record<string, unknown>;
  readonly last_used_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly provider_id: string;
  readonly provider_code: string;
  readonly provider_name: string;
  readonly provider_type: LegalSourceProviderSummary['providerType'];
  readonly provider_jurisdiction: string | null;
  readonly provider_access_mode: LegalSourceProviderSummary['accessMode'];
  readonly provider_is_enabled: boolean;
  readonly indexed_at: string | null;
  readonly has_embeddings: boolean;
}

interface VersionRow {
  readonly id: string;
  readonly source_id: string;
  readonly document_version_id: string | null;
  readonly version_no: number;
  readonly mime_type: string | null;
  readonly file_size: string | number | null;
  readonly language: string | null;
  readonly status: LegalSourceVersionSummary['status'];
  readonly text_hash: string | null;
  readonly embedding_hash: string | null;
  readonly published_at: string | null;
  readonly ingested_at: string | null;
}

interface AccessRow {
  readonly id: string;
  readonly source_id: string;
  readonly workspace_id: string | null;
  readonly user_id: string | null;
  readonly role_required: string | null;
  readonly access_level: LegalSourceAccessEntry['accessLevel'];
  readonly expires_at: string | null;
  readonly granted_by: string | null;
  readonly created_at: string;
}

interface ImportJobRow {
  readonly id: string;
  readonly provider_id: string;
  readonly workspace_id: string | null;
  readonly source_id: string | null;
  readonly document_id: string | null;
  readonly status: LegalImportJob['status'];
  readonly input_type: string;
  readonly input_ref: string | null;
  readonly total_items: number;
  readonly processed_items: number;
  readonly failed_items: number;
  readonly error_summary: string | null;
  readonly temporal_workflow_id: string | null;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ExtractionRow {
  readonly id: string;
  readonly document_version_id: string;
  readonly status: LegalExtractionJob['status'];
  readonly extractor: string;
  readonly attempt: number;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly text_hash: string | null;
  readonly started_at: string | null;
  readonly finished_at: string | null;
}

interface ChunkRow {
  readonly id: string;
  readonly source_id: string;
  readonly document_version_id: string;
  readonly chunk_no: number;
  readonly chunk_type: LegalChunkSummary['chunkType'];
  readonly text: string;
  readonly text_hash: string;
  readonly page_from: number | null;
  readonly page_to: number | null;
  readonly char_start: number | null;
  readonly char_end: number | null;
  readonly metadata: Record<string, unknown>;
  readonly security_scope: LegalChunkSummary['securityScope'];
  readonly embedding_model: string | null;
  readonly embedding_hash: string | null;
  readonly indexed_at: string | null;
}

@Injectable()
export class LegalSourcesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly legalIndexingService: LegalIndexingService,
  ) {}

  createImportJob(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: Parameters<LegalIndexingService['createImportFromDocument']>[2],
    meta: RequestMeta,
  ) {
    return this.legalIndexingService.createImportFromDocument(
      actor,
      access,
      input,
      meta,
    );
  }

  getImportJob(workspaceId: string, jobId: string) {
    return this.legalIndexingService.getImportJob(workspaceId, jobId);
  }

  async listSources(
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<readonly LegalSourceSummary[]> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Active workspace is required for legal sources.',
      );
    }

    const rows = await this.databaseService.query<SourceSummaryRow>(
      `
        select
          s.id as source_id,
          s.workspace_id,
          s.document_id,
          s.source_type,
          s.jurisdiction,
          s.title,
          s.canonical_url,
          s.external_id,
          s.license_status,
          s.visibility,
          s.classification,
          s.status,
          s.owner_workspace_id,
          s.owner_user_id,
          s.metadata,
          s.last_used_at,
          s.created_at,
          s.updated_at,
          p.id as provider_id,
          p.code as provider_code,
          p.name as provider_name,
          p.provider_type,
          p.jurisdiction as provider_jurisdiction,
          p.access_mode as provider_access_mode,
          p.is_enabled as provider_is_enabled,
          (
            select max(lc.indexed_at)
            from app.legal_chunks lc
            where lc.source_id = s.id
          ) as indexed_at,
          exists(
            select 1
            from app.legal_chunks lc
            where lc.source_id = s.id
              and lc.embedding_hash is not null
          ) as has_embeddings
        from app.legal_sources s
        inner join app.legal_source_providers p
          on p.id = s.provider_id
        where ${buildSourceAccessClause('s', 1, 2)}
        order by s.updated_at desc, s.created_at desc
      `,
      [workspaceId, actor.id],
    );

    return rows.rows.map((row) => mapSourceSummary(row));
  }

  async getSourceDetail(
    actor: AuthenticatedActor,
    access: AccessContext,
    sourceId: string,
  ): Promise<LegalSourceDetail> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        400,
        'Active workspace is required for legal source detail.',
      );
    }

    const summaryRow = await this.databaseService.one<SourceSummaryRow>(
      `
        select
          s.id as source_id,
          s.workspace_id,
          s.document_id,
          s.source_type,
          s.jurisdiction,
          s.title,
          s.canonical_url,
          s.external_id,
          s.license_status,
          s.visibility,
          s.classification,
          s.status,
          s.owner_workspace_id,
          s.owner_user_id,
          s.metadata,
          s.last_used_at,
          s.created_at,
          s.updated_at,
          p.id as provider_id,
          p.code as provider_code,
          p.name as provider_name,
          p.provider_type,
          p.jurisdiction as provider_jurisdiction,
          p.access_mode as provider_access_mode,
          p.is_enabled as provider_is_enabled,
          (
            select max(lc.indexed_at)
            from app.legal_chunks lc
            where lc.source_id = s.id
          ) as indexed_at,
          exists(
            select 1
            from app.legal_chunks lc
            where lc.source_id = s.id
              and lc.embedding_hash is not null
          ) as has_embeddings
        from app.legal_sources s
        inner join app.legal_source_providers p
          on p.id = s.provider_id
        where s.id = $3
          and ${buildSourceAccessClause('s', 1, 2)}
        limit 1
      `,
      [workspaceId, actor.id, sourceId],
    );

    if (!summaryRow) {
      throw new AppHttpException(
        'LEGAL_SOURCE_NOT_FOUND',
        404,
        'Legal source was not found in the active workspace.',
      );
    }

    const [versions, accessEntries, importJobs, extractionJobs, chunks] =
      await Promise.all([
        this.listVersions(summaryRow.source_id),
        this.listAccessEntries(summaryRow.source_id),
        this.listImportJobs(summaryRow.source_id),
        this.listExtractionJobs(summaryRow.source_id),
        this.listChunks(summaryRow.source_id),
      ]);

    const detail: LegalSourceDetail = {
      ...mapSourceSummary(summaryRow),
      versions,
      accessEntries,
      importJobs,
      extractionJobs,
      chunks,
      metadata: normalizeMetadata(summaryRow.metadata),
      availableActions: {
        canManage: access.permissions.includes('legal_sources.manage'),
        canRetry:
          access.permissions.includes('legal_sources.manage') &&
          ['pending_processing', 'index_failed'].includes(summaryRow.status),
        canArchive:
          access.permissions.includes('legal_sources.manage') &&
          summaryRow.status !== 'archived',
        canUseInRag:
          access.permissions.includes('legal_rag.use') &&
          ['processed', 'indexed'].includes(summaryRow.status),
      },
    };

    await this.databaseService.query(
      `
        update app.legal_sources
        set
          last_used_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [sourceId],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'legal.source.opened',
      entityType: 'legal_source',
      entityId: sourceId,
      result: 'success',
      metadata: {
        chunks: chunks.length,
        provider: detail.provider.code,
      },
    });

    return detail;
  }

  private async listVersions(
    sourceId: string,
  ): Promise<readonly LegalSourceVersionSummary[]> {
    const result = await this.databaseService.query<VersionRow>(
      `
        select
          id,
          source_id,
          document_version_id,
          version_no,
          mime_type,
          file_size,
          language,
          status,
          text_hash,
          embedding_hash,
          published_at,
          ingested_at
        from app.legal_document_versions
        where source_id = $1
        order by version_no desc
      `,
      [sourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      documentVersionId: row.document_version_id,
      versionNo: Number(row.version_no),
      mimeType: row.mime_type,
      fileSize: row.file_size === null ? null : Number(row.file_size),
      language: row.language,
      status: row.status,
      textHash: row.text_hash,
      embeddingHash: row.embedding_hash,
      publishedAt: row.published_at,
      ingestedAt: row.ingested_at,
    }));
  }

  private async listAccessEntries(
    sourceId: string,
  ): Promise<readonly LegalSourceAccessEntry[]> {
    const result = await this.databaseService.query<AccessRow>(
      `
        select
          id,
          source_id,
          workspace_id,
          user_id,
          role_required,
          access_level,
          expires_at,
          granted_by,
          created_at
        from app.legal_source_access
        where source_id = $1
        order by created_at asc
      `,
      [sourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      roleRequired: row.role_required,
      accessLevel: row.access_level,
      expiresAt: row.expires_at,
      grantedBy: row.granted_by,
      createdAt: row.created_at,
    }));
  }

  private async listImportJobs(
    sourceId: string,
  ): Promise<readonly LegalImportJob[]> {
    const result = await this.databaseService.query<ImportJobRow>(
      `
        select
          id,
          provider_id,
          workspace_id,
          source_id,
          document_id,
          status,
          input_type,
          input_ref,
          total_items,
          processed_items,
          failed_items,
          error_summary,
          temporal_workflow_id,
          started_at,
          finished_at,
          created_at,
          updated_at
        from app.legal_import_jobs
        where source_id = $1
        order by created_at desc
      `,
      [sourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id,
      documentId: row.document_id,
      status: row.status,
      inputType: row.input_type,
      inputRef: row.input_ref,
      totalItems: Number(row.total_items),
      processedItems: Number(row.processed_items),
      failedItems: Number(row.failed_items),
      errorSummary: row.error_summary,
      temporalWorkflowId: row.temporal_workflow_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async listExtractionJobs(
    sourceId: string,
  ): Promise<readonly LegalExtractionJob[]> {
    const result = await this.databaseService.query<ExtractionRow>(
      `
        select
          lej.id,
          lej.document_version_id,
          lej.status,
          lej.extractor,
          lej.attempt,
          lej.error_code,
          lej.error_message,
          lej.text_hash,
          lej.started_at,
          lej.finished_at
        from app.legal_extraction_jobs lej
        inner join app.legal_document_versions ldv
          on ldv.id = lej.document_version_id
        where ldv.source_id = $1
        order by lej.created_at desc
      `,
      [sourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      documentVersionId: row.document_version_id,
      status: row.status,
      extractor: row.extractor,
      attempt: Number(row.attempt),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      textHash: row.text_hash,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }));
  }

  private async listChunks(
    sourceId: string,
  ): Promise<readonly LegalChunkSummary[]> {
    const result = await this.databaseService.query<ChunkRow>(
      `
        select
          id,
          source_id,
          document_version_id,
          chunk_no,
          chunk_type,
          text,
          text_hash,
          page_from,
          page_to,
          char_start,
          char_end,
          metadata,
          security_scope,
          embedding_model,
          embedding_hash,
          indexed_at
        from app.legal_chunks
        where source_id = $1
        order by chunk_no asc
        limit 24
      `,
      [sourceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      documentVersionId: row.document_version_id,
      chunkNo: Number(row.chunk_no),
      chunkType: row.chunk_type,
      text: row.text,
      textHash: row.text_hash,
      pageFrom: row.page_from,
      pageTo: row.page_to,
      charStart: row.char_start,
      charEnd: row.char_end,
      metadata: normalizeMetadata(row.metadata),
      securityScope: row.security_scope,
      embeddingModel: row.embedding_model,
      embeddingHash: row.embedding_hash,
      indexedAt: row.indexed_at,
    }));
  }
}

function buildSourceAccessClause(
  sourceAlias: string,
  workspaceParamIndex: number,
  actorParamIndex: number,
) {
  return `
    (
      ${sourceAlias}.workspace_id = $${workspaceParamIndex}
      or ${sourceAlias}.visibility in ('public', 'product_private')
      or (
        ${sourceAlias}.visibility = 'user_private'
        and ${sourceAlias}.owner_user_id = $${actorParamIndex}
      )
      or exists(
        select 1
        from app.legal_source_access lsa
        where lsa.source_id = ${sourceAlias}.id
          and (
            lsa.workspace_id = $${workspaceParamIndex}
            or lsa.user_id = $${actorParamIndex}
          )
          and (
            lsa.expires_at is null
            or lsa.expires_at > timezone('utc', now())
          )
      )
    )
  `;
}

function mapSourceSummary(row: SourceSummaryRow): LegalSourceSummary {
  const metadata = normalizeMetadata(row.metadata);

  return {
    id: row.source_id,
    workspaceId: row.workspace_id,
    documentId: row.document_id,
    provider: {
      id: row.provider_id,
      code: row.provider_code,
      name: row.provider_name,
      providerType: row.provider_type,
      jurisdiction: row.provider_jurisdiction,
      accessMode: row.provider_access_mode,
      isEnabled: row.provider_is_enabled,
    },
    sourceType: row.source_type,
    jurisdiction: row.jurisdiction,
    title: row.title,
    canonicalUrl: row.canonical_url,
    externalId: row.external_id,
    licenseStatus: row.license_status,
    visibility: row.visibility,
    classification: row.classification,
    status: row.status,
    ownerWorkspaceId: row.owner_workspace_id,
    ownerUserId: row.owner_user_id,
    court: readMetadataString(metadata, 'court'),
    caseNumber:
      readMetadataString(metadata, 'caseNumber') ??
      readMetadataString(metadata, 'case_number'),
    decisionDate:
      readMetadataString(metadata, 'decisionDate') ??
      readMetadataString(metadata, 'decision_date'),
    hasEmbeddings: row.has_embeddings,
    indexedAt: row.indexed_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeMetadata(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return value ?? {};
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}
