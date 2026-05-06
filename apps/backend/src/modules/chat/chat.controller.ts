import type {
  CreateChatMessageRequest,
  UpdateChatThreadRequest,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LexframeRequestContext } from '../../common/decorators/lexframe-request.decorator';
import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { ChatThreadService } from './chat-thread.service';

@Controller('chat')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class ChatController {
  constructor(private readonly chatThreadService: ChatThreadService) {}

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
      readonly branchMode?: 'project' | 'document_review' | 'automation_builder';
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
  ) {
    return this.chatThreadService.streamMessage(context, threadId, body, {
      requestId: request.requestId ?? null,
      traceId: request.traceId ?? null,
    });
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
    return this.chatThreadService.streamMessage(
      context,
      threadId,
      {
        text: `Regenerate from message ${messageId}`,
        parentMessageId: messageId,
      },
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
    return this.chatThreadService.streamMessage(
      context,
      threadId,
      {
        ...body,
        parentMessageId: messageId,
      },
      {
        requestId: request.requestId ?? null,
        traceId: request.traceId ?? null,
      },
    );
  }

  @Get('search')
  @RequiredPermissions('chat.search')
  search(
    @LexframeRequestContext() context: LexframeRequest['lexframe'],
    @Query('q') query = '',
    @Query('projectId') projectId?: string,
  ) {
    return this.chatThreadService.search(context, query, projectId ?? null);
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
}
