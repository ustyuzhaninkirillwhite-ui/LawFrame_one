import type {
  AiDataClass,
  AiRedactionPreviewRequest,
  AiRouteCode,
  CreateAiChatMessageRequest,
  CreateAiChatSessionRequest,
  CreateWorkflowDraftRequest,
  CreateWorkflowPatchRequest,
  UpdateWorkflowDraftInputsRequest,
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
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AIGatewayService } from './ai-gateway.service';
import { AiAccessGuard } from './ai-access.guard';
import { AiWorkspacePolicyGuard } from './ai-workspace-policy.guard';

@Controller('ai')
@UseGuards(
  AuthGuard,
  WorkspaceContextGuard,
  PermissionGuard,
  AiAccessGuard,
  AiWorkspacePolicyGuard,
)
export class AIGatewayController {
  constructor(private readonly aiGatewayService: AIGatewayService) {}

  @Get('chat/sessions')
  @RequiredPermissions('ai.chat.use')
  listSessions(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.listSessions(context.access);
  }

  @Get('chat/sessions/:sessionId')
  @RequiredPermissions('ai.chat.use')
  getSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('sessionId') sessionId: string,
  ) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.getSession(context.access, sessionId);
  }

  @Get('chat/sessions/:sessionId/messages')
  @RequiredPermissions('ai.chat.use')
  listMessages(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('sessionId') sessionId: string,
  ) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.listSessionMessages(context.access, sessionId);
  }

  @Post('chat/sessions')
  @HttpCode(200)
  @RequiredPermissions('ai.chat.use')
  createSession(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.createSession(
      context.actor,
      context.access,
      context.aiPolicy,
      parseCreateAiChatSessionRequest(body),
      requestMeta(request),
    );
  }

  @Post('chat/messages')
  @HttpCode(200)
  @RequiredPermissions('ai.chat.use')
  sendMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.sendMessage(
      context.actor,
      context.access,
      context.aiPolicy,
      parseCreateAiChatMessageRequest(body),
      requestMeta(request),
    );
  }

  @Post('stream')
  @HttpCode(200)
  @Header('content-type', 'text/event-stream')
  @RequiredPermissions('ai.chat.use')
  streamMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error(
        'РљРѕРЅС‚РµРєСЃС‚ РР-Р·Р°РїСЂРѕСЃР° РЅРµ Р±С‹Р» РїСЂРёРІСЏР·Р°РЅ.',
      );
    }

    const value = asRecord(body);
    return this.aiGatewayService.buildStage18StreamFoundation({
      route: expectOptionalAiRouteCode(value.route),
      message: typeof value.message === 'string' ? value.message : undefined,
      requestId: requestMeta(request).requestId,
      traceId: requestMeta(request).traceId,
    });
  }

  @Get('workflow-drafts')
  @RequiredPermissions('ai.workflow.create')
  listDrafts(@LexframeRequestContext() context: LexframeRequest['lexframe']) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.listDrafts(context.access);
  }

  @Get('workflow-drafts/:draftId')
  @RequiredPermissions('ai.workflow.create')
  getDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('draftId') draftId: string,
  ) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.getDraft(context.access, draftId);
  }

  @Post('workflow-drafts')
  @HttpCode(200)
  @RequiredPermissions('ai.workflow.create')
  createDraft(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.createDraft(
      context.actor,
      context.access,
      context.aiPolicy,
      parseCreateWorkflowDraftRequest(body),
      requestMeta(request),
    );
  }

  @Patch('workflow-drafts/:draftId/inputs')
  @HttpCode(200)
  @RequiredPermissions('ai.workflow.create')
  updateDraftInputs(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('draftId') draftId: string,
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.updateDraftInputs(
      context.actor,
      context.access,
      context.aiPolicy,
      draftId,
      parseUpdateWorkflowDraftInputsRequest(body),
      requestMeta(request),
    );
  }

  @Post('workflow-patches')
  @HttpCode(200)
  @RequiredPermissions('ai.workflow.patch')
  createPatch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.createWorkflowPatch(
      context.actor,
      context.access,
      context.aiPolicy,
      parseCreateWorkflowPatchRequest(body),
      requestMeta(request),
    );
  }

  @Post('redaction/preview')
  @HttpCode(200)
  @RequiredPermissions('ai.chat.use')
  previewRedaction(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: unknown,
    @Req() request: LexframeRequest,
  ) {
    if (!context?.actor || !context.access || !context.aiPolicy) {
      throw new Error('Контекст ИИ-запроса не был привязан.');
    }

    return this.aiGatewayService.previewRedaction(
      context.actor,
      context.access,
      context.aiPolicy,
      parseAiRedactionPreviewRequest(body),
      requestMeta(request),
    );
  }

  @Get('requests/:requestId')
  @RequiredPermissions('ai.chat.use')
  getRequest(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('requestId') requestId: string,
  ) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.getRequest(context.access, requestId);
  }

  @Get('requests/:requestId/events')
  @RequiredPermissions('ai.chat.use')
  listRequestEvents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('requestId') requestId: string,
  ) {
    if (!context?.access) {
      throw new Error(
        'Контекст доступа к рабочему пространству не был привязан.',
      );
    }

    return this.aiGatewayService.listRequestEvents(context.access, requestId);
  }
}

