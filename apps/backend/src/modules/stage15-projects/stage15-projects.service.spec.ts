import type {
  AccessContext,
  AuthenticatedActor,
  LexframeRequestState,
} from '../../common/types/lexframe-request';
import { Stage15ProjectsService } from './stage15-projects.service';

const actor: AuthenticatedActor = {
  id: 'usr_stage15_owner',
  email: 'owner@lexframe.local',
  fullName: 'Stage 15 Owner',
  emailConfirmedAt: '2026-04-23T09:00:00.000Z',
  assuranceLevel: 'aal1',
  accessToken: 'dev.token',
  sessionId: 'sess_stage15_owner',
};

const access: AccessContext = {
  activeWorkspace: {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'lexframe',
    name: 'LexFrame Workspace',
    status: 'active',
    role: 'owner',
  },
  roles: ['owner'],
  permissions: ['workspace.read', 'workspace.update', 'chat.create'],
};

const context: LexframeRequestState = { actor, access };

const defaultProjectRow = {
  id: 'project_claim_001',
  workspace_id: access.activeWorkspace!.id,
  name: 'LexFrame Workspace',
  description: 'Default project',
  icon: 'L',
  color: '#3B82F6',
  status: 'active',
  owner_user_id: actor.id,
  created_at: '2026-05-08T08:00:00.000Z',
  updated_at: '2026-05-08T08:00:00.000Z',
};

const secondProjectRow = {
  id: 'project_due_diligence',
  workspace_id: access.activeWorkspace!.id,
  name: 'Due diligence',
  description: 'Materials and chat for diligence.',
  icon: 'D',
  color: '#0F766E',
  status: 'active',
  owner_user_id: actor.id,
  created_at: '2026-05-08T08:10:00.000Z',
  updated_at: '2026-05-08T08:10:00.000Z',
};

function createService() {
  const automationLibraryService = {
    listInstalled: jest.fn().mockResolvedValue([]),
  };
  const activepiecesCanvasProvisioningService = {
    ensureStage17Canvas: jest.fn(),
  };
  const dashboardService = {
    getSnapshot: jest.fn().mockResolvedValue({
      activeRuns: [],
      failedRuns: [],
      pendingApprovals: [],
      recommendations: [],
      systemStatus: {
        overall: 'healthy',
        summary: 'ok',
        checkedAt: '2026-05-08T08:00:00.000Z',
        incidentsOpen: 0,
        components: [],
      },
      generatedAt: '2026-05-08T08:00:00.000Z',
    }),
  };
  const databaseService = {
    one: jest.fn(),
    query: jest.fn(),
  };
  const chatThreadService = {
    listProjectThreads: jest.fn().mockResolvedValue({ items: [] }),
    createProjectChatForStage15: jest.fn(),
  };

  databaseService.one.mockImplementation(
    (sql: string, values: readonly unknown[]) => {
      if (
        sql.includes('insert into app.projects') &&
        values[1] === 'project_claim_001'
      ) {
        return Promise.resolve(defaultProjectRow);
      }

      if (sql.includes('insert into app.projects')) {
        return Promise.resolve({
          ...secondProjectRow,
          id: 'project_generated_001',
          name: values[1],
          description: values[2] ?? '',
          icon: values[3] ?? 'P',
          color: values[4] ?? '#3B82F6',
        });
      }

      if (
        sql.includes('from app.projects') &&
        values[1] === 'project_due_diligence'
      ) {
        return Promise.resolve(secondProjectRow);
      }

      if (
        sql.includes('from app.projects') &&
        values[1] === 'project_claim_001'
      ) {
        return Promise.resolve(defaultProjectRow);
      }

      if (sql.includes('count(*)::text')) {
        return Promise.resolve({ count: '0' });
      }

      return Promise.resolve(null);
    },
  );

  databaseService.query.mockImplementation((sql: string) => {
    if (sql.includes('from app.projects')) {
      return Promise.resolve({ rows: [defaultProjectRow, secondProjectRow] });
    }

    return Promise.resolve({ rows: [] });
  });

  return {
    service: new Stage15ProjectsService(
      automationLibraryService as never,
      activepiecesCanvasProvisioningService as never,
      dashboardService as never,
      databaseService as never,
      chatThreadService as never,
    ),
    automationLibraryService,
    dashboardService,
    databaseService,
    chatThreadService,
  };
}

describe('Stage15ProjectsService project registry', () => {
  it('lists the default project together with projects stored for the workspace', async () => {
    const { service } = createService();

    const response = await service.listProjects(context);

    expect(response.items.map((project) => project.id)).toEqual([
      'project_claim_001',
      'project_due_diligence',
    ]);
  });

  it('creates a workspace project and returns a Stage15 project summary', async () => {
    const { service, databaseService } = createService();

    const response = await service.createProject(context, {
      name: 'New litigation project',
      description: 'Claim preparation',
      color: '#2563EB',
    });

    expect(response.project).toMatchObject({
      id: 'project_generated_001',
      name: 'New litigation project',
      description: 'Claim preparation',
      color: '#2563EB',
      status: 'active',
    });
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('insert into app.projects'),
      expect.arrayContaining([
        access.activeWorkspace!.id,
        'New litigation project',
        'Claim preparation',
        '#2563EB',
        actor.id,
      ]),
    );
  });

  it('keeps project_claim_001 available for legacy Stage 17-21 routes', async () => {
    const { service } = createService();

    const project = await service.getProject(context, 'project_claim_001');

    expect(project.id).toBe('project_claim_001');
    expect(project.name).toBe('LexFrame Workspace');
  });

  it('loads project detail expensive dependencies once', async () => {
    const {
      service,
      automationLibraryService,
      dashboardService,
      chatThreadService,
    } = createService();

    await service.getProject(context, 'project_claim_001');

    expect(automationLibraryService.listInstalled).toHaveBeenCalledTimes(1);
    expect(dashboardService.getSnapshot).toHaveBeenCalledTimes(1);
    expect(chatThreadService.listProjectThreads).toHaveBeenCalledTimes(1);
  });
});
