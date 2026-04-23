import type {
  ApprovalRouteStep,
  ApprovalTaskRequestChangesRequest,
  ApprovalTaskDecisionRequest,
  CreateApprovalRouteRequest,
  UpdateApprovalRouteRequest,
  WorkflowRuntimeApprovalRequestExecuteRequest,
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
  optionalNumber,
  optionalString,
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { ApprovalsService } from './approvals.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('approval-routes')
  @RequiredPermissions('approval.task.read')
  listRoutes(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.listRoutes(context.access);
  }

  @Get('approval-routes/:id')
  @RequiredPermissions('approval.task.read')
  getRoute(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.getRoute(context.access, id);
  }

  @Post('approval-routes')
  @HttpCode(200)
  @RequiredPermissions('approval.route.manage')
  createRoute(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.createRoute(
      context.actor,
      context.access,
      parseCreateApprovalRouteRequest(body),
      requestMeta(request),
    );
  }

  @Patch('approval-routes/:id')
  @RequiredPermissions('approval.route.manage')
  updateRoute(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.updateRoute(
      context.actor,
      context.access,
      id,
      parseUpdateApprovalRouteRequest(body),
      requestMeta(request),
    );
  }

  @Get('approval-tasks')
  @RequiredPermissions('approval.task.read')
  listTasks(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.listTasks(context.access);
  }

  @Get('approval-tasks/:id')
  @RequiredPermissions('approval.task.read')
  getTask(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.getTask(context.access, id);
  }

  @Post('approval-tasks/:id/approve')
  @HttpCode(200)
  @RequiredPermissions('approval.task.decide')
  approveTask(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.approveTask(
      context.actor,
      context.access,
      id,
      parseApprovalTaskDecisionRequest(body),
      requestMeta(request),
    );
  }

  @Post('approval-tasks/:id/reject')
  @HttpCode(200)
  @RequiredPermissions('approval.task.decide')
  rejectTask(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.rejectTask(
      context.actor,
      context.access,
      id,
      parseApprovalTaskDecisionRequest(body),
      requestMeta(request),
    );
  }

  @Post('approval-tasks/:id/request-changes')
  @HttpCode(200)
  @RequiredPermissions('approval.task.decide')
  requestChanges(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.requestChanges(
      context.actor,
      context.access,
      id,
      parseApprovalTaskRequestChangesRequest(body),
      requestMeta(request),
    );
  }

  @Post('workflow-runtime/approval-request/execute')
  @HttpCode(200)
  @RequiredPermissions('approval.task.read')
  executeForRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.approvalsService.executeRuntimeRequest(
      context.actor,
      context.access,
      parseWorkflowRuntimeApprovalRequestExecuteRequest(body),
      requestMeta(request),
    );
  }
}

function parseCreateApprovalRouteRequest(
  body: unknown,
): CreateApprovalRouteRequest {
  const value = asRecord(body);

  return {
    name: expectString(value.name, 'Approval route name is required.'),
    description: optionalString(value.description),
    appliesToDocumentTypes:
      optionalStringArray(value.appliesToDocumentTypes) ?? [],
    steps: parseApprovalRouteSteps(value.steps),
  };
}

function parseUpdateApprovalRouteRequest(
  body: unknown,
): UpdateApprovalRouteRequest {
  const value = asRecord(body);

  return {
    ...(value.name !== undefined
      ? {
          name: expectString(
            value.name,
            'Approval route name must be a string.',
          ),
        }
      : {}),
    ...(value.description !== undefined
      ? { description: optionalString(value.description) }
      : {}),
    ...(value.status !== undefined
      ? { status: expectRouteStatus(value.status) }
      : {}),
    ...(value.appliesToDocumentTypes !== undefined
      ? {
          appliesToDocumentTypes:
            optionalStringArray(value.appliesToDocumentTypes) ?? [],
        }
      : {}),
    ...(value.steps !== undefined
      ? { steps: parseApprovalRouteSteps(value.steps) }
      : {}),
  };
}

function parseApprovalTaskDecisionRequest(
  body: unknown,
): ApprovalTaskDecisionRequest {
  if (body === undefined || body === null || body === '') {
    return {};
  }

  const value = asRecord(body);

  return {
    comment: optionalString(value.comment),
  };
}

function parseApprovalTaskRequestChangesRequest(
  body: unknown,
): ApprovalTaskRequestChangesRequest {
  if (body === undefined || body === null || body === '') {
    return {};
  }

  const value = asRecord(body);

  return {
    comment: optionalString(value.comment),
  };
}

function parseApprovalRouteSteps(value: unknown): readonly ApprovalRouteStep[] {
  if (!Array.isArray(value)) {
    throw new Error('Approval route steps must be an array.');
  }

  return value.map((entry, index) => {
    const step = asRecord(entry);

    return {
      stepId: expectString(
        step.stepId,
        `Approval step ${index + 1} requires stepId.`,
      ),
      order: optionalNumber(step.order) ?? index + 1,
      approverRole: optionalString(step.approverRole),
      approverUserId: optionalString(step.approverUserId),
      title: expectString(
        step.title,
        `Approval step ${index + 1} requires title.`,
      ),
      requiresComment: Boolean(step.requiresComment),
      dueInHours: optionalNumber(step.dueInHours) ?? null,
    };
  });
}

function expectRouteStatus(
  value: unknown,
): NonNullable<UpdateApprovalRouteRequest['status']> {
  if (value === 'draft' || value === 'active' || value === 'archived') {
    return value;
  }

  throw new Error('Approval route status is invalid.');
}

function parseWorkflowRuntimeApprovalRequestExecuteRequest(
  body: unknown,
): WorkflowRuntimeApprovalRequestExecuteRequest {
  const value = asRecord(body);

  return {
    workflowRunId: expectString(
      value.workflowRunId,
      'Workflow run id is required.',
    ),
    generationJobId: expectString(
      value.generationJobId,
      'Generation job id is required.',
    ),
    approvalRouteId: optionalString(value.approvalRouteId),
    title: expectString(value.title, 'Approval task title is required.'),
  };
}
