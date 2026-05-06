import type {
  InstalledAutomationDetail,
  Stage15CreateProjectChatRequest,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage15ProjectSummary,
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
    const project = await this.buildProjectSummary(actor, access);

    return { items: [project] };
  }

  async getProject(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<Stage15ProjectDetail> {
    const { actor, access } = this.requireContext(context);
    this.assertProjectId(access, projectId);

    const [project, automations, snapshot, chats] = await Promise.all([
      this.buildProjectSummary(actor, access),
      this.automationLibraryService.listInstalled(access),
      this.dashboardService.getSnapshot(actor, access),
      this.listProjectChats(context, projectId),
    ]);

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
    this.assertProjectId(access, projectId);

    const [project, automations, snapshot, chats] = await Promise.all([
      this.buildProjectSummary(actor, access),
      this.automationLibraryService.listInstalled(access),
      this.dashboardService.getSnapshot(actor, access),
      this.listProjectChats(context, projectId),
    ]);

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
    const { access } = this.requireContext(context);
    this.assertProjectId(access, projectId);
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
    const { access } = this.requireContext(context);
    this.assertProjectId(access, projectId);

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
    const { access } = this.requireContext(context);
    this.assertProjectId(access, projectId);

    return this.automationLibraryService.listInstalled(access);
  }

  async ensureStage17CanvasAutomation(
    context: LexframeRequestState | undefined,
    projectId: string,
    traceId: string | null,
  ) {
    const { actor, access } = this.requireContext(context);
    this.assertProjectId(access, projectId);

    return this.activepiecesCanvasProvisioningService.ensureStage17Canvas({
      actor,
      access,
      projectId,
      traceId,
    });
  }

  private async buildProjectSummary(
    actor: AuthenticatedActor,
    access: AccessContext,
  ): Promise<Stage15ProjectSummary> {
    const workspace = this.requireWorkspace(access);
    const [automations, snapshot, documentsCount, chats] = await Promise.all([
      this.automationLibraryService.listInstalled(access),
      this.dashboardService.getSnapshot(actor, access),
      this.countDocuments(workspace.id),
      this.chatThreadService
        .listProjectThreads(
          { actor, access },
          this.projectIdFor(access),
        )
        .catch(() => ({ items: [] })),
    ]);

    return {
      id: this.projectIdFor(access),
      workspaceId: workspace.id,
      name: workspace.name,
      description: `Workspace project ${workspace.name}: chats, documents and automations.`,
      icon: workspace.name.trim().charAt(0).toUpperCase() || 'P',
      color: '#3B82F6',
      status: 'active',
      ownerUserId: actor.id,
      role: mapProjectRole(access),
      counters: {
        chats: chats.items.length,
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
      lastActivityAt: snapshot.generatedAt,
    };
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

  private assertProjectId(access: AccessContext, projectId: string) {
    const allowedIds = new Set([
      DEFAULT_STAGE17_PROJECT_ID,
      this.projectIdFor(access),
    ]);

    if (!allowedIds.has(projectId)) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }
  }

  private projectIdFor(access: AccessContext) {
    this.requireWorkspace(access);
    return DEFAULT_STAGE17_PROJECT_ID;
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
