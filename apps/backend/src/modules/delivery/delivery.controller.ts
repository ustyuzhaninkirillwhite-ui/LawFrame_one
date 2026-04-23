import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { requestMeta } from '../stage7-support/stage7.helpers';
import { DeliveryService } from './delivery.service';

@Controller('delivery-requests')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get(':id')
  @RequiredPermissions('automation.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.getDetail(context.access, id);
  }

  @Post(':id/preview')
  @HttpCode(200)
  @RequiredPermissions('automation.read')
  preview(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.preview(context.access, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequiredPermissions('approval.task.decide')
  approve(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.approve(
      context.actor,
      context.access,
      id,
      requestMeta(request),
    );
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  send(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.send(
      context.actor,
      context.access,
      id,
      requestMeta(request),
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  cancel(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.cancel(
      context.actor,
      context.access,
      id,
      requestMeta(request),
    );
  }

  @Post(':id/retry')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  retry(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.retry(
      context.actor,
      context.access,
      id,
      requestMeta(request),
    );
  }
}
