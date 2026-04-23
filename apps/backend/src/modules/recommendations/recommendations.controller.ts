import type {
  RecommendationAcceptRequest,
  RecommendationDismissRequest,
  RecommendationFeedbackRequest,
  RecommendationSnoozeRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
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
import {
  asRecord,
  expectString,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @RequiredPermissions('recommendation.read')
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.actor || !context.access) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.list(context.actor, context.access);
  }

  @Get(':recommendationId')
  @RequiredPermissions('recommendation.read')
  getDetail(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('recommendationId') recommendationId: string,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.getDetail(
      context.actor,
      context.access,
      recommendationId,
    );
  }

  @Post(':recommendationId/accept')
  @HttpCode(200)
  @RequiredPermissions('recommendation.accept')
  accept(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('recommendationId') recommendationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.accept(
      context.actor,
      context.access,
      context.aiPolicy,
      recommendationId,
      parseAcceptRequest(body),
      requestMeta(request),
    );
  }

  @Post(':recommendationId/dismiss')
  @HttpCode(200)
  @RequiredPermissions('recommendation.read')
  dismiss(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('recommendationId') recommendationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.dismiss(
      context.actor,
      context.access,
      recommendationId,
      parseDismissRequest(body),
      requestMeta(request),
    );
  }

  @Post(':recommendationId/snooze')
  @HttpCode(200)
  @RequiredPermissions('recommendation.read')
  snooze(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('recommendationId') recommendationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.snooze(
      context.actor,
      context.access,
      recommendationId,
      parseSnoozeRequest(body),
      requestMeta(request),
    );
  }

  @Post(':recommendationId/feedback')
  @HttpCode(200)
  @RequiredPermissions('recommendation.read')
  feedback(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('recommendationId') recommendationId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Recommendation request context was not attached.');
    }

    return this.recommendationsService.feedback(
      context.actor,
      context.access,
      recommendationId,
      parseFeedbackRequest(body),
      requestMeta(request),
    );
  }
}

@Controller('admin')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class RecommendationAdminController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('recommendations/patterns')
  @RequiredPermissions('recommendation.manage')
  listPatterns(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Recommendation admin context was not attached.');
    }

    return this.recommendationsService.listPatterns(context.access);
  }

  @Get('analytics/process-cases')
  @RequiredPermissions('recommendation.manage')
  listProcessCases(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
  ) {
    if (!context?.access) {
      throw new Error('Recommendation admin context was not attached.');
    }

    return this.recommendationsService.listProcessCases(context.access);
  }

  @Get('analytics/patterns/:patternId')
  @RequiredPermissions('recommendation.manage')
  getPatternDetail(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('patternId') patternId: string,
  ) {
    if (!context?.access) {
      throw new Error('Recommendation admin context was not attached.');
    }

    return this.recommendationsService.getPatternDetail(
      context.access,
      patternId,
    );
  }
}

function parseAcceptRequest(body: unknown): RecommendationAcceptRequest {
  const value = body === undefined ? {} : asRecord(body);

  return {
    ...(optionalString(value.templatePreference)
      ? {
          templatePreference: optionalString(
            value.templatePreference,
          ) as RecommendationAcceptRequest['templatePreference'],
        }
      : {}),
    ...(optionalString(value.draftTitle)
      ? { draftTitle: optionalString(value.draftTitle) ?? undefined }
      : {}),
    ...(optionalString(value.idempotencyKey)
      ? { idempotencyKey: optionalString(value.idempotencyKey) }
      : {}),
  };
}

function parseDismissRequest(body: unknown): RecommendationDismissRequest {
  const value = body === undefined ? {} : asRecord(body);

  return {
    ...(optionalString(value.reasonCode)
      ? { reasonCode: optionalString(value.reasonCode) }
      : {}),
    ...(optionalString(value.note) ? { note: optionalString(value.note) } : {}),
    ...(typeof value.suppressPattern === 'boolean'
      ? { suppressPattern: optionalBoolean(value.suppressPattern) }
      : {}),
  };
}

function parseSnoozeRequest(body: unknown): RecommendationSnoozeRequest {
  const value = body === undefined ? {} : asRecord(body);

  return {
    ...(optionalString(value.until)
      ? { until: optionalString(value.until) }
      : {}),
    ...(typeof value.days === 'number'
      ? { days: optionalNumber(value.days) }
      : {}),
  };
}

function parseFeedbackRequest(body: unknown): RecommendationFeedbackRequest {
  const value = asRecord(body);

  return {
    feedbackType: expectString(
      value.feedbackType,
      'feedbackType is required.',
    ) as RecommendationFeedbackRequest['feedbackType'],
    ...(optionalString(value.note) ? { note: optionalString(value.note) } : {}),
  };
}
