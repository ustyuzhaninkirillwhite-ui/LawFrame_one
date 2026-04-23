import type {
  DocumentGenerationJobDetail,
  DocumentGenerationPreviewRequest,
  DocumentSummary,
  FinalizeDocumentGenerationRequest,
  RunArtifact,
  WorkflowRuntimeDocumentTemplateExecuteRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { ClausesService } from '../clauses/clauses.service';
import { DatabaseService } from '../database/database.service';
import { DocumentTemplatesService } from '../document-templates/document-templates.service';
import { DocumentValidationService } from '../document-validation/document-validation.service';
import { ProfilesService } from '../profiles/profiles.service';
import {
  buildGenerationContext,
  evaluateMappings,
  stableStringify,
  toDocumentSummary,
  type RequestMeta,
} from '../stage7-support/stage7.helpers';

interface GenerationJobRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly profile_snapshot_id: string | null;
  readonly workflow_run_id: string | null;
  readonly approval_route_id: string | null;
  readonly status: DocumentGenerationJobDetail['status'];
  readonly preview_document_id: string | null;
  readonly preview_document_version_id: string | null;
  readonly final_document_id: string | null;
  readonly final_document_version_id: string | null;
  readonly validation_report_id: string | null;
  readonly missing_field_codes: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

interface DocumentSummaryRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly owner_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly kind: DocumentSummary['kind'];
  readonly status: DocumentSummary['status'];
  readonly classification: DocumentSummary['classification'];
  readonly source: DocumentSummary['source'];
  readonly tags: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly archived_at: string | null;
  readonly deleted_at: string | null;
  readonly version_id: string | null;
  readonly version_no: number | null;
  readonly version_status: string | null;
  readonly version_original_filename: string | null;
  readonly version_mime_type: string | null;
  readonly version_size_bytes: number | null;
  readonly version_scan_status: 'not_started' | 'queued' | 'clean' | 'infected' | 'manual_review_required' | 'not_configured' | null;
  readonly version_preview_status: 'not_started' | 'queued' | 'ready' | 'failed' | null;
  readonly version_extraction_status: 'not_started' | 'queued' | 'ready' | 'failed' | 'requires_ocr' | null;
  readonly version_created_at: string | null;
  readonly version_completed_at: string | null;
}

interface ArtifactRow {
  readonly id: string;
  readonly workflow_run_id: string;
  readonly document_id: string;
  readonly document_version_id: string;
  readonly artifact_type: string;
  readonly title: string;
  readonly mime_type: string;
  readonly source: RunArtifact['source'];
  readonly created_at: string;
}

