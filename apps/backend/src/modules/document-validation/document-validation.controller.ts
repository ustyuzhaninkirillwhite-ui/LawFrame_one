import type {
  RecheckDocumentValidationRequest,
  WorkflowRuntimeDocumentValidationExecuteRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
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
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  asRecord,
  expectString,
  optionalString,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { DocumentValidationService } from './document-validation.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DocumentValidationController {
  constructor(
    private readonly documentValidationService: DocumentValidationService,
  ) {}

  @Get('document-validations/:id')
  @RequiredPermissions('document.validation.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentValidationService.getReport(context.access, id);
  }

  @Post('document-validations/:id/recheck')
  @HttpCode(200)
  @RequiredPermissions('document.validation.resolve')
  recheck(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentValidationService.recheck(
      context.actor,
      context.access,
      id,
      parseRecheckDocumentValidationRequest(body),
      requestMeta(request),
    );
  }

  @Post('workflow-runtime/document-validation/execute')
  @HttpCode(200)
  @RequiredPermissions('document.validation.read')
  executeForRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentValidationService.executeRuntime(
      context.actor,
      context.access,
      parseWorkflowRuntimeDocumentValidationExecuteRequest(body),
      requestMeta(request),
    );
  }
}

function parseRecheckDocumentValidationRequest(
  body: unknown,
): RecheckDocumentValidationRequest {
  const value = asRecord(body);

  return {
    generationJobId: optionalString(value.generationJobId),
    profileId: optionalString(value.profileId),
    templateVersionId: optionalString(value.templateVersionId),
  };
}

function parseWorkflowRuntimeDocumentValidationExecuteRequest(
  body: unknown,
): WorkflowRuntimeDocumentValidationExecuteRequest {
  const value = asRecord(body);

  return {
    workflowRunId: expectString(value.workflowRunId, 'Workflow run id is required.'),
    generationJobId: expectString(value.generationJobId, 'Generation job id is required.'),
  };
}
