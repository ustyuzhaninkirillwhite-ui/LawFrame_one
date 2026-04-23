import type {
  CreateLegalWorkProfileRequest,
  PreviewEffectiveProfileRequest,
  RestoreLegalWorkProfileVersionRequest,
  UpdateLegalWorkProfileDraftRequest,
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
import {
  asRecord,
  expectString,
  optionalRecord,
  optionalString,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { ProfilesService } from './profiles.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('profiles/current')
  @RequiredPermissions('profile.read')
  getCurrent(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.profilesService.getCurrent(
      context?.access ?? null,
      context?.actor?.id ?? null,
    );
  }

  @Get('profiles/effective')
  @RequiredPermissions('profile.read')
  getEffective(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    return this.profilesService.getEffective(
      context?.access ?? null,
      context?.actor?.id ?? null,
    );
  }

  @Post('profiles')
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

    return this.profilesService.create(
      context.actor,
      context.access,
      parseCreateLegalWorkProfileRequest(body),
      requestMeta(request),
    );
  }

  @Patch('profiles/:profileId/draft')
  @RequiredPermissions('profile.update')
  updateDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('profileId') profileId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.profilesService.updateDraft(
      context.actor,
      context.access,
      profileId,
      parseUpdateLegalWorkProfileDraftRequest(body),
      requestMeta(request),
    );
  }

  @Post('profiles/:profileId/validate')
  @HttpCode(200)
  @RequiredPermissions('profile.read')
  validate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('profileId') profileId: string,
  ) {
    return this.profilesService.validate(context?.access ?? null, profileId);
  }

  @Post('profiles/:profileId/publish')
  @HttpCode(200)
  @RequiredPermissions('profile.publish')
  publish(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('profileId') profileId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.profilesService.publish(
      context.actor,
      context.access,
      profileId,
      requestMeta(request),
    );
  }

  @Get('profiles/:profileId/versions')
  @RequiredPermissions('profile.read')
  listVersions(@Param('profileId') profileId: string) {
    return this.profilesService.listVersions(profileId);
  }

  @Post('profiles/:profileId/restore-version')
  @HttpCode(200)
  @RequiredPermissions('profile.update')
  restoreVersion(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('profileId') profileId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.profilesService.restoreVersion(
      context.actor,
      context.access,
      profileId,
      parseRestoreLegalWorkProfileVersionRequest(body),
      requestMeta(request),
    );
  }

  @Post('profiles/:profileId/preview-effective')
  @HttpCode(200)
  @RequiredPermissions('profile.read')
  previewEffective(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('profileId') profileId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.profilesService.previewEffective(
      context.actor,
      context.access,
      profileId,
      parsePreviewEffectiveProfileRequest(body),
      requestMeta(request),
    );
  }
}

function parseCreateLegalWorkProfileRequest(
  body: unknown,
): CreateLegalWorkProfileRequest {
  const value = asRecord(body);
  const profileType = expectProfileType(value.profileType);

  return {
    profileType,
    name: expectString(value.name, 'Profile name is required.'),
    description: optionalString(value.description),
    workspaceId: optionalString(value.workspaceId),
    ownerUserId: optionalString(value.ownerUserId),
    content: optionalRecord(value.content) ?? {},
    changeNote: optionalString(value.changeNote),
  };
}

function parseUpdateLegalWorkProfileDraftRequest(
  body: unknown,
): UpdateLegalWorkProfileDraftRequest {
  const value = asRecord(body);

  return {
    ...(value.name !== undefined
      ? { name: expectString(value.name, 'Profile name must be a non-empty string.') }
      : {}),
    ...(value.description !== undefined ? { description: optionalString(value.description) } : {}),
    ...(value.content !== undefined ? { content: optionalRecord(value.content) ?? {} } : {}),
    ...(value.changeNote !== undefined ? { changeNote: optionalString(value.changeNote) } : {}),
  };
}

function parseRestoreLegalWorkProfileVersionRequest(
  body: unknown,
): RestoreLegalWorkProfileVersionRequest {
  const value = asRecord(body);

  return {
    versionId: expectString(value.versionId, 'Profile version id is required.'),
    changeNote: optionalString(value.changeNote),
  };
}

function parsePreviewEffectiveProfileRequest(
  body: unknown,
): PreviewEffectiveProfileRequest {
  const value = asRecord(body);

  return {
    profileId: optionalString(value.profileId),
    workspaceId: optionalString(value.workspaceId),
    userId: optionalString(value.userId),
    automationOverrides: optionalRecord(value.automationOverrides) ?? {},
  };
}

function expectProfileType(
  value: unknown,
): CreateLegalWorkProfileRequest['profileType'] {
  if (value === 'system' || value === 'workspace' || value === 'personal') {
    return value;
  }

  throw new Error('Profile type must be system, workspace or personal.');
}
