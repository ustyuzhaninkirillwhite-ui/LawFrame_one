import type {
  CreateDocumentStructureRequest,
  CreateDocumentTypeRequest,
  DocumentStructureSection,
  UpdateDocumentStructureRequest,
  UpdateDocumentTypeRequest,
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
  optionalStringArray,
  requestMeta,
} from '../stage7-support/stage7.helpers';
import { DocumentTypesService } from './document-types.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Get('document-types')
  @RequiredPermissions('document.template.read')
  list(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTypesService.list(context.access);
  }

  @Get('document-types/:id')
  @RequiredPermissions('document.template.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTypesService.get(context.access, id);
  }

  @Post('document-types')
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

    return this.documentTypesService.create(
      context.actor,
      context.access,
      parseCreateDocumentTypeRequest(body),
      requestMeta(request),
    );
  }

  @Patch('document-types/:id')
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

    return this.documentTypesService.update(
      context.actor,
      context.access,
      id,
      parseUpdateDocumentTypeRequest(body),
      requestMeta(request),
    );
  }

  @Get('document-structures')
  @RequiredPermissions('document.template.read')
  listStructures(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTypesService.listStructures(context.access);
  }

  @Post('document-structures')
  @HttpCode(200)
  @RequiredPermissions('document.template.manage')
  createStructure(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTypesService.createStructure(
      context.access,
      parseCreateDocumentStructureRequest(body),
    );
  }

  @Patch('document-structures/:id')
  @RequiredPermissions('document.template.manage')
  updateStructure(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentTypesService.updateStructure(
      context.access,
      id,
      parseUpdateDocumentStructureRequest(body),
    );
  }
}

function parseCreateDocumentTypeRequest(body: unknown): CreateDocumentTypeRequest {
  const value = asRecord(body);

  return {
    workspaceId: optionalString(value.workspaceId),
    code: expectString(value.code, 'Document type code is required.'),
    name: expectString(value.name, 'Document type name is required.'),
    jurisdiction: optionalString(value.jurisdiction),
    practiceArea: optionalString(value.practiceArea),
    structure: parseStructureSections(value.structure),
    attachmentDefaults: optionalStringArray(value.attachmentDefaults) ?? [],
    validationRules: optionalRecord(value.validationRules) ?? {},
  };
}

function parseUpdateDocumentTypeRequest(body: unknown): UpdateDocumentTypeRequest {
  const value = asRecord(body);

  return {
    ...(value.name !== undefined
      ? { name: expectString(value.name, 'Document type name must be a string.') }
      : {}),
    ...(value.jurisdiction !== undefined
      ? { jurisdiction: optionalString(value.jurisdiction) }
      : {}),
    ...(value.practiceArea !== undefined
      ? { practiceArea: optionalString(value.practiceArea) }
      : {}),
    ...(value.structure !== undefined
      ? { structure: parseStructureSections(value.structure) }
      : {}),
    ...(value.attachmentDefaults !== undefined
      ? { attachmentDefaults: optionalStringArray(value.attachmentDefaults) ?? [] }
      : {}),
    ...(value.validationRules !== undefined
      ? { validationRules: optionalRecord(value.validationRules) ?? {} }
      : {}),
  };
}

function parseCreateDocumentStructureRequest(
  body: unknown,
): CreateDocumentStructureRequest {
  const value = asRecord(body);

  return {
    documentTypeId: expectString(value.documentTypeId, 'Document type id is required.'),
    documentTypeVersionId: optionalString(value.documentTypeVersionId),
    sections: parseStructureSections(value.sections),
  };
}

function parseUpdateDocumentStructureRequest(
  body: unknown,
): UpdateDocumentStructureRequest {
  const value = asRecord(body);

  return {
    sections: parseStructureSections(value.sections),
  };
}

function parseStructureSections(value: unknown): readonly DocumentStructureSection[] {
  if (!Array.isArray(value)) {
    throw new Error('Structure sections must be an array.');
  }

  return value.map((entry, index) => {
    const section = asRecord(entry);

    return {
      sectionId: expectString(
        section.sectionId,
        `Structure section ${index + 1} requires sectionId.`,
      ),
      title: expectString(section.title, `Structure section ${index + 1} requires title.`),
      kind: expectSectionKind(section.kind),
      required: Boolean(section.required),
      order: typeof section.order === 'number' ? section.order : index,
      locked: Boolean(section.locked),
      clauseIds: optionalStringArray(section.clauseIds) ?? [],
      placeholderCodes: optionalStringArray(section.placeholderCodes) ?? [],
    };
  });
}

function expectSectionKind(value: unknown): DocumentStructureSection['kind'] {
  if (
    value === 'header' ||
    value === 'intro' ||
    value === 'facts' ||
    value === 'analysis' ||
    value === 'claims' ||
    value === 'attachments' ||
    value === 'signature' ||
    value === 'custom'
  ) {
    return value;
  }

  throw new Error('Document structure kind is invalid.');
}
