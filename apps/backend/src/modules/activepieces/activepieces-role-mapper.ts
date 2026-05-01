import type { PermissionCode } from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import type { ActivepiecesMappedSessionRole } from './activepieces-session.types';

@Injectable()
export class ActivepiecesRoleMapper {
  mapAutomationCanvasRole(input: {
    readonly access: AccessContext;
    readonly readOnlySupported: boolean;
  }): ActivepiecesMappedSessionRole {
    const permissions = new Set<PermissionCode>(input.access.permissions);
    const canEdit =
      permissions.has('automation.edit') ||
      permissions.has('canvas.edit') ||
      permissions.has('canvas.open_advanced_builder');
    const canView =
      canEdit ||
      permissions.has('automation.read') ||
      permissions.has('canvas.view') ||
      permissions.has('activepieces.open_builder');

    if (canEdit) {
      return {
        role: 'EDITOR',
        permissions: {
          can_view: true,
          can_edit: true,
          can_manage_connections: permissions.has('connections.manage'),
          can_open_diagnostics:
            permissions.has('workspace.security.read') ||
            permissions.has('canvas.debug'),
        },
        downgradeReason: input.access.roles.includes('owner')
          ? 'automation_canvas_downgrades_owner_to_editor'
          : null,
      };
    }

    if (canView && input.readOnlySupported) {
      return {
        role: 'VIEWER',
        permissions: {
          can_view: true,
          can_edit: false,
          can_manage_connections: false,
          can_open_diagnostics: false,
        },
        downgradeReason: 'read_only_canvas',
      };
    }

    throw new AppHttpException(
      'ROLE_NOT_ALLOWED',
      403,
      'The current role cannot open Activepieces Canvas for this automation.',
      {
        requiredPermission: 'automation.read',
      },
    );
  }
}
