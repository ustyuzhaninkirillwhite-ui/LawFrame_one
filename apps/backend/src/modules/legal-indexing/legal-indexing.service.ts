import type {
  CreateLegalImportJobRequest,
  DataClassification,
  LegalChunkType,
  LegalImportJob,
  LegalImportJobStatus,
  LegalSourceVisibility,
} from "@lexframe/contracts";
import type {
  AccessContext,
  AuthenticatedActor,
} from "../../common/types/lexframe-request";
import type { PoolClient } from "pg";
import { loadServerEnv } from "@lexframe/config";
import { Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { AppHttpException } from "../../common/errors/app-http.exception";
import { AuditService } from "../audit/audit.service";
import { DatabaseService } from "../database/database.service";

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface ProviderRow {
  readonly id: string;
  readonly code: string;
}

interface DocumentImportRow {
  readonly document_id: string;
  readonly workspace_id: string;
  readonly owner_id: string;
  readonly created_by_user_id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly classification: DataClassification;
  readonly current_version_id: string | null;
  readonly version_no: number | null;
  readonly mime_type: string | null;
  readonly size_bytes: number | null;
  readonly sha256: string | null;
  readonly storage_bucket: string | null;
  readonly storage_path: string | null;
  readonly completed_at: string | null;
  readonly version_created_at: string | null;
  readonly original_filename: string | null;
}

interface ExistingLegalVersionRow {
  readonly id: string;
  readonly source_id: string;
  readonly version_no: number;
}

interface TextChunkRow {
  readonly content: string;
  readonly chunk_index: number;
}

interface ImportJobRow {
  readonly id: string;
  readonly provider_id: string;
  readonly workspace_id: string | null;
  readonly source_id: string | null;
  readonly document_id: string | null;
  readonly status: LegalImportJobStatus;
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

interface ChunkSeed {
  readonly chunkNo: number;
  readonly chunkType: LegalChunkType;
  readonly text: string;
  readonly textHash: string;
  readonly pageFrom: number | null;
  readonly pageTo: number | null;
  readonly metadata: Record<string, unknown>;
  readonly citationLabel: string;
}

const SUPPORTED_EXTRACTION_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const DEFAULT_EMBEDDING_MODEL = "lexframe-stage6-mvp";
const DEFAULT_INDEX_VERSION = "legal_chunks_v1";

@Injectable()
export class LegalIndexingService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  getWorkflowRegistry() {
    return {
      taskQueue: this.env.TEMPORAL_TASK_QUEUE,
      namespace: this.env.TEMPORAL_NAMESPACE,
      address: this.env.TEMPORAL_ADDRESS,
      workflows: [
        "LegalSourceImportWorkflow",
        "LegalExtractNormalizeWorkflow",
        "LegalEmbedIndexWorkflow",
        "LegalRagAnalyzeWorkflow",
        "LegalReindexWorkflow",
      ] as const,
      index: {
        alias: this.env.OPENSEARCH_INDEX_ALIAS,
        physicalIndex: DEFAULT_INDEX_VERSION,
        searchPipeline: this.env.OPENSEARCH_SEARCH_PIPELINE,
        analyzer: "legal_ru",
      },
    };
  }

  async createImportFromDocument(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateLegalImportJobRequest,
    meta: RequestMeta,
  ): Promise<LegalImportJob> {
    const workspaceId = access.activeWorkspace?.id;

    if (!workspaceId) {
      throw new AppHttpException(
        "WORKSPACE_CONTEXT_REQUIRED",
        400,
        "Для импорта юридического источника требуется активное рабочее пространство.",
      );
    }

    const documentId = this.resolveDocumentId(input);
    const provider = await this.loadProvider(input.providerCode);
    const document = await this.loadDocumentForImport(documentId, workspaceId);

    if (!document.current_version_id || !document.version_no) {
      throw new AppHttpException(
        "DOCUMENT_VERSION_NOT_READY",
        409,
        "Перед запуском юридического импорта требуется текущая версия документа.",
      );
    }

    const existingLegalVersion = await this.loadExistingLegalVersion(
      document.current_version_id,
    );
    const sourceId = existingLegalVersion?.source_id ?? randomUUID();
    const legalDocumentVersionId = existingLegalVersion?.id ?? randomUUID();
    const importJobId = randomUUID();
    const extractionJobId = randomUUID();
    const textContent = await this.loadNormalizedText(document.current_version_id);
    const normalizedText = this.resolveNormalizedText(document, textContent);
    const supportsExtraction = document.mime_type
      ? SUPPORTED_EXTRACTION_MIME_TYPES.has(document.mime_type)
      : false;
    const requiresOcr = !supportsExtraction;
    const chunks =
      !requiresOcr && normalizedText
        ? this.chunkNormalizedText(normalizedText, input.classification)
        : [];
    const now = new Date().toISOString();
    const errorSummary = requiresOcr
      ? "Для этого типа документа требуется OCR fallback."
      : normalizedText === null
        ? "Извлечённый текст недоступен. Импорт создал только оболочку источника."
        : null;
    const importStatus: LegalImportJobStatus = requiresOcr
      ? "partially_failed"
      : "completed";
    const sourceStatus = requiresOcr ? "pending_processing" : "indexed";
    const extractionStatus = requiresOcr ? "requires_ocr" : "completed";
    const visibility = resolveVisibility(input.classification, provider.code);
    const baseMetadata = normalizeRecord(input.metadata);
    const sourceMetadata = {
      ...baseMetadata,
      workflowNames: this.getWorkflowRegistry().workflows,
      importMvp: true,
      originalFilename: document.original_filename,
      sourceDocumentId: document.document_id,
      mimeType: document.mime_type,
      storageBucket: document.storage_bucket,
      storagePath: document.storage_path,
      usedPlaceholderText: textContent === null && normalizedText !== null,
      ...(typeof baseMetadata.caseNumber === "string"
        ? {}
        : {
            caseNumber: extractCaseNumber(
              document.title,
              document.description,
            ),
          }),
    };

    await this.databaseService.transaction(async (client) => {
      await this.upsertLegalSource(
        client,
        {
          id: sourceId,
          workspaceId,
          documentId: document.document_id,
          providerId: provider.id,
          sourceType: input.documentType,
          title: document.title,
          classification: input.classification,
          visibility,
          status: sourceStatus,
          ownerWorkspaceId: workspaceId,
          ownerUserId: document.owner_id,
          createdByUserId: actor.id,
          metadata: sourceMetadata,
        },
      );

      await client.query(
        `
          insert into app.legal_document_versions (
            id,
            source_id,
            workspace_id,
            document_version_id,
            version_no,
            text_hash,
            metadata_hash,
            embedding_hash,
            storage_bucket,
            storage_path,
            mime_type,
            file_size,
            language,
            ingested_at,
            published_at,
            status
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            'ru',
            timezone('utc', now()),
            $13,
            $14
          )
          on conflict (id) do update
          set
            source_id = excluded.source_id,
            workspace_id = excluded.workspace_id,
            document_version_id = excluded.document_version_id,
            version_no = excluded.version_no,
            text_hash = excluded.text_hash,
            metadata_hash = excluded.metadata_hash,
            embedding_hash = excluded.embedding_hash,
            storage_bucket = excluded.storage_bucket,
            storage_path = excluded.storage_path,
            mime_type = excluded.mime_type,
            file_size = excluded.file_size,
            language = excluded.language,
            ingested_at = excluded.ingested_at,
            published_at = excluded.published_at,
            status = excluded.status,
            updated_at = timezone('utc', now())
        `,
        [
          legalDocumentVersionId,
          sourceId,
          workspaceId,
          document.current_version_id,
          document.version_no,
          normalizedText ? hashText(normalizedText) : null,
          hashText(JSON.stringify(sourceMetadata)),
          normalizedText
            ? hashText(
                `${document.current_version_id}:${hashText(normalizedText)}:${DEFAULT_EMBEDDING_MODEL}:${DEFAULT_INDEX_VERSION}`,
              )
            : null,
          document.storage_bucket,
          document.storage_path,
          document.mime_type,
          document.size_bytes,
          document.completed_at ?? document.version_created_at,
          sourceStatus,
        ],
      );

      await client.query(
        `delete from app.legal_extraction_jobs where document_version_id = $1`,
        [legalDocumentVersionId],
      );
      await client.query(
        `delete from app.legal_document_texts where document_version_id = $1`,
        [legalDocumentVersionId],
      );
      await client.query(`delete from app.legal_chunks where document_version_id = $1`, [
        legalDocumentVersionId,
      ]);

      if (normalizedText) {
        await client.query(
          `
            insert into app.legal_document_texts (
              document_version_id,
              workspace_id,
              normalized_text,
              raw_text_ref,
              language,
              paragraph_map,
              text_hash
            )
            values ($1, $2, $3, $4, 'ru', $5::jsonb, $6)
          `,
          [
            legalDocumentVersionId,
            workspaceId,
            normalizedText,
            document.storage_path,
            JSON.stringify(
              chunks.map((chunk) => ({
                chunkNo: chunk.chunkNo,
                citationLabel: chunk.citationLabel,
              })),
            ),
            hashText(normalizedText),
          ],
        );
      }

      await client.query(
        `
          insert into app.legal_extraction_jobs (
            id,
            document_version_id,
            workspace_id,
            status,
            extractor,
            attempt,
            error_code,
            error_message,
            text_hash,
            started_at,
            finished_at
          )
          values (
            $1,
            $2,
            $3,
            $4,
            'stage6-ts-mvp',
            1,
            $5,
            $6,
            $7,
            timezone('utc', now()),
            timezone('utc', now())
          )
        `,
        [
          extractionJobId,
          legalDocumentVersionId,
          workspaceId,
          extractionStatus,
          requiresOcr ? "requires_ocr" : null,
          errorSummary,
          normalizedText ? hashText(normalizedText) : null,
        ],
      );

      for (const chunk of chunks) {
        await client.query(
          `
            insert into app.legal_chunks (
              id,
              source_id,
              document_version_id,
              workspace_id,
              chunk_no,
              chunk_type,
              text,
              text_hash,
              page_from,
              page_to,
              metadata,
              security_scope,
              embedding_model,
              embedding_hash,
              index_version,
              citation_label,
              indexed_at
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11::jsonb,
              $12,
              $13,
              $14,
              $15,
              $16,
              timezone('utc', now())
            )
          `,
          [
            randomUUID(),
            sourceId,
            legalDocumentVersionId,
            workspaceId,
            chunk.chunkNo,
            chunk.chunkType,
            chunk.text,
            chunk.textHash,
            chunk.pageFrom,
            chunk.pageTo,
            JSON.stringify(chunk.metadata),
            visibility,
            DEFAULT_EMBEDDING_MODEL,
            hashText(
              `${chunk.textHash}:${DEFAULT_EMBEDDING_MODEL}:${DEFAULT_INDEX_VERSION}`,
            ),
            DEFAULT_INDEX_VERSION,
            chunk.citationLabel,
          ],
        );
      }

      await client.query(
        `
          insert into app.legal_import_jobs (
            id,
            provider_id,
            workspace_id,
            source_id,
            document_id,
            created_by_user_id,
            status,
            input_type,
            input_ref,
            total_items,
            processed_items,
            failed_items,
            error_summary,
            temporal_workflow_id,
            started_at,
            finished_at
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            1,
            $10,
            $11,
            $12,
            $13,
            timezone('utc', now()),
            timezone('utc', now())
          )
        `,
        [
          importJobId,
          provider.id,
          workspaceId,
          sourceId,
          document.document_id,
          actor.id,
          importStatus,
          input.inputType,
          document.document_id,
          requiresOcr ? 0 : 1,
          requiresOcr ? 1 : 0,
          errorSummary,
          `${this.getWorkflowRegistry().workflows[0]}:${sourceId}`,
        ],
      );

      await client.query(
        `
          insert into app.legal_source_access (
            id,
            source_id,
            workspace_id,
            role_required,
            access_level,
            granted_by
          )
          values ($1, $2, $3, 'lawyer', 'manage', $4)
          on conflict do nothing
        `,
        [randomUUID(), sourceId, workspaceId, actor.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: "legal.source.imported",
      entityType: "legal_source",
      entityId: sourceId,
      result: requiresOcr ? "error" : "success",
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        importJobId,
        documentId: document.document_id,
        legalDocumentVersionId,
        sourceStatus,
        workflow: this.getWorkflowRegistry().workflows[0],
      },
    });

    return this.getImportJob(workspaceId, importJobId);
  }

  async getImportJob(workspaceId: string, importJobId: string): Promise<LegalImportJob> {
    const row = await this.databaseService.one<ImportJobRow>(
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
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [importJobId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        "LEGAL_IMPORT_JOB_NOT_FOUND",
        404,
        "Задача юридического импорта не найдена в активном рабочем пространстве.",
      );
    }

    return mapImportJobRow(row);
  }

  private resolveDocumentId(input: CreateLegalImportJobRequest) {
    if (typeof input.documentId === "string" && input.documentId.trim().length > 0) {
      return input.documentId.trim();
    }

    const uploadId = input.files?.[0]?.uploadId;
    if (typeof uploadId === "string" && uploadId.trim().length > 0) {
      return uploadId.trim();
    }

    throw new AppHttpException(
      "DOCUMENT_ID_REQUIRED",
      400,
      "Импорт MVP этапа 6 сейчас требует существующий ID документа этапа 2.",
    );
  }

  private async loadProvider(code: string): Promise<ProviderRow> {
    const provider = await this.databaseService.one<ProviderRow>(
      `
        select id, code
        from app.legal_source_providers
        where code = $1
          and is_enabled = true
        limit 1
      `,
      [code],
    );

    if (!provider) {
      throw new AppHttpException(
        "LEGAL_SOURCE_PROVIDER_NOT_FOUND",
        404,
        "Провайдер юридического источника недоступен.",
      );
    }

    return provider;
  }

  private async loadDocumentForImport(
    documentId: string,
    workspaceId: string,
  ): Promise<DocumentImportRow> {
    const document = await this.databaseService.one<DocumentImportRow>(
      `
        select
          d.id as document_id,
          d.workspace_id,
          d.owner_id,
          d.created_by_user_id,
          d.title,
          d.description,
          d.classification,
          d.current_version_id,
          dv.version_no,
          dv.mime_type,
          dv.size_bytes,
          dv.sha256,
          dv.storage_bucket,
          dv.storage_path,
          dv.completed_at,
          dv.created_at as version_created_at,
          dv.original_filename
        from app.documents d
        left join app.document_versions dv
          on dv.id = d.current_version_id
        where d.id = $1
          and d.workspace_id = $2
          and d.deleted_at is null
        limit 1
      `,
      [documentId, workspaceId],
    );

    if (!document) {
      throw new AppHttpException(
        "DOCUMENT_NOT_FOUND",
        404,
        "Исходный документ не найден в активном рабочем пространстве.",
      );
    }

    return document;
  }

  private async loadExistingLegalVersion(
    documentVersionId: string,
  ): Promise<ExistingLegalVersionRow | null> {
    return this.databaseService.one<ExistingLegalVersionRow>(
      `
        select
          id,
          source_id,
          version_no
        from app.legal_document_versions
        where document_version_id = $1
        limit 1
      `,
      [documentVersionId],
    );
  }

  private async loadNormalizedText(
    documentVersionId: string,
  ): Promise<string | null> {
    const chunks = await this.databaseService.query<TextChunkRow>(
      `
        select content, chunk_index
        from app.document_text_chunks
        where document_version_id = $1
        order by chunk_index asc
      `,
      [documentVersionId],
    );

    if (chunks.rows.length === 0) {
      return null;
    }

    return chunks.rows.map((row) => row.content.trim()).join("\n\n").trim() || null;
  }

  private resolveNormalizedText(
    document: DocumentImportRow,
    extractedText: string | null,
  ): string | null {
    if (typeof extractedText === "string" && extractedText.trim().length > 0) {
      return extractedText.trim();
    }

    const fallback = [document.title, document.description ?? ""]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join("\n\n")
      .trim();

    return fallback.length > 0 && document.mime_type
      ? SUPPORTED_EXTRACTION_MIME_TYPES.has(document.mime_type)
        ? fallback
        : null
      : null;
  }

  private chunkNormalizedText(
    normalizedText: string,
    classification: DataClassification,
  ): readonly ChunkSeed[] {
    const paragraphs = normalizedText
      .split(/\n{2,}/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const seeds: ChunkSeed[] = [];
    let current = "";
    let chunkNo = 0;

    for (const paragraph of paragraphs) {
      const nextValue = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
      if (nextValue.length > 900 && current.length > 0) {
        seeds.push(
          this.buildChunkSeed(chunkNo, current, classification, seeds.length + 1),
        );
        chunkNo += 1;
        current = paragraph;
      } else {
        current = nextValue;
      }
    }

    if (current.length > 0) {
      seeds.push(this.buildChunkSeed(chunkNo, current, classification, seeds.length + 1));
    }

    if (seeds.length === 0) {
      return [
        this.buildChunkSeed(0, normalizedText.slice(0, 900), classification, 1),
      ];
    }

    return seeds;
  }

  private buildChunkSeed(
    chunkNo: number,
    value: string,
    classification: DataClassification,
    ordinal: number,
  ): ChunkSeed {
    return {
      chunkNo,
      chunkType: inferChunkType(value),
      text: value,
      textHash: hashText(value),
      pageFrom: null,
      pageTo: null,
      metadata: {
        classification,
        tokenEstimate: estimateTokens(value),
      },
      citationLabel: `L-${ordinal}`,
    };
  }

  private async upsertLegalSource(
    client: PoolClient,
    input: {
      readonly id: string;
      readonly workspaceId: string;
      readonly documentId: string;
      readonly providerId: string;
      readonly sourceType: CreateLegalImportJobRequest["documentType"];
      readonly title: string;
      readonly classification: DataClassification;
      readonly visibility: LegalSourceVisibility;
      readonly status: "indexed" | "pending_processing";
      readonly ownerWorkspaceId: string;
      readonly ownerUserId: string;
      readonly createdByUserId: string;
      readonly metadata: Record<string, unknown>;
    },
  ) {
    await client.query(
      `
        insert into app.legal_sources (
          id,
          workspace_id,
          document_id,
          provider_id,
          source_type,
          jurisdiction,
          title,
          license_status,
          visibility,
          classification,
          status,
          owner_workspace_id,
          owner_user_id,
          created_by_user_id,
          metadata,
          last_used_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          'RU',
          $6,
          'allowed',
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13::jsonb,
          timezone('utc', now())
        )
        on conflict (id) do update
        set
          workspace_id = excluded.workspace_id,
          document_id = excluded.document_id,
          provider_id = excluded.provider_id,
          source_type = excluded.source_type,
          title = excluded.title,
          visibility = excluded.visibility,
          classification = excluded.classification,
          status = excluded.status,
          owner_workspace_id = excluded.owner_workspace_id,
          owner_user_id = excluded.owner_user_id,
          metadata = excluded.metadata,
          last_used_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      `,
      [
        input.id,
        input.workspaceId,
        input.documentId,
        input.providerId,
        input.sourceType,
        input.title,
        input.visibility,
        input.classification,
        input.status,
        input.ownerWorkspaceId,
        input.ownerUserId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ],
    );
  }
}

function mapImportJobRow(row: ImportJobRow): LegalImportJob {
  return {
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
  };
}

function resolveVisibility(
  classification: DataClassification,
  providerCode: string,
): LegalSourceVisibility {
  if (classification === "public" && providerCode === "product_curated") {
    return "public";
  }

  if (classification === "public" && providerCode === "workspace_private") {
    return "workspace_private";
  }

  return "workspace_private";
}

function inferChunkType(text: string): LegalChunkType {
  const value = text.toLowerCase();

  if (/установил|обстоятельств|факт/i.test(value)) {
    return "facts";
  }

  if (/суд считает|приходит к выводу|мотив/i.test(value)) {
    return "court_reasoning";
  }

  if (/решил|постановил|определил/i.test(value)) {
    return "operative_part";
  }

  if (/довод|требован|позици/i.test(value)) {
    return "claims";
  }

  if (/ст\.|статья|пункт|постановление/i.test(value)) {
    return "citations";
  }

  return "unknown";
}

function normalizeRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function extractCaseNumber(...parts: readonly (string | null | undefined)[]) {
  for (const part of parts) {
    if (!part) {
      continue;
    }

    const match = part.match(/[AА]\d{1,4}-\d{1,8}\/\d{2,4}/u);
    if (match?.[0]) {
      return match[0];
    }
  }

    return null;
  }

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
