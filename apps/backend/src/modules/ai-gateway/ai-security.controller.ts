import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AiPolicyService } from './ai-policy.service';

@Controller('admin/security/ai')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AiSecurityController {
  constructor(private readonly aiPolicyService: AiPolicyService) {}

  @Get('policies')
  @RequiredPermissions('ai.policy.read')
  listProviderPolicies(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.aiPolicyService.listProviderPolicies(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }
}
