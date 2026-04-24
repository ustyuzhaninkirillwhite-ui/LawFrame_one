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
  title = 'Activepieces builder',
  requirements = [],
}: ActivepiecesEmbeddedBuilderProps) {
  const blocked = requirements.some(
    (requirement) =>
      requirement.status === 'missing' ||
      requirement.status === 'blocked_by_policy',
  );

  if (blocked) {
    return (
      <section aria-label="Activepieces runtime requirements">
        <h2>Runtime requirements</h2>
        <ul>
          {requirements.map((requirement) => (
            <li key={requirement.code}>
              <span>{requirement.label}</span>
              <span>{requirement.status}</span>
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
