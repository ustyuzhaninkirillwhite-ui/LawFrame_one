import type { AccessContext } from '../../common/types/lexframe-request';
import { ActivepiecesRoleMapper } from './activepieces-role-mapper';

describe('ActivepiecesRoleMapper', () => {
  const mapper = new ActivepiecesRoleMapper();

  function access(permissions: AccessContext['permissions']): AccessContext {
    return {
      activeWorkspace: null,
      roles: ['viewer'],
      permissions,
    };
  }

  it('maps automation_canvas edit permissions to EDITOR without issuing ADMIN', () => {
    const result = mapper.mapAutomationCanvasRole({
      access: access(['automation.read', 'automation.edit']),
      readOnlySupported: true,
    });

    expect(result.role).toBe('EDITOR');
    expect(result.permissions.can_edit).toBe(true);
    expect(result.permissions.can_manage_connections).toBe(false);
  });

  it('maps read permissions to VIEWER only when read-only mode is available', () => {
    const result = mapper.mapAutomationCanvasRole({
      access: access(['automation.read']),
      readOnlySupported: true,
    });

    expect(result.role).toBe('VIEWER');
    expect(result.permissions.can_edit).toBe(false);
  });

  it('fails closed when a viewer cannot get confirmed read-only mode', () => {
    try {
      mapper.mapAutomationCanvasRole({
        access: access(['automation.read']),
        readOnlySupported: false,
      });
      throw new Error('Expected ROLE_NOT_ALLOWED');
    } catch (error) {
      expect(error).toMatchObject({ code: 'ROLE_NOT_ALLOWED' });
    }
  });
});
