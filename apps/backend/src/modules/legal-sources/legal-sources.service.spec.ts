import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { LegalSourcesService } from './legal-sources.service';

const actor: AuthenticatedActor = {
  id: 'usr_legal_sources',
  email: 'legal-sources@example.test',
  fullName: 'Legal Sources',
  emailConfirmedAt: null,
  assuranceLevel: 'aal1',
  accessToken: 'test',
  sessionId: 'session-legal-sources',
};

const access: AccessContext = {
  activeWorkspace: {
    id: 'ws_legal_sources',
    slug: 'legal-sources',
    name: 'Legal Sources',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: ['legal_search.use', 'legal_sources.manage', 'legal_rag.use'],
};

describe('LegalSourcesService', () => {
  it('lists only accessible source rows and maps safe provider/citation metadata', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rows: [sourceRow()] }),
      one: jest.fn(),
    };
    const service = new LegalSourcesService(
      databaseService as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    const result = await service.listSources(actor, access);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'source_1',
        workspaceId: access.activeWorkspace!.id,
        title: 'Court source',
        court: 'АС Москвы',
        caseNumber: 'А40-1/2026',
        provider: expect.objectContaining({
          code: 'workspace_upload',
          accessMode: 'file_upload',
        }),
      }),
    ]);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('from app.legal_sources s'),
      [access.activeWorkspace!.id, actor.id],
    );
    expect(JSON.stringify(result)).not.toContain('api_key');
  });

  it('returns a controlled not-found error for cross-workspace source detail', async () => {
    const databaseService = {
      query: jest.fn(),
      one: jest.fn().mockResolvedValue(null),
    };
    const auditService = { record: jest.fn() };
    const service = new LegalSourcesService(
      databaseService as never,
      auditService as never,
      {} as never,
    );

    await expect(
      service.getSourceDetail(actor, access, 'source_foreign'),
    ).rejects.toMatchObject({ code: 'LEGAL_SOURCE_NOT_FOUND' });
    expect(auditService.record).not.toHaveBeenCalled();
  });
});

function sourceRow() {
  return {
    source_id: 'source_1',
    workspace_id: access.activeWorkspace!.id,
    document_id: 'doc_1',
    source_type: 'court_decision',
    jurisdiction: 'ru',
    title: 'Court source',
    canonical_url: 'https://example.test/cases/1',
    external_id: 'case-1',
    license_status: 'allowed',
    visibility: 'workspace_private',
    classification: 'client_material',
    status: 'indexed',
    owner_workspace_id: access.activeWorkspace!.id,
    owner_user_id: actor.id,
    metadata: {
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
  };
}
