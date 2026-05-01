export type ActivepiecesConnectionStatus =
  | 'configured'
  | 'missing'
  | 'blocked_by_policy'
  | 'requires_approval';

export { ActivepiecesCanvasRoute } from './activepieces-canvas-route';

export interface EmbeddedBuilderUrlInput {
  readonly baseUrl: string;
  readonly projectId: string;
  readonly flowId?: string | null;
  readonly mode?: 'builder' | 'runs' | 'connections' | 'templates';
  readonly embedToken?: never;
}

export interface RuntimeRequirementView {
  readonly code: string;
  readonly label: string;
  readonly status: ActivepiecesConnectionStatus;
  readonly policy: 'default' | 'workspace_policy' | 'advanced' | 'admin';
}

export function buildEmbeddedBuilderUrl(input: EmbeddedBuilderUrlInput): string {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({
    projectId: input.projectId,
    lexframeEmbed: 'true',
  });
  if (input.flowId) {
    params.set('flowId', input.flowId);
  }
  if (input.mode) {
    params.set('mode', input.mode);
  }
  return `${baseUrl}/embed?${params.toString()}`;
}

export function getConnectionStatusLabel(
  status: ActivepiecesConnectionStatus,
): string {
  switch (status) {
    case 'configured':
      return 'Настроено';
    case 'missing':
      return 'Нет подключения';
    case 'blocked_by_policy':
      return 'Заблокировано политикой';
    case 'requires_approval':
      return 'Требует согласования';
  }
}

export function hasBlockingRuntimeRequirement(
  requirements: readonly RuntimeRequirementView[],
): boolean {
  return requirements.some(
    (requirement) =>
      requirement.status === 'missing' ||
      requirement.status === 'blocked_by_policy',
  );
}
