import type { CreateProfileImportJobRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { asRecord, expectString, optionalString, requestMeta } from '../stage7-support/stage7.helpers';
import { ProfileImportsService } from './profile-imports.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ProfileImportsController {
  constructor(private readonly profileImportsService: ProfileImportsService) {}

  @Post('profile-imports')
  @HttpCode(200)
  @RequiredPermissions('profile.update')
  create(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.profileImportsService.create(
      context.actor,
      context.access,
      parseCreateProfileImportJobRequest(body),
      requestMeta(request),
    );
  }
}

function parseCreateProfileImportJobRequest(
  body: unknown,
): CreateProfileImportJobRequest {
  const value = asRecord(body);

  return {
    sourceDocumentId: expectString(value.sourceDocumentId, 'Source document id is required.'),
    sourceDocumentVersionId: expectString(
      value.sourceDocumentVersionId,
      'Source document version id is required.',
    ),
    targetProfileId: optionalString(value.targetProfileId),
  };
}
