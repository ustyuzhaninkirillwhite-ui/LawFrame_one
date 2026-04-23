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
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SecretsService } from './secrets.service';

@Controller('admin/security/secrets')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get()
  @RequiredPermissions('secret.read_metadata')
  listInventory() {
    return this.secretsService.listInventory();
  }

  @Post(':secretCode/mark-compromised')
  @HttpCode(200)
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('secret.rotate')
  markCompromised(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('secretCode') secretCode: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.secretsService.markCompromised(
      context.actor,
      context.access,
      secretCode,
      parseNotes(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Post(':secretCode/rotation/start')
  @HttpCode(200)
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('secret.rotate')
  startRotation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('secretCode') secretCode: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.secretsService.startRotation(
      context.actor,
      context.access,
      secretCode,
      parseNotes(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }

  @Post(':secretCode/rotation/complete')
  @HttpCode(200)
  @UseGuards(AdminReauthGuard)
  @RequiredPermissions('secret.rotate')
  completeRotation(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('secretCode') secretCode: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.secretsService.completeRotation(
      context.actor,
      context.access,
      secretCode,
      parseNotes(body),
      request.headers['x-request-id'] ?? null,
      request.headers['x-trace-id'] ?? null,
    );
  }
}

function parseNotes(body: unknown): string | null {
  if (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { notes?: unknown }).notes === 'string'
  ) {
    return ((body as { notes?: string }).notes ?? '').trim() || null;
  }

  return null;
}
