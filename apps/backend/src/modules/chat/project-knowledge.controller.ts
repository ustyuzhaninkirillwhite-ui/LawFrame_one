import type { UpsertProjectKnowledgeItemRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ProjectKnowledgeService } from './project-knowledge.service';

@Controller('projects')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ProjectKnowledgeController {
  constructor(
    private readonly projectKnowledgeService: ProjectKnowledgeService,
  ) {}

  @Get(':projectId/knowledge')
  @RequiredPermissions('chat.view')
  list(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
  ) {
    return this.projectKnowledgeService.list(context, projectId);
  }

  @Post(':projectId/knowledge')
  @RequiredPermissions('chat.manage_project_context')
  create(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Body() body: UpsertProjectKnowledgeItemRequest,
  ) {
    return this.projectKnowledgeService.create(context, projectId, body);
  }

  @Patch(':projectId/knowledge/:itemId')
  @RequiredPermissions('chat.manage_project_context')
  update(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() body: Partial<UpsertProjectKnowledgeItemRequest>,
  ) {
    return this.projectKnowledgeService.update(
      context,
      projectId,
      itemId,
      body,
    );
  }

  @Delete(':projectId/knowledge/:itemId')
  @RequiredPermissions('chat.manage_project_context')
  delete(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.projectKnowledgeService.delete(context, projectId, itemId);
  }
}
