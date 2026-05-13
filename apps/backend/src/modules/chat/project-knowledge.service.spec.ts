import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { ProjectKnowledgeService } from './project-knowledge.service';

const actor: AuthenticatedActor = {
  id: 'usr_project_owner',
  email: 'owner@lexframe.local',
  fullName: 'Project Owner',
  emailConfirmedAt: '2026-05-11T09:00:00.000Z',
  assuranceLevel: 'aal1',
  accessToken: 'dev.token',
  sessionId: 'sess_project_owner',
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
  permissions: ['chat.view', 'chat.manage_project_context'],
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
        const projectId = values[1];
        return Promise.resolve(
          projectId === 'project_due_diligence'
            ? { id: 'project_due_diligence' }
            : null,
        );
      }

      if (sql.includes('insert into app.project_knowledge_items')) {
        return Promise.resolve({
          id: 'knowledge_1',
          workspace_id: access.activeWorkspace!.id,
          project_id: values[1],
          source_type: values[2],
          source_id: values[3],
          mode: values[4],
          classification: values[5],
          pinned: values[6],
          enabled_for_chat: values[7],
          citation_required: values[8],
          title: null,
          summary: null,
          url: null,
          created_at: '2026-05-11T10:00:00.000Z',
          updated_at: '2026-05-11T10:00:00.000Z',
        });
      }

      return Promise.resolve(null);
    },
  );
  databaseService.query.mockResolvedValue({
    rows: [
      {
        id: 'knowledge_web_1',
        workspace_id: access.activeWorkspace!.id,
        project_id: 'project_due_diligence',
        source_type: 'web_search_result',
        source_id: 'web_1',
        mode: 'reference_only',
        classification: 'public',
        pinned: false,
        enabled_for_chat: true,
        citation_required: true,
        title: 'External source',
        summary: 'Sanitized result summary',
        url: 'https://example.test/source',
        created_at: '2026-05-11T10:00:00.000Z',
        updated_at: '2026-05-11T10:00:00.000Z',
      },
    ],
  });

  return {
    service: new ProjectKnowledgeService(
      databaseService as never,
      auditService as never,
    ),
    databaseService,
    auditService,
  };
}

describe('ProjectKnowledgeService', () => {
  it('allows project knowledge for any project in the active workspace', async () => {
    const { service } = createService();

    const result = await service.list(context, 'project_due_diligence');

    expect(result.items).toEqual([
      expect.objectContaining({
        projectId: 'project_due_diligence',
        sourceType: 'web_search_result',
        title: 'External source',
        summary: 'Sanitized result summary',
        url: 'https://example.test/source',
      }),
    ]);
  });

  it('rejects project knowledge for a project outside the active workspace', async () => {
    const { service } = createService();

    await expect(
      service.list(context, 'project_other_workspace'),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_ACCESS_DENIED',
    } satisfies Partial<AppHttpException>);
  });

  it('creates project knowledge on non-default projects', async () => {
    const { service, auditService } = createService();

    const result = await service.create(context, 'project_due_diligence', {
      sourceType: 'web_search_result',
      sourceId: 'web_1',
      mode: 'reference_only',
      classification: 'public',
      pinned: false,
      enabledForChat: true,
      citationRequired: true,
    });

    expect(result.projectId).toBe('project_due_diligence');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'chat.context.item.added',
        metadata: expect.objectContaining({
          project_id: 'project_due_diligence',
        }),
      }),
    );
  });
});