function parseCreateAiChatSessionRequest(
  body: unknown,
): CreateAiChatSessionRequest {
  const value = asRecord(body);

  return {
    source: expectChatSource(value.source),
    ...(typeof value.mode === 'string'
      ? { mode: expectChatMode(value.mode) }
      : {}),
    ...(typeof value.currentAutomationId === 'string'
      ? { currentAutomationId: value.currentAutomationId.trim() || null }
      : {}),
    ...(Array.isArray(value.selectedDocumentIds)
      ? { selectedDocumentIds: expectStringArray(value.selectedDocumentIds) }
      : {}),
    ...(Array.isArray(value.selectedTemplateIds)
      ? { selectedTemplateIds: expectStringArray(value.selectedTemplateIds) }
      : {}),
    ...(typeof value.selectedProfileId === 'string'
      ? { selectedProfileId: value.selectedProfileId.trim() || null }
      : {}),
  };
}

function parseCreateAiChatMessageRequest(
  body: unknown,
): CreateAiChatMessageRequest {
  const value = asRecord(body);

  return {
    ...(typeof value.sessionId === 'string'
      ? { sessionId: value.sessionId.trim() || null }
      : {}),
    mode: expectChatMode(value.mode),
    message: expectString(value.message, 'Сообщение обязательно.'),
    ...(Array.isArray(value.selectedDocumentIds)
      ? { selectedDocumentIds: expectStringArray(value.selectedDocumentIds) }
      : {}),
    ...(Array.isArray(value.selectedTemplateIds)
      ? { selectedTemplateIds: expectStringArray(value.selectedTemplateIds) }
      : {}),
    ...(typeof value.selectedProfileId === 'string'
      ? { selectedProfileId: value.selectedProfileId.trim() || null }
      : {}),
    ...(typeof value.currentAutomationId === 'string'
      ? { currentAutomationId: value.currentAutomationId.trim() || null }
      : {}),
    ...(typeof value.clientTraceId === 'string'
      ? { clientTraceId: value.clientTraceId.trim() || null }
      : {}),
  };
}

