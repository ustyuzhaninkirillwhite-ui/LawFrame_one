import type {
  CreateDocumentStructureRequest,
  CreateDocumentTypeRequest,
  DocumentStructureRecord,
  DocumentStructureSection,
  DocumentTypeDetail,
  DocumentTypeSummary,
  DocumentTypeVersionSummary,
  UpdateDocumentStructureRequest,
  UpdateDocumentTypeRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { hashJson, type RequestMeta } from '../stage7-support/stage7.helpers';

interface DocumentTypeRow {
  readonly id: string;
  readonly workspace_id: string | null;
  readonly code: string;
  readonly name: string;
  readonly jurisdiction: string | null;
  readonly practice_area: string | null;
  readonly status: DocumentTypeSummary['status'];
  readonly active_version_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface DocumentTypeVersionRow {
  readonly id: string;
  readonly document_type_id: string;
  readonly version: number;
  readonly status: DocumentTypeVersionSummary['status'];
  readonly schema_version: string;
  readonly structure: readonly DocumentStructureSection[];
  readonly attachment_defaults: readonly string[];
  readonly validation_rules: Record<string, unknown>;
  readonly created_at: string;
  readonly published_at: string | null;
}

interface DocumentStructureRow {
  readonly document_type_version_id: string;
  readonly document_type_id: string;
  readonly section_id: string;
  readonly title: string;
  readonly kind: DocumentStructureSection['kind'];
  readonly is_required: boolean;
  readonly sort_order: number;
  readonly locked: boolean;
  readonly clause_ids: readonly string[];
  readonly placeholder_codes: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async list(access: AccessContext): Promise<readonly DocumentTypeSummary[]> {
    const result = await this.databaseService.query<DocumentTypeRow>(
      `
        select
          id,
          workspace_id,
          code,
          name,
          jurisdiction,
          practice_area,
          status,
          active_version_id,
          created_at,
          updated_at
        from app.document_types
        where deleted_at is null
          and (workspace_id = $1 or workspace_id is null)
        order by updated_at desc, created_at desc
      `,
      [access.activeWorkspace!.id],
    );

    return result.rows.map(mapDocumentTypeRow);
  }

  async get(access: AccessContext, id: string): Promise<DocumentTypeDetail> {
    const row = await this.databaseService.one<DocumentTypeRow>(
      `
        select
          id,
          workspace_id,
          code,
          name,
          jurisdiction,
          practice_area,
          status,
          active_version_id,
          created_at,
          updated_at
        from app.document_types
        where id = $1
          and deleted_at is null
          and (workspace_id = $2 or workspace_id is null)
        limit 1
      `,
      [id, access.activeWorkspace!.id],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_TYPE_NOT_FOUND',
        404,
        'Document type was not found.',
      );
    }

    const versions = await this.listVersions(id);

    return {
      ...mapDocumentTypeRow(row),
      versions,
    };
  }

  async create(
    actor: AuthenticatedActor,
    access: AccessContext,
    input: CreateDocumentTypeRequest,
    meta: RequestMeta,
  ): Promise<DocumentTypeDetail> {
    const workspaceId = input.workspaceId ?? access.activeWorkspace!.id;

    return this.databaseService.transaction(async (client) => {
      const typeResult = await client.query<{ id: string }>(
        `
          insert into app.document_types (
            workspace_id,
            code,
            name,
            jurisdiction,
            practice_area,
            status,
            created_by_user_id,
            updated_by_user_id
          )
          values ($1, $2, $3, $4, $5, 'draft', $6, $6)
          returning id
        `,
        [
          workspaceId,
          input.code.trim(),
          input.name.trim(),
          input.jurisdiction ?? null,
          input.practiceArea ?? null,
          actor.id,
        ],
      );
      const documentTypeId = typeResult.rows[0]!.id;

      const versionResult = await client.query<{ id: string }>(
        `
          insert into app.document_type_versions (
            document_type_id,
            workspace_id,
            version,
            status,
            schema_version,
            structure,
            attachment_defaults,
            validation_rules,
            created_by_user_id
          )
          values ($1, $2, 1, 'draft', 'stage7.v1', $3::jsonb, $4::jsonb, $5::jsonb, $6)
          returning id
        `,
        [
          documentTypeId,
          workspaceId,
          JSON.stringify(input.structure),
          JSON.stringify(input.attachmentDefaults ?? []),
          JSON.stringify(input.validationRules ?? {}),
          actor.id,
        ],
      );

      await client.query(
        `
          update app.document_types
          set active_version_id = $2
          where id = $1
        `,
        [documentTypeId, versionResult.rows[0]!.id],
      );

      await this.replaceStructureRows(
        client,
        workspaceId,
        documentTypeId,
        versionResult.rows[0]!.id,
        input.structure,
      );

      await this.auditService.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        workspaceId,
        action: 'document_type.created',
        entityType: 'document_type',
        entityId: documentTypeId,
        result: 'success',
        requestId: meta.requestId,
        traceId: meta.traceId,
        metadata: {
          code: input.code,
          structureHash: hashJson(input.structure),
        },
      });

      return this.get(access, documentTypeId);
    });
  }

  async update(
    actor: AuthenticatedActor,
    access: AccessContext,
    id: string,
    input: UpdateDocumentTypeRequest,
    meta: RequestMeta,
  ): Promise<DocumentTypeDetail> {
    const current = await this.get(access, id);
    const workspaceId = current.workspaceId ?? access.activeWorkspace!.id;
    const currentVersion = current.versions[0] ?? null;

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          update app.document_types
          set
            name = coalesce($2, name),
            jurisdiction = coalesce($3, jurisdiction),
            practice_area = coalesce($4, practice_area),
            updated_by_user_id = $5,
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          id,
          input.name?.trim() ?? null,
          input.jurisdiction ?? null,
          input.practiceArea ?? null,
          actor.id,
        ],
      );

      if (
        input.structure ||
        input.attachmentDefaults ||
        input.validationRules
      ) {
        const nextVersion = await this.getNextVersionNumber(id);
        const versionResult = await client.query<{ id: string }>(
          `
            insert into app.document_type_versions (
              document_type_id,
              workspace_id,
              version,
              status,
              schema_version,
              structure,
              attachment_defaults,
              validation_rules,
              created_by_user_id
            )
            values ($1, $2, $3, 'draft', 'stage7.v1', $4::jsonb, $5::jsonb, $6::jsonb, $7)
            returning id
          `,
          [
            id,
            workspaceId,
            nextVersion,
            JSON.stringify(input.structure ?? currentVersion?.structure ?? []),
            JSON.stringify(
              input.attachmentDefaults ??
                currentVersion?.attachmentDefaults ??
                [],
            ),
            JSON.stringify(
              input.validationRules ?? currentVersion?.validationRules ?? {},
            ),
            actor.id,
          ],
        );

        await client.query(
          `
            update app.document_types
            set active_version_id = $2
            where id = $1
          `,
          [id, versionResult.rows[0]!.id],
        );

        await this.replaceStructureRows(
          client,
          workspaceId,
          id,
          versionResult.rows[0]!.id,
          input.structure ?? currentVersion?.structure ?? [],
        );
      }
    });

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'document_type.updated',
      entityType: 'document_type',
      entityId: id,
      result: 'success',
      requestId: meta.requestId,
      traceId: meta.traceId,
      metadata: {
        hasStructureChange: Boolean(input.structure),
      },
    });

    return this.get(access, id);
  }

  async listStructures(
    access: AccessContext,
  ): Promise<readonly DocumentStructureRecord[]> {
    const result = await this.databaseService.query<DocumentStructureRow>(
      `
        select
          document_type_version_id,
          document_type_id,
          section_id,
          title,
          kind,
          is_required,
          sort_order,
          locked,
          clause_ids,
          placeholder_codes,
          created_at,
          updated_at
        from app.document_structures
        where workspace_id = $1
        order by document_type_version_id, sort_order asc
      `,
      [access.activeWorkspace!.id],
    );

    return groupStructureRows(result.rows);
  }

  async createStructure(
    access: AccessContext,
    input: CreateDocumentStructureRequest,
  ): Promise<DocumentStructureRecord> {
    const workspaceId = access.activeWorkspace!.id;
    const versionId =
      input.documentTypeVersionId ??
      (
        await this.databaseService.one<{
          readonly active_version_id: string | null;
        }>(
          `
          select active_version_id
          from app.document_types
          where id = $1
            and workspace_id = $2
          limit 1
        `,
          [input.documentTypeId, workspaceId],
        )
      )?.active_version_id;

    if (!versionId) {
      throw new AppHttpException(
        'DOCUMENT_TYPE_VERSION_NOT_FOUND',
        404,
        'Document type version was not found for structure update.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      await this.replaceStructureRows(
        client,
        workspaceId,
        input.documentTypeId,
        versionId,
        input.sections,
      );

      await client.query(
        `
          update app.document_type_versions
          set structure = $2::jsonb
          where id = $1
        `,
        [versionId, JSON.stringify(input.sections)],
      );
    });

    return this.getStructureRecord(access, versionId);
  }

  async updateStructure(
    access: AccessContext,
    id: string,
    input: UpdateDocumentStructureRequest,
  ): Promise<DocumentStructureRecord> {
    const version = await this.databaseService.one<{
      readonly id: string;
      readonly document_type_id: string;
    }>(
      `
        select id, document_type_id
        from app.document_type_versions
        where id = $1
        limit 1
      `,
      [id],
    );

    if (!version) {
      throw new AppHttpException(
        'DOCUMENT_TYPE_VERSION_NOT_FOUND',
        404,
        'Document type version was not found.',
      );
    }

    await this.databaseService.transaction(async (client) => {
      await this.replaceStructureRows(
        client,
        access.activeWorkspace!.id,
        version.document_type_id,
        version.id,
        input.sections,
      );

      await client.query(
        `
          update app.document_type_versions
          set structure = $2::jsonb
          where id = $1
        `,
        [version.id, JSON.stringify(input.sections)],
      );
    });

    return this.getStructureRecord(access, version.id);
  }

  async listVersions(
    documentTypeId: string,
  ): Promise<readonly DocumentTypeVersionSummary[]> {
    const result = await this.databaseService.query<DocumentTypeVersionRow>(
      `
        select
          id,
          document_type_id,
          version,
          status,
          schema_version,
          structure,
          attachment_defaults,
          validation_rules,
          created_at,
          published_at
        from app.document_type_versions
        where document_type_id = $1
        order by version desc
      `,
      [documentTypeId],
    );

    return result.rows.map(mapDocumentTypeVersionRow);
  }

  private async getStructureRecord(
    access: AccessContext,
    versionId: string,
  ): Promise<DocumentStructureRecord> {
    const rows = await this.databaseService.query<DocumentStructureRow>(
      `
        select
          document_type_version_id,
          document_type_id,
          section_id,
          title,
          kind,
          is_required,
          sort_order,
          locked,
          clause_ids,
          placeholder_codes,
          created_at,
          updated_at
        from app.document_structures
        where document_type_version_id = $1
          and workspace_id = $2
        order by sort_order asc
      `,
      [versionId, access.activeWorkspace!.id],
    );

    const grouped = groupStructureRows(rows.rows);
    const record = grouped[0];

    if (!record) {
      throw new AppHttpException(
        'DOCUMENT_STRUCTURE_NOT_FOUND',
        404,
        'Document structure record was not found.',
      );
    }

    return record;
  }

  private async replaceStructureRows(
    client: { query: DatabaseService['query'] },
    workspaceId: string,
    documentTypeId: string,
    versionId: string,
    sections: readonly DocumentStructureSection[],
  ) {
    await client.query(
      `
        delete from app.document_structures
        where document_type_version_id = $1
      `,
      [versionId],
    );

    for (const section of sections) {
      await client.query(
        `
          insert into app.document_structures (
            workspace_id,
            document_type_id,
            document_type_version_id,
            section_id,
            title,
            kind,
            is_required,
            sort_order,
            locked,
            clause_ids,
            placeholder_codes
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
        `,
        [
          workspaceId,
          documentTypeId,
          versionId,
          section.sectionId,
          section.title,
          section.kind,
          section.required,
          section.order,
          section.locked,
          JSON.stringify(section.clauseIds),
          JSON.stringify(section.placeholderCodes),
        ],
      );
    }
  }

  private async getNextVersionNumber(documentTypeId: string): Promise<number> {
    const row = await this.databaseService.one<{
      readonly next_version: number;
    }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from app.document_type_versions
        where document_type_id = $1
      `,
      [documentTypeId],
    );

    return row?.next_version ?? 1;
  }
}

function mapDocumentTypeRow(row: DocumentTypeRow): DocumentTypeSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    code: row.code,
    name: row.name,
    jurisdiction: row.jurisdiction,
    practiceArea: row.practice_area,
    status: row.status,
    activeVersionId: row.active_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentTypeVersionRow(
  row: DocumentTypeVersionRow,
): DocumentTypeVersionSummary {
  return {
    id: row.id,
    documentTypeId: row.document_type_id,
    version: row.version,
    status: row.status,
    schemaVersion: row.schema_version,
    structure: row.structure ?? [],
    attachmentDefaults: row.attachment_defaults ?? [],
    validationRules: row.validation_rules ?? {},
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

function groupStructureRows(
  rows: readonly DocumentStructureRow[],
): readonly DocumentStructureRecord[] {
  const grouped = new Map<string, DocumentStructureRecord>();

  for (const row of rows) {
    const current = grouped.get(row.document_type_version_id);
    const section: DocumentStructureSection = {
      sectionId: row.section_id,
      title: row.title,
      kind: row.kind,
      required: row.is_required,
      order: row.sort_order,
      locked: row.locked,
      clauseIds: row.clause_ids ?? [],
      placeholderCodes: row.placeholder_codes ?? [],
    };

    if (current) {
      grouped.set(row.document_type_version_id, {
        ...current,
        sections: [...current.sections, section].sort(
          (left, right) => left.order - right.order,
        ),
        updatedAt: row.updated_at,
      });
      continue;
    }

    grouped.set(row.document_type_version_id, {
      id: row.document_type_version_id,
      documentTypeId: row.document_type_id,
      documentTypeVersionId: row.document_type_version_id,
      sections: [section],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return [...grouped.values()];
}
