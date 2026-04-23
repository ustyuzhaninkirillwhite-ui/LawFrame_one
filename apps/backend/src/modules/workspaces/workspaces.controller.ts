import type {
  CreateWorkspaceInvitationRequest,
  CreateWorkspaceRequest,
  RoleCode,
  UpdateWorkspaceMemberRoleRequest,
  UpdateWorkspaceRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { loadServerEnv } from '@lexframe/config';
import { WorkspacesService } from './workspaces.service';

@Controller()
export class WorkspacesController {
  private readonly env = loadServerEnv();

  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.list(context.actor);
  }

  @Post('workspaces')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  create(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.create(
      context.actor,
      parseCreateWorkspaceRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Get('workspaces/:workspaceId')
  @UseGuards(AuthGuard, WorkspaceContextGuard)
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.get(context.actor, workspaceId);
  }

  @Patch('workspaces/:workspaceId')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.update')
  update(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workspacesService.update(
      context.actor,
      context.access,
      workspaceId,
      parseUpdateWorkspaceRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Post('workspaces/:workspaceId/switch')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.switch')
  switchWorkspace(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.switchWorkspace(context.actor, workspaceId, {
      requestId: request.headers['x-request-id'] ?? 'req_missing',
      traceId: request.headers['x-trace-id'] ?? null,
    });
  }

  @Get('workspaces/:workspaceId/members')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.member.read')
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @Patch('workspaces/:workspaceId/members/:memberId/role')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard, AdminReauthGuard)
  @RequiredPermissions('workspace.member.update_role')
  changeRole(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workspacesService.changeMemberRole(
      context.actor,
      context.access,
      workspaceId,
      memberId,
      parseUpdateWorkspaceMemberRoleRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard, AdminReauthGuard)
  @RequiredPermissions('workspace.member.remove')
  removeMember(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workspacesService.removeMember(
      context.actor,
      context.access,
      workspaceId,
      memberId,
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Post('workspaces/:workspaceId/invitations')
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.invite')
  createInvitation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.workspacesService.createInvitation(
      context.actor,
      context.access,
      workspaceId,
      parseCreateWorkspaceInvitationRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
      this.env.LEXFRAME_APP_BASE_URL,
    );
  }

  @Get('workspaces/:workspaceId/invitations')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.invite')
  listInvitations(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listInvitations(workspaceId);
  }

  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  @UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
  @RequiredPermissions('workspace.invite')
  revokeInvitation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.revokeInvitation(
      context.actor,
      workspaceId,
      invitationId,
      {
        requestId: request.headers['x-request-id'] ?? null,
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }

  @Post('workspace-invitations/accept')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  acceptInvitation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor) {
      throw new Error('AuthGuard did not attach actor context.');
    }

    return this.workspacesService.acceptInvitation(
      context.actor,
      parseAcceptInvitationRequest(body),
      {
        requestId: request.headers['x-request-id'] ?? 'req_missing',
        traceId: request.headers['x-trace-id'] ?? null,
      },
    );
  }
}

function parseCreateWorkspaceRequest(body: unknown): CreateWorkspaceRequest {
  const value = asRecord(body);
  const name = expectString(value.name, 'Workspace name is required.');
  const slug =
    typeof value.slug === 'string' && value.slug.trim().length > 0
      ? value.slug
      : undefined;

  return {
    name,
    ...(slug ? { slug } : {}),
  };
}

function parseUpdateWorkspaceRequest(body: unknown): UpdateWorkspaceRequest {
  const value = asRecord(body);
  let nextName: string | undefined;
  let nextStatus: UpdateWorkspaceRequest['status'];

  if (typeof value.name === 'string' && value.name.trim().length > 0) {
    nextName = value.name;
  }

  if (
    value.status === 'active' ||
    value.status === 'archived' ||
    value.status === 'suspended'
  ) {
    nextStatus = value.status;
  }

  if (!nextName && !nextStatus) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Workspace update payload is empty.',
    );
  }

  return {
    ...(nextName ? { name: nextName } : {}),
    ...(nextStatus ? { status: nextStatus } : {}),
  };
}

function parseCreateWorkspaceInvitationRequest(
  body: unknown,
): CreateWorkspaceInvitationRequest {
  const value = asRecord(body);
  const email = expectString(value.email, 'Invitation email is required.');
  const role = expectRole(value.role);
  const expiresInDays =
    typeof value.expiresInDays === 'number' ? value.expiresInDays : undefined;

  return {
    email,
    role,
    ...(expiresInDays ? { expiresInDays } : {}),
  };
}

function parseUpdateWorkspaceMemberRoleRequest(
  body: unknown,
): UpdateWorkspaceMemberRoleRequest {
  const value = asRecord(body);

  return {
    role: expectRole(value.role),
  };
}

function parseAcceptInvitationRequest(body: unknown): string {
  const value = asRecord(body);
  return expectString(value.token, 'Invitation token is required.');
}

function expectRole(value: unknown): RoleCode {
  if (
    value === 'owner' ||
    value === 'admin' ||
    value === 'lawyer' ||
    value === 'assistant' ||
    value === 'viewer' ||
    value === 'security_admin' ||
    value === 'billing_admin'
  ) {
    return value;
  }

  throw new AppHttpException('VALIDATION_ERROR', 400, 'Role code is invalid.');
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be a JSON object.',
    );
  }

  return value as Record<string, unknown>;
}
