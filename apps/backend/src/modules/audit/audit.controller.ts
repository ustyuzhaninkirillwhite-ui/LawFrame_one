import type { AuditExportRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit/events')
  @RequiredPermissions('audit.read')
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.auditService.list(workspaceId);
  }

  @Get('admin/security/audit-events')
  @RequiredPermissions('audit.read')
  listAdmin(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.auditService.list(workspaceId);
  }

  @Post('admin/security/audit/export')
  @HttpCode(200)
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('audit.export')
  exportEvents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.auditService.exportEvents(
      workspaceId,
      parseAuditExportRequest(body),
    );
  }
}

function parseAuditExportRequest(body: unknown): AuditExportRequest {
  const value =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  return {
    from: typeof value.from === 'string' ? value.from : null,
    to: typeof value.to === 'string' ? value.to : null,
    category: typeof value.category === 'string' ? value.category : null,
    format: value.format === 'jsonl' ? 'jsonl' : 'json',
  };
}
