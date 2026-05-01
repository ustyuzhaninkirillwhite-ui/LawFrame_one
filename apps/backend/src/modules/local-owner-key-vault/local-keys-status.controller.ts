import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { loadServerEnv } from '@lexframe/config';
import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { LocalOwnerKeyVaultService } from './local-owner-key-vault.service';

@Controller('admin/local-keys')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class LocalKeysStatusController {
  private readonly env = loadServerEnv();

  constructor(
    private readonly vaultService: LocalOwnerKeyVaultService,
    private readonly auditService: AuditService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @RequiredPermissions('secret.read_metadata')
  async getStatus(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace context is required for local keys diagnostics.',
      );
    }

    const roles = new Set(context.access.roles);
    const localDev =
      this.env.NODE_ENV !== 'production' ||
      this.env.LEXFRAME_ENV_PROFILE === 'local';
    if (!localDev && !roles.has('owner') && !roles.has('security_admin')) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Local owner key diagnostics are restricted to the owner or security admin.',
      );
    }

    await this.auditService.record({
      actorUserId: context.actor.id,
      actorEmail: context.actor.email,
      workspaceId: context.access.activeWorkspace?.id ?? null,
      action: 'local_keys.status.viewed',
      result: 'success',
      requestId: request.headers['x-request-id'] ?? null,
      traceId: request.headers['x-trace-id'] ?? null,
      eventCategory: 'security',
      metadata: {
        status: this.vaultService.getSafeStatus().status,
      },
    });

    return this.vaultService.getSafeStatus();
  }
}
