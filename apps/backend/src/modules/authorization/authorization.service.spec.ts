import { AuthorizationService } from './authorization.service';

describe('AuthorizationService workspace RBAC contracts', () => {
  it('returns all active workspaces for a multi-workspace user without trusting client state', async () => {
    const databaseService = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'workspace_alpha',
            slug: 'alpha',
            name: 'Alpha',
            status: 'active',
            role_code: 'owner',
          },
          {
            id: 'workspace_beta',
            slug: 'beta',
            name: 'Beta',
            status: 'active',
            role_code: 'viewer',
          },
        ],
      }),
    };
    const service = new AuthorizationService(databaseService as never);

    await expect(service.listWorkspacesForUser('user_001')).resolves.toEqual([
      {
        id: 'workspace_alpha',
        slug: 'alpha',
        name: 'Alpha',
        status: 'active',
        role: 'owner',
      },
      {
        id: 'workspace_beta',
        slug: 'beta',
        name: 'Beta',
        status: 'active',
        role: 'viewer',
      },
    ]);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('where wm.auth_user_id = $1'),
      ['user_001'],
    );
    expect(databaseService.query.mock.calls[0]?.[0]).toContain(
      "wm.status = 'active'",
    );
    expect(databaseService.query.mock.calls[0]?.[0]).toContain(
      'w.deleted_at is null',
    );
  });

  it('returns null for cross-workspace access instead of synthesizing permissions from input', async () => {
    const databaseService = {
      one: jest.fn().mockResolvedValue(null),
    };
    const service = new AuthorizationService(databaseService as never);

    await expect(
      service.getWorkspaceAccess('user_001', 'workspace_other'),
    ).resolves.toBeNull();
    await expect(
      service.hasPermission(
        'user_001',
        'workspace_other',
        'workspace.member.update_role',
      ),
    ).resolves.toBe(false);
    expect(databaseService.one).toHaveBeenCalledWith(
      expect.stringContaining('wm.workspace_id = $2'),
      ['user_001', 'workspace_other'],
    );
  });

  it('maps role permissions from the database permission matrix for admin/lawyer/assistant/viewer scenarios', async () => {
    const matrix = new Map([
      [
        'admin',
        [
          'workspace.member.update_role',
          'settings.organization.update',
          'settings.ai.manage_workspace',
        ],
      ],
      ['lawyer', ['document.read', 'chat.view', 'ai.chat.use']],
      ['assistant', ['document.read', 'chat.view']],
      ['viewer', ['document.read']],
    ]);
    const databaseService = {
      one: jest.fn((_sql: string, params: readonly unknown[]) => {
        const role = String(params[1]).replace('workspace_', '');
        return Promise.resolve({
          id: params[1],
          slug: role,
          name: role,
          status: 'active',
          role_code: role,
          permissions: matrix.get(role),
        });
      }),
    };
    const service = new AuthorizationService(databaseService as never);

    await expect(
      service.hasPermission(
        'user_001',
        'workspace_admin',
        'settings.organization.update',
      ),
    ).resolves.toBe(true);
    await expect(
      service.hasPermission('user_001', 'workspace_lawyer', 'document.read'),
    ).resolves.toBe(true);
    await expect(
      service.hasPermission(
        'user_001',
        'workspace_assistant',
        'workspace.member.update_role',
      ),
    ).resolves.toBe(false);
    await expect(
      service.hasPermission('user_001', 'workspace_viewer', 'workspace.update'),
    ).resolves.toBe(false);
  });

  it('exposes role and permission definitions without high-risk metadata loss', async () => {
    const databaseService = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              code: 'owner',
              label: 'Owner',
              description: 'Full workspace control',
              permissions: ['workspace.member.update_role'],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              code: 'settings.ai.secret.rotate_workspace',
              label: 'Rotate workspace AI secret',
              description: 'Rotate workspace AI provider key',
              scope: 'ai',
              high_risk: true,
            },
          ],
        }),
    };
    const service = new AuthorizationService(databaseService as never);

    await expect(service.listRoles()).resolves.toEqual([
      {
        code: 'owner',
        label: 'Owner',
        description: 'Full workspace control',
        permissions: ['workspace.member.update_role'],
      },
    ]);
    await expect(service.listPermissions()).resolves.toEqual([
      {
        code: 'settings.ai.secret.rotate_workspace',
        label: 'Rotate workspace AI secret',
        description: 'Rotate workspace AI provider key',
        scope: 'ai',
        highRisk: true,
      },
    ]);
  });
});
