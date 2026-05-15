import { ChatThreadService } from './chat-thread.service';
import { ChatStreamService } from './chat-stream.service';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';

const workspaceId = '00000000-0000-0000-0000-000000000201';
const actor: AuthenticatedActor = {
  id: '00000000-0000-0000-0000-000000000101',
  email: 'chat-smoke@example.test',
  fullName: 'Chat Smoke',
  emailConfirmedAt: null,
  assuranceLevel: 'aal1',
  accessToken: 'test-access-token',
  sessionId: 'session-1',
};

const access: AccessContext = {
  activeWorkspace: {
    id: workspaceId,
    slug: 'workspace',
    name: 'Workspace',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: [
    'chat.create',
    'chat.view',
    'settings.ai.manage_self',
    'settings.ai.manage_workspace',
  ],
};

describe('ChatThreadService project chat streaming', () => {
  it('lists global chat threads without returning project-scoped chats', async () => {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '00000000-0000-0000-0000-000000000501',
            workspace_id: workspaceId,
            project_id: null,
            kind: 'general',
            visibility: 'private',
            status: 'active',
            title: 'Global chat',
            last_message_preview: 'General question',
            current_branch_id: null,
            created_by: actor.id,
            created_at: '2026-05-09T00:00:00.000Z',
            updated_at: '2026-05-09T00:00:00.000Z',
            archived_at: null,
            deleted_at: null,
          },
        ],
      }),
      transaction: jest.fn(),
    };
    const service = new ChatThreadService(
      databaseService as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.listGlobalThreads({ actor, access });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      projectId: null,
      kind: 'general',
      title: 'Global chat',
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('project_id is null'),
      expect.arrayContaining([workspaceId]),
    );
  });

  it('creates a global chat thread without project ownership', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000502',
        workspace_id: workspaceId,
        project_id: null,
        kind: 'general',
        visibility: 'private',
        status: 'active',
        title: 'General workspace chat',
        last_message_preview: null,
        current_branch_id: null,
        created_by: actor.id,
        created_at: '2026-05-09T00:00:00.000Z',
        updated_at: '2026-05-09T00:00:00.000Z',
        archived_at: null,
        deleted_at: null,
      }),
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      transaction: jest.fn(),
    };
    const service = new ChatThreadService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.createGlobalThread(
      { actor, access },
      { title: 'General workspace chat' },
      { requestId: 'request-1', traceId: 'trace-1' },
    );

    expect(result.thread).toMatchObject({
      projectId: null,
      kind: 'general',
      visibility: 'private',
      title: 'General workspace chat',
    });
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.chat_threads'),
      expect.arrayContaining([
        workspaceId,
        'general',
        'General workspace chat',
      ]),
    );
  });

  it('uses a Russian default title for newly created global chats', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000503',
        workspace_id: workspaceId,
        project_id: null,
        kind: 'general',
        visibility: 'private',
        status: 'active',
        title: 'Новый чат',
        last_message_preview: null,
        current_branch_id: null,
        created_by: actor.id,
        created_at: '2026-05-09T00:00:00.000Z',
        updated_at: '2026-05-09T00:00:00.000Z',
        archived_at: null,
        deleted_at: null,
      }),
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      transaction: jest.fn(),
    };
    const service = new ChatThreadService(
      databaseService as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.createGlobalThread(
      { actor, access },
      { title: null },
      { requestId: 'request-1', traceId: 'trace-1' },
    );

    expect(result.thread.title).toBe('Новый чат');
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.chat_threads'),
      expect.arrayContaining([workspaceId, 'general', 'Новый чат']),
    );
  });

  it('creates project chat threads in the caller-provided non-default project context', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000401',
        workspace_id: workspaceId,
        project_id: 'project_custom_live_001',
        kind: 'project',
        visibility: 'project',
        status: 'active',
        title: 'Custom project chat',
        last_message_preview: null,
        current_branch_id: null,
        created_by: actor.id,
        created_at: '2026-05-09T00:00:00.000Z',
        updated_at: '2026-05-09T00:00:00.000Z',
        archived_at: null,
        deleted_at: null,
      }),
      query: jest.fn(() => Promise.resolve({ rows: [] })),
      transaction: jest.fn(),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.createProjectThread(
      { actor, access },
      'project_custom_live_001',
      { title: 'Custom project chat' },
      { requestId: 'request-1', traceId: 'trace-1' },
    );

    expect(result.thread.projectId).toBe('project_custom_live_001');
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.chat_threads'),
      expect.arrayContaining(['project_custom_live_001']),
    );
  });

  it('persists the assistant message from a live backend AI gateway stream instead of a canned route notice', async () => {
    const persistedParts: Array<{
      readonly role: string;
      readonly text: string;
    }> = [];
    const databaseService = createDatabaseServiceMock(persistedParts);
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const aiGatewayService = {
      buildStage18StreamFoundation: jest.fn(() => 'event: route_snapshot\n\n'),
      streamChatCompletion: jest.fn().mockResolvedValue({
        route: {
          route: 'default_chat',
          provider: 'cometapi',
          model: 'deepseek-v4-pro',
          providerConnectionId: 'provider-connection-1',
          keyFingerprint: 'sha256:abcdef1234567890',
          blocked: false,
        },
        response: {
          provider: 'cometapi',
          model: 'deepseek-v4-pro',
          text: 'LEXFRAME_CHAT_SMOKE_OK Подключение проектного чата работает.',
          ok: true,
          latencyMs: 123,
          contentChunkCount: 1,
          reasoningChunkCount: 1,
          status: 200,
          errorClass: null,
          requestDescriptor: {
            provider: 'cometapi',
            compatibility: 'openai_chat_completions',
            method: 'POST',
            endpointPath: '/chat/completions',
            baseUrlHost: 'api.example.test',
            baseUrlPath: '/v1',
            model: 'deepseek-v4-pro',
            bodyKeys: [
              'model',
              'messages',
              'stream',
              'max_tokens',
              'reasoning_effort',
              'thinking',
            ],
            hasAuthorizationHeader: true,
            secretFingerprint: 'sha256:abcdef1234567890',
            stream: true,
            maxTokens: 384_000,
            reasoningEffort: 'high',
            thinkingEnabled: true,
          },
        },
      }),
    };
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'provider-connection-1',
        providerCode: 'cometapi',
        modelId: 'deepseek-v4-pro',
        baseUrl: 'https://api.example.test/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:abcdef1234567890',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: false,
        runtimeCallable: true,
        directBrowserAccess: false,
        policyDecisionId: 'policy-decision-1',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };

    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      aiGatewayService as never,
      routeGroupResolver as never,
      new ChatStreamService(),
    );

    const snapshot = await service.streamMessage(
      { actor, access },
      '00000000-0000-0000-0000-000000000301',
      {
        text: 'Проверь подключение чата. Верни маркер LEXFRAME_CHAT_SMOKE_OK.',
      },
      { requestId: 'request-1', traceId: 'trace-1' },
    );

    expect(aiGatewayService.streamChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'default_chat',
        maxTokens: 384_000,
        reasoningEffort: 'high',
        thinking: { type: 'enabled' },
      }),
    );
    const gatewayRequest = aiGatewayService.streamChatCompletion.mock
      .calls[0][0] as {
      readonly messages: readonly {
        readonly role: string;
        readonly content: string;
      }[];
    };
    const systemMessage = gatewayRequest.messages.find(
      (message) => message.role === 'system',
    );
    expect(systemMessage?.content).toContain(
      'Return a complete answer at the level of detail requested by the user.',
    );
    expect(systemMessage?.content).not.toContain('Answer briefly');
    expect(systemMessage?.content).toContain('LEXFRAME_CHAT_SMOKE_OK');
    expect(systemMessage?.content).toContain('Do not reveal API keys');
    expect(snapshot.status).toBe('completed');
    expect(JSON.stringify(snapshot)).toContain('LEXFRAME_CHAT_SMOKE_OK');
    expect(JSON.stringify(snapshot)).not.toContain('abcdef1234567890');
    expect(persistedParts).toContainEqual({
      role: 'assistant',
      text: 'LEXFRAME_CHAT_SMOKE_OK Подключение проектного чата работает.',
    });
    expect(persistedParts).not.toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining('LexFrame AI Gateway processed'),
      }),
    );
  });

  it('audits a safe stream failure when the backend provider route falls back', async () => {
    const persistedParts: Array<{
      readonly role: string;
      readonly text: string;
    }> = [];
    const persistedStreamJobs: Array<{
      readonly status: string;
      readonly messageId: unknown;
    }> = [];
    const persistedStreamEvents: Array<{
      readonly eventType: string;
      readonly payload: string;
    }> = [];
    const databaseService = createDatabaseServiceMock(
      persistedParts,
      persistedStreamJobs,
      persistedStreamEvents,
    );
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const aiGatewayService = {
      buildStage18StreamFoundation: jest.fn(() => 'event: route_snapshot\n\n'),
      streamChatCompletion: jest.fn().mockResolvedValue({
        route: {
          route: 'default_chat',
          provider: 'cometapi',
          model: 'deepseek-v4-pro',
          providerConnectionId: 'provider-connection-1',
          keyFingerprint: 'sha256:abcdef1234567890',
          routeReason: 'workspace_preference:default_chat',
          blocked: false,
        },
        response: {
          ok: false,
          provider: 'cometapi',
          model: 'deepseek-v4-pro',
          text: '',
          latencyMs: 123,
          contentChunkCount: 0,
          reasoningChunkCount: 1,
          status: 401,
          errorClass: 'PROVIDER_AUTH_INVALID_TOKEN',
          attemptCount: 1,
          retryReason: null,
          requestDescriptor: {
            provider: 'cometapi',
            compatibility: 'openai_chat_completions',
            method: 'POST',
            endpointPath: '/chat/completions',
            baseUrlHost: 'api.example.test',
            baseUrlPath: '/v1',
            model: 'deepseek-v4-pro',
            bodyKeys: [
              'model',
              'messages',
              'stream',
              'max_tokens',
              'reasoning_effort',
              'thinking',
            ],
            hasAuthorizationHeader: true,
            secretFingerprint: 'sha256:abcdef1234567890',
            stream: true,
            maxTokens: 384_000,
            reasoningEffort: 'high',
            thinkingEnabled: true,
          },
        },
      }),
    };
    const routeGroupResolver = {
      resolveEffectivePolicy: jest.fn().mockResolvedValue({
        routeGroup: 'chat_ai',
        routeCode: 'default_chat',
        source: 'workspace_preference',
        providerConnectionId: 'provider-connection-1',
        providerCode: 'cometapi',
        modelId: 'deepseek-v4-pro',
        baseUrl: 'https://api.example.test/v1',
        hasSecret: true,
        secretStatus: 'active',
        fingerprint: 'sha256:abcdef1234567890',
        supportsStreaming: true,
        supportsJson: true,
        supportsToolCalls: false,
        runtimeCallable: true,
        directBrowserAccess: false,
        policyDecisionId: 'policy-decision-1',
        resolvedAt: '2026-05-09T00:00:00.000Z',
      }),
    };

    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      aiGatewayService as never,
      routeGroupResolver as never,
      new ChatStreamService(),
    );

    await expect(
      service.streamMessage(
        { actor, access },
        '00000000-0000-0000-0000-000000000301',
        {
          text: 'Проверь подключение чата. Верни маркер LEXFRAME_CHAT_SMOKE_OK.',
        },
        { requestId: 'request-1', traceId: 'trace-1' },
      ),
    ).rejects.toMatchObject({ code: 'AI_GATEWAY_NOT_READY' });

    expect(persistedParts).toContainEqual({
      role: 'user',
      text: 'Проверь подключение чата. Верни маркер LEXFRAME_CHAT_SMOKE_OK.',
    });
    expect(persistedParts.some((part) => part.role === 'assistant')).toBe(true);
    expect(persistedStreamJobs).toContainEqual(
      expect.objectContaining({ status: 'failed' }),
    );
    expect(persistedStreamEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'route_snapshot' }),
        expect.objectContaining({ eventType: 'error' }),
      ]),
    );
    expect(JSON.stringify(persistedStreamEvents)).not.toContain(
      'abcdef1234567890',
    );

    const failedAudit = auditService.record.mock.calls
      .map(
        ([event]) =>
          event as {
            readonly action: string;
            readonly result: string;
            readonly metadata: Record<string, unknown>;
          },
      )
      .find((event) => event.action === 'chat.message.stream_failed');

    expect(failedAudit).toMatchObject({
      action: 'chat.message.stream_failed',
      result: 'error',
      metadata: expect.objectContaining({
        thread_id: '00000000-0000-0000-0000-000000000301',
        route_group: 'chat_ai',
        provider: 'cometapi',
        model: 'deepseek-v4-pro',
        provider_stream_ok: false,
        provider_error_class: 'PROVIDER_AUTH_INVALID_TOKEN',
        provider_status: 401,
        content_chunk_count: 0,
        reasoning_chunk_count: 1,
        attempt_count: 1,
        error_code: 'AI_GATEWAY_NOT_READY',
        error_status: 503,
        key_fingerprint_prefix: 'sha256:abcdef12',
      }),
    });
    expect(JSON.stringify(failedAudit)).not.toContain('abcdef1234567890');
  });

  it('treats optimistic client stream ids as locally cancelled without touching stream jobs', async () => {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.cancelStream(
      { actor, access },
      '00000000-0000-0000-0000-000000000301',
      'client-stream-message-1',
      { requestId: 'request-1', traceId: 'trace-1' },
    );

    expect(result).toEqual({
      streamId: 'client-stream-message-1',
      threadId: '00000000-0000-0000-0000-000000000301',
      status: 'cancelled',
    });
    expect(databaseService.query).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects unsafe chat attachment upload intents before signing storage URLs', async () => {
    const databaseService = createDatabaseServiceMock([]);
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.createAttachmentUploadIntents(
      { actor, access },
      {
        threadId: '00000000-0000-0000-0000-000000000301',
        files: [
          {
            clientAttachmentId: 'client-1',
            filename: '../payload.exe',
            mimeType: 'application/x-msdownload',
            sizeBytes: 12,
          },
        ],
      },
    );

    expect(result.items).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        clientAttachmentId: 'client-1',
        code: 'unsafe_filename',
      }),
    );
    expect(databaseService.query).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into app.chat_attachments'),
      expect.any(Array),
    );
  });

  it('validates chat attachment intents for empty, oversized, unsupported, disguised and duplicate files', async () => {
    const databaseService = createDatabaseServiceMock([]);
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          signedURL: '/storage/v1/object/upload/sign/chat-attachment',
        }),
    } as Response);
    const service = new ChatThreadService(
      databaseService as never,
      auditService as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.createAttachmentUploadIntents(
      { actor, access },
      {
        threadId: '00000000-0000-0000-0000-000000000301',
        files: [
          {
            clientAttachmentId: 'valid',
            filename: 'evidence.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 12,
            sha256:
              '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
          },
          {
            clientAttachmentId: 'duplicate',
            filename: 'evidence.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 12,
          },
          {
            clientAttachmentId: 'empty',
            filename: 'empty.txt',
            mimeType: 'text/plain',
            sizeBytes: 0,
          },
          {
            clientAttachmentId: 'oversize',
            filename: 'oversize.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 26 * 1024 * 1024,
          },
          {
            clientAttachmentId: 'unsupported-mime',
            filename: 'payload.bin',
            mimeType: 'application/octet-stream',
            sizeBytes: 10,
          },
          {
            clientAttachmentId: 'disguised',
            filename: 'payload.exe',
            mimeType: 'application/pdf',
            sizeBytes: 10,
          },
        ],
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      clientAttachmentId: 'valid',
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      attachment: expect.objectContaining({
        originalFilename: 'evidence.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        status: 'pending_upload',
      }),
    });
    expect(result.errors.map((error) => error.code)).toEqual([
      'duplicate_file',
      'empty_file',
      'file_too_large',
      'unsupported_mime_type',
      'unsupported_extension',
    ]);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.chat_attachments'),
      expect.arrayContaining([
        workspaceId,
        '00000000-0000-0000-0000-000000000301',
        actor.id,
        'evidence.pdf',
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('2cf24dba5fb0a30e');

    fetchSpy.mockRestore();
  });

  it('blocks completing an attachment for a different thread before storage verification', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000701',
        workspace_id: workspaceId,
        thread_id: '00000000-0000-0000-0000-000000000399',
        message_id: null,
        run_id: null,
        original_filename: 'evidence.pdf',
        safe_filename: 'evidence.pdf',
        mime_type: 'application/pdf',
        size_bytes: 12,
        sha256: null,
        storage_bucket: 'chat-attachments-private',
        storage_path: 'workspaces/ws/chat/thread/evidence.pdf',
        status: 'pending_upload',
        metadata: {},
      }),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const service = new ChatThreadService(
      databaseService as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    await expect(
      service.completeAttachmentUpload(
        { actor, access },
        '00000000-0000-0000-0000-000000000701',
        {
          threadId: '00000000-0000-0000-0000-000000000301',
        },
      ),
    ).rejects.toMatchObject({ code: 'CHAT_ATTACHMENT_BLOCKED' });

    expect(databaseService.one).toHaveBeenCalledTimes(1);
    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it('searches only inside the requested project or global scope', async () => {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '00000000-0000-0000-0000-000000000501',
            workspace_id: workspaceId,
            project_id: 'project_claim_001',
            kind: 'project',
            visibility: 'project',
            status: 'active',
            title: 'Project scoped chat',
            last_message_preview: null,
            current_branch_id: null,
            created_by: actor.id,
            created_at: '2026-05-09T00:00:00.000Z',
            updated_at: '2026-05-09T00:00:00.000Z',
            archived_at: null,
            deleted_at: null,
            message_id: null,
            snippet: 'Project scoped chat',
            classification: null,
          },
        ],
      }),
      transaction: jest.fn(),
    };
    const service = new ChatThreadService(
      databaseService as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      new ChatStreamService(),
    );

    const result = await service.search(
      { actor, access },
      'project',
      'project_claim_001',
      'project',
    );

    expect(result.items[0]?.thread.projectId).toBe('project_claim_001');
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining("$4::text = 'project'"),
      [workspaceId, 'project', 'project_claim_001', 'project'],
    );
  });
});

