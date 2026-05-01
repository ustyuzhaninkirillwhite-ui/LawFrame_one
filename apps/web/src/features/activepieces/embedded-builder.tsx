'use client';

import { buildEmbeddedBuilderUrl, type RuntimeRequirementView } from './index';

export interface ActivepiecesEmbeddedBuilderProps {
  readonly baseUrl: string;
  readonly projectId: string;
  readonly flowId?: string | null;
  readonly title?: string;
  readonly requirements?: readonly RuntimeRequirementView[];
}

export function ActivepiecesEmbeddedBuilder({
  baseUrl,
  projectId,
  flowId,
  title = 'Конструктор автоматизаций',
  requirements = [],
}: ActivepiecesEmbeddedBuilderProps) {
  const blocked = requirements.some(
    (requirement) =>
      requirement.status === 'missing' ||
      requirement.status === 'blocked_by_policy',
  );

  if (blocked) {
    return (
      <section aria-label="Требования runtime конструктора">
        <h2>Требования runtime конструктора</h2>
        <ul>
          {requirements.map((requirement) => (
            <li key={requirement.code}>
              <span>{requirement.label}</span>
              <span>{formatRequirementStatus(requirement.status)}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <iframe
      title={title}
      src={buildEmbeddedBuilderUrl({ baseUrl, projectId, flowId })}
      sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      referrerPolicy="no-referrer"
      style={{
        border: 0,
        display: 'block',
        height: '100%',
        minHeight: '720px',
        width: '100%',
      }}
    />
  );
}

function formatRequirementStatus(status: RuntimeRequirementView['status']) {
  switch (status) {
    case 'configured':
      return 'Готово';
    case 'missing':
      return 'Не настроено';
    case 'blocked_by_policy':
      return 'Заблокировано политикой';
    default:
      return 'Неизвестно';
  }
}
