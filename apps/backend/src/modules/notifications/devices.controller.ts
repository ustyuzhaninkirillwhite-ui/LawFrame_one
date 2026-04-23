import type { DeviceRegistrationRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { NotificationsService } from './notifications.service';

@Controller('devices')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DevicesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register')
  @HttpCode(200)
  @RequiredPermissions('dashboard.view')
  register(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access || !context.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.notificationsService.registerDevice(
      context.actor.id,
      context.access.activeWorkspace!.id,
      parseDeviceRegistrationRequest(body),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @RequiredPermissions('dashboard.view')
  remove(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.actor) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.notificationsService.removeDevice(context.actor.id, id);
  }
}

function parseDeviceRegistrationRequest(
  body: unknown,
): DeviceRegistrationRequest {
  if (!body || typeof body !== 'object') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Device registration payload is required.',
    );
  }

  const value = body as Record<string, unknown>;

  if (
    value.deviceType !== 'web_push' &&
    value.deviceType !== 'ios' &&
    value.deviceType !== 'android'
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Device type is required.',
    );
  }

  if (
    typeof value.deviceToken !== 'string' ||
    value.deviceToken.trim().length === 0
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Device token is required.',
    );
  }

  return {
    deviceType: value.deviceType,
    deviceToken: value.deviceToken.trim(),
    ...(value.metadata && typeof value.metadata === 'object'
      ? {
          metadata: value.metadata as Record<string, unknown>,
        }
      : {}),
  };
}
