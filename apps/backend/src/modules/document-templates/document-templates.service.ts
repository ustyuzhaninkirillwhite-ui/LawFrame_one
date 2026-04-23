import type {
  CreateDocumentTemplateRequest,
  DocumentTemplateDetail,
  DocumentTemplatePlaceholder,
  DocumentTemplateSummary,
  DocumentTemplateVersionSummary,
  ParseDocumentTemplatePlaceholdersResponse,
  PublishDocumentTemplateVersionRequest,
  UpdateDocumentTemplateRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import {
  extractPlaceholders,
  type RequestMeta,
} from '../stage7-support/stage7.helpers';

interface TemplateRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly owner_user_id: string | null;
  readonly document_type_id: string | null;
  readonly source_document_id: string;
  readonly source_document_version_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: DocumentTemplateSummary['visibility'];
  readonly status: DocumentTemplateSummary['status'];
  readonly active_version_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface TemplateVersionRow {
  readonly id: string;
  readonly template_id: string;
  readonly version: number;
  readonly status: DocumentTemplateVersionSummary['status'];
  readonly source_document_version_id: string;
  readonly preview_document_version_id: string | null;
  readonly placeholders: readonly DocumentTemplatePlaceholder[];
  readonly mappings: DocumentTemplateVersionSummary['mappings'];
  readonly created_at: string;
  readonly published_at: string | null;
}

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    access: AccessContext,
  ): Promise<readonly DocumentTemplateDetail[]> {
    const result = await this.databaseService.query<TemplateRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          document_type_id,
          source_document_id,
          source_document_version_id,
          title,
          description,
          visibility,
          status,
          active_version_id,
          created_at,
          updated_at
        from app.document_templates
        where deleted_at is null
          and (
            visibility in ('system', 'public')
            or workspace_id = $1
          )
        order by updated_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return Promise.all(result.rows.map((row) => this.buildDetail(row)));
  }

  async get(
    access: AccessContext,
    id: string,
  ): Promise<DocumentTemplateDetail> {
    const row = await this.getTemplateRow(id, access.activeWorkspace!.id);
    return this.buildDetail(row);
  }

  async create(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateDocumentTemplateRequest,
    meta: RequestMeta,
  ): Promise<DocumentTemplateDetail> {
    const workspaceId = input.workspaceId ?? access.activeWorkspace!.id;

    return this.databaseService.transaction(async (client) => {
      const templateResult = await client.query<{ id: string }>(
        `
          insert into app.document_templates (
            workspace_id,
            owner_user_id,
            document_type_id,
            source_document_id,
            source_document_version_id,
            title,
            description,
            visibility,
            status,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $9)
          returning id
        `,
        [
          workspaceId,
          input.visibility === 'personal'
            ? actor.id
            : (input.ownerUserId ?? null),
          input.documentTypeId ?? null,
          input.sourceDocumentId,
          input.sourceDocumentVersionId,
          input.title.trim(),
          input.description ?? null,
          input.visibility,
          actor.id,
        ],
      );
      const templateId = templateResult.rows[0]!.id;

      const versionResult = await client.query<{ id: string }>(
        `
          insert into app.document_template_versions (
            template_id,
            workspace_id,
            version,
            status,
            source_document_version_id,
            placeholders,
            mappings,
            created_by_user_id
          )
          values ($1, $2, 1, 'draft', $3, $4::jsonb, $5::jsonb, $6)
          returning id
        `,
        [
          templateId,
          workspaceId,
          input.sourceDocumentVersionId,
          JSON.stringify(input.placeholders ?? []),
          JSON.stringify(input.mappings ?? []),
          actor.id,
        ],
      );

      await client.query(
        `
          update app.document_templates
          set active_version_id = $2
          where id = $1
        `,
        [templateId, versionResult.rows[0]!.id],
      );

      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'document.template.uploaded',
        entityType: 'document_template',
        entityId: templateId,
        result: 'success',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          sourceDocumentId: input.sourceDocumentId,
          placeholderCount: input.placeholders?.length ?? 0,
        },
      });

      return this.get(access, templateId);
    });
  }

  async update(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: UpdateDocumentTemplateRequest,
    meta: RequestMeta,
  ): Promise<DocumentTemplateDetail> {
    const template = await this.getTemplateRow(id, access.activeWorkspace!.id);
    const currentVersion = await this.getActiveVersion(template);

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.document_templates
          set
            title = coalesce($2, title),
            description = coalesce($3, description),
            document_type_id = coalesce($4, document_type_id),
            visibility = coalesce($5, visibility),
            updated_by_user_id = $6,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          id,
          input.title?.trim() ?? null,
          input.description ?? null,
          input.documentTypeId ?? null,
          input.visibility ?? null,
          actor.id,
        ],
      );

      if (input.placeholders || input.mappings) {
        if (!currentVersion || currentVersion.status === 'published') {
          const version = await this.getNextVersionNumber(id);
          const inserted = await client.query<{ id: string }>(
            `
              insert into app.document_template_versions (
                template_id,
                workspace_id,
                version,
                status,
                source_document_version_id,
                preview_document_version_id,
                placeholders,
                mappings,
                created_by_user_id
              )
              values ($1, $2, $3, 'draft', $4, $5, $6::jsonb, $7::jsonb, $8)
              returning id
            `,
            [
              id,
              template.workspace_id,
              version,
              currentVersion?.source_document_version_id ??
                template.source_document_version_id,
              currentVersion?.preview_document_version_id ?? null,
              JSON.stringify(
                input.placeholders ?? currentVersion?.placeholders ?? [],
              ),
              JSON.stringify(input.mappings ?? currentVersion?.mappings ?? []),
              actor.id,
            ],
          );

          await client.query(
            `
              update app.document_templates
              set active_version_id = $2
              where id = $1
            `,
            [id, inserted.rows[0]!.id],
          );
        } else {
          await client.query(
            `
              update app.document_template_versions
              set
                placeholders = $2::jsonb,
                mappings = $3::jsonb
              where id = $1
            `,
            [
              currentVersion.id,
              JSON.stringify(input.placeholders ?? currentVersion.placeholders),
              JSON.stringify(input.mappings ?? currentVersion.mappings),
            ],
          );
        }
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.template.updated',
      entityType: 'document_template',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        hasMappingChange: Boolean(input.mappings),
      },
    });

    return this.get(access, id);
  }

  async parsePlaceholders(
    access: AccessContext,
    id: string,
  ): Promise<ParseDocumentTemplatePlaceholdersResponse> {
    const template = await this.getTemplateRow(id, access.activeWorkspace!.id);
    const version = await this.getActiveVersion(template);

    if (!version) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_VERSION_NOT_FOUND',
        404,
        'Template version was not found.',
      );
    }

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
        limit 1
      `,
      [template.source_document_id, version.source_document_version_id],
    );

    const derived = extractPlaceholders(
      [
        template.title,
        template.description ?? '',
        source?.title ?? '',
        source?.description ?? '',
        source?.original_filename ?? '',
        JSON.stringify(version.placeholders ?? []),
      ].join(' '),
    );
    const merged = dedupePlaceholders([
      ...(version.placeholders ?? []),
      ...derived,
    ]);

    await this.databaseService.query(
      `
        update app.document_template_versions
        set placeholders = $2::jsonb
        where id = $1
      `,
      [version.id, JSON.stringify(merged)],
    );

    return {
      templateId: template.id,
      templateVersionId: version.id,
      placeholders: merged,
      detectedTags: merged.map((entry) => entry.code),
    };
  }

  async publishDraft(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    _input: PublishDocumentTemplateVersionRequest,
    meta: RequestMeta,
  ): Promise<DocumentTemplateDetail> {
    const version = await this.databaseService.one<TemplateVersionRow>(
      `
        select
          id,
          template_id,
          version,
          status,
          source_document_version_id,
          preview_document_version_id,
          placeholders,
          mappings,
          created_at,
          published_at
        from app.document_template_versions
        where id = $1
        limit 1
      `,
      [id],
    );

    if (!version) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_VERSION_NOT_FOUND',
        404,
        'Document template version was not found.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.document_template_versions
          set
            status = 'published',
            published_at = timezone('utc', now())
          where id = $1
        `,
        [id],
      );

      await client.query(
        `
          update app.document_templates
          set
            active_version_id = $2,
            status = 'published',
            updated_by_user_id = $3,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [version.template_id, id, actor.id],
      );
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace!.id,
      action: 'document.template.published',
      entityType: 'document_template_version',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        templateId: version.template_id,
      },
    });

    return this.get(access, version.template_id);
  }

  async getVersion(
    templateId: string,
    requestedVersionId?: string | null,
  ): Promise<TemplateVersionRow> {
    const template = await this.databaseService.one<TemplateRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          document_type_id,
          source_document_id,
          source_document_version_id,
          title,
          description,
          visibility,
          status,
          active_version_id,
          created_at,
          updated_at
        from app.document_templates
        where id = $1
        limit 1
      `,
      [templateId],
    );

    if (!template) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_NOT_FOUND',
        404,
        'Document template was not found.',
      );
    }

    const versionId = requestedVersionId ?? template.active_version_id;

    if (!versionId) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_VERSION_NOT_FOUND',
        404,
        'Document template version was not found.',
      );
    }

    const version = await this.databaseService.one<TemplateVersionRow>(
      `
        select
          id,
          template_id,
          version,
          status,
          source_document_version_id,
          preview_document_version_id,
          placeholders,
          mappings,
          created_at,
          published_at
        from app.document_template_versions
        where id = $1
        limit 1
      `,
      [versionId],
    );

    if (!version) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_VERSION_NOT_FOUND',
        404,
        'Document template version was not found.',
      );
    }

    return version;
  }

  private async getTemplateRow(
    id: string,
    workspaceId: string,
  ): Promise<TemplateRow> {
    const row = await this.databaseService.one<TemplateRow>(
      `
        select
          id,
          workspace_id,
          owner_user_id,
          document_type_id,
          source_document_id,
          source_document_version_id,
          title,
          description,
          visibility,
          status,
          active_version_id,
          created_at,
          updated_at
        from app.document_templates
        where id = $1
          and deleted_at is null
          and (
            visibility in ('system', 'public')
            or workspace_id = $2
          )
        limit 1
      `,
      [id, workspaceId],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_TEMPLATE_NOT_FOUND',
        404,
        'Document template was not found.',
      );
    }

    return row;
  }

  private async getActiveVersion(
    template: TemplateRow,
  ): Promise<TemplateVersionRow | null> {
    if (!template.active_version_id) {
      return null;
    }

    return this.databaseService.one<TemplateVersionRow>(
      `
        select
          id,
          template_id,
          version,
          status,
          source_document_version_id,
          preview_document_version_id,
          placeholders,
          mappings,
          created_at,
          published_at
        from app.document_template_versions
        where id = $1
        limit 1
      `,
      [template.active_version_id],
    );
  }

  private async getVersions(
    templateId: string,
  ): Promise<readonly DocumentTemplateVersionSummary[]> {
    const result = await this.databaseService.query<TemplateVersionRow>(
      `
        select
          id,
          template_id,
          version,
          status,
          source_document_version_id,
          preview_document_version_id,
          placeholders,
          mappings,
          created_at,
          published_at
        from app.document_template_versions
        where template_id = $1
        order by version desc
      `,
      [templateId],
    );

    return result.rows.map(mapTemplateVersionRow);
  }

  private async buildDetail(row: TemplateRow): Promise<DocumentTemplateDetail> {
    return {
      ...mapTemplateRow(row),
      versions: await this.getVersions(row.id),
    };
  }

  private async getNextVersionNumber(templateId: string): Promise<number> {
    const row = await this.databaseService.one<{
      readonly next_version: number;
    }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from app.document_template_versions
        where template_id = $1
      `,
      [templateId],
    );

    return row?.next_version ?? 1;
  }
}

function mapTemplateRow(row: TemplateRow): DocumentTemplateSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerUserId: row.owner_user_id,
    documentTypeId: row.document_type_id,
    sourceDocumentId: row.source_document_id,
    sourceDocumentVersionId: row.source_document_version_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    activeVersionId: row.active_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplateVersionRow(
  row: TemplateVersionRow,
): DocumentTemplateVersionSummary {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    status: row.status,
    sourceDocumentVersionId: row.source_document_version_id,
    previewDocumentVersionId: row.preview_document_version_id,
    placeholders: row.placeholders ?? [],
    mappings: row.mappings ?? [],
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

function dedupePlaceholders(
  placeholders: readonly DocumentTemplatePlaceholder[],
): readonly DocumentTemplatePlaceholder[] {
  const seen = new Map<string, DocumentTemplatePlaceholder>();

  for (const placeholder of placeholders) {
    seen.set(placeholder.code, placeholder);
  }

  return [...seen.values()];
}
