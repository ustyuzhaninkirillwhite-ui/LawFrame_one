import type {
  CreateReauthChallengeRequest,
  VerifyReauthChallengeRequest,
  WorkspaceSecuritySettingsUpdateRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
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
import { IdentityService } from './identity.service';

@Controller()
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('auth/bootstrap')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  bootstrap(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.identityService.bootstrap(
      context.actor,
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Get('session/context')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getSessionContext(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    const requestedWorkspaceId =
      request.headers['x-workspace-id'] ?? request.params.workspaceId;

    return this.identityService.getSessionContext(
      context.actor,
      request.headers['x-request-id'] ?? 'req_missing',
      requestedWorkspaceId,
    );
  }

  @Get('account/security')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  getSecurityAccount(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.identityService.getSecurityAccount(
      context.actor,
      request.headers['x-workspace-id'] ?? request.params.workspaceId,
    );
  }

  @Get('admin/security/sessions')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('session.read')
  listSecuritySessions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.identityService.listSecuritySessions(
      context.actor,
      context.access ?? null,
    );
  }

  @Post('admin/security/sessions/:sessionId/revoke')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard, AdminReauthGuard)
  @RequiredPermissions('session.revoke')
  revokeSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.identityService.revokeSession(
      context.actor,
      context.access,
      sessionId,
      typeof (body as { reason?: unknown })?.reason === 'string'
        ? (body as { reason?: string }).reason ?? null
        : null,
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Post('admin/security/users/:userId/revoke-all-sessions')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard, AdminReauthGuard)
  @RequiredPermissions('session.revoke')
  revokeAllSessions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.identityService.revokeAllSessionsForUser(
      context.actor,
      context.access,
      userId,
      typeof (body as { reason?: unknown })?.reason === 'string'
        ? (body as { reason?: string }).reason ?? null
        : null,
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Get('admin/security/workspace-policies')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.security.read')
  getWorkspaceSecuritySettings(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.identityService.getWorkspaceSecuritySettings(workspaceId);
  }

  @Patch('admin/security/workspace-policies')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard, AdminReauthGuard)
  @RequiredPermissions('workspace.security.manage')
  updateWorkspaceSecuritySettings(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.identityService.updateWorkspaceSecuritySettings(
      context.actor,
      workspaceId,
      parseWorkspaceSecuritySettingsUpdate(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Post('security/reauth/challenge')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  createReauthChallenge(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.identityService.createReauthChallenge(
      context.actor,
      context.access ?? null,
      parseCreateReauthChallenge(body),
    );
  }

  @Post('security/reauth/verify')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  verifyReauthChallenge(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    const parsed = parseVerifyReauthChallenge(body);
    return this.identityService.verifyReauthChallenge(
      context.actor,
      parsed.challengeId,
      parsed.verificationCode,
    );
  }
}

function parseWorkspaceSecuritySettingsUpdate(
  body: unknown,
): WorkspaceSecuritySettingsUpdateRequest {
  const value = asRecord(body);

  return {
    ...(typeof value.requireMfaForAdmins === 'boolean'
      ? { requireMfaForAdmins: value.requireMfaForAdmins }
      : {}),
    ...(typeof value.requireMfaForAll === 'boolean'
      ? { requireMfaForAll: value.requireMfaForAll }
      : {}),
    ...(Array.isArray(value.allowedEmailDomains)
      ? {
          allowedEmailDomains: value.allowedEmailDomains.filter(
            (item): item is string => typeof item === 'string',
          ),
        }
      : {}),
    ...(typeof value.ssoRequired === 'boolean'
      ? { ssoRequired: value.ssoRequired }
      : {}),
    ...(typeof value.sessionMaxAgeMinutes === 'number'
      ? { sessionMaxAgeMinutes: value.sessionMaxAgeMinutes }
      : {}),
    ...(typeof value.idleTimeoutMinutes === 'number'
      ? { idleTimeoutMinutes: value.idleTimeoutMinutes }
      : {}),
    ...(typeof value.allowPersonalApiTokens === 'boolean'
      ? { allowPersonalApiTokens: value.allowPersonalApiTokens }
      : {}),
    ...(typeof value.aiSensitiveDataAllowed === 'boolean'
      ? { aiSensitiveDataAllowed: value.aiSensitiveDataAllowed }
      : {}),
    ...(typeof value.externalDeliveryRequiresApproval === 'boolean'
      ? {
          externalDeliveryRequiresApproval:
            value.externalDeliveryRequiresApproval,
        }
      : {}),
  };
}

function parseCreateReauthChallenge(
  body: unknown,
): CreateReauthChallengeRequest {
  const value = asRecord(body);
  return {
    reason:
      typeof value.reason === 'string' && value.reason.trim().length > 0
        ? value.reason.trim()
        : 'Administrative action requires reauthentication.',
    ...(value.challengeType === 'password' ||
    value.challengeType === 'mfa' ||
    value.challengeType === 'sso'
      ? { challengeType: value.challengeType }
      : {}),
  };
}

function parseVerifyReauthChallenge(
  body: unknown,
): VerifyReauthChallengeRequest {
  const value = asRecord(body);
  if (
    typeof value.challengeId !== 'string' ||
    value.challengeId.trim().length === 0 ||
    typeof value.verificationCode !== 'string' ||
    value.verificationCode.trim().length === 0
  ) {
    throw new Error('Challenge id and verification code are required.');
  }

  return {
    challengeId: value.challengeId.trim(),
    verificationCode: value.verificationCode.trim(),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Request body must be an object.');
  }

  return value as Record<string, unknown>;
}
