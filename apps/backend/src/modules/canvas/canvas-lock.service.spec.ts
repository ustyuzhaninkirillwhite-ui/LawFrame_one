import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { CanvasLockService } from './canvas-lock.service';

describe('CanvasLockService', () => {
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

  it('reports an expired draft lock as not currently held', async () => {
    const service = new CanvasLockService(
      fakeDatabase({
        id: 'lock_1',
        draft_version_id: 'draft_1',
        lock_type: 'edit',
        locked_by_user_id: actor.id,
        locked_by_user_email: actor.email,
        expires_at: '2000-01-01T00:00:00.000Z',
      }),
    );

    const state = await service.getLockState(
      access,
      actor,
      'automation_1',
      'draft_1',
    );

    expect(state.status).toBe('expired');
    expect(state.locked).toBe(false);
    expect(state.locked_by_current_user).toBe(false);
  });

  it('requires an edit lock before mutation', async () => {
    const service = new CanvasLockService(fakeDatabase(null));

    await expect(
      service.assertLockHeld(access, actor, 'automation_1', 'draft_1'),
    ).rejects.toMatchObject({
      code: 'CANVAS_LOCK_REQUIRED',
    });
  });

  it('rejects mutation while another user owns the lock', async () => {
    const service = new CanvasLockService(
      fakeDatabase({
        id: 'lock_2',
        draft_version_id: 'draft_1',
        lock_type: 'edit',
        locked_by_user_id: 'other_user',
        locked_by_user_email: 'other@example.com',
        expires_at: '2999-01-01T00:00:00.000Z',
      }),
    );

    await expect(
      service.assertLockHeld(access, actor, 'automation_1', 'draft_1'),
    ).rejects.toMatchObject({
      code: 'CANVAS_LOCK_OWNED_BY_ANOTHER_USER',
    });
  });
});

function fakeDatabase(row: unknown) {
  return {
    one: jest.fn().mockResolvedValue(row),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    transaction: jest.fn((callback: (client: unknown) => unknown) =>
      Promise.resolve(
        callback({
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        }),
      ),
    ),
  } as never;
}
