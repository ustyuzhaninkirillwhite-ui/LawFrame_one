import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequiredPermissions('dashboard.view')
  list(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query() query: Record<string, string | undefined>,
  ) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.notificationsService.list(context.access, context.actor.id, {
      cursor: query.cursor ?? null,
      limit: query.limit ? Number(query.limit) : undefined,
      status:
        query.status === 'read' || query.status === 'unread'
          ? query.status
          : 'all',
      type: query.type ?? null,
    });
  }

  @Post(':id/read')
  @HttpCode(200)
  @RequiredPermissions('dashboard.view')
  markRead(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.notificationsService.markRead(
      context.access,
      context.actor.id,
      id,
    );
  }

  @Post('read-all')
  @HttpCode(200)
  @RequiredPermissions('dashboard.view')
  markAllRead(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.notificationsService.markAllRead(
      context.access,
      context.actor.id,
    );
  }
}
