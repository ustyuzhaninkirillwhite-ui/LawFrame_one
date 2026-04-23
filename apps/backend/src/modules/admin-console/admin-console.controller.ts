import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminConsoleService } from './admin-console.service';

@Controller('admin/security')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AdminConsoleController {
  constructor(private readonly adminConsoleService: AdminConsoleService) {}

  @Get('overview')
  @RequiredPermissions('workspace.security.read')
  getOverview(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.adminConsoleService.getOverview(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }
}
