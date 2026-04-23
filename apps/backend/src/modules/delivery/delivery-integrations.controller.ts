import type { DeliverySandboxTestRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  optionalRecord,
  optionalString,
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { DeliveryService } from './delivery.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DeliveryIntegrationsController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('integrations/delivery/status')
  @RequiredPermissions('automation.read')
  getStatus(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.getIntegrationStatus();
  }

  @Post('delivery/sandbox/test')
  @HttpCode(200)
  @RequiredPermissions('automation.run')
  runSandboxTest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.deliveryService.runSandboxTest(
      context.actor,
      context.access,
      parseDeliverySandboxTestRequest(body),
      requestMeta(request),
    );
  }
}

function parseDeliverySandboxTestRequest(
  body: unknown,
): DeliverySandboxTestRequest {
  if (body === undefined || body === null || body === '') {
    return {};
  }

  const value = asRecord(body);

  return {
    ...(value.subject !== undefined
      ? { subject: optionalString(value.subject) ?? undefined }
      : {}),
    ...(value.body !== undefined
      ? { body: optionalString(value.body) ?? undefined }
      : {}),
    ...(value.recipientEmails !== undefined
      ? {
          recipientEmails: optionalStringArray(value.recipientEmails) ?? [],
        }
      : {}),
    ...(value.metadata !== undefined
      ? { metadata: optionalRecord(value.metadata) ?? {} }
      : {}),
  };
}
