import type {
  CreateProfileImportJobRequest,
  ProfileImportJobSummary,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { type RequestMeta } from '../stage7-support/stage7.helpers';

interface ProfileImportJobRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly source_document_id: string;
  readonly source_document_version_id: string;
  readonly target_profile_id: string | null;
  readonly status: ProfileImportJobSummary['status'];
  readonly inferred_profile_content: Record<string, unknown> | null;
  readonly inferred_template_title: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class ProfileImportsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateProfileImportJobRequest,
    meta: RequestMeta,
  ): Promise<ProfileImportJobSummary> {
    const source = await this.databaseService.one<{
      readonly title: string;
      readonly description: string | null;
      readonly original_filename: string;
    }>(
      `
        select
          d.title,
          d.description,
          dv.original_filename
        from app.documents d
        join app.document_versions dv
          on dv.document_id = d.id
        where d.id = $1
          and dv.id = $2
          and d.workspace_id = $3
        limit 1
      `,
      [input.sourceDocumentId, input.sourceDocumentVersionId, access.activeWorkspace!.id],
    );

    if (!source) {
      throw new AppHttpException(
        'PROFILE_IMPORT_SOURCE_NOT_FOUND',
        404,
        'Profile import source document was not found.',
      );
    }

    const inferredProfileContent = {
      sourceDocumentTitle: source.title,
      sourceFilename: source.original_filename,
      notes: source.description ?? null,
      importMode: 'draft_only',
    };

    const row = await this.databaseService.one<ProfileImportJobRow>(
      `
        insert into app.profile_import_jobs (
          workspace_id,
          source_document_id,
          source_document_version_id,
          target_profile_id,
          status,
          inferred_profile_content,
          inferred_template_title,
          created_by_user_id
        )
        values ($1, $2, $3, $4, 'draft_ready', $5::jsonb, $6, $7)
        returning
          id,
          workspace_id,
          source_document_id,
          source_document_version_id,
          target_profile_id,
          status,
          inferred_profile_content,
          inferred_template_title,
          created_at,
          updated_at
      `,
      [
        access.activeWorkspace!.id,
        input.sourceDocumentId,
        input.sourceDocumentVersionId,
        input.targetProfileId ?? null,
        JSON.stringify(inferredProfileContent),
        `${source.title} imported draft`,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'PROFILE_IMPORT_CREATE_FAILED',
        500,
        'Profile import job was not created.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'profile.import.created',
      entityType: 'profile_import_job',
      entityId: row.id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        sourceDocumentId: input.sourceDocumentId,
      },
    });

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sourceDocumentId: row.source_document_id,
      sourceDocumentVersionId: row.source_document_version_id,
      targetProfileId: row.target_profile_id,
      status: row.status,
      inferredProfileContent: row.inferred_profile_content,
      inferredTemplateTitle: row.inferred_template_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
