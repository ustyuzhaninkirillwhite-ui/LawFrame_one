import type {
  DocumentGenerationPreviewRequest,
  FinalizeDocumentGenerationRequest,
  WorkflowRuntimeDocumentTemplateExecuteRequest,
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
  optionalRecord,
  optionalString,
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { DocumentGenerationService } from './document-generation.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DocumentGenerationController {
  constructor(
    private readonly documentGenerationService: DocumentGenerationService,
  ) {}

  @Post('document-generation/previews')
  @HttpCode(200)
  @RequiredPermissions('document.generate')
  createPreview(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentGenerationService.createPreview(
      context.actor,
      context.access,
      parseDocumentGenerationPreviewRequest(body),
      requestMeta(request),
    );
  }

  @Get('document-generation/:id')
  @RequiredPermissions('document.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentGenerationService.getJob(context.access, id);
  }

  @Post('document-generation/:id/finalize')
  @HttpCode(200)
  @RequiredPermissions('document.generate')
  finalize(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentGenerationService.finalize(
      context.actor,
      context.access,
      id,
      parseFinalizeDocumentGenerationRequest(body),
      requestMeta(request),
    );
  }

  @Post('workflow-runtime/document-template/execute')
  @HttpCode(200)
  @RequiredPermissions('document.generate')
  executeForRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentGenerationService.executeRuntime(
      context.actor,
      context.access,
      parseWorkflowRuntimeDocumentTemplateExecuteRequest(body),
      requestMeta(request),
    );
  }
}

function parseDocumentGenerationPreviewRequest(
  body: unknown,
): DocumentGenerationPreviewRequest {
  const value = asRecord(body);

  return {
    templateId: expectString(value.templateId, 'Template id is required.'),
    templateVersionId: optionalString(value.templateVersionId),
    profileId: optionalString(value.profileId),
    documentTypeId: optionalString(value.documentTypeId),
    approvalRouteId: optionalString(value.approvalRouteId),
    workflowRunId: optionalString(value.workflowRunId),
    input: {
      facts: optionalRecord(asRecord(value.input).facts) ?? {},
      params: optionalRecord(asRecord(value.input).params) ?? {},
      sourceDocumentIds:
        optionalStringArray(asRecord(value.input).sourceDocumentIds) ?? [],
    },
    aiSectionCodes: optionalStringArray(value.aiSectionCodes) ?? [],
  };
}

function parseFinalizeDocumentGenerationRequest(
  body: unknown,
): FinalizeDocumentGenerationRequest {
  if (body === undefined || body === null || body === '') {
    return {};
  }

  const value = asRecord(body);

  return {
    generationJobId: optionalString(value.generationJobId),
    approvalDecisionComment: optionalString(value.approvalDecisionComment),
  };
}

function parseWorkflowRuntimeDocumentTemplateExecuteRequest(
  body: unknown,
): WorkflowRuntimeDocumentTemplateExecuteRequest {
  const value = asRecord(body);
  const input = asRecord(value.input);

  return {
    installedAutomationId: expectString(
      value.installedAutomationId,
      'Installed automation id is required.',
    ),
    workflowRunId: expectString(
      value.workflowRunId,
      'Workflow run id is required.',
    ),
    templateId: expectString(value.templateId, 'Template id is required.'),
    templateVersionId: optionalString(value.templateVersionId),
    profileId: optionalString(value.profileId),
    input: {
      facts: optionalRecord(input.facts) ?? {},
      params: optionalRecord(input.params) ?? {},
      sourceDocumentIds: optionalStringArray(input.sourceDocumentIds) ?? [],
    },
  };
}
