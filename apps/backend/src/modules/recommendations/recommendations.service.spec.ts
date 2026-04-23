import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService', () => {
  const actor: AuthenticatedActor = {
    id: 'usr_recommendation_owner',
    email: 'owner@lexframe.local',
    fullName: 'Recommendation Owner',
    emailConfirmedAt: '2026-04-22T09:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'dev.token',
    sessionId: 'sess_recommendation_owner',
  };

  const access: AccessContext = {
    activeWorkspace: {
      id: 'ws_recommendation_main',
      slug: 'recommendation-main',
      name: 'Recommendation Main',
      status: 'active',
      role: 'owner',
    },
    roles: ['owner'],
    permissions: ['recommendation.manage'],
  };

  function createService() {
    const aiGatewayService = {};
    const auditService = {};
    const databaseService = {
      query: jest.fn(),
      one: jest.fn(),
    };
    const notificationsService = {};
    const telemetryService = {};

    return {
      service: new RecommendationsService(
        aiGatewayService as never,
        auditService as never,
        databaseService as never,
        notificationsService as never,
        telemetryService as never,
      ),
      databaseService,
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

  it('blocks recommendation listing when stage9 relations are missing', async () => {
    const { service, databaseService } = createService();

    databaseService.query.mockRejectedValue({
      code: '42P01',
    });

    await expectAppError(
      service.list(actor, access),
      'READINESS_GATE_BLOCKED',
      503,
    );
  });

  it('returns an empty recommendation list when analytics tables are ready but empty', async () => {
    const { service, databaseService } = createService();

    databaseService.query.mockResolvedValue({
      rows: [],
    });

    await expect(service.list(actor, access)).resolves.toEqual([]);
  });
});
