import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { LegalSearchService } from './legal-search.service';

const actor: AuthenticatedActor = {
  id: 'usr_legal_search',
  email: 'legal-search@example.test',
  fullName: 'Legal Search',
  emailConfirmedAt: null,
  assuranceLevel: 'aal1',
  accessToken: 'test',
  sessionId: 'session-legal-search',
};

const access: AccessContext = {
  activeWorkspace: {
    id: 'ws_legal_search',
    slug: 'legal-search',
    name: 'Legal Search',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: ['legal_search.use'],
};

describe('LegalSearchService', () => {
  it('applies workspace ACL, returns safe citations and audits only search metadata', async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [searchRow()] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new LegalSearchService(
      databaseService as never,
      auditService as never,
    );

    const result = await service.query(
      actor,
      access,
      {
        query: 'поставка',
        mode: 'hybrid',
        selectedSourceIds: ['source_1'],
        limit: 5,
      },
      { requestId: 'req_search', traceId: 'trace_search' },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      source: expect.objectContaining({
        id: 'source_1',
        workspaceId: access.activeWorkspace!.id,
      }),
      citation: expect.objectContaining({
        citationId: 'cit_chunk_12',
        sourceId: 'source_1',
        title: 'Договор поставки',
      }),
    });
    expect(result.debug.aclApplied).toBe(true);
    expect(databaseService.query.mock.calls[0]?.[0]).toContain(
      'from app.legal_chunks c',
    );
    expect(databaseService.query.mock.calls[0]?.[0]).toContain(
      'inner join app.legal_sources s',
    );
    expect(databaseService.query.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([
        access.activeWorkspace!.id,
        actor.id,
        ['source_1'],
      ]),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'legal.search.performed',
        metadata: expect.objectContaining({
          queryHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          selectedSourceCount: 1,
        }),
      }),
    );
    expect(
      JSON.stringify(auditService.record.mock.calls[0]?.[0]?.metadata),
    ).not.toContain('поставка');
    expect(JSON.stringify(result)).not.toMatch(/api[_-]?key|Bearer/i);
    expect(JSON.stringify(auditService.record.mock.calls)).not.toMatch(
      /api[_-]?key|Bearer/i,
    );
  });

  it('does not persist raw legal search text in audit metadata', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new LegalSearchService(
      databaseService as never,
      auditService as never,
    );
    const sensitiveQuery = 'confidential merger memo raw prompt marker';

    await service.query(
      actor,
      access,
      {
        query: sensitiveQuery,
        mode: 'hybrid',
        selectedSourceIds: ['source_1'],
        limit: 5,
      },
      { requestId: 'req_search_redaction', traceId: 'trace_search_redaction' },
    );

    const metadata = auditService.record.mock.calls[0]?.[0]?.metadata;
    expect(metadata).toEqual(
      expect.objectContaining({
        queryHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        queryLength: sensitiveQuery.length,
        selectedSourceCount: 1,
      }),
    );
    expect(JSON.stringify(metadata)).not.toContain(sensitiveQuery);
    expect(metadata).not.toHaveProperty('query');
    expect(metadata).not.toHaveProperty('selectedSources');
  });

  it('requires active workspace context for legal search', async () => {
    const service = new LegalSearchService(
      { query: jest.fn() } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.query(
        actor,
        { ...access, activeWorkspace: null },
        { query: 'поставка', mode: 'keyword' },
        { requestId: null, traceId: null },
      ),
    ).rejects.toMatchObject({ code: 'WORKSPACE_CONTEXT_REQUIRED' });
  });
});

function searchRow() {
  return {
    source_id: 'source_1',
    workspace_id: access.activeWorkspace!.id,
    document_id: 'doc_1',
    source_type: 'court_decision',
    jurisdiction: 'ru',
    title: 'Договор поставки',
    canonical_url: 'https://example.test/cases/1',
    external_id: 'case-1',
    license_status: 'allowed',
    visibility: 'workspace_private',
    classification: 'client_material',
    status: 'indexed',
    owner_workspace_id: access.activeWorkspace!.id,
    owner_user_id: actor.id,
    source_metadata: {
      court: 'АС Москвы',
      caseNumber: 'А40-1/2026',
      decisionDate: '2026-05-01',
    },
    last_used_at: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    provider_id: 'provider_1',
    provider_code: 'workspace_upload',
    provider_name: 'Workspace upload',
    provider_type: 'workspace_private',
    provider_jurisdiction: 'ru',
    provider_access_mode: 'file_upload',
    provider_is_enabled: true,
    indexed_at: '2026-05-01T00:00:00.000Z',
    has_embeddings: true,
    chunk_id: 'chunk_12345678',
    document_version_id: 'docv_1',
    chunk_no: 1,
    chunk_type: 'paragraph',
    chunk_text:
      'Суд оценил договор поставки, сроки поставки и доказательства передачи товара.',
    text_hash: 'sha256:text',
    page_from: 1,
    page_to: 2,
    char_start: 0,
    char_end: 82,
    chunk_metadata: {},
    security_scope: 'workspace_private',
    embedding_model: 'text-embedding',
    embedding_hash: 'sha256:embedding',
  };
}
