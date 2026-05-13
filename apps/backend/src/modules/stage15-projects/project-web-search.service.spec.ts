import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { ProjectWebSearchService } from './project-web-search.service';

const actor: AuthenticatedActor = {
  id: 'usr_web_search',
  email: 'owner@lexframe.local',
  fullName: 'Web Search Owner',
  emailConfirmedAt: '2026-05-11T09:00:00.000Z',
  assuranceLevel: 'aal1',
  accessToken: 'dev.token',
  sessionId: 'sess_web_search',
};

const access: AccessContext = {
  activeWorkspace: {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'lexframe',
    name: 'LexFrame',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: ['chat.manage_project_context'],
};

const context: LexframeRequestState = { actor, access };

function createService() {
  const databaseService = {
    one: jest.fn(),
    query: jest.fn(),
  };
  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  databaseService.one.mockImplementation(
    (sql: string, values: readonly unknown[]) => {
      if (sql.includes('from app.projects')) {
        return Promise.resolve(
          values[1] === 'project_due_diligence'
            ? { id: 'project_due_diligence' }
            : null,
        );
      }

      if (sql.includes('insert into app.project_web_search_results')) {
        return Promise.resolve({
          id: 'web_result_1',
          workspace_id: access.activeWorkspace!.id,
          project_id: 'project_due_diligence',
          title: 'Result title',
          url: 'https://example.test/result',
          snippet: 'Short result summary',
          provider: 'tavily',
          score: 0.72,
          created_at: '2026-05-11T10:00:00.000Z',
        });
      }

      if (sql.includes('insert into app.project_knowledge_items')) {
        return Promise.resolve({ id: 'knowledge_1' });
      }

      return Promise.resolve(null);
    },
  );

  return {
    service: new ProjectWebSearchService(
      databaseService as never,
      auditService as never,
    ),
    databaseService,
    auditService,
  };
}

describe('ProjectWebSearchService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = {
      ...originalEnv,
      LEXFRAME_WEB_SEARCH_PROVIDER: 'tavily',
      LEXFRAME_TAVILY_API_KEY: 'tvly_secret_test',
      LEXFRAME_WEB_SEARCH_TIMEOUT_MS: '8000',
      LEXFRAME_WEB_SEARCH_MAX_RESULTS: '5',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('queries Tavily server-side, sanitizes results and never returns the key', async () => {
    const { service } = createService();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: '<b>Result title</b>',
              url: 'https://example.test/result#secret',
              content: 'Short result summary',
              score: 0.72,
            },
          ],
        }),
    } as Response);

    const response = await service.search(context, 'project_due_diligence', {
      query: 'contract dispute',
      saveResults: false,
    });

    expect(response.status).toBe('ok');
    expect(response.items[0]).toEqual(
      expect.objectContaining({
        title: 'Result title',
        url: 'https://example.test/result',
        snippet: 'Short result summary',
        sourceType: 'web_search_result',
      }),
    );
    expect(JSON.stringify(response)).not.toContain('tvly_secret_test');
  });

  it('persists selected web results as project knowledge when requested', async () => {
    const { service, databaseService } = createService();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            {
              title: 'Result title',
              url: 'https://example.test/result',
              content: 'Short result summary',
              score: 0.72,
            },
          ],
        }),
    } as Response);

    const response = await service.search(context, 'project_due_diligence', {
      query: 'contract dispute',
      saveResults: true,
    });

    expect(response.items[0]?.knowledgeItemId).toBe('knowledge_1');
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.project_web_search_results'),
      expect.arrayContaining([
        access.activeWorkspace!.id,
        'project_due_diligence',
        'tavily',
      ]),
    );
  });

  it('returns a safe unavailable response when Tavily is not configured', async () => {
    const { service } = createService();
    const fetchSpy = jest.spyOn(global, 'fetch');
    delete process.env.LEXFRAME_TAVILY_API_KEY;

    const response = await service.search(context, 'project_due_diligence', {
      query: 'contract dispute',
      saveResults: true,
    });

    expect(response).toEqual({
      provider: 'tavily',
      status: 'unconfigured',
      items: [],
      error: {
        code: 'provider_unconfigured',
        message: 'Web search provider is not configured.',
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
