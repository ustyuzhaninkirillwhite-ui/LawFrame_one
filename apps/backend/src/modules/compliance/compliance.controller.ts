import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';

@Controller('admin/compliance')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('processing-activities')
  @RequiredPermissions('compliance.read')
  listProcessingActivities(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.complianceService.listProcessingActivities(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Get('retention-policies')
  @RequiredPermissions('compliance.read')
  listRetentionPolicies(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.complianceService.listRetentionPolicies(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Get('retention/report')
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('compliance.read')
  getRetentionReport(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.complianceService.getRetentionReport(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Get('dsr')
  @RequiredPermissions('compliance.read')
  listDsrRequests(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.complianceService.listDsrRequests(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Get('ropa/export')
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('compliance.read')
  exportRopa(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.complianceService.listProcessingActivities(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }

  @Get('access-reviews')
  @RequiredPermissions('access_review.manage')
  listAccessReviews(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    return this.complianceService.listAccessReviewCampaigns(
      context?.access?.activeWorkspace?.id ?? null,
    );
  }
}
