import type {
  Stage15CreateProjectChatRequest,
  Stage15CreateProjectRequest,
  Stage15ProjectCreatedResponse,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  Stage15ProjectDetail,
  Stage15ProjectListResponse,
  Stage15ProjectSnapshot,
  Stage15ProjectUpdatedResponse,
  Stage15UpdateProjectRequest,
  ProjectWebSearchRequest,
  ProjectWebSearchResponse,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ProjectWebSearchService } from './project-web-search.service';
import { Stage15ProjectsService } from './stage15-projects.service';

@Controller('projects')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class Stage15ProjectsController {
  constructor(
    private readonly stage15ProjectsService: Stage15ProjectsService,
    private readonly projectWebSearchService: ProjectWebSearchService,
  ) {}

  @Get()
  @RequiredPermissions('workspace.read')
  listProjects(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ): Promise<Stage15ProjectListResponse> {
    return this.stage15ProjectsService.listProjects(context);
  }

  @Post()
  @HttpCode(200)
  @RequiredPermissions('workspace.update')
  createProject(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: Stage15CreateProjectRequest,
  ): Promise<Stage15ProjectCreatedResponse> {
    return this.stage15ProjectsService.createProject(context, body);
  }

  @Get(':projectId')
  @RequiredPermissions('workspace.read')
  getProject(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
  ): Promise<Stage15ProjectDetail> {
    return this.stage15ProjectsService.getProject(context, projectId);
  }

  @Patch(':projectId')
  @RequiredPermissions('workspace.update')
  updateProject(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Body() body: Stage15UpdateProjectRequest,
  ): Promise<Stage15ProjectUpdatedResponse> {
    return this.stage15ProjectsService.updateProject(context, projectId, body);
  }

  @Get(':projectId/snapshot')
  @RequiredPermissions('dashboard.view')
  getProjectSnapshot(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
  ): Promise<Stage15ProjectSnapshot> {
    return this.stage15ProjectsService.getProjectSnapshot(context, projectId);
  }

  @Get(':projectId/chats')
  @RequiredPermissions('workspace.read')
  listProjectChats(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
  ): Promise<readonly Stage15ProjectChatSummary[]> {
    return this.stage15ProjectsService.listProjectChats(context, projectId);
  }

  @Post(':projectId/chats')
  @HttpCode(200)
  @RequiredPermissions('workspace.read')
  createProjectChat(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Body() body: Stage15CreateProjectChatRequest,
  ): Promise<Stage15ProjectChatCreatedResponse> {
    return this.stage15ProjectsService.createProjectChat(
      context,
      projectId,
      body,
    );
  }

  @Post(':projectId/web-search')
  @HttpCode(200)
  @RequiredPermissions('chat.manage_project_context')
  searchProjectWeb(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Body() body: ProjectWebSearchRequest,
  ): Promise<ProjectWebSearchResponse> {
    return this.projectWebSearchService.search(context, projectId, body);
  }

  @Get(':projectId/automations')
  @RequiredPermissions('automation.read')
  listProjectAutomations(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
  ) {
    return this.stage15ProjectsService.listProjectAutomations(
      context,
      projectId,
    );
  }

  @Post(':projectId/automations/stage17-canvas/ensure')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  ensureStage17CanvasAutomation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.stage15ProjectsService.ensureStage17CanvasAutomation(
      context,
      projectId,
      request.headers['x-trace-id'] ?? request.headers['x-request-id'] ?? null,
    );
  }
}
