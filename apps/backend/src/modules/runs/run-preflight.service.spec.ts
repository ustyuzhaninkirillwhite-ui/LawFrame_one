jest.mock('../activepieces/activepieces.service', () => ({
  ActivepiecesService: class ActivepiecesService {},
}));

import { RunErrorClassifierService } from './run-error-classifier.service';
import { RunPreflightService } from './run-preflight.service';

describe('RunPreflightService automation/run backend contracts', () => {
  const access = {
    activeWorkspace: {
      id: 'workspace_001',
      slug: 'workspace',
      name: 'Workspace',
      role: 'owner',
      status: 'active',
    },
    roles: ['owner'],
    permissions: ['automation.run'],
  } as never;

  it('blocks a dry-run/start preflight when runtime mapping is missing', async () => {
    const databaseService = {
      one: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'automation_001',
          title: 'Claim workflow',
          required_inputs: [],
          active_canvas_version_id: 'canvas_version_active',
          production_disabled_at: null,
          production_disabled_reason: null,
        })
        .mockResolvedValueOnce(null),
    };
    const activepiecesService = {
      getAutomationRuntimeRequirements: jest.fn().mockResolvedValue({
        canRun: true,
        syncState: 'synced',
        missingConnections: [],
        warnings: [],
      }),
    };
    const service = new RunPreflightService(
      databaseService as never,
      activepiecesService as never,
    );

    const report = await service.preflight(access, 'automation_001', {
      mode: 'dry_run',
      inputs: {},
    } as never);

    expect(report.canStart).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'canvas.version.binding',
          status: 'blocked',
          message:
            'Runtime binding does not point to the active Canvas version.',
        }),
      ]),
    );
    expect(report.summary).toBe('Preflight blocked for Claim workflow.');
    expect(JSON.stringify(report)).not.toContain('apiKey');
  });

  it('blocks execution when required document/profile inputs are absent', async () => {
    const databaseService = {
      one: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'automation_002',
          title: 'Document workflow',
          required_inputs: ['documentIds', 'profileId'],
          active_canvas_version_id: 'canvas_version_active',
          production_disabled_at: null,
          production_disabled_reason: null,
        })
        .mockResolvedValueOnce({
          automation_version_id: 'canvas_version_active',
          runtime_projection_id: 'runtime_projection_001',
          status: 'active',
        }),
    };
    const activepiecesService = {
      getAutomationRuntimeRequirements: jest.fn().mockResolvedValue({
        canRun: true,
        syncState: 'synced',
        missingConnections: [],
        warnings: [],
      }),
    };
    const service = new RunPreflightService(
      databaseService as never,
      activepiecesService as never,
    );

    const report = await service.preflight(access, 'automation_002', {
      mode: 'dry_run',
      inputs: {},
    } as never);

    expect(report.canStart).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'input.documents',
          status: 'blocked',
        }),
        expect.objectContaining({
          code: 'input.profile',
          status: 'blocked',
        }),
      ]),
    );
  });

  it('returns a controlled not-found error for cross-workspace automation ids', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue(null),
    };
    const service = new RunPreflightService(
      databaseService as never,
      { getAutomationRuntimeRequirements: jest.fn() } as never,
    );

    await expect(
      service.preflight(access, 'automation_other_workspace', {
        mode: 'dry_run',
      } as never),
    ).rejects.toMatchObject({
      code: 'AUTOMATION_NOT_FOUND',
    });
  });
});

describe('RunErrorClassifierService controlled failure contracts', () => {
  it('marks transient provider/runtime failures retryable without leaking raw details', () => {
    const service = new RunErrorClassifierService();

    expect(
      service.classify({
        code: ' TIMEOUT ',
        message: null,
      }),
    ).toMatchObject({
      code: 'timeout',
      retryable: true,
    });
    expect(
      service.classify({
        code: 'provider_secret_invalid',
        message: 'Provider failed',
      }),
    ).toMatchObject({
      code: 'provider_secret_invalid',
      retryable: false,
      userMessage: 'Provider failed',
    });
  });
});
