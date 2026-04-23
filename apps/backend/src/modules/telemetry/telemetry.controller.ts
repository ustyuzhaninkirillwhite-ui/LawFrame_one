import type { ProductEventCaptureRequest } from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  asRecord,
  expectString,
  optionalRecord,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { TelemetryService } from './telemetry.service';

@Controller('events')
@UseGuards(AuthGuard, WorkspaceContextGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('capture')
  @HttpCode(200)
  capture(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Telemetry request context was not attached.');
    }

    return this.telemetryService.captureFromFrontend(
      context.actor,
      context.access,
      parseProductEventCaptureRequest(body),
      requestMeta(request),
    );
  }
}

function parseProductEventCaptureRequest(
  body: unknown,
): ProductEventCaptureRequest {
  const value = asRecord(body);

  return {
    eventName: expectString(value.eventName, 'eventName is required.'),
    eventTime: expectString(value.eventTime, 'eventTime is required.'),
    sessionId: expectString(value.sessionId, 'sessionId is required.'),
    traceId: expectString(value.traceId, 'traceId is required.'),
    workspaceId: expectString(value.workspaceId, 'workspaceId is required.'),
    properties: optionalRecord(value.properties) ?? {},
    ...(typeof value.resourceType === 'string'
      ? { resourceType: value.resourceType.trim() || null }
      : {}),
    ...(typeof value.resourceId === 'string'
      ? { resourceId: value.resourceId.trim() || null }
      : {}),
    ...(typeof value.processInstanceId === 'string'
      ? { processInstanceId: value.processInstanceId.trim() || null }
      : {}),
    ...(typeof value.runId === 'string'
      ? { runId: value.runId.trim() || null }
      : {}),
    ...(typeof value.clientEventId === 'string'
      ? { clientEventId: value.clientEventId.trim() || null }
      : {}),
    ...(typeof value.idempotencyKey === 'string'
      ? { idempotencyKey: value.idempotencyKey.trim() || null }
      : {}),
    ...(typeof value.source === 'string'
      ? { source: value.source as ProductEventCaptureRequest['source'] }
      : {}),
  };
}
