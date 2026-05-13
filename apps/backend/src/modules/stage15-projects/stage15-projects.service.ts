import type {
  InstalledAutomationDetail,
  Stage15CreateProjectChatRequest,
  Stage15CreateProjectRequest,
  Stage15ProjectCreatedResponse,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage15ProjectSummary,
  Stage15ProjectUpdatedResponse,
  Stage15UpdateProjectRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { ActivepiecesCanvasProvisioningService } from '../activepieces/activepieces-canvas-provisioning.service';
import { AutomationLibraryService } from '../automation-library/automation-library.service';
import {
  ChatThreadService,
  mapStage15ProjectChat,
} from '../chat/chat-thread.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { DatabaseService } from '../database/database.service';

const DEFAULT_STAGE17_PROJECT_ID = 'project_claim_001';
const DEFAULT_PROJECT_COLOR = '#3B82F6';

interface ProjectRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
  readonly status: Stage15ProjectSummary['status'];
  readonly owner_user_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const PROJECT_COLUMNS = [
  'id',
  'workspace_id',
  'name',
  'description',
  'icon',
  'color',
  'status',
  'owner_user_id',
  'created_at',
  'updated_at',
].join(', ');

@Injectable()
export class Stage15ProjectsService {
  constructor(
    private readonly automationLibraryService: AutomationLibraryService,
    private readonly activepiecesCanvasProvisioningService: ActivepiecesCanvasProvisioningService,
    private readonly dashboardService: DashboardService,
    private readonly databaseService: DatabaseService,
    private readonly chatThreadService: ChatThreadService,
  ) {}

  async listProjects(
    context: LexframeRequestState | undefined,
  ): Promise<Stage15ProjectListResponse> {
    const { actor, access } = this.requireContext(context);
    await this.ensureDefaultProject(actor, access);
    const rows = await this.listProjectRows(access);
    const items = await Promise.all(
      rows.map((row) => this.buildProjectSummary(row, actor, access)),
    );

    return { items };
  }

  async createProject(
    context: LexframeRequestState | undefined,
    input: Stage15CreateProjectRequest,
  ): Promise<Stage15ProjectCreatedResponse> {
    const { actor, access } = this.requireContext(context);
    const workspace = this.requireWorkspace(access);
    const name = input.name.trim();

    if (!name) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Project name is required.',
      );
    }

    const description = input.description?.trim() ?? '';
    const color = normalizeProjectColor(input.color);
    const icon = projectIconFor(name);
    const row = await this.databaseService.one<ProjectRow>(
      `
        insert into app.projects (
          workspace_id,
          id,
          name,
          description,
          icon,
          color,
          status,
          owner_user_id,
          created_by,
          updated_by
        )
        values (
          $1,
          'project_' || replace(public.app_uuid_v7()::text, '-', ''),
          $2,
          $3,
          $4,
          $5,
          'active',
          $6,
          $6,
          $6
        )
        returning ${PROJECT_COLUMNS}
      `,
      [workspace.id, name, description, icon, color, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'INVALID_REQUEST',
        500,
        'Project could not be created.',
      );
    }

    return {
      project: await this.buildProjectSummary(row, actor, access),
    };
  }

  async updateProject(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: Stage15UpdateProjectRequest,
  ): Promise<Stage15ProjectUpdatedResponse> {
    const { actor, access } = this.requireContext(context);
    const workspace = this.requireWorkspace(access);
    await this.requireProjectRow(actor, access, projectId);

    const name =
      input.name === undefined || input.name === null
        ? null
        : input.name.trim();
    if (input.name !== undefined && !name) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        400,
        'Project name is required.',
      );
    }

    const description =
      input.description === undefined || input.description === null
        ? null
        : input.description.trim();
    const color =
      input.color === undefined || input.color === null
        ? null
        : normalizeProjectColor(input.color);
    const icon = name ? projectIconFor(name) : null;
    const row = await this.databaseService.one<ProjectRow>(
      `
        update app.projects
        set
          name = coalesce($3, name),
          description = coalesce($4, description),
          color = coalesce($5, color),
          icon = coalesce($6, icon),
          updated_by = $7,
          updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
          and status <> 'archived'
        returning ${PROJECT_COLUMNS}
      `,
      [workspace.id, projectId, name, description, color, icon, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }

    return {
      project: await this.buildProjectSummary(row, actor, access),
    };
  }

  async getProject(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<Stage15ProjectDetail> {
    const { actor, access } = this.requireContext(context);
    const row = await this.requireProjectRow(actor, access, projectId);
    const workspace = this.requireWorkspace(access);

    const [automations, snapshot, documentsCount, chatThreads] =
      await Promise.all([
        this.automationLibraryService.listInstalled(access),
        this.dashboardService.getSnapshot(actor, access),
        this.countDocuments(workspace.id),
        this.chatThreadService.listProjectThreads({ actor, access }, projectId),
      ]);
    const chats = chatThreads.items.map(mapStage15ProjectChat);
    const project = this.buildProjectSummaryFromData(
      row,
      actor,
      access,
      automations,
      snapshot,
      documentsCount,
      chats,
    );

    return {
      ...project,
      chats,
      automations,
      documents: [],
      recentRuns: [...snapshot.activeRuns, ...snapshot.failedRuns].slice(0, 8),
      pendingApprovals: snapshot.pendingApprovals,
      recommendations: snapshot.recommendations,
      systemStatus: snapshot.systemStatus,
    };
  }

  async getProjectSnapshot(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<Stage15ProjectSnapshot> {
    const { actor, access } = this.requireContext(context);
    const row = await this.requireProjectRow(actor, access, projectId);
    const workspace = this.requireWorkspace(access);

    const [automations, snapshot, documentsCount, chatThreads] =
      await Promise.all([
        this.automationLibraryService.listInstalled(access),
        this.dashboardService.getSnapshot(actor, access),
        this.countDocuments(workspace.id),
        this.chatThreadService.listProjectThreads({ actor, access }, projectId),
      ]);
    const chats = chatThreads.items.map(mapStage15ProjectChat);
    const project = this.buildProjectSummaryFromData(
      row,
      actor,
      access,
      automations,
      snapshot,
      documentsCount,
      chats,
    );

    return {
      ...snapshot,
      project,
      recentChats: chats.slice(0, 6),
      projectAutomations: automations,
      projectDocuments: [],
    };
  }

  async listProjectChats(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<readonly Stage15ProjectChatSummary[]> {
    const { actor, access } = this.requireContext(context);
    await this.assertProjectId(actor, access, projectId);
    const response = await this.chatThreadService.listProjectThreads(
      context,
      projectId,
    );

    return response.items.map(mapStage15ProjectChat);
  }

  async createProjectChat(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: Stage15CreateProjectChatRequest = {},
  ): Promise<Stage15ProjectChatCreatedResponse> {
    const { actor, access } = this.requireContext(context);
    await this.assertProjectId(actor, access, projectId);

    return this.chatThreadService.createProjectChatForStage15(
      context,
      projectId,
      {
        title: input.title,
        kind: 'project',
      },
    );
  }

  async listProjectAutomations(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<readonly InstalledAutomationDetail[]> {
    const { actor, access } = this.requireContext(context);
    await this.assertProjectId(actor, access, projectId);

    return this.automationLibraryService.listInstalled(access);
  }

  async ensureStage17CanvasAutomation(
    context: LexframeRequestState | undefined,
    projectId: string,
    traceId: string | null,
  ) {
    const { actor, access } = this.requireContext(context);
    await this.assertProjectId(actor, access, projectId);

    return this.activepiecesCanvasProvisioningService.ensureStage17Canvas({
      actor,
      access,
      projectId,
      traceId,
    });
  }

  private async buildProjectSummary(
    row: ProjectRow,
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<Stage15ProjectSummary> {
    const workspace = this.requireWorkspace(access);
    const [automations, snapshot, documentsCount, chatThreads] =
      await Promise.all([
        this.automationLibraryService.listInstalled(access),
        this.dashboardService.getSnapshot(actor, access),
        this.countDocuments(workspace.id),
        this.chatThreadService
          .listProjectThreads({ actor, access }, row.id)
          .catch(() => ({ items: [] })),
      ]);

    return this.buildProjectSummaryFromData(
      row,
      actor,
      access,
      automations,
      snapshot,
      documentsCount,
      chatThreads.items.map(mapStage15ProjectChat),
    );
  }

  private buildProjectSummaryFromData(
    row: ProjectRow,
    actor: AuthenticatedActor,
    access: AccessContext,
    automations: readonly InstalledAutomationDetail[],
    snapshot: Awaited<ReturnType<DashboardService['getSnapshot']>>,
    documentsCount: number,
    chats: readonly Stage15ProjectChatSummary[],
  ): Stage15ProjectSummary {
    const workspace = this.requireWorkspace(access);

    return {
      id: row.id,
      workspaceId: workspace.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      color: row.color,
      status: row.status,
      ownerUserId: row.owner_user_id ?? actor.id,
      role: mapProjectRole(access),
      counters: {
        chats: chats.length,
        automations: automations.length,
        documents: documentsCount,
        activeRuns: snapshot.activeRuns.length,
        pendingApprovals: snapshot.pendingApprovals.length,
        recommendations: snapshot.recommendations.length,
        missingConnections: automations.reduce(
          (total, item) => total + item.missingConnections.length,
          0,
        ),
      },
      lastActivityAt: row.updated_at ?? snapshot.generatedAt,
    };
  }

  private async ensureDefaultProject(
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<ProjectRow> {
    const workspace = this.requireWorkspace(access);
    const name = workspace.name || 'LexFrame';

    const row = await this.databaseService.one<ProjectRow>(
      `
        insert into app.projects (
          workspace_id,
          id,
          name,
          description,
          icon,
          color,
          status,
          owner_user_id,
          created_by,
          updated_by
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'active',
          $7,
          $7,
          $7
        )
        on conflict (workspace_id, id) do update
        set updated_at = app.projects.updated_at
        returning ${PROJECT_COLUMNS}
      `,
      [
        workspace.id,
        DEFAULT_STAGE17_PROJECT_ID,
        name,
        'Default LexFrame project for existing Stage 17-21 routes.',
        projectIconFor(name),
        DEFAULT_PROJECT_COLOR,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'INVALID_REQUEST',
        500,
        'Default project could not be resolved.',
      );
    }

    return row;
  }

  private async listProjectRows(
    access: AccessContext,
  ): Promise<readonly ProjectRow[]> {
    const workspace = this.requireWorkspace(access);
    const result = await this.databaseService.query<ProjectRow>(
      `
        select ${PROJECT_COLUMNS}
        from app.projects
        where workspace_id = $1
          and status <> 'archived'
        order by
          case when id = $2 then 0 else 1 end,
          updated_at desc
      `,
      [workspace.id, DEFAULT_STAGE17_PROJECT_ID],
    );

    return result.rows;
  }

  private async requireProjectRow(
    actor: AuthenticatedActor,
    access: AccessContext,
    projectId: string,
  ): Promise<ProjectRow> {
    await this.ensureDefaultProject(actor, access);
    const row = await this.findProjectRow(access, projectId);

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }

    return row;
  }

  private async findProjectRow(
    access: AccessContext,
    projectId: string,
  ): Promise<ProjectRow | null> {
    const workspace = this.requireWorkspace(access);

    return this.databaseService.one<ProjectRow>(
      `
        select ${PROJECT_COLUMNS}
        from app.projects
        where workspace_id = $1
          and id = $2
          and status <> 'archived'
      `,
      [workspace.id, projectId],
    );
  }

  private async countDocuments(workspaceId: string): Promise<number> {
    try {
      const row = await this.databaseService.one<{ count: string }>(
        `
          select count(*)::text as count
          from app.documents
          where workspace_id = $1
            and deleted_at is null
        `,
        [workspaceId],
      );

      return Number.parseInt(row?.count ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  private requireContext(context: LexframeRequestState | undefined): {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
  } {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    this.requireWorkspace(context.access);

    return {
      actor: context.actor,
      access: context.access,
    };
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

  private async assertProjectId(
    actor: AuthenticatedActor,
    access: AccessContext,
    projectId: string,
  ) {
    const row = await this.requireProjectRow(actor, access, projectId);

    if (!row) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }
  }
}

function mapProjectRole(access: AccessContext): Stage15ProjectSummary['role'] {
  if (access.roles.includes('owner')) {
    return 'owner';
  }

  if (access.roles.includes('viewer')) {
    return 'viewer';
  }

  return 'editor';
}

function normalizeProjectColor(color: string | null | undefined) {
  const candidate = color?.trim();

  if (candidate && /^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate;
  }

  return DEFAULT_PROJECT_COLOR;
}

function projectIconFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'P';
}
