import type {
  CanvasOperationRequest,
  LexFrameWorkflowV2,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { CanvasOperationService } from './canvas-operation.service';

describe('CanvasOperationService', () => {
  const actor: AuthenticatedActor = {
    id: 'user_editor',
    email: 'editor@example.com',
    fullName: 'Editor',
    emailConfirmedAt: '2026-04-24T00:00:00.000Z',
    assuranceLevel: 'aal1',
    accessToken: 'token',
    sessionId: 'session',
  };
  const access: AccessContext = {
    activeWorkspace: { id: 'workspace_1', name: 'Workspace' } as never,
    roles: ['lawyer'],
    permissions: ['canvas.view', 'canvas.edit'],
  };

  it('rejects edit batches before opening a transaction when no draft lock is held', async () => {
    const databaseService = {
      transaction: jest.fn(),
    };
    const draftService = {
      getDraftForMutation: jest.fn().mockResolvedValue({
        id: 'draft_1',
        workflow: makeWorkflow(),
        workflow_hash: 'hash_1',
        revision_counter: 1,
      }),
    };
    const lockService = {
      assertLockHeld: jest
        .fn()
        .mockRejectedValue(
          new AppHttpException(
            'CANVAS_LOCK_REQUIRED',
            423,
            'Canvas edit lock is required.',
          ),
        ),
    };
    const service = new CanvasOperationService(
      databaseService as never,
      draftService as never,
      { fastValidate: jest.fn() } as never,
      lockService as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { recordProductEvent: jest.fn() } as never,
      {} as never,
    );
    const input: CanvasOperationRequest = {
      draft_id: 'draft_1',
      expected_revision: 1,
      base_hash: 'hash_1',
      operations: [
        {
          client_operation_id: 'op_1',
          operation_type: 'UPDATE_LAYOUT',
          operation_payload: { auto_arrange: true },
        },
      ],
    };

    await expect(
      service.applyOperations(actor, access, 'automation_1', input, {
        requestId: 'request_1',
        traceId: 'trace_1',
      }),
    ).rejects.toMatchObject({
      code: 'CANVAS_LOCK_REQUIRED',
    });

    expect(lockService.assertLockHeld).toHaveBeenCalledWith(
      access,
      actor,
      'automation_1',
      'draft_1',
    );
    expect(databaseService.transaction).not.toHaveBeenCalled();
  });
});

function makeWorkflow(): LexFrameWorkflowV2 {
  const now = '2026-04-24T00:00:00.000Z';
  return {
    schema_version: '2.0',
    id: 'wf_test',
    workspace_id: 'workspace_1',
    automation_id: 'automation_1',
    draft_version_id: 'draft_1',
    metadata: {
      title: 'Test workflow',
      status: 'draft',
      canvas_mode: 'guided_vertical',
    },
    inputs: [],
    outputs: [],
    nodes: [],
    edges: [],
    variables: [],
    validation: {
      status: 'valid',
      errors_count: 0,
      warnings_count: 0,
      policy_blocks_count: 0,
      issues: [],
      can_save: true,
      can_test: true,
      can_publish: true,
      can_compile: true,
      can_run: true,
      can_sync: true,
    },
    runtime_projection: {
      status: 'not_compiled',
      can_compile: false,
      can_run: false,
      warnings: [],
    },
    layout: {
      mode: 'guided_vertical',
      updated_at: now,
    },
    created_at: now,
    updated_at: now,
  };
}
