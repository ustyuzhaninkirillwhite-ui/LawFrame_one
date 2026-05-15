import type {
  ChatAttachmentCompleteRequest,
  ChatAttachmentUploadIntentRequest,
  ChatThreadListQuery,
  CreateChatMessageRequest,
  CreateChatThreadRequest,
  UpdateChatThreadRequest,
} from '@lexframe/contracts';
import type { LexframeRequest } from '../../common/types/lexframe-request';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ChatThreadService } from './chat-thread.service';
import { buildSseResponseHeaders } from './chat-sse-headers';

@Controller('chat')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ChatController {
  constructor(private readonly chatThreadService: ChatThreadService) {}

  @Get('threads')
  @RequiredPermissions('chat.view')
  listThreads(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('scope') scope?: ChatThreadListQuery['scope'],
    @Query('projectId') projectId?: string,
  ) {
    if (scope === 'project' && projectId) {
      return this.chatThreadService.listProjectThreads(context, projectId);
    }

    return this.chatThreadService.listGlobalThreads(context);
  }

  @Post('threads')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  createThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: CreateChatThreadRequest,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.createGlobalThread(context, body, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Get('threads/:threadId')
  @RequiredPermissions('chat.view')
  getThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
  ) {
    return this.chatThreadService.getThread(context, threadId);
  }

  @Patch('threads/:threadId')
  @RequiredPermissions('chat.edit')
  updateThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Body() body: UpdateChatThreadRequest,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.updateThread(context, threadId, body, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Post('threads/:threadId/archive')
  @HttpCode(200)
  @RequiredPermissions('chat.edit')
  archiveThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.archiveThread(context, threadId, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Post('threads/:threadId/delete')
  @HttpCode(200)
  @RequiredPermissions('chat.delete')
  deleteThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.deleteThread(context, threadId, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Post('threads/:threadId/branch')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  branchThread(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Body()
    body: {
      readonly sourceMessageId?: string | null;
      readonly branchMode?:
        | 'project'
        | 'document_review'
        | 'automation_builder';
    },
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.branchThread(
      context,
      threadId,
      body.sourceMessageId ?? null,
      body.branchMode ?? 'project',
      {
        requestId: request.requestId ?? null,
        traceId: request.traceId ?? null,
      },
    );
  }

  @Get('threads/:threadId/messages')
  @RequiredPermissions('chat.view')
  listMessages(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
  ) {
    return this.chatThreadService.listMessages(context, threadId);
  }

  @Post('threads/:threadId/messages')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  createMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Body() body: CreateChatMessageRequest,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.createUserMessage(context, threadId, body, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Post('threads/:threadId/messages:stream')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  streamMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Body() body: CreateChatMessageRequest,
    @Req() request: LexframeRequest,
    @Headers('accept') accept: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res() reply: SseReply,
  ) {
    const meta = {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    };

    if (!accept?.includes('text/event-stream')) {
      return this.chatThreadService
        .streamMessage(context, threadId, body, meta)
        .then((snapshot) => reply.send(snapshot));
    }

    return this.streamMessageAsSse(
      context,
      threadId,
      body,
      meta,
      reply,
      origin,
    );
  }

  @Post('threads/:threadId/streams/:streamId/resume')
  @HttpCode(200)
  @RequiredPermissions('chat.view')
  resumeStream(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Param('streamId') streamId: string,
  ) {
    return this.chatThreadService.resumeStream(context, threadId, streamId);
  }

  @Post('threads/:threadId/streams/:streamId/cancel')
  @HttpCode(200)
  @RequiredPermissions('chat.edit')
  cancelStream(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Param('streamId') streamId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.cancelStream(context, threadId, streamId, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Post('threads/:threadId/messages/:messageId/regenerate')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  regenerate(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Param('messageId') messageId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.regenerateMessage(
      context,
      threadId,
      messageId,
      {
        requestId: request.requestId ?? null,
        traceId: request.traceId ?? null,
      },
    );
  }

  @Post('threads/:threadId/messages/:messageId/edit')
  @HttpCode(200)
  @RequiredPermissions('chat.edit')
  editMessage(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Param('messageId') messageId: string,
    @Body() body: CreateChatMessageRequest,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.editMessage(
      context,
      threadId,
      messageId,
      body,
      {
        requestId: request.requestId ?? null,
        traceId: request.traceId ?? null,
      },
    );
  }

  @Post('threads/:threadId/branches/:branchId/switch')
  @HttpCode(200)
  @RequiredPermissions('chat.edit')
  switchBranch(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('threadId') threadId: string,
    @Param('branchId') branchId: string,
    @Req() request: LexframeRequest,
  ) {
    return this.chatThreadService.switchBranch(context, threadId, branchId, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
  }

  @Get('search')
  @RequiredPermissions('chat.search')
  search(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('q') query = '',
    @Query('projectId') projectId?: string,
    @Query('scope') scope?: ChatThreadListQuery['scope'],
  ) {
    return this.chatThreadService.search(
      context,
      query,
      projectId ?? null,
      scope ?? null,
    );
  }

  @Post('threads/:threadId/export')
  @HttpCode(200)
  @RequiredPermissions('chat.export')
  exportThread(@Param('threadId') threadId: string) {
    return {
      threadId,
      format: 'json',
      status: 'created',
    };
  }

  @Post('attachments/upload-intents')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  createAttachmentUploadIntents(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Body() body: ChatAttachmentUploadIntentRequest,
  ) {
    return this.chatThreadService.createAttachmentUploadIntents(context, body);
  }

  @Post('attachments/:attachmentId/complete')
  @HttpCode(200)
  @RequiredPermissions('chat.create')
  completeAttachmentUpload(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('attachmentId') attachmentId: string,
    @Body() body: ChatAttachmentCompleteRequest,
  ) {
    return this.chatThreadService.completeAttachmentUpload(
      context,
      attachmentId,
      body,
    );
  }

  @Delete('attachments/:attachmentId')
  @HttpCode(200)
  @RequiredPermissions('chat.edit')
  deleteAttachment(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.chatThreadService.deleteAttachment(context, attachmentId);
  }

  @Get('attachments/:attachmentId/download')
  @RequiredPermissions('chat.view')
  downloadAttachment(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.chatThreadService.createAttachmentDownloadUrl(
      context,
      attachmentId,
    );
  }

  private async streamMessageAsSse(
    context: LexframeRequest['lexframe'],
    threadId: string,
    body: CreateChatMessageRequest,
    meta: {
      readonly requestId: string | null;
      readonly traceId: string | null;
    },
    reply: SseReply,
    origin: string | undefined,
  ) {
    reply.raw.writeHead(200, buildSseResponseHeaders(origin));

    const writeEvent = (event: {
      readonly type: string;
      readonly payload: Record<string, unknown>;
    }) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const snapshot = await this.chatThreadService.streamMessage(
        context,
        threadId,
        body,
        meta,
        {
          onEvent: writeEvent,
        },
      );
      writeEvent({
        type: 'done',
        payload: { snapshot },
      });
    } catch (error) {
      writeEvent({
        type: 'error',
        payload: {
          code: getSafeSseErrorCode(error),
        },
      });
    } finally {
      reply.raw.end();
    }
  }
}

interface SseReply {
  send(payload: unknown): unknown;
  raw: {
    writeHead(statusCode: number, headers: Record<string, string>): void;
    write(chunk: string): void;
    end(): void;
  };
}

function getSafeSseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'CHAT_STREAM_FAILED';
  }

  const code = (error as { readonly code?: unknown }).code;
  if (typeof code !== 'string' || !/^[A-Z0-9_:-]{2,80}$/.test(code)) {
    return 'CHAT_STREAM_FAILED';
  }

  return code;
}