function parseCreateWorkflowDraftRequest(
  body: unknown,
): CreateWorkflowDraftRequest {
  const value = asRecord(body);

  if (
    typeof value.workflow !== 'object' ||
    value.workflow === null ||
    Array.isArray(value.workflow)
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Содержимое процесса обязательно.',
    );
  }

  const workflow = value.workflow as Record<string, unknown>;

  if (workflow.schemaVersion !== 'lexframe.workflow.v1') {
    throw new AppHttpException(
      'AI_SCHEMA_VALIDATION_FAILED',
      400,
      'Структурированный workflow output не соответствует schemaVersion lexframe.workflow.v1.',
    );
  }

  return {
    title: expectString(value.title, 'Название черновика обязательно.'),
    workflow: workflow as unknown as CreateWorkflowDraftRequest['workflow'],
    ...(typeof value.source === 'string'
      ? { source: value.source as CreateWorkflowDraftRequest['source'] }
      : {}),
    ...(typeof value.linkedSessionId === 'string'
      ? { linkedSessionId: value.linkedSessionId.trim() || null }
      : {}),
  };
}

function parseUpdateWorkflowDraftInputsRequest(
  body: unknown,
): UpdateWorkflowDraftInputsRequest {
  const value = asRecord(body);

  if (
    typeof value.answers !== 'object' ||
    value.answers === null ||
    Array.isArray(value.answers)
  ) {
    throw new AppHttpException(
      'VALIDATION_ERROR',
      400,
      'Ответы черновика должны быть JSON-объектом.',
    );
  }

  return {
    answers: value.answers as Record<string, unknown>,
  };
}

function parseCreateWorkflowPatchRequest(
  body: unknown,
): CreateWorkflowPatchRequest {
  const value = asRecord(body);

  return {
    automationId: expectString(
      value.automationId,
      'ID автоматизации обязателен.',
    ),
    baseVersionId: expectString(
      value.baseVersionId,
      'ID базовой версии обязателен.',
    ),
    instruction: expectString(
      value.instruction,
      'Инструкция для правки обязательна.',
    ),
    ...(typeof value.sessionId === 'string'
      ? { sessionId: value.sessionId.trim() || null }
      : {}),
  };
}

function parseAiRedactionPreviewRequest(
  body: unknown,
): AiRedactionPreviewRequest {
  const value = asRecord(body);

  return {
    text: expectString(
      value.text,
      'Для предпросмотра обезличивания требуется текст.',
    ),
    classification: expectAiDataClass(value.classification),
    redactionPolicy:
      value.redactionPolicy === 'strict' || value.redactionPolicy === 'balanced'
        ? value.redactionPolicy
        : 'balanced',
  };
}

function expectChatSource(
  value: unknown,
): CreateAiChatSessionRequest['source'] {
  if (
    value === 'global_chat' ||
    value === 'automation_chat' ||
    value === 'document_chat'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Источник чата некорректен.',
  );
}

function expectChatMode(value: unknown): CreateAiChatMessageRequest['mode'] {
  if (
    value === 'create_workflow' ||
    value === 'modify_workflow' ||
    value === 'explain_workflow' ||
    value === 'extract_fields'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Режим чата некорректен.',
  );
}

function expectAiDataClass(value: unknown): AiDataClass {
  if (
    value === 'A_PUBLIC' ||
    value === 'A_TEMPLATE_NON_SENSITIVE' ||
    value === 'B_INTERNAL_WORKSPACE' ||
    value === 'B_ANONYMIZED_LEGAL' ||
    value === 'C_CONFIDENTIAL_CLIENT' ||
    value === 'C_LEGAL_SECRET' ||
    value === 'D_AI_EXTERNAL_FORBIDDEN'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'Классификация ИИ некорректна.',
  );
}

function expectOptionalAiRouteCode(value: unknown): AiRouteCode | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (
    value === 'default_chat' ||
    value === 'agent_general' ||
    value === 'rag_legal_summary' ||
    value === 'automation_planner_high'
  ) {
    return value;
  }

  throw new AppHttpException(
    'VALIDATION_ERROR',
    400,
    'AI route is not allowed.',
  );
}

function expectString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppHttpException('VALIDATION_ERROR', 400, message);
  }

  return value.trim();
}

function expectStringArray(value: readonly unknown[]): string[] {
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
    idempotencyKey:
      request.headers['x-idempotency-key'] ??
      request.headers['idempotency-key'] ??
      null,
  };
}
