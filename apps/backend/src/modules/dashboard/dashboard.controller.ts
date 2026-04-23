import type { LexframeRequest } from '../../common/types/lexframe-request';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { DashboardService } from './dashboard.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/snapshot')
  @RequiredPermissions('dashboard.view')
  getSnapshot(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.dashboardService.getSnapshot(context.actor, context.access);
  }

  @Get('dashboard/events')
  @RequiredPermissions('dashboard.view')
  listEvents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('since_sequence') sinceSequence?: string,
  ) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.dashboardService.listEvents(
      context.actor,
      context.access,
      sinceSequence ? Number(sinceSequence) : undefined,
    );
  }
}
