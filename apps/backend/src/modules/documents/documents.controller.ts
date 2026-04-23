import type {
  CompleteUploadRequest,
  CreateDocumentVersionUploadIntentRequest,
  DocumentKind,
  DocumentListQuery,
  DocumentObjectRole,
  DocumentUploadIntentRequest,
  SignedUrlRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { dataClassification } from '@lexframe/contracts';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @RequiredPermissions('document.read')
  list(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Req() request: LexframeRequest,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.list(
      context.access,
      parseDocumentListQuery(request.query),
    );
  }

  @Get(':documentId')
  @RequiredPermissions('document.read')
  get(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
  ) {
    if (!context?.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.getDetail(context.access, documentId);
  }

  @Get(':documentId/versions')
  @RequiredPermissions('document.read')
  listVersions(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
  ) {
    const workspaceId = context?.access?.activeWorkspace?.id;

    if (!workspaceId) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.listVersions(documentId, workspaceId);
  }

  @Post('upload-intents')
  @HttpCode(200)
  @RequiredPermissions('document.upload')
  createUploadIntent(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.createUploadIntent(
      context.actor,
      context.access,
      parseDocumentUploadIntentRequest(body),
      requestMeta(request),
    );
  }

  @Post(':documentId/versions/upload-intent')
  @HttpCode(200)
  @RequiredPermissions('document.upload')
  createVersionUploadIntent(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.createVersionUploadIntent(
      context.actor,
      context.access,
      documentId,
      parseDocumentVersionUploadIntentRequest(body),
      requestMeta(request),
    );
  }

  @Post(':documentId/versions/:versionId/complete')
  @HttpCode(200)
  @RequiredPermissions('document.upload')
  completeUpload(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.completeUpload(
      context.actor,
      context.access,
      documentId,
      versionId,
      parseCompleteUploadRequest(body),
      requestMeta(request),
    );
  }

  @Post(':documentId/versions/:versionId/make-current')
  @HttpCode(200)
  @RequiredPermissions('document.upload')
  makeCurrent(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.makeCurrent(
      context.actor,
      context.access,
      documentId,
      versionId,
      requestMeta(request),
    );
  }

  @Post(':documentId/signed-url')
  @HttpCode(200)
  @RequiredPermissions('document.read')
  createSignedUrl(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.createSignedUrl(
      context.actor,
      context.access,
      documentId,
      parseSignedUrlRequest(body),
      requestMeta(request),
    );
  }

  @Post(':documentId/archive')
  @HttpCode(200)
  @RequiredPermissions('document.delete')
  archive(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.archive(
      context.actor,
      context.access,
      documentId,
      requestMeta(request),
    );
  }

  @Post(':documentId/restore')
  @HttpCode(200)
  @RequiredPermissions('document.restore')
  restore(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.restore(
      context.actor,
      context.access,
      documentId,
      requestMeta(request),
    );
  }

  @Delete(':documentId')
  @RequiredPermissions('document.delete')
  delete(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('documentId') documentId: string,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error('Workspace access context was not attached.');
    }

    return this.documentsService.softDelete(
      context.actor,
      context.access,
      documentId,
      requestMeta(request),
    );
  }
}

function parseDocumentListQuery(value: unknown): DocumentListQuery {
  const query = asRecord(value ?? {});
  const output: {
    q?: string;
    tag?: string;
    cursor?: string;
    kind?: DocumentKind;
    status?: DocumentListQuery['status'];
    classification?: DocumentListQuery['classification'];
  } = {};

  if (typeof query.q === 'string' && query.q.trim().length > 0) {
    output.q = query.q.trim();
  }

  if (typeof query.tag === 'string' && query.tag.trim().length > 0) {
    output.tag = query.tag.trim();
  }

  if (typeof query.cursor === 'string' && query.cursor.trim().length > 0) {
    output.cursor = query.cursor.trim();
  }

  if (isDocumentKind(query.kind)) {
    output.kind = query.kind;
  }

  if (isDocumentStatus(query.status)) {
    output.status = query.status;
  }

  if (isDataClassification(query.classification)) {
    output.classification = query.classification;
  }

  return output;
}

