import type {
  ProjectKnowledgeItem,
  ProjectKnowledgeListResponse,
  UpsertProjectKnowledgeItemRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

interface ProjectKnowledgeRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string;
  readonly source_type: ProjectKnowledgeItem['sourceType'];
  readonly source_id: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly url: string | null;
  readonly mode: ProjectKnowledgeItem['mode'];
  readonly classification: ProjectKnowledgeItem['classification'];
  readonly pinned: boolean;
  readonly enabled_for_chat: boolean;
  readonly citation_required: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

const PROJECT_KNOWLEDGE_COLUMNS = [
  'id',
  'workspace_id',
  'project_id',
  'source_type',
  'source_id',
  'null::text as title',
  'null::text as summary',
  'null::text as url',
  'mode',
  'classification',
  'pinned',
  'enabled_for_chat',
  'citation_required',
  'created_at',
  'updated_at',
].join(', ');

@Injectable()
export class ProjectKnowledgeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<ProjectKnowledgeListResponse> {
    const { access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.assertProjectExists(access, projectId);
    const result = await this.databaseService.query<ProjectKnowledgeRow>(
      `
        select
          item.id,
          item.workspace_id,
          item.project_id,
          item.source_type,
          item.source_id,
          coalesce(nullif(item.metadata->>'title', ''), web_result.title) as title,
          coalesce(nullif(item.metadata->>'summary', ''), web_result.snippet) as summary,
          coalesce(nullif(item.metadata->>'url', ''), web_result.url) as url,
          item.mode,
          item.classification,
          item.pinned,
          item.enabled_for_chat,
          item.citation_required,
          item.created_at,
          item.updated_at
        from app.project_knowledge_items item
        left join app.project_web_search_results web_result
          on item.source_type = 'web_search_result'
          and item.source_id = web_result.id::text
          and item.workspace_id = web_result.workspace_id
          and item.project_id = web_result.project_id
        where item.workspace_id = $1
          and item.project_id = $2
        order by item.pinned desc, item.updated_at desc
        limit 100
      `,
      [workspaceId, projectId],
    );

    return { items: result.rows.map(mapProjectKnowledgeRow) };
  }

  async create(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: UpsertProjectKnowledgeItemRequest,
  ): Promise<ProjectKnowledgeItem> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.assertProjectExists(access, projectId);
    const row = await this.databaseService.one<ProjectKnowledgeRow>(
      `
        insert into app.project_knowledge_items (
          workspace_id,
          project_id,
          source_type,
          source_id,
          mode,
          classification,
          pinned,
          enabled_for_chat,
          citation_required,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning ${PROJECT_KNOWLEDGE_COLUMNS}
      `,
      [
        workspaceId,
        projectId,
        input.sourceType,
        input.sourceId,
        input.mode,
        input.classification,
        input.pinned ?? false,
        input.enabledForChat ?? true,
        input.citationRequired ?? true,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'CHAT_CONTEXT_POLICY_BLOCKED',
        500,
        'Project knowledge item was not created.',
      );
    }

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'chat.context.item.added',
      entityType: 'project_knowledge_item',
      entityId: row.id,
      result: 'success',
      eventCategory: 'chat',
      metadata: {
        project_id: projectId,
        source_type: input.sourceType,
        mode: input.mode,
        classification: input.classification,
      },
    });

    return mapProjectKnowledgeRow(row);
  }

  async update(
    context: LexframeRequestState | undefined,
    projectId: string,
    itemId: string,
    input: Partial<UpsertProjectKnowledgeItemRequest>,
  ): Promise<ProjectKnowledgeItem> {
    const { access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.assertProjectExists(access, projectId);
    const row = await this.databaseService.one<ProjectKnowledgeRow>(
      `
        update app.project_knowledge_items
        set
          mode = coalesce($4, mode),
          pinned = coalesce($5, pinned),
          enabled_for_chat = coalesce($6, enabled_for_chat),
          citation_required = coalesce($7, citation_required),
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and project_id = $3
        returning ${PROJECT_KNOWLEDGE_COLUMNS}
      `,
      [
        itemId,
        workspaceId,
        projectId,
        input.mode ?? null,
        input.pinned ?? null,
        input.enabledForChat ?? null,
        input.citationRequired ?? null,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'DOCUMENT_NOT_FOUND',
        404,
        'Project knowledge item was not found.',
      );
    }

    return mapProjectKnowledgeRow(row);
  }

  async delete(
    context: LexframeRequestState | undefined,
    projectId: string,
    itemId: string,
  ) {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.assertProjectExists(access, projectId);
    await this.databaseService.query(
      `
        delete from app.project_knowledge_items
        where id = $1
          and workspace_id = $2
          and project_id = $3
      `,
      [itemId, workspaceId, projectId],
    );
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId,
      action: 'chat.context.item.removed',
      entityType: 'project_knowledge_item',
      entityId: itemId,
      result: 'success',
      eventCategory: 'chat',
      metadata: { project_id: projectId },
    });

    return { id: itemId, status: 'deleted' as const };
  }

  private requireContext(context: LexframeRequestState | undefined): {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
  } {
    if (!context?.actor || !context.access) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace access context was not attached.',
      );
    }
    return { actor: context.actor, access: context.access };
  }

  private requireWorkspace(access: AccessContext) {
    if (!access.activeWorkspace) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Active workspace is required.',
      );
    }
    return access.activeWorkspace;
  }

  private async assertProjectExists(
    access: AccessContext,
    projectId: string,
  ): Promise<void> {
    const workspace = this.requireWorkspace(access);
    const row = await this.databaseService.one<{ readonly id: string }>(
      `
        select id
        from app.projects
        where workspace_id = $1
          and id = $2
          and status <> 'archived'
      `,
      [workspace.id, projectId],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }
  }
}

function mapProjectKnowledgeRow(
  row: ProjectKnowledgeRow,
): ProjectKnowledgeItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    mode: row.mode,
    classification: row.classification,
    pinned: row.pinned,
    enabledForChat: row.enabled_for_chat,
    citationRequired: row.citation_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
