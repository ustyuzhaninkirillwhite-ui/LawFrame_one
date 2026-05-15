import type {
  CreateRunArtifactRequest,
  DocumentDetail,
  DocumentUploadIntentRequest,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { documentDetailFixture } from '@lexframe/contracts';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const actor: AuthenticatedActor = {
    id: 'usr_stage2_owner',
    email: 'owner@lexframe.local',
    fullName: 'Owner User',
    emailConfirmedAt: '2026-04-21T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_stage2_owner',
  };

  type DocumentsServiceInternals = {
    issueSignedUrl(
      bucket: string,
      storagePath: string,
      expiresInSeconds: number,
    ): Promise<string>;
  };

  const access: AccessContext = {
    activeWorkspace: {
      id: 'ws_stage2_main',
      slug: 'stage2-main',
      name: 'Stage 2 Main',
      status: 'active',
      role: 'owner',
    },
    roles: ['owner'],
    permissions: [
      'document.read',
      'document.upload',
      'document.delete',
      'document.restore',
      'document.template.manage',
      'automation.run',
    ],
  };

  function createService() {
    const databaseService = {
      one: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const auditService = {
      record: jest.fn(),
    };
    const liveEventsService = {
      recordEvent: jest.fn(),
    };

    return {
      service: new DocumentsService(
        databaseService as never,
        auditService as never,
        liveEventsService as never,
      ),
      databaseService,
      auditService,
      liveEventsService,
    };
  }

  async function expectAppError(
    promise: Promise<unknown>,
    code: string,
    status: number,
  ) {
    try {
      await promise;
      throw new Error('Expected AppHttpException to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpException);
      expect((error as AppHttpException).code).toBe(code);
      expect((error as AppHttpException).getStatus()).toBe(status);
    }
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('creates an upload intent with a deterministic sanitized storage path', async () => {
    const { service, databaseService, auditService } = createService();
    const client = {
      query: jest.fn(),
    };
    const input: DocumentUploadIntentRequest = {
      title: 'Claim template',
      kind: 'document_template',
      classification: 'client_material',
      originalFilename: 'Claim Template FINAL.DOCX',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 120_000,
      tags: ['claim', 'template'],
    };

    databaseService.transaction.mockImplementation(
      async (callback: (clientArg: unknown) => Promise<void>) =>
        callback(client),
    );

    const result = await service.createUploadIntent(actor, access, input, {
      requestId: 'req_upload_intent',
      traceId: 'trace_upload_intent',
    });

    expect(result.bucket).toBe('documents-private');
    expect(result.storagePath).toMatch(
      /^workspace\/ws_stage2_main\/documents\/.+\/versions\/.+\/original\/claim-template-final\.docx$/,
    );
    expect(result.allowedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('falls back to client reported upload metadata for dev tokens', async () => {
    const { service, databaseService } = createService();

    databaseService.one.mockResolvedValue(null);

    const result = await (service as any).verifyUploadedObject(
      actor,
      'documents-private',
      'workspace/ws/documents/doc/versions/ver/original/demo.pdf',
      {
        clientReportedSize: 4096,
        clientReportedMimeType: 'application/pdf',
      },
    );

    expect(result).toEqual({
      mimeType: 'application/pdf',
      sizeBytes: 4096,
    });
  });

  it('validates uploaded file bytes and records only safe content metadata', async () => {
    const { service, databaseService, auditService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'docv_uploaded',
      document_id: 'doc_uploaded',
      storage_bucket: 'documents-private',
      storage_path:
        'workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/evidence.txt',
      status: 'upload_pending',
      mime_type: 'text/plain',
      original_filename: 'evidence.txt',
      size_bytes: 5,
      scan_status: 'queued',
      preview_status: 'queued',
      extraction_status: 'queued',
    });

    const result = await service.uploadVersionContent(
      actor,
      access,
      'doc_uploaded',
      'docv_uploaded',
      {
        contentBase64: 'aGVsbG8=',
        clientReportedMimeType: 'text/plain',
        clientReportedSize: 5,
      },
      {
        requestId: 'req_content',
        traceId: 'trace_content',
      },
    );

    expect(result).toEqual({
      sha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      sizeBytes: 5,
      mimeType: 'text/plain',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'document.version.content_received',
        metadata: expect.objectContaining({
          documentId: 'doc_uploaded',
          sizeBytes: 5,
          mimeType: 'text/plain',
          sha256:
            '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toContain(
      'aGVsbG8=',
    );
  });

  it('rejects content upload when reported size does not match received bytes', async () => {
    const { service, databaseService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'docv_uploaded',
      document_id: 'doc_uploaded',
      storage_bucket: 'documents-private',
      storage_path:
        'workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/evidence.txt',
      status: 'upload_pending',
      mime_type: 'text/plain',
      original_filename: 'evidence.txt',
      size_bytes: 6,
      scan_status: 'queued',
      preview_status: 'queued',
      extraction_status: 'queued',
    });

    await expectAppError(
      service.uploadVersionContent(
        actor,
        access,
        'doc_uploaded',
        'docv_uploaded',
        {
          contentBase64: 'aGVsbG8=',
          clientReportedMimeType: 'text/plain',
          clientReportedSize: 6,
        },
        {
          requestId: 'req_content',
          traceId: 'trace_content',
        },
      ),
      'DOCUMENT_UPLOAD_SIZE_MISMATCH',
      400,
    );
  });

  it('rejects content upload when reported metadata differs from the upload intent', async () => {
    const { service, databaseService, auditService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'docv_uploaded',
      document_id: 'doc_uploaded',
      storage_bucket: 'documents-private',
      storage_path:
        'workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/evidence.pdf',
      status: 'upload_pending',
      mime_type: 'application/pdf',
      original_filename: 'evidence.pdf',
      size_bytes: 5,
      scan_status: 'queued',
      preview_status: 'queued',
      extraction_status: 'queued',
    });

    await expectAppError(
      service.uploadVersionContent(
        actor,
        access,
        'doc_uploaded',
        'docv_uploaded',
        {
          contentBase64: 'aGVsbG8=',
          clientReportedMimeType: 'text/plain',
          clientReportedSize: 5,
        },
        {
          requestId: 'req_mismatch',
          traceId: 'trace_mismatch',
        },
      ),
      'DOCUMENT_UPLOAD_METADATA_MISMATCH',
      400,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects upload completion before document content is received', async () => {
    const { service, databaseService, auditService } = createService();

    databaseService.one.mockResolvedValueOnce({
      id: 'docv_pending',
      document_id: 'doc_pending',
      storage_bucket: 'documents-private',
      storage_path:
        'workspace/ws/documents/doc_pending/versions/docv_pending/original/evidence.pdf',
      status: 'upload_pending',
      mime_type: 'application/pdf',
      original_filename: 'evidence.pdf',
      size_bytes: 5,
      scan_status: 'queued',
      preview_status: 'queued',
      extraction_status: 'queued',
    });
    jest.spyOn(service as any, 'verifyUploadedObject').mockResolvedValue({
      mimeType: 'application/pdf',
      sizeBytes: 5,
    });

    await expectAppError(
      service.completeUpload(
        actor,
        access,
        'doc_pending',
        'docv_pending',
        {
          clientReportedSize: 5,
          clientReportedMimeType: 'application/pdf',
          sha256:
            '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
        },
        {
          requestId: 'req_complete_before_content',
          traceId: 'trace_complete_before_content',
        },
      ),
      'DOCUMENT_UPLOAD_NOT_READY',
      409,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects unsafe document upload intent metadata before creating storage rows', async () => {
    const { service, databaseService } = createService();
    const baseInput: DocumentUploadIntentRequest = {
      title: 'Unsafe upload',
      kind: 'case_material',
      classification: 'client_material',
      originalFilename: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      tags: [],
    };

    await expectAppError(
      service.createUploadIntent(
        actor,
        access,
        { ...baseInput, sizeBytes: 0 },
        { requestId: 'req_empty', traceId: 'trace_empty' },
      ),
      'VALIDATION_ERROR',
      400,
    );
    await expectAppError(
      service.createUploadIntent(
        actor,
        access,
        {
          ...baseInput,
          originalFilename: '../payload.pdf',
        },
        { requestId: 'req_path', traceId: 'trace_path' },
      ),
      'VALIDATION_ERROR',
      400,
    );
    await expectAppError(
      service.createUploadIntent(
        actor,
        access,
        {
          ...baseInput,
          originalFilename: 'payload.exe',
          mimeType: 'application/pdf',
        },
        { requestId: 'req_disguised', traceId: 'trace_disguised' },
      ),
      'VALIDATION_ERROR',
      400,
    );
    await expectAppError(
      service.createUploadIntent(
        actor,
        access,
        {
          ...baseInput,
          originalFilename: 'payload.bin',
          mimeType: 'application/octet-stream',
        },
        { requestId: 'req_mime', traceId: 'trace_mime' },
      ),
      'UNSUPPORTED_MIME_TYPE',
      400,
    );

    expect(databaseService.transaction).not.toHaveBeenCalled();
  });

  it('rejects non-canonical document content base64 without auditing raw content', async () => {
    const { service, databaseService, auditService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'docv_uploaded',
      document_id: 'doc_uploaded',
      storage_bucket: 'documents-private',
      storage_path:
        'workspace/ws/documents/doc_uploaded/versions/docv_uploaded/original/evidence.txt',
      status: 'upload_pending',
      mime_type: 'text/plain',
      original_filename: 'evidence.txt',
      size_bytes: 10,
      scan_status: 'queued',
      preview_status: 'queued',
      extraction_status: 'queued',
    });

    await expectAppError(
      service.uploadVersionContent(
        actor,
        access,
        'doc_uploaded',
        'docv_uploaded',
        {
          contentBase64: 'not valid base64',
          clientReportedMimeType: 'text/plain',
          clientReportedSize: 10,
        },
        {
          requestId: 'req_bad_content',
          traceId: 'trace_bad_content',
        },
      ),
      'DOCUMENT_UPLOAD_CONTENT_INVALID',
      400,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('creates run artifacts after the document version exists and only then marks it current', async () => {
    const { service, databaseService, auditService, liveEventsService } =
      createService();
    const client = {
      query: jest.fn().mockResolvedValue(undefined),
    };
    const input: CreateRunArtifactRequest = {
      artifactType: 'draft_document',
      title: 'Generated draft',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      source: 'automation_result',
      classification: 'client_material',
    };

    databaseService.transaction.mockImplementation(
      async (callback: (clientArg: unknown) => Promise<void>) =>
        callback(client),
    );

    await service.createRunArtifact(actor, access, 'run_stage4_demo', input, {
      requestId: 'req_run_artifact',
      traceId: 'trace_run_artifact',
    });

    expect(client.query).toHaveBeenCalled();
    expect(client.query.mock.calls[0]?.[0]).toContain(
      'insert into app.documents',
    );
    expect(client.query.mock.calls[1]?.[0]).toContain(
      'insert into app.document_versions',
    );
    expect(client.query.mock.calls[2]?.[0]).toContain('update app.documents');
    expect(client.query.mock.calls[3]?.[0]).toContain(
      'insert into app.run_artifacts',
    );
    expect(auditService.record).toHaveBeenCalledTimes(1);
    expect(liveEventsService.recordEvent).toHaveBeenCalledTimes(1);
  });

  it('restores a document back to upload_pending when no current version exists', async () => {
    const { service, databaseService, auditService } = createService();

    databaseService.one.mockResolvedValue({
      id: 'doc_restore',
      workspace_id: access.activeWorkspace!.id,
      title: 'Restore target',
      kind: 'case_material',
      classification: 'confidential',
      current_version_id: null,
      deleted_at: '2026-04-21T09:00:00.000Z',
    });
    databaseService.query.mockResolvedValue(undefined);

    const result = await service.restore(actor, access, 'doc_restore', {
      requestId: 'req_restore',
      traceId: 'trace_restore',
    });

    expect(result).toEqual({
      status: 'restored',
      documentId: 'doc_restore',
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('update app.documents'),
      ['doc_restore', access.activeWorkspace!.id, 'upload_pending'],
    );
    expect(auditService.record).toHaveBeenCalledTimes(1);
  });

  it('blocks signed URL issuance for infected versions', async () => {
    const { service, auditService } = createService();
    const infectedDetail: DocumentDetail = {
      ...documentDetailFixture,
      status: 'ready',
      deletedAt: null,
      currentVersion: {
        ...documentDetailFixture.currentVersion!,
        id: 'docv_infected',
        scanStatus: 'infected',
      },
      versions: [
        {
          ...documentDetailFixture.currentVersion!,
          id: 'docv_infected',
          scanStatus: 'infected',
        },
      ],
    };

    jest.spyOn(service as any, 'getDetail').mockResolvedValue(infectedDetail);

    await expectAppError(
      service.createSignedUrl(
        actor,
        access,
        documentDetailFixture.id,
        {
          objectRole: 'original',
          purpose: 'download',
        },
        {
          requestId: 'req_signed_url',
          traceId: 'trace_signed_url',
        },
      ),
      'VIRUS_DETECTED',
      409,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('blocks signed URL issuance for archived documents', async () => {
    const { service, auditService } = createService();
    const archivedDetail: DocumentDetail = {
      ...documentDetailFixture,
      status: 'archived',
      archivedAt: '2026-04-22T09:00:00.000Z',
      deletedAt: null,
      currentVersion: {
        ...documentDetailFixture.currentVersion!,
        id: 'docv_archived',
        scanStatus: 'clean',
      },
      versions: [
        {
          ...documentDetailFixture.currentVersion!,
          id: 'docv_archived',
          scanStatus: 'clean',
        },
      ],
    };

    jest.spyOn(service as any, 'getDetail').mockResolvedValue(archivedDetail);

    await expectAppError(
      service.createSignedUrl(
        actor,
        access,
        documentDetailFixture.id,
        {
          objectRole: 'original',
          purpose: 'download',
        },
        {
          requestId: 'req_signed_url_archived',
          traceId: 'trace_signed_url_archived',
        },
      ),
      'DOCUMENT_STATE_INVALID',
      409,
    );

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('clamps signed URL ttl and keeps the full URL out of audit metadata', async () => {
    const { service, auditService } = createService();
    const detail: DocumentDetail = {
      ...documentDetailFixture,
      status: 'ready',
      archivedAt: null,
      deletedAt: null,
      currentVersion: {
        ...documentDetailFixture.currentVersion!,
        id: 'docv_ready',
        scanStatus: 'clean',
      },
      versions: [
        {
          ...documentDetailFixture.currentVersion!,
          id: 'docv_ready',
          scanStatus: 'clean',
        },
      ],
    };
    const issueSignedUrl = jest
      .spyOn(service as any, 'issueSignedUrl')
      .mockResolvedValue('https://storage.lexframe.local/signed/demo');

    jest.spyOn(service as any, 'getDetail').mockResolvedValue(detail);
    jest
      .spyOn(service as any, 'loadDocumentSecurityLabel')
      .mockResolvedValue(null);
    jest
      .spyOn(service as any, 'isWorkspaceIncidentLocked')
      .mockResolvedValue(false);
    jest.spyOn(service as any, 'loadSignedUrlTarget').mockResolvedValue({
      bucket: 'documents-private',
      objectPath: 'workspace/ws/documents/doc/versions/ver/original/demo.pdf',
    });

    const result = await service.createSignedUrl(
      actor,
      access,
      detail.id,
      {
        versionId: 'docv_ready',
        objectRole: 'preview_pdf',
        purpose: 'preview',
        expiresInSeconds: 9999,
      },
      {
        requestId: 'req_signed_url_clamp',
        traceId: 'trace_signed_url_clamp',
      },
    );

    expect(issueSignedUrl).toHaveBeenCalledWith(
      'documents-private',
      'workspace/ws/documents/doc/versions/ver/original/demo.pdf',
      300,
    );
    expect(result.ttlSeconds).toBe(300);

    const auditPayload = auditService.record.mock.calls[0]?.[0];
    expect(auditPayload?.metadata).toEqual(
      expect.objectContaining({
        versionId: 'docv_ready',
        objectRole: 'preview_pdf',
        ttlSeconds: 300,
        reasonLogged: false,
      }),
    );
    expect(auditPayload?.metadata).not.toHaveProperty('signedUrl');
    expect(auditPayload?.metadata).not.toHaveProperty('fullUrl');
  });

  it('fails instead of returning a demo signed URL when the storage signer is unavailable', async () => {
    const { service } = createService();

    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('signer unavailable'));

    await expectAppError(
      (service as unknown as DocumentsServiceInternals).issueSignedUrl(
        'documents-private',
        'workspace/ws/documents/doc/versions/ver/original/demo.pdf',
        120,
      ),
      'READINESS_GATE_BLOCKED',
      503,
    );
  });
});