function parseDocumentUploadIntentRequest(
  body: unknown,
): DocumentUploadIntentRequest {
  const value = asRecord(body);
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((item): item is string => typeof item === 'string')
    : undefined;
  const relations = Array.isArray(value.relations)
    ? value.relations.map((item) => parseDocumentRelationInput(item))
    : undefined;

  return {
    title: expectString(value.title, 'Document title is required.'),
    ...(typeof value.description === 'string' &&
    value.description.trim().length > 0
      ? { description: value.description.trim() }
      : {}),
    kind: expectDocumentKind(value.kind),
    classification: expectDataClassification(value.classification),
    originalFilename: expectString(
      value.originalFilename,
      'Original filename is required.',
    ),
    mimeType: expectString(value.mimeType, 'MIME type is required.'),
    sizeBytes: expectPositiveNumber(value.sizeBytes, 'File size is required.'),
    ...(tags ? { tags } : {}),
    ...(relations ? { relations } : {}),
  };
}

function parseDocumentVersionUploadIntentRequest(
  body: unknown,
): CreateDocumentVersionUploadIntentRequest {
  const value = asRecord(body);

  return {
    originalFilename: expectString(
      value.originalFilename,
      'Original filename is required.',
    ),
    mimeType: expectString(value.mimeType, 'MIME type is required.'),
    sizeBytes: expectPositiveNumber(value.sizeBytes, 'File size is required.'),
  };
}

function parseCompleteUploadRequest(body: unknown): CompleteUploadRequest {
  const value = asRecord(body);

  return {
    clientReportedSize: expectPositiveNumber(
      value.clientReportedSize,
      'Client reported file size is required.',
    ),
    clientReportedMimeType: expectString(
      value.clientReportedMimeType,
      'Client reported MIME type is required.',
    ),
    ...(typeof value.sha256 === 'string' && value.sha256.trim().length > 0
      ? { sha256: value.sha256.trim() }
      : {}),
  };
}

function parseSignedUrlRequest(body: unknown): SignedUrlRequest {
  const value = asRecord(body);

  if (value.purpose !== 'download' && value.purpose !== 'preview') {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Signed URL purpose must be download or preview.',
    );
  }

  return {
    ...(typeof value.versionId === 'string' && value.versionId.trim().length > 0
      ? { versionId: value.versionId.trim() }
      : {}),
    objectRole: expectDocumentObjectRole(value.objectRole),
    purpose: value.purpose,
    ...(typeof value.expiresInSeconds === 'number'
      ? { expiresInSeconds: value.expiresInSeconds }
      : {}),
  };
}

function parseDocumentRelationInput(value: unknown) {
  const record = asRecord(value);

  return {
    relationType: expectString(
      record.relationType,
      'Relation type is required.',
    ),
    targetEntityType: expectString(
      record.targetEntityType,
      'Relation target entity type is required.',
    ),
    targetEntityId: expectString(
      record.targetEntityId,
      'Relation target entity id is required.',
    ),
  };
}

function expectDocumentKind(value: unknown): DocumentKind {
  if (isDocumentKind(value)) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Document kind is invalid.',
  );
}

function expectDataClassification(
  value: unknown,
): (typeof dataClassification)[number] {
  if (isDataClassification(value)) {
    return value;
  }

  throw new AppHttpException(
    'DOCUMENT_CLASSIFICATION_REQUIRED',
    400,
    'Document classification is required.',
  );
}

function expectDocumentObjectRole(value: unknown): DocumentObjectRole {
  if (
    value === 'original' ||
    value === 'preview_pdf' ||
    value === 'thumbnail' ||
    value === 'extracted_text' ||
    value === 'redacted_copy'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Document object role is invalid.',
  );
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function expectPositiveNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value;
}

function isDataClassification(
  value: unknown,
): value is (typeof dataClassification)[number] {
  return (
    typeof value === 'string' && dataClassification.includes(value as never)
  );
}

function isDocumentKind(value: unknown): value is DocumentKind {
  return (
    value === 'case_material' ||
    value === 'evidence' ||
    value === 'legal_source' ||
    value === 'document_template' ||
    value === 'generated_document' ||
    value === 'draft_document' ||
    value === 'delivery_attachment' ||
    value === 'profile_clause' ||
    value === 'other'
  );
}

function isDocumentStatus(value: unknown) {
  return (
    value === 'upload_pending' ||
    value === 'uploaded' ||
    value === 'processing' ||
    value === 'ready' ||
    value === 'failed' ||
    value === 'archived' ||
    value === 'soft_deleted' ||
    value === 'hard_delete_pending'
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Request body must be a JSON object.',
    );
  }

  return value as Record<string, unknown>;
}

function requestMeta(request: LexframeRequest) {
  return {
    requestId: request.headers['x-request-id'] ?? null,
    traceId: request.headers['x-trace-id'] ?? null,
  };
}
