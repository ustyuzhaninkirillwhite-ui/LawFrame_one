import type {
  CompleteUploadRequest,
  CreateDocumentVersionUploadIntentRequest,
  CreateRunArtifactRequest,
  DocumentDetail,
  DocumentJobStatus,
  DocumentJobType,
  DocumentKind,
  DocumentListQuery,
  DocumentListResponse,
  DocumentMutationResult,
  DocumentObjectRole,
  DocumentProcessingJob,
  DocumentRelation,
  DocumentRelationInput,
  DocumentScanStatus,
  DocumentSource,
  DocumentStatus,
  DocumentStorageObject,
  DocumentSummary,
  DocumentUploadContentRequest,
  DocumentUploadContentResponse,
  DocumentUploadIntentRequest,
  DocumentUploadIntentResponse,
  DocumentVersionSummary,
  RunArtifact,
  SignedUrlRequest,
  SignedUrlResponse,
  StorageState,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { PoolClient } from 'pg';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { LiveEventsService } from '../realtime/live-events.service';
import {
  ALLOWED_MIME_TYPES,
  DEFAULT_UPLOAD_TTL_MINUTES,
  MAX_UPLOAD_SIZE_BYTES,
  PREVIEWABLE_MIME_TYPES,
  TEXT_EXTRACTABLE_MIME_TYPES,
  buildDerivedStoragePath,
  buildStoragePath,
  clampSignedUrlTtl,
  createFutureTimestamp,
  deriveArtifactFilename,
  mapStorageState,
  normalizeArtifactKind,
  resolveDocumentSource,
  sanitizeFilename,
} from './documents-storage.helpers';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface DocumentSummaryRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly owner_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: DocumentKind;
  readonly status: DocumentStatus;
  readonly classification: DocumentSummary['classification'];
  readonly source: DocumentSource;
  readonly tags: readonly string[] | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly archived_at: string | null;
  readonly deleted_at: string | null;
  readonly version_id: string | null;
  readonly version_no: number | null;
  readonly version_status: DocumentStatus | null;
  readonly version_original_filename: string | null;
  readonly version_mime_type: string | null;
  readonly version_size_bytes: number | null;
  readonly version_sha256: string | null;
  readonly version_scan_status: DocumentVersionSummary['scanStatus'] | null;
  readonly version_preview_status:
    | DocumentVersionSummary['previewStatus']
    | null;
  readonly version_extraction_status:
    | DocumentVersionSummary['extractionStatus']
    | null;
  readonly version_created_at: string | null;
  readonly version_completed_at: string | null;
  readonly version_bucket: string | null;
}

interface VersionRow {
  readonly id: string;
  readonly document_id: string;
  readonly version_no: number;
  readonly status: DocumentStatus;
  readonly original_filename: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly sha256: string | null;
  readonly storage_bucket: string;
  readonly scan_status: DocumentVersionSummary['scanStatus'];
  readonly preview_status: DocumentVersionSummary['previewStatus'];
  readonly extraction_status: DocumentVersionSummary['extractionStatus'];
  readonly created_at: string;
  readonly completed_at: string | null;
}

interface StorageObjectRow {
  readonly id: string;
  readonly document_version_id: string;
  readonly bucket?: string;
  readonly object_path?: string;
  readonly object_role: DocumentObjectRole;
  readonly mime_type: string;
  readonly size_bytes: number | null;
  readonly status: StorageState;
  readonly created_at: string;
}

interface RelationRow {
  readonly id: string;
  readonly relation_type: string;
  readonly target_entity_type: string;
  readonly target_entity_id: string;
  readonly created_at: string;
}

interface JobRow {
  readonly id: string;
  readonly document_version_id: string;
  readonly job_type: DocumentJobType;
  readonly status: DocumentJobStatus;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ExistingDocumentRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly title: string;
  readonly kind: DocumentKind;
  readonly classification: DocumentSummary['classification'];
  readonly current_version_id: string | null;
  readonly deleted_at: string | null;
}

interface ExistingVersionRow {
  readonly id: string;
  readonly document_id: string;
  readonly storage_bucket: string;
  readonly storage_path: string;
  readonly status: DocumentStatus;
  readonly mime_type: string;
  readonly original_filename: string;
  readonly scan_status: DocumentScanStatus;
  readonly preview_status: DocumentVersionSummary['previewStatus'];
  readonly extraction_status: DocumentVersionSummary['extractionStatus'];
}

interface StorageVerificationRow {
  readonly bucket_id: string;
  readonly name: string;
  readonly mime_type: string | null;
  readonly size_bytes: number | null;
}

interface RunArtifactRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly artifact_type: string;
  readonly title: string;
  readonly mime_type: string;
  readonly source: DocumentSource;
  readonly created_at: string;
}

interface DocumentSecurityLabelRow {
  readonly data_class: DocumentDetail['classification'];
  readonly download_requires_reason: boolean;
  readonly incident_locked: boolean;
}

