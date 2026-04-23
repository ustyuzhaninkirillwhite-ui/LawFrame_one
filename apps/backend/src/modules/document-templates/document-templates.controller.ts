import type {
  CreateDocumentTemplateRequest,
  PublishDocumentTemplateVersionRequest,
  UpdateDocumentTemplateRequest,
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
  optionalRecord,
  optionalString,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { DocumentTemplatesService } from './document-templates.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DocumentTemplatesController {
  constructor(private readonly documentTemplatesService: DocumentTemplatesService) {}

  @Get('document-templates')
  @RequiredPermissions('document.template.read')
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.list(context.access);
  }

  @Get('document-templates/:id')
  @RequiredPermissions('document.template.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.get(context.access, id);
  }

  @Post('document-templates')
  @HttpCode(200)
  @RequiredPermissions('document.template.manage')
  create(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.create(
      context.actor,
      context.access,
      parseCreateDocumentTemplateRequest(body),
      requestMeta(request),
    );
  }

  @Patch('document-templates/:id')
  @RequiredPermissions('document.template.manage')
  update(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.update(
      context.actor,
      context.access,
      id,
      parseUpdateDocumentTemplateRequest(body),
      requestMeta(request),
    );
  }

  @Post('document-templates/:id/parse-placeholders')
  @HttpCode(200)
  @RequiredPermissions('document.template.map_fields')
  parsePlaceholders(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.parsePlaceholders(context.access, id);
  }

  @Post('document-template-versions/:id/publish-draft')
  @HttpCode(200)
  @RequiredPermissions('document.template.publish')
  publishDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTemplatesService.publishDraft(
      context.actor,
      context.access,
      id,
      parsePublishDocumentTemplateVersionRequest(body),
      requestMeta(request),
    );
  }
}

function parseCreateDocumentTemplateRequest(
  body: unknown,
): CreateDocumentTemplateRequest {
  const value = asRecord(body);

  return {
    workspaceId: optionalString(value.workspaceId),
    ownerUserId: optionalString(value.ownerUserId),
    documentTypeId: optionalString(value.documentTypeId),
    sourceDocumentId: expectString(value.sourceDocumentId, 'Source document id is required.'),
    sourceDocumentVersionId: expectString(
      value.sourceDocumentVersionId,
      'Source document version id is required.',
    ),
    title: expectString(value.title, 'Template title is required.'),
    description: optionalString(value.description),
    visibility: expectVisibility(value.visibility),
    placeholders: Array.isArray(value.placeholders) ? value.placeholders as CreateDocumentTemplateRequest['placeholders'] : [],
    mappings: Array.isArray(value.mappings) ? value.mappings as CreateDocumentTemplateRequest['mappings'] : [],
  };
}

function parseUpdateDocumentTemplateRequest(
  body: unknown,
): UpdateDocumentTemplateRequest {
  const value = asRecord(body);

  return {
    ...(value.title !== undefined ? { title: expectString(value.title, 'Template title must be a string.') } : {}),
    ...(value.description !== undefined ? { description: optionalString(value.description) } : {}),
    ...(value.documentTypeId !== undefined ? { documentTypeId: optionalString(value.documentTypeId) } : {}),
    ...(value.visibility !== undefined ? { visibility: expectVisibility(value.visibility) } : {}),
    ...(value.placeholders !== undefined
      ? { placeholders: Array.isArray(value.placeholders) ? value.placeholders as UpdateDocumentTemplateRequest['placeholders'] : [] }
      : {}),
    ...(value.mappings !== undefined
      ? { mappings: Array.isArray(value.mappings) ? value.mappings as UpdateDocumentTemplateRequest['mappings'] : [] }
      : {}),
  };
}

function parsePublishDocumentTemplateVersionRequest(
  body: unknown,
): PublishDocumentTemplateVersionRequest {
  if (body === undefined || body === null) {
    return {};
  }

  const value = asRecord(body);

  return {
    versionId: optionalString(value.versionId),
  };
}

function expectVisibility(
  value: unknown,
): CreateDocumentTemplateRequest['visibility'] {
  if (
    value === 'workspace' ||
    value === 'personal' ||
    value === 'public' ||
    value === 'system'
  ) {
    return value;
  }

  throw new Error('Template visibility is invalid.');
}