@Injectable()
export class DocumentGenerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly profilesService: ProfilesService,
    private readonly documentTemplatesService: DocumentTemplatesService,
    private readonly clausesService: ClausesService,
    private readonly documentValidationService: DocumentValidationService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  async createPreview(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: DocumentGenerationPreviewRequest,
    meta: RequestMeta,
  ): Promise<DocumentGenerationJobDetail> {
    const workspaceId = access.activeWorkspace!.id;
    const template = await this.documentTemplatesService.get(access, input.templateId);
    const version = await this.documentTemplatesService.getVersion(
      input.templateId,
      input.templateVersionId ?? template.activeVersionId,
    );
    const snapshot = await this.profilesService.createEffectiveSnapshotForRun({
      workspaceId,
      userId: actor.id,
      profileId: input.profileId ?? null,
      runId: input.workflowRunId ?? null,
      previewId: input.templateId,
    });
    const phraseRules = await this.clausesService.listPhraseRules(access, actor.id);
    const context = buildGenerationContext({
      profile: snapshot.effectiveContent,
      generationInput: input.input,
      documentType: input.documentTypeId ? { id: input.documentTypeId } : null,
    });
    const evaluated = evaluateMappings(version.mappings, context as Record<string, unknown>);
    const renderedText = stableStringify({
      templateId: input.templateId,
      templateVersionId: version.id,
      values: evaluated.resolved,
    });

    const preview = await this.databaseService.transaction(async (client) => {
      const createdPreview = await this.createDocumentRecord(
        client,
        workspaceId,
        actor.id,
        {
          title: `Preview: ${template.title}`,
          description: `Preview generated from ${template.title}.`,
          kind: 'draft_document',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: `${slugify(template.title)}-preview.docx`,
        },
      );

      const insertedJob = await client.query<{ id: string }>(
        `
          insert into app.document_generation_jobs (
            workspace_id,
            workflow_run_id,
            template_id,
            template_version_id,
            profile_id,
            profile_snapshot_id,
            document_type_id,
            approval_route_id,
            status,
            input_payload,
            ai_section_codes,
            missing_field_codes,
            preview_document_id,
            preview_document_version_id,
            created_by_user_id
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
            'preview_ready',
            $9::jsonb,
            $10::jsonb,
            $11::jsonb,
            $12,
            $13,
            $14
          )
          returning id
        `,
        [
          workspaceId,
          input.workflowRunId ?? null,
          template.id,
          version.id,
          input.profileId ?? null,
          snapshot.id,
          input.documentTypeId ?? template.documentTypeId ?? null,
          input.approvalRouteId ?? null,
          JSON.stringify(input.input),
          JSON.stringify(input.aiSectionCodes ?? []),
          JSON.stringify(evaluated.missing),
          createdPreview.documentId,
          createdPreview.versionId,
          actor.id,
        ],
      );
      const jobId = insertedJob.rows[0]!.id;

      let artifactId: string | null = null;

      if (input.workflowRunId) {
        artifactId = await this.createArtifact(
          client,
          input.workflowRunId,
          workspaceId,
          createdPreview.documentId,
          createdPreview.versionId,
          'document_preview',
          `Preview: ${template.title}`,
        );
      }

      await client.query(
        `
          insert into app.document_generation_outputs (
            generation_job_id,
            workspace_id,
            artifact_id,
            artifact_type,
            document_id,
            document_version_id,
            metadata
          )
          values ($1, $2, $3, 'preview_document', $4, $5, $6::jsonb)
        `,
        [
          jobId,
          workspaceId,
          artifactId,
          createdPreview.documentId,
          createdPreview.versionId,
          JSON.stringify(evaluated.resolved),
        ],
      );

      const report = await this.documentValidationService.createOrReplaceReport({
        workspaceId,
        generationJobId: jobId,
        documentId: createdPreview.documentId,
        documentVersionId: createdPreview.versionId,
        placeholders: version.placeholders,
        missingFieldCodes: evaluated.missing,
        renderedText,
        approvalRouteBound: Boolean(input.approvalRouteId),
        phraseRules,
      });

      await client.query(
        `
          update app.document_generation_jobs
          set validation_report_id = $2
          where id = $1
        `,
        [jobId, report.id],
      );

      return jobId;
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'document.generation.previewed',
      entityType: 'document_generation_job',
      entityId: preview,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        templateId: input.templateId,
        templateVersionId: version.id,
      },
    });

    return this.getJob(access, preview);
  }

  async getJob(
    access: AccessContext,
    id: string,
  ): Promise<DocumentGenerationJobDetail> {
    const row = await this.databaseService.one<GenerationJobRow>(
      `
        select
          id,
          workspace_id,
          template_id,
          template_version_id,
          profile_snapshot_id,
          workflow_run_id,
          approval_route_id,
          status,
          preview_document_id,
          preview_document_version_id,
          final_document_id,
          final_document_version_id,
          validation_report_id,
          missing_field_codes,
          created_at,
          updated_at
        from app.document_generation_jobs
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [id, access.activeWorkspace!.id],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_GENERATION_NOT_FOUND',
        404,
        'Document generation job was not found.',
      );
    }

    const [previewDocument, finalDocument, artifacts] = await Promise.all([
      row.preview_document_id ? this.loadDocumentSummary(row.preview_document_id) : null,
      row.final_document_id ? this.loadDocumentSummary(row.final_document_id) : null,
      row.workflow_run_id ? this.loadRunArtifacts(row.workflow_run_id) : Promise.resolve([]),
    ]);

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      templateId: row.template_id,
      templateVersionId: row.template_version_id,
      profileSnapshotId: row.profile_snapshot_id,
      workflowRunId: row.workflow_run_id,
      approvalRouteId: row.approval_route_id,
      status: row.status,
      previewDocumentId: row.preview_document_id,
      previewDocumentVersionId: row.preview_document_version_id,
      finalDocumentId: row.final_document_id,
      finalDocumentVersionId: row.final_document_version_id,
      validationReportId: row.validation_report_id,
      missingFieldCodes: row.missing_field_codes ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      previewDocument,
      finalDocument,
      artifacts,
    };
  }

  async finalize(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: FinalizeDocumentGenerationRequest,
    meta: RequestMeta,
  ): Promise<DocumentGenerationJobDetail> {
    const job = await this.getJob(access, input.generationJobId ?? id);

    if (job.approvalRouteId) {
      const task = await this.approvalsService.ensureTaskForGeneration({
        actor,
        access,
        generationJobId: job.id,
        routeId: job.approvalRouteId,
        workflowRunId: job.workflowRunId,
        title: input.approvalDecisionComment?.trim() || `Approve finalization for ${job.id}`,
        meta,
      });

      if (task?.status === 'pending') {
        await this.databaseService.query(
          `
            update app.document_generation_jobs
            set
              status = 'waiting_approval',
              updated_at = timezone('utc', now())
            where id = $1
          `,
          [job.id],
        );

        return this.getJob(access, job.id);
      }

      if (task?.status === 'rejected') {
        throw new AppHttpException(
          'APPROVAL_REJECTED',
          409,
          'Document finalization was rejected by approval gate.',
        );
      }
    }

    if (job.finalDocumentId && job.finalDocumentVersionId) {
      return this.getJob(access, job.id);
    }

    const finalJobId = await this.databaseService.transaction(async (client) => {
      const previewDocument = job.previewDocument;

      if (!previewDocument?.currentVersion) {
        throw new AppHttpException(
          'DOCUMENT_PREVIEW_NOT_FOUND',
          409,
          'Preview document must exist before finalization.',
        );
      }

      const createdFinal = await this.createDocumentRecord(
        client,
        access.activeWorkspace!.id,
        actor.id,
        {
          title: previewDocument.title.replace(/^Preview:\s*/, 'Final: '),
          description: previewDocument.description,
          kind: 'generated_document',
          mimeType: previewDocument.currentVersion.mimeType,
          filename: previewDocument.currentVersion.originalFilename.replace(
            '-preview',
            '-final',
          ),
        },
      );

      let artifactId: string | null = null;

      if (job.workflowRunId) {
        artifactId = await this.createArtifact(
          client,
          job.workflowRunId,
          access.activeWorkspace!.id,
          createdFinal.documentId,
          createdFinal.versionId,
          'final_document',
          previewDocument.title.replace(/^Preview:\s*/, 'Final: '),
        );
      }

      await client.query(
        `
          insert into app.document_generation_outputs (
            generation_job_id,
            workspace_id,
            artifact_id,
            artifact_type,
            document_id,
            document_version_id,
            metadata
          )
          values ($1, $2, $3, 'final_document', $4, $5, '{}'::jsonb)
        `,
        [
          job.id,
          access.activeWorkspace!.id,
          artifactId,
          createdFinal.documentId,
          createdFinal.versionId,
        ],
      );

      await client.query(
        `
          update app.document_generation_jobs
          set
            status = 'finalized',
            final_document_id = $2,
            final_document_version_id = $3,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [job.id, createdFinal.documentId, createdFinal.versionId],
      );

      if (job.workflowRunId) {
        await client.query(
          `
            update app.workflow_runs
            set approval_state = case
              when approval_route_id is null then approval_state
              else 'approved'
            end
            where id = $1
          `,
          [job.workflowRunId],
        );
      }

      return job.id;
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.finalized',
      entityType: 'document_generation_job',
      entityId: finalJobId,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        approvalRouteId: job.approvalRouteId,
      },
    });

    return this.getJob(access, finalJobId);
  }

  async executeRuntime(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: WorkflowRuntimeDocumentTemplateExecuteRequest,
    meta: RequestMeta,
  ): Promise<DocumentGenerationJobDetail> {
    return this.createPreview(
      actor,
      access,
      {
        templateId: input.templateId,
        templateVersionId: input.templateVersionId ?? null,
        profileId: input.profileId ?? null,
        workflowRunId: input.workflowRunId,
        input: input.input,
      },
      meta,
    );
  }

  private async loadDocumentSummary(documentId: string): Promise<DocumentSummary | null> {
    const row = await this.databaseService.one<DocumentSummaryRow>(
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
          v.scan_status as version_scan_status,
          v.preview_status as version_preview_status,
          v.extraction_status as version_extraction_status,
          v.created_at as version_created_at,
          v.completed_at as version_completed_at
        from app.documents d
        left join app.document_versions v
          on v.id = d.current_version_id
        where d.id = $1
        limit 1
      `,
      [documentId],
    );

    if (!row) {
      return null;
    }

    return toDocumentSummary({
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
      version:
        row.version_id &&
        row.version_no &&
        row.version_status &&
        row.version_original_filename &&
        row.version_mime_type &&
        row.version_size_bytes !== null &&
        row.version_scan_status &&
        row.version_preview_status &&
        row.version_extraction_status &&
        row.version_created_at
          ? {
              id: row.version_id,
              versionNo: row.version_no,
              status: row.version_status,
              originalFilename: row.version_original_filename,
              mimeType: row.version_mime_type,
              sizeBytes: Number(row.version_size_bytes),
              scanStatus: row.version_scan_status,
              previewStatus: row.version_preview_status,
              extractionStatus: row.version_extraction_status,
              createdAt: row.version_created_at,
              completedAt: row.version_completed_at,
            }
          : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
      deletedAt: row.deleted_at,
    });
  }

  private async loadRunArtifacts(runId: string): Promise<readonly RunArtifact[]> {
    const result = await this.databaseService.query<ArtifactRow>(
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
        order by created_at asc
      `,
      [runId],
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

  private async createDocumentRecord(
    client: { query: DatabaseService['query'] },
    workspaceId: string,
    actorId: string,
    input: {
      readonly title: string;
      readonly description: string | null;
      readonly kind: DocumentSummary['kind'];
      readonly mimeType: string;
      readonly filename: string;
    },
  ) {
    const document = await client.query<{ id: string }>(
      `
        insert into app.documents (
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
        values ($1, $2, $3, $4, $5, 'ready', 'confidential', 'automation_result', '{}'::text[], $2, $2)
        returning id
      `,
      [workspaceId, actorId, input.title, input.description, input.kind],
    );
    const documentId = document.rows[0]!.id;
    const version = await client.query<{ id: string }>(
      `
        insert into app.document_versions (
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
        values ($1, $2, 1, 'ready', $3, $4, $5, 0, 'artifacts-private', $6, 'clean', 'ready', 'ready', $7, timezone('utc', now()))
        returning id
      `,
      [
        documentId,
        workspaceId,
        input.filename,
        input.filename.toLowerCase(),
        input.mimeType,
        `${workspaceId}/${documentId}/${randomUUID()}/${input.filename.toLowerCase()}`,
        actorId,
      ],
    );
    const versionId = version.rows[0]!.id;

    await client.query(
      `
        update app.documents
        set current_version_id = $2
        where id = $1
      `,
      [documentId, versionId],
    );

    return {
      documentId,
      versionId,
    };
  }

  private async createArtifact(
    client: { query: DatabaseService['query'] },
    workflowRunId: string,
    workspaceId: string,
    documentId: string,
    documentVersionId: string,
    artifactType: string,
    title: string,
  ): Promise<string> {
    const artifact = await client.query<{ id: string }>(
      `
        insert into app.run_artifacts (
          workflow_run_id,
          workspace_id,
          document_id,
          document_version_id,
          artifact_type,
          title,
          mime_type,
          source
        )
        values ($1, $2, $3, $4, $5, $6, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'automation_result')
        returning id
      `,
      [workflowRunId, workspaceId, documentId, documentVersionId, artifactType, title],
    );

    return artifact.rows[0]!.id;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