@Injectable()
export class DocumentsService {
  private readonly env = loadServerEnv();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly liveEventsService: LiveEventsService,
  ) {}

  async list(
    access: AccessContext,
    query: DocumentListQuery,
  ): Promise<DocumentListResponse> {
    const conditions = ['d.workspace_id = $1'];
    const values: unknown[] = [access.activeWorkspace!.id];

    if (query.kind) {
      values.push(query.kind);
      conditions.push(`d.kind = $${values.length}`);
    }

    if (query.status) {
      values.push(query.status);
      conditions.push(`d.status = $${values.length}`);
    }

    if (query.classification) {
      values.push(query.classification);
      conditions.push(`d.classification = $${values.length}`);
    }

    if (query.tag) {
      values.push(query.tag);
      conditions.push(`$${values.length} = any(d.tags)`);
    }

    if (query.q) {
      values.push(`%${query.q}%`);
      conditions.push(
        `(d.title ilike $${values.length} or coalesce(d.description, '') ilike $${values.length})`,
      );
    }

    if (query.status === 'soft_deleted') {
      conditions.push('d.deleted_at is not null');
    } else {
      conditions.push('d.deleted_at is null');
    }

    const result = await this.databaseService.query<DocumentSummaryRow>(
      `
        select
          d.id,
          d.workspace_id,
          d.owner_id,
          d.title,
          d.description,
          d.kind,
          d.status,
          d.classification,
          d.source,
          d.tags,
          d.created_at,
          d.updated_at,
          d.archived_at,
          d.deleted_at,
          v.id as version_id,
          v.version_no,
          v.status as version_status,
          v.original_filename as version_original_filename,
          v.mime_type as version_mime_type,
          v.size_bytes as version_size_bytes,
          v.sha256 as version_sha256,
          v.scan_status as version_scan_status,
          v.preview_status as version_preview_status,
          v.extraction_status as version_extraction_status,
          v.created_at as version_created_at,
          v.completed_at as version_completed_at,
          v.storage_bucket as version_bucket
        from app.documents d
        left join app.document_versions v
          on v.id = d.current_version_id
        where ${conditions.join(' and ')}
        order by d.updated_at desc, d.created_at desc
        limit 50
      `,
      values,
    );

    return {
      items: result.rows.map((row) => mapSummaryRow(row)),
      nextCursor: null,
    };
  }

  async getDetail(
    access: AccessContext,
    documentId: string,
  ): Promise<DocumentDetail> {
    const summaryRow = await this.databaseService.one<DocumentSummaryRow>(
      `
        select
          d.id,
          d.workspace_id,
          d.owner_id,
          d.title,
          d.description,
          d.kind,
          d.status,
          d.classification,
          d.source,
          d.tags,
          d.created_at,
          d.updated_at,
          d.archived_at,
          d.deleted_at,
          v.id as version_id,
          v.version_no,
          v.status as version_status,
          v.original_filename as version_original_filename,
          v.mime_type as version_mime_type,
          v.size_bytes as version_size_bytes,
          v.sha256 as version_sha256,
          v.scan_status as version_scan_status,
          v.preview_status as version_preview_status,
          v.extraction_status as version_extraction_status,
          v.created_at as version_created_at,
          v.completed_at as version_completed_at,
          v.storage_bucket as version_bucket
        from app.documents d
        left join app.document_versions v
          on v.id = d.current_version_id
        where d.id = $1
          and d.workspace_id = $2
        limit 1
      `,
      [documentId, access.activeWorkspace!.id],
    );

    if (!summaryRow) {
      throw new AppHttpException(
        'DOCUMENT_NOT_FOUND',
        404,
        'Document was not found in the active workspace.',
      );
    }

    const [versions, storageObjects, relations, jobs] = await Promise.all([
      this.listVersions(documentId, access.activeWorkspace!.id),
      this.listStorageObjects(documentId, access.activeWorkspace!.id),
      this.listRelations(documentId, access.activeWorkspace!.id),
      this.listJobs(documentId, access.activeWorkspace!.id),
    ]);

    return {
      ...mapSummaryRow(summaryRow),
      versions,
      storageObjects,
      relations,
      processingJobs: jobs,
      availableActions: {
        canUploadVersion: access.permissions.includes('document.upload'),
        canDelete: access.permissions.includes('document.delete'),
        canRestore: access.permissions.includes('document.restore'),
        canManageTemplate:
          summaryRow.kind === 'document_template' &&
          access.permissions.includes('document.template.manage'),
        canRequestSignedUrl: access.permissions.includes('document.read'),
      },
    };
  }

  async listVersions(
    documentId: string,
    workspaceId: string,
  ): Promise<readonly DocumentVersionSummary[]> {
    const result = await this.databaseService.query<VersionRow>(
      `
        select
          id,
          document_id,
          version_no,
          status,
          original_filename,
          mime_type,
          size_bytes,
          sha256,
          storage_bucket,
          scan_status,
          preview_status,
          extraction_status,
          created_at,
          completed_at
        from app.document_versions
        where document_id = $1
          and workspace_id = $2
          and deleted_at is null
        order by version_no desc
      `,
      [documentId, workspaceId],
    );

    return result.rows.map((row) => mapVersionRow(row));
  }

  async createUploadIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: DocumentUploadIntentRequest,
    meta: RequestMeta,
  ): Promise<DocumentUploadIntentResponse> {
    this.assertMimeAllowed(input.mimeType);
    this.assertSizeAllowed(input.sizeBytes);

    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageBucket = 'documents-private';
    const storagePath = buildStoragePath(
      access.activeWorkspace!.id,
      documentId,
      versionId,
      'original',
      input.originalFilename,
    );
    const normalizedFilename = sanitizeFilename(input.originalFilename);
    const expiresAt = createFutureTimestamp(DEFAULT_UPLOAD_TTL_MINUTES);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.documents (
            id,
            workspace_id,
            owner_id,
            title,
            description,
            kind,
            status,
            classification,
            source,
            tags,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, 'upload_pending', $7, $8, $9::text[], $10, $10)
        `,
        [
          documentId,
          access.activeWorkspace!.id,
          actor.id,
          input.title,
          input.description ?? null,
          input.kind,
          input.classification,
          resolveDocumentSource(input.kind),
          input.tags ?? [],
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.document_versions (
            id,
            document_id,
            workspace_id,
            version_no,
            status,
            original_filename,
            normalized_filename,
            mime_type,
            size_bytes,
            storage_bucket,
            storage_path,
            created_by_user_id
          )
          values ($1, $2, $3, 1, 'upload_pending', $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          versionId,
          documentId,
          access.activeWorkspace!.id,
          input.originalFilename,
          normalizedFilename,
          input.mimeType,
          input.sizeBytes,
          storageBucket,
          storagePath,
          actor.id,
        ],
      );

      for (const relation of input.relations ?? []) {
        await this.insertRelation(
          client,
          access.activeWorkspace!.id,
          documentId,
          relation,
          actor.id,
        );
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.upload.intent_created',
      entityType: 'document',
      entityId: documentId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        versionId,
        classification: input.classification,
        uploadMethod: 'direct',
      },
    });

    return {
      documentId,
      versionId,
      bucket: storageBucket,
      storagePath,
      uploadMethod: 'direct',
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
      expiresAt,
    };
  }

  async createVersionUploadIntent(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    input: CreateDocumentVersionUploadIntentRequest,
    meta: RequestMeta,
  ): Promise<DocumentUploadIntentResponse> {
    this.assertMimeAllowed(input.mimeType);
    this.assertSizeAllowed(input.sizeBytes);

    const document = await this.getExistingDocument(
      documentId,
      access.activeWorkspace!.id,
    );
    const versionId = randomUUID();
    const versionNo = await this.getNextVersionNumber(documentId);
    const storageBucket =
      document.kind === 'generated_document'
        ? 'artifacts-private'
        : 'documents-private';
    const storagePath = buildStoragePath(
      access.activeWorkspace!.id,
      documentId,
      versionId,
      'original',
      input.originalFilename,
    );
    const normalizedFilename = sanitizeFilename(input.originalFilename);
    const expiresAt = createFutureTimestamp(DEFAULT_UPLOAD_TTL_MINUTES);

    await this.databaseService.query(
      `
        insert into app.document_versions (
          id,
          document_id,
          workspace_id,
          version_no,
          status,
          original_filename,
          normalized_filename,
          mime_type,
          size_bytes,
          storage_bucket,
          storage_path,
          created_by_user_id
        )
        values ($1, $2, $3, $4, 'upload_pending', $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        versionId,
        documentId,
        access.activeWorkspace!.id,
        versionNo,
        input.originalFilename,
        normalizedFilename,
        input.mimeType,
        input.sizeBytes,
        storageBucket,
        storagePath,
        actor.id,
      ],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.version.intent_created',
      entityType: 'document_version',
      entityId: versionId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        documentId,
        versionNo,
        classification: document.classification,
      },
    });

    return {
      documentId,
      versionId,
      bucket: storageBucket,
      storagePath,
      uploadMethod: 'direct',
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
      expiresAt,
    };
  }

  async completeUpload(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    versionId: string,
    input: CompleteUploadRequest,
    meta: RequestMeta,
  ): Promise<DocumentDetail> {
    const version = await this.getExistingVersion(
      documentId,
      versionId,
      access.activeWorkspace!.id,
    );

    const storageObject = await this.verifyUploadedObject(
      actor,
      version.storage_bucket,
      version.storage_path,
      input,
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.document_versions
          set
            status = 'processing',
            size_bytes = $4,
            mime_type = $5,
            sha256 = $6,
            scan_status = 'queued',
            preview_status = $7,
            extraction_status = $8,
            completed_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
          where id = $1
            and document_id = $2
            and workspace_id = $3
        `,
        [
          versionId,
          documentId,
          access.activeWorkspace!.id,
          storageObject.sizeBytes ?? input.clientReportedSize,
          storageObject.mimeType ?? input.clientReportedMimeType,
          input.sha256 ?? null,
          PREVIEWABLE_MIME_TYPES.has(version.mime_type) ? 'queued' : 'failed',
          TEXT_EXTRACTABLE_MIME_TYPES.has(version.mime_type)
            ? 'queued'
            : 'failed',
        ],
      );

      await client.query(
        `
          insert into app.document_storage_objects (
            id,
            document_id,
            document_version_id,
            workspace_id,
            bucket,
            object_path,
            object_role,
            mime_type,
            size_bytes,
            status
          )
          values ($1, $2, $3, $4, $5, $6, 'original', $7, $8, 'private_bucket')
          on conflict (bucket, object_path) do update
          set
            mime_type = excluded.mime_type,
            size_bytes = excluded.size_bytes,
            status = excluded.status
        `,
        [
          randomUUID(),
          documentId,
          versionId,
          access.activeWorkspace!.id,
          version.storage_bucket,
          version.storage_path,
          storageObject.mimeType ?? input.clientReportedMimeType,
          storageObject.sizeBytes ?? input.clientReportedSize,
        ],
      );

      await this.ensureProcessingJobs(
        client,
        documentId,
        versionId,
        access.activeWorkspace!.id,
      );
      await this.runProcessingPipeline(
        client,
        actor,
        access,
        documentId,
        versionId,
        version.original_filename,
        storageObject.mimeType ?? input.clientReportedMimeType,
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.version.completed',
      entityType: 'document_version',
      entityId: versionId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        documentId,
        mimeType: storageObject.mimeType ?? input.clientReportedMimeType,
      },
    });

    return this.getDetail(access, documentId);
  }

  async uploadVersionContent(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    versionId: string,
    input: DocumentUploadContentRequest,
    meta: RequestMeta,
  ): Promise<DocumentUploadContentResponse> {
    await this.getExistingVersion(
      documentId,
      versionId,
      access.activeWorkspace!.id,
    );
    this.assertMimeAllowed(input.clientReportedMimeType);
    this.assertSizeAllowed(input.clientReportedSize);

    const bytes = decodeBase64Content(input.contentBase64);
    if (bytes.byteLength !== input.clientReportedSize) {
      throw new AppHttpException(
        'DOCUMENT_UPLOAD_SIZE_MISMATCH',
        400,
        'Uploaded file bytes do not match the reported size.',
        {
          reportedSize: input.clientReportedSize,
          receivedSize: bytes.byteLength,
        },
      );
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (input.sha256 && input.sha256 !== sha256) {
      throw new AppHttpException(
        'DOCUMENT_UPLOAD_HASH_MISMATCH',
        400,
        'Uploaded file bytes do not match the reported content hash.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.version.content_received',
      entityType: 'document_version',
      entityId: versionId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        documentId,
        mimeType: input.clientReportedMimeType,
        sizeBytes: bytes.byteLength,
        sha256,
      },
    });

    return {
      sha256,
      sizeBytes: bytes.byteLength,
      mimeType: input.clientReportedMimeType,
    };
  }

  async makeCurrent(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    versionId: string,
    meta: RequestMeta,
  ): Promise<DocumentDetail> {
    const version = await this.getExistingVersion(
      documentId,
      versionId,
      access.activeWorkspace!.id,
    );

    if (
      !['uploaded', 'processing', 'ready', 'archived'].includes(version.status)
    ) {
      throw new AppHttpException(
        'DOCUMENT_STATE_INVALID',
        409,
        'Only uploaded or ready versions can become current.',
      );
    }

    await this.databaseService.query(
      `
        update app.documents
        set
          current_version_id = $3,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [documentId, access.activeWorkspace!.id, versionId],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.version.made_current',
      entityType: 'document_version',
      entityId: versionId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        documentId,
      },
    });

    return this.getDetail(access, documentId);
  }

  async createSignedUrl(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    input: SignedUrlRequest,
    meta: RequestMeta,
  ): Promise<SignedUrlResponse> {
    const detail = await this.getDetail(access, documentId);
    const versionId = input.versionId ?? detail.currentVersion?.id;
    const workspaceId = access.activeWorkspace!.id;

    if (!versionId) {
      throw new AppHttpException(
        'DOCUMENT_VERSION_NOT_FOUND',
        404,
        'No document version is available for signed URL generation.',
      );
    }

    if (
      detail.status === 'archived' ||
      detail.status === 'soft_deleted' ||
      detail.status === 'hard_delete_pending' ||
      detail.archivedAt ||
      detail.deletedAt
    ) {
      throw new AppHttpException(
        'DOCUMENT_STATE_INVALID',
        409,
        'Signed URLs are blocked for archived or deleted documents.',
      );
    }

    const version = detail.versions.find((item) => item.id === versionId);
    if (!version) {
      throw new AppHttpException(
        'DOCUMENT_VERSION_NOT_FOUND',
        404,
        'Requested document version was not found.',
      );
    }

    if (version.scanStatus === 'infected') {
      throw new AppHttpException(
        'VIRUS_DETECTED',
        409,
        'Signed URLs are blocked for quarantined document versions.',
      );
    }

    const [label, incidentLockActive] = await Promise.all([
      this.loadDocumentSecurityLabel(documentId, workspaceId),
      this.isWorkspaceIncidentLocked(workspaceId),
    ]);
    const dataClass = label?.data_class ?? detail.classification;
    const reason = input.reason?.trim() ?? '';

    if (incidentLockActive || label?.incident_locked === true) {
      throw new AppHttpException(
        'INCIDENT_LOCK',
        423,
        'Document delivery is locked while incident mode is active.',
        {
          documentId,
          dataClass,
        },
      );
    }

    if (
      (label?.download_requires_reason === true ||
        dataClass === 'legal_secret' ||
        dataClass === 'ai_forbidden_external') &&
      reason.length === 0
    ) {
      throw new AppHttpException(
        'DOCUMENT_REASON_REQUIRED',
        403,
        'A reason is required before issuing a signed URL for this document.',
        {
          documentId,
          dataClass,
        },
      );
    }

    if (
      dataClass === 'ai_forbidden_external' &&
      input.acknowledgeClassificationWarning !== true
    ) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Sensitive classification must be explicitly acknowledged before issuing a signed URL.',
        {
          acknowledgeClassificationWarning: true,
          dataClass,
        },
      );
    }

    const resolvedTarget = await this.loadSignedUrlTarget(
      documentId,
      versionId,
      input.objectRole,
      workspaceId,
      detail,
    );
    const expiresInSeconds = clampSignedUrlTtl(
      input.purpose,
      input.expiresInSeconds,
    );
    const signedUrl = await this.issueSignedUrl(
      resolvedTarget.bucket,
      resolvedTarget.objectPath,
      expiresInSeconds,
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.signed_url.issued',
      entityType: 'document',
      entityId: documentId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      eventCategory: 'document',
      sessionId: actor.sessionId,
      dataClass,
      metadata: {
        versionId,
        objectRole: input.objectRole,
        ttlSeconds: expiresInSeconds,
        purpose: input.purpose,
        reasonLogged: reason.length > 0,
      },
    });

    return {
      documentId,
      versionId,
      objectRole: input.objectRole,
      signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      ttlSeconds: expiresInSeconds,
      dataClass,
      reasonLogged: reason.length > 0,
    };
  }

  async archive(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    meta: RequestMeta,
  ): Promise<DocumentMutationResult> {
    await this.assertDocumentExists(documentId, access.activeWorkspace!.id);
    await this.databaseService.query(
      `
        update app.documents
        set
          status = 'archived',
          archived_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [documentId, access.activeWorkspace!.id],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.archived',
      entityType: 'document',
      entityId: documentId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
    });

    return {
      status: 'archived',
      documentId,
    };
  }

  async restore(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    meta: RequestMeta,
  ): Promise<DocumentMutationResult> {
    const document = await this.getExistingDocument(
      documentId,
      access.activeWorkspace!.id,
    );

    const nextStatus: DocumentStatus =
      document.current_version_id === null ? 'upload_pending' : 'ready';

    await this.databaseService.query(
      `
        update app.documents
        set
          status = $3,
          archived_at = null,
          deleted_at = null,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [documentId, access.activeWorkspace!.id, nextStatus],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.restored',
      entityType: 'document',
      entityId: documentId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
    });

    return {
      status: 'restored',
      documentId,
    };
  }

  async softDelete(
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    meta: RequestMeta,
  ): Promise<DocumentMutationResult> {
    await this.assertDocumentExists(documentId, access.activeWorkspace!.id);
    await this.databaseService.query(
      `
        update app.documents
        set
          status = 'soft_deleted',
          deleted_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [documentId, access.activeWorkspace!.id],
    );

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.soft_deleted',
      entityType: 'document',
      entityId: documentId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
    });

    return {
      status: 'deleted',
      documentId,
    };
  }

  async listRunArtifacts(
    workspaceId: string,
    runId: string,
  ): Promise<readonly RunArtifact[]> {
    const result = await this.databaseService.query<RunArtifactRow>(
      `
        select
          id,
          workflow_run_id,
          document_id,
          document_version_id,
          artifact_type,
          title,
          mime_type,
          source,
          created_at
        from app.run_artifacts
        where workflow_run_id = $1
          and workspace_id = $2
        order by created_at desc
      `,
      [runId, workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workflowRunId: row.workflow_run_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
      artifactType: row.artifact_type,
      title: row.title,
      mimeType: row.mime_type,
      source: row.source,
      createdAt: row.created_at,
    }));
  }

  async createRunArtifact(
    actor: AuthenticatedActor,
    access: AccessContext,
    runId: string,
    input: CreateRunArtifactRequest,
    meta: RequestMeta,
  ): Promise<RunArtifact> {
    const documentId = randomUUID();
    const versionId = randomUUID();
    const artifactId = randomUUID();
    const filename = deriveArtifactFilename(input.title, input.mimeType);
    const storagePath = buildStoragePath(
      access.activeWorkspace!.id,
      documentId,
      versionId,
      'original',
      filename,
    );

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.documents (
            id,
            workspace_id,
            owner_id,
            title,
            description,
            kind,
            status,
            classification,
            source,
            current_version_id,
            tags,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, null, $5, 'processing', $6, $7, null, $8::text[], $9, $9)
        `,
        [
          documentId,
          access.activeWorkspace!.id,
          actor.id,
          input.title,
          normalizeArtifactKind(input.artifactType),
          input.classification,
          input.source,
          [runId, 'run-artifact'],
          actor.id,
        ],
      );

      await client.query(
        `
          insert into app.document_versions (
            id,
            document_id,
            workspace_id,
            version_no,
            status,
            original_filename,
            normalized_filename,
            mime_type,
            size_bytes,
            storage_bucket,
            storage_path,
            scan_status,
            preview_status,
            extraction_status,
            created_by_user_id,
            completed_at
          )
          values (
            $1,
            $2,
            $3,
            1,
            'processing',
            $4,
            $5,
            $6,
            0,
            'artifacts-private',
            $7,
            'not_configured',
            $8,
            $9,
            $10,
            timezone('utc', now())
          )
        `,
        [
          versionId,
          documentId,
          access.activeWorkspace!.id,
          filename,
          sanitizeFilename(filename),
          input.mimeType,
          storagePath,
          PREVIEWABLE_MIME_TYPES.has(input.mimeType) ? 'queued' : 'failed',
          TEXT_EXTRACTABLE_MIME_TYPES.has(input.mimeType) ? 'queued' : 'failed',
          actor.id,
        ],
      );

      await client.query(
        `
          update app.documents
          set
            current_version_id = $3,
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [documentId, access.activeWorkspace!.id, versionId],
      );

      await client.query(
        `
          insert into app.run_artifacts (
            id,
            workflow_run_id,
            workspace_id,
            document_id,
            document_version_id,
            artifact_type,
            title,
            mime_type,
            source
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          artifactId,
          runId,
          access.activeWorkspace!.id,
          documentId,
          versionId,
          input.artifactType,
          input.title,
          input.mimeType,
          input.source,
        ],
      );

      await this.insertRelation(
        client,
        access.activeWorkspace!.id,
        documentId,
        {
          relationType: 'output_of_workflow_run',
          targetEntityType: 'workflow_run',
          targetEntityId: runId,
        },
        actor.id,
      );

      if (input.sourceDocumentId) {
        await this.insertRelation(
          client,
          access.activeWorkspace!.id,
          documentId,
          {
            relationType: 'derived_from',
            targetEntityType: 'document',
            targetEntityId: input.sourceDocumentId,
          },
          actor.id,
        );
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'run.artifact.created',
      entityType: 'run_artifact',
      entityId: artifactId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        runId,
        documentId,
        versionId,
      },
    });

    await this.liveEventsService.recordEvent({
      workspaceId: access.activeWorkspace!.id,
      runId,
      topics: [
        `workspace:${access.activeWorkspace!.id}:dashboard`,
        `run:${runId}`,
      ],
      eventType: 'artifact.created',
      entityType: 'run_artifact',
      entityId: artifactId,
      payload: {
        artifact: {
          id: artifactId,
          workflowRunId: runId,
          documentId,
          documentVersionId: versionId,
          artifactType: input.artifactType,
          title: input.title,
          mimeType: input.mimeType,
          source: input.source,
        },
      },
    });

    return {
      id: artifactId,
      workflowRunId: runId,
      documentId,
      documentVersionId: versionId,
      artifactType: input.artifactType,
      title: input.title,
      mimeType: input.mimeType,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
  }

  private async getExistingDocument(
    documentId: string,
    workspaceId: string,
  ): Promise<ExistingDocumentRow> {
    const row = await this.databaseService.one<ExistingDocumentRow>(
      `
        select
          id,
          workspace_id,
          title,
          kind,
          classification,
          current_version_id,
          deleted_at
        from app.documents
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [documentId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_NOT_FOUND',
        404,
        'Document was not found in the active workspace.',
      );
    }

    return row;
  }

  private async assertDocumentExists(
    documentId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.getExistingDocument(documentId, workspaceId);
  }

  private async loadDocumentSecurityLabel(
    documentId: string,
    workspaceId: string,
  ): Promise<DocumentSecurityLabelRow | null> {
    return this.databaseService.one<DocumentSecurityLabelRow>(
      `
        select
          data_class,
          download_requires_reason,
          incident_locked
        from app.document_security_labels
        where document_id = $1
          and workspace_id = $2
        limit 1
      `,
      [documentId, workspaceId],
    );
  }

  private async isWorkspaceIncidentLocked(
    workspaceId: string,
  ): Promise<boolean> {
    const row = await this.databaseService.one<{ readonly locked: boolean }>(
      `
        select public.is_incident_locked($1) as locked
      `,
      [workspaceId],
    );

    return Boolean(row?.locked);
  }

  private async getExistingVersion(
    documentId: string,
    versionId: string,
    workspaceId: string,
  ): Promise<ExistingVersionRow> {
    const row = await this.databaseService.one<ExistingVersionRow>(
      `
        select
          id,
          document_id,
          storage_bucket,
          storage_path,
          status,
          mime_type,
          original_filename,
          scan_status,
          preview_status,
          extraction_status
        from app.document_versions
        where id = $1
          and document_id = $2
          and workspace_id = $3
          and deleted_at is null
        limit 1
      `,
      [versionId, documentId, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_VERSION_NOT_FOUND',
        404,
        'Document version was not found in the active workspace.',
      );
    }

    return row;
  }

  private async getNextVersionNumber(documentId: string): Promise<number> {
    const row = await this.databaseService.one<{
      readonly next_version_no: number;
    }>(
      `
        select coalesce(max(version_no), 0) + 1 as next_version_no
        from app.document_versions
        where document_id = $1
      `,
      [documentId],
    );

    return row?.next_version_no ?? 1;
  }

  private async listStorageObjects(
    documentId: string,
    workspaceId: string,
  ): Promise<readonly DocumentStorageObject[]> {
    const result = await this.databaseService.query<StorageObjectRow>(
      `
        select
          id,
          document_version_id,
          bucket,
          object_path,
          object_role,
          mime_type,
          size_bytes,
          status,
          created_at
        from app.document_storage_objects
        where document_id = $1
          and workspace_id = $2
        order by created_at asc
      `,
      [documentId, workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      versionId: row.document_version_id,
      role: row.object_role,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  private async listRelations(
    documentId: string,
    workspaceId: string,
  ): Promise<readonly DocumentRelation[]> {
    const result = await this.databaseService.query<RelationRow>(
      `
        select
          id,
          relation_type,
          target_entity_type,
          target_entity_id,
          created_at
        from app.document_relations
        where source_document_id = $1
          and workspace_id = $2
        order by created_at asc
      `,
      [documentId, workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      relationType: row.relation_type,
      targetEntityType: row.target_entity_type,
      targetEntityId: row.target_entity_id,
      createdAt: row.created_at,
    }));
  }

  private async listJobs(
    documentId: string,
    workspaceId: string,
  ): Promise<readonly DocumentProcessingJob[]> {
    const result = await this.databaseService.query<JobRow>(
      `
        select
          id,
          document_version_id,
          job_type,
          status,
          attempts,
          max_attempts,
          last_error,
          created_at,
          updated_at
        from app.document_processing_jobs
        where document_id = $1
          and workspace_id = $2
        order by created_at asc
      `,
      [documentId, workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      versionId: row.document_version_id,
      jobType: row.job_type,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async insertRelation(
    client: PoolClient,
    workspaceId: string,
    documentId: string,
    relation: DocumentRelationInput,
    actorId: string,
  ) {
    await client.query(
      `
        insert into app.document_relations (
          id,
          workspace_id,
          source_document_id,
          relation_type,
          target_entity_type,
          target_entity_id,
          created_by_user_id
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        randomUUID(),
        workspaceId,
        documentId,
        relation.relationType,
        relation.targetEntityType,
        relation.targetEntityId,
        actorId,
      ],
    );
  }

  private async ensureProcessingJobs(
    client: PoolClient,
    documentId: string,
    versionId: string,
    workspaceId: string,
  ) {
    const jobTypes: readonly DocumentJobType[] = [
      'virus_scan',
      'metadata_extract',
      'text_extract',
      'preview_generate',
      'index_prepare',
    ];

    for (const jobType of jobTypes) {
      await client.query(
        `
          insert into app.document_processing_jobs (
            id,
            document_id,
            document_version_id,
            workspace_id,
            job_type,
            status,
            idempotency_key
          )
          values ($1, $2, $3, $4, $5, 'queued', $6)
          on conflict (idempotency_key) do nothing
        `,
        [
          randomUUID(),
          documentId,
          versionId,
          workspaceId,
          jobType,
          `${versionId}:${jobType}`,
        ],
      );
    }
  }

  private async runProcessingPipeline(
    client: PoolClient,
    actor: AuthenticatedActor,
    access: AccessContext,
    documentId: string,
    versionId: string,
    originalFilename: string,
    mimeType: string,
  ) {
    await this.markJobStatus(client, versionId, 'virus_scan', 'completed');

    if (TEXT_EXTRACTABLE_MIME_TYPES.has(mimeType)) {
      await client.query(
        `
          insert into app.document_text_chunks (
            id,
            document_id,
            document_version_id,
            workspace_id,
            chunk_index,
            content,
            token_count,
            metadata
          )
          values ($1, $2, $3, $4, 0, $5, $6, $7::jsonb)
          on conflict (document_version_id, chunk_index) do update
          set
            content = excluded.content,
            token_count = excluded.token_count,
            metadata = excluded.metadata
        `,
        [
          randomUUID(),
          documentId,
          versionId,
          access.activeWorkspace!.id,
          `Extracted text placeholder for ${originalFilename}.`,
          6,
          JSON.stringify({
            generatedBy: 'stage2-mvp',
          }),
        ],
      );

      await client.query(
        `
          insert into app.document_storage_objects (
            id,
            document_id,
            document_version_id,
            workspace_id,
            bucket,
            object_path,
            object_role,
            mime_type,
            size_bytes,
            status
          )
          values ($1, $2, $3, $4, 'documents-private', $5, 'extracted_text', 'application/json', 0, 'private_bucket')
          on conflict (bucket, object_path) do nothing
        `,
        [
          randomUUID(),
          documentId,
          versionId,
          access.activeWorkspace!.id,
          buildDerivedStoragePath(
            access.activeWorkspace!.id,
            documentId,
            versionId,
            'extracted_text',
            originalFilename,
          ),
        ],
      );
      await this.markJobStatus(client, versionId, 'text_extract', 'completed');
    } else {
      await this.markJobStatus(client, versionId, 'text_extract', 'skipped');
    }

    if (
      PREVIEWABLE_MIME_TYPES.has(mimeType) &&
      mimeType !== 'application/pdf'
    ) {
      await client.query(
        `
          insert into app.document_storage_objects (
            id,
            document_id,
            document_version_id,
            workspace_id,
            bucket,
            object_path,
            object_role,
            mime_type,
            size_bytes,
            status
          )
          values ($1, $2, $3, $4, 'previews-private', $5, 'preview_pdf', 'application/pdf', 0, 'signed_url_only')
          on conflict (bucket, object_path) do nothing
        `,
        [
          randomUUID(),
          documentId,
          versionId,
          access.activeWorkspace!.id,
          buildDerivedStoragePath(
            access.activeWorkspace!.id,
            documentId,
            versionId,
            'preview_pdf',
            originalFilename,
          ),
        ],
      );
      await this.markJobStatus(
        client,
        versionId,
        'preview_generate',
        'completed',
      );
    } else if (mimeType === 'application/pdf') {
      await this.markJobStatus(
        client,
        versionId,
        'preview_generate',
        'completed',
      );
    } else {
      await this.markJobStatus(
        client,
        versionId,
        'preview_generate',
        'skipped',
      );
    }

    await this.markJobStatus(
      client,
      versionId,
      'metadata_extract',
      'completed',
    );
    await this.markJobStatus(client, versionId, 'index_prepare', 'completed');

    await client.query(
      `
        update app.document_versions
        set
          status = 'ready',
          scan_status = 'clean',
          preview_status = $3,
          extraction_status = $4,
          updated_at = timezone('utc', now())
        where id = $1
          and document_id = $2
      `,
      [
        versionId,
        documentId,
        PREVIEWABLE_MIME_TYPES.has(mimeType) ? 'ready' : 'failed',
        TEXT_EXTRACTABLE_MIME_TYPES.has(mimeType) ? 'ready' : 'failed',
      ],
    );

    await client.query(
      `
        update app.documents
        set
          status = 'ready',
          current_version_id = $3,
          updated_by_user_id = $4,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
      `,
      [documentId, access.activeWorkspace!.id, versionId, actor.id],
    );
  }

  private async markJobStatus(
    client: PoolClient,
    versionId: string,
    jobType: DocumentJobType,
    status: DocumentJobStatus,
  ) {
    await client.query(
      `
        update app.document_processing_jobs
        set
          status = $3,
          attempts = attempts + 1,
          updated_at = timezone('utc', now())
        where document_version_id = $1
          and job_type = $2
      `,
      [versionId, jobType, status],
    );
  }

  private async verifyUploadedObject(
    actor: AuthenticatedActor,
    bucket: string,
    storagePath: string,
    input: CompleteUploadRequest,
  ) {
    const row = await this.databaseService.one<StorageVerificationRow>(
      `
        select
          bucket_id,
          name,
          coalesce(metadata->>'mimetype', metadata->>'contentType') as mime_type,
          nullif(metadata->>'size', '')::bigint as size_bytes
        from storage.objects
        where bucket_id = $1
          and name = $2
        limit 1
      `,
      [bucket, storagePath],
    );

    if (!row && actor.accessToken.startsWith('dev.')) {
      return {
        mimeType: input.clientReportedMimeType,
        sizeBytes: input.clientReportedSize,
      };
    }

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_UPLOAD_NOT_READY',
        409,
        'Uploaded storage object was not found yet.',
      );
    }

    return {
      mimeType: row.mime_type ?? input.clientReportedMimeType,
      sizeBytes: row.size_bytes ?? input.clientReportedSize,
    };
  }

  private async loadSignedUrlTarget(
    documentId: string,
    versionId: string,
    objectRole: DocumentObjectRole,
    workspaceId: string,
    detail: DocumentDetail,
  ): Promise<{
    readonly bucket: string;
    readonly objectPath: string;
  }> {
    if (objectRole === 'original') {
      const version = await this.databaseService.one<{
        readonly storage_bucket: string;
        readonly storage_path: string;
      }>(
        `
          select storage_bucket, storage_path
          from app.document_versions
          where id = $1
            and document_id = $2
            and workspace_id = $3
          limit 1
        `,
        [versionId, documentId, workspaceId],
      );

      if (!version) {
        throw new AppHttpException(
          'DOCUMENT_VERSION_NOT_FOUND',
          404,
          'Document version was not found for signed URL generation.',
        );
      }

      return {
        bucket: version.storage_bucket,
        objectPath: version.storage_path,
      };
    }

    const storageObject = await this.databaseService.one<{
      readonly bucket: string;
      readonly object_path: string;
    }>(
      `
        select bucket, object_path
        from app.document_storage_objects
        where document_id = $1
          and document_version_id = $2
          and workspace_id = $3
          and object_role = $4
        limit 1
      `,
      [documentId, versionId, workspaceId, objectRole],
    );

    if (!storageObject && objectRole === 'preview_pdf') {
      const version = detail.versions.find((item) => item.id === versionId);
      if (version?.mimeType === 'application/pdf') {
        return this.loadSignedUrlTarget(
          documentId,
          versionId,
          'original',
          workspaceId,
          detail,
        );
      }
    }

    if (!storageObject) {
      throw new AppHttpException(
        'PREVIEW_GENERATION_FAILED',
        409,
        'Requested derived document asset is not ready yet.',
      );
    }

    return {
      bucket: storageObject.bucket,
      objectPath: storageObject.object_path,
    };
  }

  private async issueSignedUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    try {
      const response = await fetch(
        `${this.env.SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`,
        {
          method: 'POST',
          headers: {
            apikey: this.env.SUPABASE_SECRET_KEY,
            authorization: `Bearer ${this.env.SUPABASE_SECRET_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            expiresIn: expiresInSeconds,
          }),
        },
      );

      if (response.ok) {
        const payload = (await response.json()) as {
          readonly signedURL?: string;
          readonly signedUrl?: string;
        };
        const signedUrl = payload.signedURL ?? payload.signedUrl;

        if (typeof signedUrl === 'string' && signedUrl.length > 0) {
          return signedUrl.startsWith('http')
            ? signedUrl
            : `${this.env.SUPABASE_URL}${signedUrl}`;
        }
      }
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Supabase storage signing endpoint did not return a signed URL.',
        {
          bucket,
          objectPath,
          expiresInSeconds,
          status: response.status,
        },
      );
    } catch (error) {
      throw new AppHttpException(
        'READINESS_GATE_BLOCKED',
        503,
        'Supabase storage signing endpoint is unavailable.',
        {
          bucket,
          objectPath,
          expiresInSeconds,
          reason:
            error instanceof Error
              ? error.message
              : 'Unknown storage signing error.',
        },
      );
    }
  }

  private assertMimeAllowed(mimeType: string) {
    if (
      !ALLOWED_MIME_TYPES.includes(
        mimeType as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      throw new AppHttpException(
        'UNSUPPORTED_MIME_TYPE',
        400,
        'This MIME type is not allowed for stage 2 document uploads.',
      );
    }
  }

  private assertSizeAllowed(sizeBytes: number) {
    if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw new AppHttpException(
        'FILE_TOO_LARGE',
        400,
        'The file exceeds the maximum allowed upload size.',
        {
          maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        },
      );
    }
  }
}

function decodeBase64Content(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new AppHttpException(
      'DOCUMENT_UPLOAD_CONTENT_INVALID',
      400,
      'Uploaded file content must be valid base64.',
    );
  }

  const buffer = Buffer.from(value, 'base64');
  if (buffer.toString('base64') !== value) {
    throw new AppHttpException(
      'DOCUMENT_UPLOAD_CONTENT_INVALID',
      400,
      'Uploaded file content must be canonical base64.',
    );
  }

  return buffer;
}

function mapSummaryRow(row: DocumentSummaryRow): DocumentSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    status: row.status,
    classification: row.classification,
    source: row.source,
    tags: row.tags ?? [],
    currentVersion: mapVersionFromSummaryRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
  };
}

function mapVersionFromSummaryRow(
  row: DocumentSummaryRow,
): DocumentVersionSummary | null {
  if (
    !row.version_id ||
    !row.version_no ||
    !row.version_status ||
    !row.version_original_filename ||
    !row.version_mime_type ||
    row.version_size_bytes === null ||
    !row.version_scan_status ||
    !row.version_preview_status ||
    !row.version_extraction_status ||
    !row.version_created_at ||
    !row.version_bucket
  ) {
    return null;
  }

  return {
    id: row.version_id,
    documentId: row.id,
    versionNo: row.version_no,
    status: row.version_status,
    originalFilename: row.version_original_filename,
    mimeType: row.version_mime_type,
    sizeBytes: Number(row.version_size_bytes),
    sha256: row.version_sha256,
    storageState: mapStorageState(row.version_bucket),
    scanStatus: row.version_scan_status,
    previewStatus: row.version_preview_status,
    extractionStatus: row.version_extraction_status,
    createdAt: row.version_created_at,
    completedAt: row.version_completed_at,
  };
}

function mapVersionRow(row: VersionRow): DocumentVersionSummary {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNo: row.version_no,
    status: row.status,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    storageState: mapStorageState(row.storage_bucket),
    scanStatus: row.scan_status,
    previewStatus: row.preview_status,
    extractionStatus: row.extraction_status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