function createDatabaseServiceMock(
  persistedParts: Array<{ readonly role: string; readonly text: string }>,
  persistedStreamJobs: Array<{
    readonly status: string;
    readonly messageId: unknown;
  }> = [],
  persistedStreamEvents: Array<{
    readonly eventType: string;
    readonly payload: string;
  }> = [],
) {
  let lastInsertedRole = 'user';
  let messageSequence = 0;

  const thread = {
    id: '00000000-0000-0000-0000-000000000301',
    workspace_id: workspaceId,
    project_id: 'project_claim_001',
    kind: 'project',
    visibility: 'project',
    status: 'active',
    title: 'Smoke chat',
    last_message_preview: null,
    current_branch_id: null,
    created_by: actor.id,
    created_at: '2026-05-09T00:00:00.000Z',
    updated_at: '2026-05-09T00:00:00.000Z',
    archived_at: null,
    deleted_at: null,
  };

  const client = {
    query: jest.fn((sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('insert into app.chat_messages')) {
        messageSequence += 1;
        lastInsertedRole = String(values[3]);
        return Promise.resolve({
          rows: [
            {
              id: `00000000-0000-0000-0000-00000000030${messageSequence + 1}`,
              thread_id: values[0],
              workspace_id: values[1],
              project_id: values[2],
              role: values[3],
              status: values[4],
              parent_message_id: values[5],
              client_message_id: values[6],
              branch_id: values[7],
              run_id: values[8],
              created_by: values[9],
              request_id: values[10],
              trace_id: values[11],
              created_at: '2026-05-09T00:00:00.000Z',
              updated_at: '2026-05-09T00:00:00.000Z',
            },
          ],
        });
      }

      if (sql.includes('insert into app.chat_message_parts')) {
        const text = String(values[4]);
        persistedParts.push({ role: lastInsertedRole, text });
        return Promise.resolve({
          rows: [
            {
              id: `part-${persistedParts.length}`,
              message_id: values[0],
              type: values[3],
              text,
              payload: {},
              sequence: 0,
            },
          ],
        });
      }

      if (sql.includes('update app.chat_messages')) {
        return Promise.resolve({
          rows: [
            {
              id: values[0],
              thread_id: values[2],
              workspace_id: values[1],
              project_id: 'project_claim_001',
              role: 'assistant',
              status: values[3],
              parent_message_id: '00000000-0000-0000-0000-000000000302',
              client_message_id: null,
              branch_id: null,
              run_id: null,
              created_by: actor.id,
              request_id: 'request-1',
              trace_id: 'trace-1',
              created_at: '2026-05-09T00:00:00.000Z',
              updated_at: '2026-05-09T00:00:00.000Z',
            },
          ],
        });
      }

      if (sql.includes('update app.chat_message_parts')) {
        const text = String(values[3]);
        const assistantPart = [...persistedParts]
          .reverse()
          .find((part) => part.role === 'assistant');
        if (assistantPart) {
          (assistantPart as { role: string; text: string }).text = text;
        }
        return Promise.resolve({
          rows: [
            {
              id: `part-${persistedParts.length}`,
              message_id: values[0],
              type: 'markdown',
              text,
              payload: {},
              sequence: 0,
            },
          ],
        });
      }

      if (sql.includes('insert into app.chat_stream_jobs')) {
        persistedStreamJobs.push({
          messageId: sql.includes('assistant_message_id')
            ? values[4]
            : values[3],
          status: sql.includes("'thinking'") ? 'thinking' : String(values[4]),
        });
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('update app.chat_stream_jobs')) {
        persistedStreamJobs.push({
          messageId: values[0],
          status: String(values[3]),
        });
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('insert into app.chat_stream_events')) {
        persistedStreamEvents.push({
          eventType: String(values[3]),
          payload: String(values[4]),
        });
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    }),
  };

  return {
    one: jest.fn((sql: string) => {
      if (sql.includes('from app.chat_threads')) {
        return Promise.resolve(thread);
      }
      return Promise.resolve(null);
    }),
    query: jest.fn((sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('update app.chat_stream_jobs')) {
        persistedStreamJobs.push({
          messageId: values[0],
          status: String(values[3]),
        });
      }
      return Promise.resolve({ rows: [] });
    }),
    transaction: jest.fn((callback: (tx: typeof client) => unknown) =>
      Promise.resolve(callback(client)),
    ),
  };
}
