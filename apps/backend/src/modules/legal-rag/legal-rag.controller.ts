import type {
  LegalSearchFilters,
  RagAnalyzeRequest,
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
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { LegalRagService } from './legal-rag.service';

@Controller()
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class LegalRagController {
  constructor(private readonly legalRagService: LegalRagService) {}

  @Post('legal-rag/analyze')
  @HttpCode(200)
  @RequiredPermissions('legal_rag.use')
  analyze(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.legalRagService.analyze(
      context.actor,
      context.access,
      parseRagAnalyzeRequest(body),
      requestMeta(request),
    );
  }

  @Post('workflow-runtime/legal-rag/analyze')
  @HttpCode(200)
  @RequiredPermissions('legal_rag.use')
  analyzeForRuntime(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.legalRagService.analyze(
      context.actor,
      context.access,
      parseRagAnalyzeRequest(body),
      requestMeta(request),
    );
  }

  @Get('legal-rag/requests/:requestId')
  @RequiredPermissions('legal_rag.use')
  getRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('requestId') requestId: string,
  ) {
    if (!context?.access?.activeWorkspace?.id) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.legalRagService.getRequestSummary(
      context.access.activeWorkspace.id,
      requestId,
    );
  }
}

function parseRagAnalyzeRequest(body: unknown): RagAnalyzeRequest {
  const value = asRecord(body);
  const selection = asRecord(value.sourceSelection);
  const options =
    value.options !== undefined ? asRecord(value.options) : undefined;

  return {
    taskType: expectString(value.taskType, 'Тип задачи RAG обязателен.'),
    question: expectString(value.question, 'Вопрос RAG обязателен.'),
    sourceSelection: {
      mode: expectSourceMode(selection.mode),
      ...(Array.isArray(selection.selectedSourceIds)
        ? {
            selectedSourceIds: selection.selectedSourceIds
              .filter((entry): entry is string => typeof entry === 'string')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0),
          }
        : {}),
      ...(typeof selection.searchQuery === 'string' &&
      selection.searchQuery.trim().length > 0
        ? { searchQuery: selection.searchQuery.trim() }
        : {}),
      ...(selection.filters !== undefined
        ? { filters: parseFilters(selection.filters) }
        : {}),
    },
    ...(Array.isArray(value.workspaceDocumentIds)
      ? {
          workspaceDocumentIds: value.workspaceDocumentIds
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
    ...(options
      ? {
          options: {
            ...(typeof options.maxContextChunks === 'number'
              ? { maxContextChunks: options.maxContextChunks }
              : {}),
            ...(typeof options.requireCitations === 'boolean'
              ? { requireCitations: options.requireCitations }
              : {}),
            ...(typeof options.includeUnsupportedClaims === 'boolean'
              ? { includeUnsupportedClaims: options.includeUnsupportedClaims }
              : {}),
          },
        }
      : {}),
  };
}

function parseFilters(value: unknown): LegalSearchFilters {
  const record = asRecord(value);

  return {
    ...(Array.isArray(record.sourceType)
      ? { sourceType: record.sourceType.filter(isSourceType) }
      : {}),
    ...(Array.isArray(record.visibility)
      ? { visibility: record.visibility.filter(isVisibility) }
      : {}),
    ...(Array.isArray(record.court)
      ? {
          court: record.court
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
    ...(typeof record.dateFrom === 'string' && record.dateFrom.trim().length > 0
      ? { dateFrom: record.dateFrom.trim() }
      : {}),
    ...(typeof record.dateTo === 'string' && record.dateTo.trim().length > 0
      ? { dateTo: record.dateTo.trim() }
      : {}),
    ...(Array.isArray(record.category)
      ? {
          category: record.category
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0),
        }
      : {}),
    ...(typeof record.workspaceId === 'string' &&
    record.workspaceId.trim().length > 0
      ? { workspaceId: record.workspaceId.trim() }
      : {}),
    ...(typeof record.caseNumber === 'string' &&
    record.caseNumber.trim().length > 0
      ? { caseNumber: record.caseNumber.trim() }
      : {}),
  };
}

function expectSourceMode(
  value: unknown,
): RagAnalyzeRequest['sourceSelection']['mode'] {
  if (
    value === 'selected_only' ||
    value === 'selected_and_search' ||
    value === 'search_only'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Режим sourceSelection.mode для RAG некорректен.',
  );
}

function isSourceType(
  value: unknown,
): value is
  | 'court_decision'
  | 'statute'
  | 'regulation'
  | 'contract_template'
  | 'user_document'
  | 'internal_memo'
  | 'analysis_result' {
  return (
    value === 'court_decision' ||
    value === 'statute' ||
    value === 'regulation' ||
    value === 'contract_template' ||
    value === 'user_document' ||
    value === 'internal_memo' ||
    value === 'analysis_result'
  );
}

function isVisibility(
  value: unknown,
): value is
  | 'public'
  | 'product_private'
  | 'workspace_private'
  | 'user_private'
  | 'restricted_provider' {
  return (
    value === 'public' ||
    value === 'product_private' ||
    value === 'workspace_private' ||
    value === 'user_private' ||
    value === 'restricted_provider'
  );
}

function expectString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Тело запроса должно быть JSON-объектом.',
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
