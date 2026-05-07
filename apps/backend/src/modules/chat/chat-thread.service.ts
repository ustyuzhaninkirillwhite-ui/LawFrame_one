import type {
  ChatDataClassification,
  ChatMessageDto,
  ChatMessagePartDto,
  ChatMessagesResponse,
  ChatSearchResponse,
  ChatStreamSnapshot,
  ChatThreadKind,
  ChatThreadListResponse,
  ChatThreadResponse,
  ChatThreadSummary,
  CreateChatMessageRequest,
  CreateChatThreadRequest,
  Stage15ProjectChatCreatedResponse,
  Stage15ProjectChatSummary,
  UpdateChatThreadRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { ChatStreamService } from './chat-stream.service';

const DEFAULT_STAGE19_PROJECT_ID = 'project_claim_001';

interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

interface ThreadRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly kind: ChatThreadKind;
  readonly visibility: ChatThreadSummary['visibility'];
  readonly status: ChatThreadSummary['status'];
  readonly title: string;
  readonly last_message_preview: string | null;
  readonly current_branch_id: string | null;
  readonly created_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly archived_at: string | null;
  readonly deleted_at: string | null;
}

interface MessageRow {
  readonly id: string;
  readonly thread_id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly role: ChatMessageDto['role'];
  readonly status: ChatMessageDto['status'];
  readonly parent_message_id: string | null;
  readonly created_by: string | null;
  readonly request_id: string | null;
  readonly trace_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface MessagePartRow {
  readonly id: string;
  readonly message_id: string;
  readonly type: ChatMessagePartDto['type'];
  readonly text: string | null;
  readonly payload: Record<string, unknown> | null;
  readonly sequence: number;
}

@Injectable()
export class ChatThreadService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly chatStreamService: ChatStreamService,
  ) {}

  async listProjectThreads(
    context: LexframeRequestState | undefined,
    projectId: string,
  ): Promise<ChatThreadListResponse> {
    const { access } = this.requireContext(context);
    this.assertProjectId(access, projectId);
    const workspaceId = this.requireWorkspace(access).id;
    const result = await this.databaseService.query<ThreadRow>(
      `
        select *
        from app.chat_threads
        where workspace_id = $1
          and project_id = $2
          and status <> 'deleted'
        order by updated_at desc
        limit 100
      `,
      [workspaceId, projectId],
    );

    return { items: result.rows.map(mapThreadRow) };
  }

  async createProjectThread(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: CreateChatThreadRequest = {},
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<ChatThreadResponse> {
    const { actor, access } = this.requireContext(context);
    this.assertProjectId(access, projectId);
    const workspaceId = this.requireWorkspace(access).id;
    const kind = input.kind ?? 'project';
    const title = normalizeTitle(input.title) ?? 'Новый чат проекта';
    const row = await this.databaseService.one<ThreadRow>(
      `
        insert into app.chat_threads (
          workspace_id,
          project_id,
          kind,
          visibility,
          status,
          title,
          created_by,
          updated_by,
          trace_id
        )
        values ($1, $2, $3, 'project', 'active', $4, $5, $5, $6)
        returning *
      `,
      [workspaceId, projectId, kind, title, actor.id, meta.traceId],
    );

    if (!row) {
      throw new AppHttpException(
        'CHAT_THREAD_NOT_FOUND',
        500,
        'Chat thread was not created.',
      );
    }

    await this.auditChat({
      actor,
      workspaceId,
      action: 'chat.thread.created',
      entityId: row.id,
      result: 'success',
      meta,
      metadata: { project_id: projectId, kind },
    });

    return { thread: mapThreadRow(row) };
  }

  async createProjectChatForStage15(
    context: LexframeRequestState | undefined,
    projectId: string,
    input: CreateChatThreadRequest = {},
    meta: RequestMeta = { requestId: null, traceId: null },
  ): Promise<Stage15ProjectChatCreatedResponse> {
    const response = await this.createProjectThread(
      context,
      projectId,
      input,
      meta,
    );
    const thread = response.thread;

    return {
      chat: mapStage15ProjectChat(thread),
      session: {
        id: thread.id,
        workspaceId: thread.workspaceId,
        source: 'project_chat',
        mode: 'create_workflow',
        status: thread.status === 'active' ? 'active' : 'archived',
        title: thread.title,
        currentAutomationId: null,
        selectedDocumentIds: [],
        selectedTemplateIds: [],
        selectedProfileId: null,
        contentStorageMode: 'plaintext_allowed',
        allowedModes: [
          'create_workflow',
          'modify_workflow',
          'explain_workflow',
          'extract_fields',
        ],
        aiPolicySummary: {
          externalAiEnabled: true,
          confidentialDataAllowed: false,
          cometapiAllowedForPublicData: true,
        },
        lastMessageAt: null,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    };
  }

  async getThread(
    context: LexframeRequestState | undefined,
    threadId: string,
  ): Promise<ChatThreadResponse> {
    const { access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    const row = await this.getThreadRow(workspaceId, threadId);
    return { thread: mapThreadRow(row) };
  }

  async updateThread(
    context: LexframeRequestState | undefined,
    threadId: string,
    input: UpdateChatThreadRequest,
    meta: RequestMeta,
  ): Promise<ChatThreadResponse> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.getThreadRow(workspaceId, threadId);
    const row = await this.databaseService.one<ThreadRow>(
      `
        update app.chat_threads
        set
          title = coalesce($3, title),
          status = coalesce($4, status),
          updated_by = $5,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning *
      `,
      [
        threadId,
        workspaceId,
        normalizeTitle(input.title) ?? null,
        input.status ?? null,
        actor.id,
      ],
    );

    if (!row) {
      throw new AppHttpException(
        'CHAT_THREAD_NOT_FOUND',
        404,
        'Chat thread was not found.',
      );
    }

    await this.auditChat({
      actor,
      workspaceId,
      action: 'chat.thread.updated',
      entityId: threadId,
      result: 'success',
      meta,
      metadata: { status: row.status },
    });

    return { thread: mapThreadRow(row) };
  }

  archiveThread(
    context: LexframeRequestState | undefined,
    threadId: string,
    meta: RequestMeta,
  ) {
    return this.setThreadLifecycle(context, threadId, 'archived', meta);
  }

  deleteThread(
    context: LexframeRequestState | undefined,
    threadId: string,
    meta: RequestMeta,
  ) {
    return this.setThreadLifecycle(context, threadId, 'deleted', meta);
  }

  async branchThread(
    context: LexframeRequestState | undefined,
    threadId: string,
    sourceMessageId: string | null,
    branchMode: ChatThreadKind,
    meta: RequestMeta,
  ): Promise<ChatThreadResponse> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    const source = await this.getThreadRow(workspaceId, threadId);
    const created = await this.createProjectThread(
      context,
      source.project_id ?? DEFAULT_STAGE19_PROJECT_ID,
      {
        title: `${source.title} / ветка`,
        kind: branchMode,
      },
      meta,
    );

    await this.databaseService.query(
      `
        insert into app.chat_thread_branches (
          parent_thread_id,
          source_message_id,
          branch_thread_id,
          branch_mode,
          workspace_id,
          project_id,
          created_by
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        threadId,
        sourceMessageId,
        created.thread.id,
        branchMode,
        workspaceId,
        source.project_id,
        actor.id,
      ],
    );

    await this.auditChat({
      actor,
      workspaceId,
      action: 'chat.thread.branched',
      entityId: created.thread.id,
      result: 'success',
      meta,
      metadata: {
        parent_thread_id: threadId,
        source_message_id: sourceMessageId,
        branch_mode: branchMode,
      },
    });

    return created;
  }

  async listMessages(
    context: LexframeRequestState | undefined,
    threadId: string,
  ): Promise<ChatMessagesResponse> {
    const { access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.getThreadRow(workspaceId, threadId);
    const messages = await this.databaseService.query<MessageRow>(
      `
        select *
        from app.chat_messages
        where workspace_id = $1
          and thread_id = $2
          and status <> 'redacted'
        order by created_at asc
        limit 200
      `,
      [workspaceId, threadId],
    );
    const messageIds = messages.rows.map((row) => row.id);
    const parts = messageIds.length
      ? await this.databaseService.query<MessagePartRow>(
          `
            select *
            from app.chat_message_parts
            where message_id = any($1::uuid[])
            order by sequence asc
          `,
          [messageIds],
        )
      : { rows: [] };

    return {
      items: messages.rows.map((message) =>
        mapMessageRow(
          message,
          parts.rows.filter((part) => part.message_id === message.id),
        ),
      ),
    };
  }

  async createUserMessage(
    context: LexframeRequestState | undefined,
    threadId: string,
    input: CreateChatMessageRequest,
    meta: RequestMeta,
  ): Promise<ChatMessageDto> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    const thread = await this.getThreadRow(workspaceId, threadId);
    this.assertThreadWritable(thread);
    const message = await this.insertMessage({
      workspaceId,
      projectId: thread.project_id,
      threadId,
      role: 'user',
      status: 'completed',
      parentMessageId: input.parentMessageId ?? null,
      actorId: actor.id,
      requestId: meta.requestId,
      traceId: meta.traceId,
      text: input.text,
      partType: 'text',
    });

    await this.auditChat({
      actor,
      workspaceId,
      action: 'chat.message.created',
      entityId: message.id,
      result: 'success',
      meta,
      metadata: {
        thread_id: threadId,
        project_id: thread.project_id,
        attachment_count: input.attachments?.length ?? 0,
      },
    });

    return message;
  }

  async streamMessage(
    context: LexframeRequestState | undefined,
    threadId: string,
    input: CreateChatMessageRequest,
    meta: RequestMeta,
  ): Promise<ChatStreamSnapshot> {
    const { actor } = this.requireContext(context);
    const userMessage = await this.createUserMessage(
      context,
      threadId,
      input,
      meta,
    );
    const routeSse = this.aiGatewayService.buildStage18StreamFoundation({
      route: 'default_chat',
      message: input.text,
      requestId: meta.requestId,
      traceId: meta.traceId,
    });
    const assistantMessage = await this.insertMessage({
      workspaceId: userMessage.workspaceId,
      projectId: userMessage.projectId,
      threadId,
      role: 'assistant',
      status: 'completed',
      parentMessageId: userMessage.id,
      actorId: actor.id,
      requestId: meta.requestId,
      traceId: meta.traceId,
      text: 'LexFrame AI Gateway обработал запрос через default_chat. Ответ сохранён в project chat.',
      partType: 'markdown',
    });
    const snapshot = this.chatStreamService.createStreamSnapshot({
      workspaceId: userMessage.workspaceId,
      threadId,
      messageId: assistantMessage.id,
      text: assistantMessage.parts[0]?.text ?? '',
      routeSnapshot: {
        route: 'default_chat',
        provider: 'cometapi',
        model: 'deepseek-v4-flash',
        policyDecisionId: 'stage19-default-chat',
        keyFingerprint: null,
        traceId: meta.traceId ?? randomUUID(),
      },
    });

    await this.persistStreamSnapshot(snapshot, routeSse);
    await this.auditChat({
      actor,
      workspaceId: userMessage.workspaceId,
      action: 'chat.message.stream_completed',
      entityId: assistantMessage.id,
      result: 'success',
      meta,
      metadata: {
        thread_id: threadId,
        route: 'default_chat',
        provider: 'cometapi',
        model: 'deepseek-v4-flash',
      },
    });

    return snapshot;
  }

  resumeStream(
    context: LexframeRequestState | undefined,
    threadId: string,
    streamId: string,
  ) {
    void context;
    return {
      streamId,
      threadId,
      status: 'completed' as const,
      events: [],
    };
  }

  async cancelStream(
    context: LexframeRequestState | undefined,
    threadId: string,
    streamId: string,
    meta: RequestMeta,
  ) {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    await this.databaseService.query(
      `
        update app.chat_stream_jobs
        set status = 'cancelled', completed_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
          and thread_id = $3
      `,
      [streamId, workspaceId, threadId],
    );
    await this.auditChat({
      actor,
      workspaceId,
      action: 'chat.message.cancelled',
      entityId: streamId,
      result: 'success',
      meta,
      metadata: { thread_id: threadId },
    });

    return { streamId, threadId, status: 'cancelled' as const };
  }

  async search(
    context: LexframeRequestState | undefined,
    query: string,
    projectId: string | null,
  ): Promise<ChatSearchResponse> {
    const { access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    const result = await this.databaseService.query<
      ThreadRow & {
        readonly message_id: string | null;
        readonly snippet: string | null;
        readonly classification: ChatDataClassification | null;
      }
    >(
      `
        select
          t.*,
          null::uuid as message_id,
          ts_headline('simple', coalesce(t.title, ''), plainto_tsquery('simple', $2)) as snippet,
          null::text as classification
        from app.chat_threads t
        where t.workspace_id = $1
          and ($3::text is null or t.project_id = $3)
          and t.status <> 'deleted'
          and (
            $2 = ''
            or to_tsvector('simple', coalesce(t.title, '')) @@ plainto_tsquery('simple', $2)
            or t.title ilike '%' || $2 || '%'
          )
        order by t.updated_at desc
        limit 25
      `,
      [workspaceId, query.trim(), projectId],
    );

    return {
      items: result.rows.map((row) => ({
        thread: mapThreadRow(row),
        messageId: row.message_id,
        snippet: row.snippet,
        classification: row.classification,
      })),
      nextCursor: null,
    };
  }

  private async setThreadLifecycle(
    context: LexframeRequestState | undefined,
    threadId: string,
    status: 'archived' | 'deleted',
    meta: RequestMeta,
  ): Promise<ChatThreadResponse> {
    const { actor, access } = this.requireContext(context);
    const workspaceId = this.requireWorkspace(access).id;
    const row = await this.databaseService.one<ThreadRow>(
      `
        update app.chat_threads
        set
          status = $3,
          archived_at = case when $3 = 'archived' then timezone('utc', now()) else archived_at end,
          deleted_at = case when $3 = 'deleted' then timezone('utc', now()) else deleted_at end,
          updated_by = $4,
          updated_at = timezone('utc', now())
        where id = $1
          and workspace_id = $2
        returning *
      `,
      [threadId, workspaceId, status, actor.id],
    );

    if (!row) {
      throw new AppHttpException(
        'CHAT_THREAD_NOT_FOUND',
        404,
        'Chat thread was not found.',
      );
    }

    await this.auditChat({
      actor,
      workspaceId,
      action:
        status === 'archived' ? 'chat.thread.archived' : 'chat.thread.deleted',
      entityId: threadId,
      result: 'success',
      meta,
      metadata: { status },
    });

    return { thread: mapThreadRow(row) };
  }

  private async getThreadRow(
    workspaceId: string,
    threadId: string,
  ): Promise<ThreadRow> {
    const row = await this.databaseService.one<ThreadRow>(
      `
        select *
        from app.chat_threads
        where id = $1
          and workspace_id = $2
        limit 1
      `,
      [threadId, workspaceId],
    );

    if (!row || row.status === 'deleted') {
      throw new AppHttpException(
        'CHAT_THREAD_NOT_FOUND',
        404,
        'Chat thread was not found.',
      );
    }

    return row;
  }

  private assertThreadWritable(thread: ThreadRow) {
    if (thread.status === 'archived') {
      throw new AppHttpException(
        'CHAT_THREAD_ARCHIVED',
        409,
        'Archived chat thread cannot accept new messages.',
      );
    }
  }

  private async insertMessage(input: {
    readonly workspaceId: string;
    readonly projectId: string | null;
    readonly threadId: string;
    readonly role: ChatMessageDto['role'];
    readonly status: ChatMessageDto['status'];
    readonly parentMessageId: string | null;
    readonly actorId: string | null;
    readonly requestId: string | null;
    readonly traceId: string | null;
    readonly text: string;
    readonly partType: ChatMessagePartDto['type'];
  }): Promise<ChatMessageDto> {
    return this.databaseService.transaction(async (client) => {
      const messageResult = await client.query<MessageRow>(
        `
          insert into app.chat_messages (
            thread_id,
            workspace_id,
            project_id,
            role,
            status,
            parent_message_id,
            created_by,
            request_id,
            trace_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          returning *
        `,
        [
          input.threadId,
          input.workspaceId,
          input.projectId,
          input.role,
          input.status,
          input.parentMessageId,
          input.actorId,
          input.requestId,
          input.traceId,
        ],
      );
      const message = messageResult.rows[0];
      if (!message) {
        throw new AppHttpException(
          'CHAT_MESSAGE_NOT_FOUND',
          500,
          'Chat message was not created.',
        );
      }
      const partResult = await client.query<MessagePartRow>(
        `
          insert into app.chat_message_parts (
            message_id,
            thread_id,
            workspace_id,
            type,
            text,
            payload,
            sequence
          )
          values ($1, $2, $3, $4, $5, '{}'::jsonb, 0)
          returning *
        `,
        [
          message.id,
          input.threadId,
          input.workspaceId,
          input.partType,
          input.text,
        ],
      );

      await client.query(
        `
          update app.chat_threads
          set
            last_message_preview = left($3, 240),
            updated_at = timezone('utc', now())
          where id = $1
            and workspace_id = $2
        `,
        [input.threadId, input.workspaceId, input.text],
      );

      return mapMessageRow(message, partResult.rows);
    });
  }

  private async persistStreamSnapshot(
    snapshot: ChatStreamSnapshot,
    gatewayEvidence: string,
  ) {
    await this.databaseService.transaction(async (client) => {
      await client.query(
        `
          insert into app.chat_stream_jobs (
            id,
            workspace_id,
            thread_id,
            message_id,
            status,
            trace_id,
            gateway_evidence_hash,
            completed_at
          )
          values ($1, $2, $3, $4, $5, $6, encode(digest($7::text, 'sha256'), 'hex'), timezone('utc', now()))
          on conflict (id) do nothing
        `,
        [
          snapshot.streamId,
          snapshot.workspaceId,
          snapshot.threadId,
          snapshot.messageId,
          snapshot.status,
          getTraceId(snapshot),
          gatewayEvidence,
        ],
      );

      for (const [index, event] of snapshot.events.entries()) {
        await client.query(
          `
            insert into app.chat_stream_events (
              stream_job_id,
              workspace_id,
              thread_id,
              event_type,
              payload,
              sequence
            )
            values ($1, $2, $3, $4, $5::jsonb, $6)
          `,
          [
            snapshot.streamId,
            snapshot.workspaceId,
            snapshot.threadId,
            event.type,
            JSON.stringify(event.payload),
            index,
          ],
        );
      }
    });
  }

  private requireContext(context: LexframeRequestState | undefined): {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
  } {
    if (!context?.actor || !context.access) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace access context was not attached.',
      );
    }
    this.requireWorkspace(context.access);
    return { actor: context.actor, access: context.access };
  }

  private requireWorkspace(access: AccessContext) {
    if (!access.activeWorkspace) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Active workspace is required.',
      );
    }
    return access.activeWorkspace;
  }

  private assertProjectId(access: AccessContext, projectId: string) {
    const allowedIds = new Set([
      DEFAULT_STAGE19_PROJECT_ID,
      this.projectIdFor(access),
    ]);
    if (!allowedIds.has(projectId)) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        404,
        'Project is not available in the active workspace.',
      );
    }
  }

  private projectIdFor(access: AccessContext) {
    this.requireWorkspace(access);
    return DEFAULT_STAGE19_PROJECT_ID;
  }

  private auditChat(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly action: string;
    readonly entityId: string;
    readonly result: 'success' | 'denied' | 'error';
    readonly meta: RequestMeta;
    readonly metadata: Record<string, unknown>;
  }) {
    return this.auditService.record({
      actorUserId: input.actor.id,
      actorEmail: input.actor.email,
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: 'chat',
      entityId: input.entityId,
      result: input.result,
      requestId: input.meta.requestId,
      traceId: input.meta.traceId,
      eventCategory: 'chat',
      dataClass: null,
      metadata: input.metadata,
    });
  }
}

export function mapStage15ProjectChat(
  thread: ChatThreadSummary,
): Stage15ProjectChatSummary {
  return {
    id: thread.id,
    projectId: thread.projectId ?? DEFAULT_STAGE19_PROJECT_ID,
    title: thread.title,
    status: thread.status === 'active' ? 'active' : 'archived',
    lastMessagePreview:
      thread.lastMessagePreview ??
      'Чат создан. История хранится в LexFrame DB.',
    selectedDocumentIds: [],
    linkedAutomationId: null,
    updatedAt: thread.updatedAt,
  };
}

function mapThreadRow(row: ThreadRow): ChatThreadSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    kind: row.kind,
    visibility: row.visibility,
    status: row.status,
    title: row.title,
    lastMessagePreview: row.last_message_preview,
    currentBranchId: row.current_branch_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
  };
}

function mapMessageRow(
  row: MessageRow,
  parts: readonly MessagePartRow[],
): ChatMessageDto {
  return {
    id: row.id,
    threadId: row.thread_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    role: row.role,
    status: row.status,
    parentMessageId: row.parent_message_id,
    createdBy: row.created_by,
    requestId: row.request_id,
    traceId: row.trace_id,
    parts: parts.map((part) => ({
      id: part.id,
      type: part.type,
      text: part.text,
      payload: part.payload ?? {},
      sequence: part.sequence,
    })),
    attachments: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTitle(value: string | null | undefined) {
  const title = value?.trim();
  return title && title.length > 0 ? title : null;
}

function getTraceId(snapshot: ChatStreamSnapshot) {
  const start = snapshot.events.find((event) => event.type === 'message_start');
  const traceId = start?.payload.traceId;
  return typeof traceId === 'string' ? traceId : randomUUID();
}
