import type {
  CompatibilityStatus,
  ModerationDecision,
  PublicationRequest,
  TemplateRequirement,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';

export function extractWorkflowModuleCodes(
  workflow: Record<string, unknown>,
  fallback: readonly string[] = [],
): readonly string[] {
  const steps: readonly unknown[] = Array.isArray(workflow.steps)
    ? workflow.steps
    : Array.isArray(workflow.nodes)
      ? workflow.nodes
      : [];
  const moduleCodes = steps
    .map(
      (step) =>
        getStringProperty(step, 'moduleCode') ??
        getStringProperty(step, 'module_code'),
    )
    .filter((value): value is string => Boolean(value));

  if (moduleCodes.length === 0) {
    return [...fallback];
  }

  return [...new Set(moduleCodes)];
}

export function extractWorkflowInputs(
  workflow: Record<string, unknown>,
): readonly string[] {
  const inputs: readonly unknown[] = Array.isArray(workflow.inputs)
    ? workflow.inputs
    : [];

  return inputs
    .map(
      (entry) =>
        getStringProperty(entry, 'code') ??
        getStringProperty(entry, 'key') ??
        getStringProperty(entry, 'inputId'),
    )
    .filter((value): value is string => Boolean(value));
}

export function resolveInstalledRequirements(
  requirements: readonly TemplateRequirement[],
  access: AccessContext,
  input: {
    readonly profileId?: string | null;
    readonly documentIds?: readonly string[];
    readonly connectionIds?: readonly string[];
  },
): readonly TemplateRequirement[] {
  return requirements.map((requirement) => {
    let status = requirement.status;

    if (
      requirement.kind === 'profile' &&
      !input.profileId &&
      !requirement.optional
    ) {
      status = 'missing';
    }

    if (
      requirement.kind === 'document' &&
      !requirement.optional &&
      (!input.documentIds || input.documentIds.length === 0)
    ) {
      status = 'missing';
    }

    if (requirement.kind === 'connection') {
      const connectionCode = requirement.code.replace(/^connection\./, '');

      if (!input.connectionIds?.includes(connectionCode)) {
        status = requirement.optional ? 'missing' : 'blocked';
      }
    }

    if (
      requirement.kind === 'permission' &&
      !access.permissions.includes(requirement.code as never)
    ) {
      status = 'blocked';
    }

    return {
      ...requirement,
      status,
    };
  });
}

export function deriveCompatibilityStatus(
  storedStatus: CompatibilityStatus,
  requirements: readonly TemplateRequirement[],
): CompatibilityStatus {
  if (requirements.some((requirement) => requirement.status === 'blocked')) {
    return 'policy_blocked';
  }

  if (requirements.some((requirement) => requirement.status === 'missing')) {
    return 'missing_requirements';
  }

  return storedStatus;
}

export function deriveRequirementBlocker(
  requirements: readonly TemplateRequirement[],
): string | null {
  const blocker = requirements.find(
    (requirement) =>
      requirement.status === 'blocked' || requirement.status === 'missing',
  );

  return blocker ? `${blocker.label} is ${blocker.status}.` : null;
}

export function buildNextGate(
  compatibilityStatus: CompatibilityStatus,
  requirements: readonly TemplateRequirement[],
): string {
  const blocker = deriveRequirementBlocker(requirements);

  if (blocker) {
    return `Resolve requirement blockers before runtime sync: ${blocker}`;
  }

  if (compatibilityStatus === 'runtime_sync_pending') {
    return 'Runtime projection is not synced yet. Sync the automation before opening the builder or starting a run.';
  }

  if (compatibilityStatus === 'compatible') {
    return 'Requirements are satisfied. Sync runtime to provision the embedded builder and execution loop.';
  }

  return 'Review compatibility blockers before continuing.';
}

export function difference(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  const leftOnly = left.filter((value) => !right.includes(value));
  const rightOnly = right.filter((value) => !left.includes(value));
  return [...new Set([...leftOnly, ...rightOnly])];
}

export function buildPublicTemplateCode(
  code: string,
  sourceTemplateId: string,
): string {
  return `public.${code.replace(/[^a-z0-9._-]+/gi, '-')}.${sourceTemplateId.slice(0, 8)}`;
}

export function normalizePublicationDecision(
  decision: ModerationDecision['decision'],
): PublicationRequest['status'] {
  if (decision === 'approve') {
    return 'approved';
  }

  if (decision === 'reject') {
    return 'rejected';
  }

  return 'changes_requested';
}

function getStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const property = record[key];

  return typeof property === 'string' ? property : null;
}
