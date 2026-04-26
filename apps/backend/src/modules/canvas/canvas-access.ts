import type { AccessContext } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';

export function requireWorkspaceId(access: AccessContext): string {
  const workspaceId = access.activeWorkspace?.id;
  if (!workspaceId) {
    throw new AppHttpException(
      'WORKSPACE_CONTEXT_REQUIRED',
      403,
      'Workspace context is required for Canvas.',
    );
  }
  return workspaceId;
}
