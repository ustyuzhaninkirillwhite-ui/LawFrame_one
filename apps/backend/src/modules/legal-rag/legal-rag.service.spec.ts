import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { LegalRagService } from './legal-rag.service';

const actor: AuthenticatedActor = {
  id: 'usr_legal_rag',
  email: 'legal-rag@example.test',
  fullName: 'Legal RAG',
  emailConfirmedAt: null,
  assuranceLevel: 'aal1',
  accessToken: 'test',
  sessionId: 'session-legal-rag',
};

const access: AccessContext = {
  activeWorkspace: {
    id: 'ws_legal_rag',
    slug: 'legal-rag',
    name: 'Legal RAG',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: ['legal_rag.use', 'legal_search.use'],
};

describe('LegalRagService', () => {
  it('persists and audits a blocked RAG request without calling the provider', async () => {
    const requestRows: Array<{
      readonly requestId: string;
      readonly question: string;
      readonly classification: string;
      readonly status: string;
    }> = [];
    const databaseService = {
      query: jest.fn((sql: string, values: readonly unknown[]) => {
        if (sql.includes('insert into app.rag_requests')) {
          requestRows.push({
            requestId: String(values[0]),
            question: String(values[4]),
            classification: String(values[9]),
            status: String(values[10]),
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      one: jest.fn((sql: string, values: readonly unknown[]) => {
        if (sql.includes('from app.rag_requests')) {
          const row = requestRows.find((item) => item.requestId === values[0]);
          return Promise.resolve({
            id: row?.requestId ?? 'rag_blocked',
            workspace_id: access.activeWorkspace!.id,
            user_id: actor.id,
            task_type: 'case_analysis',
            question: row?.question ?? 'Какая позиция по делу?',
            query_hash: 'sha256:query',
            selected_source_ids: [],
            selected_document_ids: [],
            ai_route: 'rag_legal_summary',
            data_classification: row?.classification ?? 'public',
            status: row?.status ?? 'blocked',
            created_at: '2026-05-13T00:00:00.000Z',
            updated_at: '2026-05-13T00:00:00.000Z',
            completed_at: null,
          });
        }

        if (sql.includes('from app.rag_outputs')) {
          return Promise.resolve(null);
        }

        return Promise.resolve(null);
      }),
    };
    const auditService = { record: jest.fn().mockResolvedValue(undefined) };
    const aiGatewayService = {
      planStructuredRoute: jest.fn().mockResolvedValue({
        route: 'rag_legal_summary',
        provider: 'cometapi',
        model: 'deepseek-v4-flash',
        blocked: true,
        blockedReasonCode: 'DATA_POLICY_BLOCKED',
        blockedMessage: 'Route blocked by data policy.',
      }),
      generateStructured: jest.fn(),
    };
    const legalSearchService = {
      loadContextCandidates: jest.fn().mockResolvedValue([]),
    };
    const service = new LegalRagService(
      databaseService as never,
      auditService as never,
      aiGatewayService as never,
      legalSearchService as never,
    );

    const result = await service.analyze(
      actor,
      access,
      {
        taskType: 'case_analysis',
        question: 'Какая позиция по делу?',
        sourceSelection: {
          mode: 'search_only',
          searchQuery: 'позиция по делу',
        },
        options: {
          requireCitations: true,
          includeUnsupportedClaims: true,
          maxContextChunks: 4,
        },
      },
      { requestId: 'req_rag', traceId: 'trace_rag' },
    );

    expect(result.status).toBe('blocked');
    expect(aiGatewayService.generateStructured).not.toHaveBeenCalled();
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.rag_requests'),
      expect.arrayContaining([
        access.activeWorkspace!.id,
        actor.id,
        'case_analysis',
        'Какая позиция по делу?',
        expect.any(String),
        '[]',
        '[]',
        'rag_legal_summary',
        'public',
        'blocked',
      ]),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_route_blocked',
        result: 'denied',
        metadata: expect.objectContaining({
          reasonCode: 'DATA_POLICY_BLOCKED',
          classification: 'public',
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls)).not.toMatch(
      /api[_-]?key|Bearer|sk-/i,
    );
  });
});
