import { createHash } from 'node:crypto';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import type {
  ActivepiecesInstalledAutomationForSession,
  ActivepiecesPiecesPolicy,
  ActivepiecesWorkspaceSecurityForSession,
} from './activepieces-session.types';
import { STAGE17_DIRECT_AI_PROVIDER_PIECES } from './activepieces-piece-catalog';

const DENYLISTED_PIECES = STAGE17_DIRECT_AI_PROVIDER_PIECES;

@Injectable()
export class ActivepiecesPiecesPolicyService {
  private readonly env = loadServerEnv();

  buildAutomationCanvasPolicy(input: {
    readonly workspaceSecurity: ActivepiecesWorkspaceSecurityForSession;
    readonly automation: ActivepiecesInstalledAutomationForSession;
  }): ActivepiecesPiecesPolicy {
    const filterType = normalizeFilterType(
      input.workspaceSecurity.piecesFilterType,
    );
    if (filterType !== 'ALLOWED') {
      throw new AppHttpException(
        'PIECES_POLICY_INVALID',
        422,
        'Activepieces Canvas requires an ALLOWED pieces policy.',
        {
          configuredFilterType: input.workspaceSecurity.piecesFilterType,
        },
      );
    }

    const configuredTags = input.workspaceSecurity.piecesTags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    const derivedTags = derivePiecesTags(input.automation.workflow);
    const localDevTags = this.isLocalAllOpenSourceProfile()
      ? [
          'stage17-local-all-open-source-pieces',
          'activepieces-core',
          'activepieces-community',
          'open-source-pieces',
        ]
      : [];
    const piecesTags = [
      ...new Set([...configuredTags, ...derivedTags, ...localDevTags]),
    ].sort();

    if (piecesTags.length === 0) {
      throw new AppHttpException(
        'PIECES_POLICY_EMPTY',
        422,
        'Activepieces Canvas pieces allowlist cannot be empty.',
      );
    }

    const policy = {
      piecesFilterType: 'ALLOWED' as const,
      piecesTags,
      denylistedPieces: this.isLocalAllOpenSourceProfile()
        ? []
        : [...DENYLISTED_PIECES],
    };

    return {
      ...policy,
      policyHash: `sha256:${hashCanonical(policy)}`,
    };
  }

  private isLocalAllOpenSourceProfile() {
    return (
      this.env.LEXFRAME_STAGE17_PIECES_PROFILE ===
        'stage17-local-all-open-source-pieces' &&
      this.env.LEXFRAME_DEPLOY_ENV !== 'production' &&
      this.env.LEXFRAME_ENV_PROFILE !== 'production'
    );
  }
}

function normalizeFilterType(value: string) {
  return value.toUpperCase() === 'ALLOWLIST' ? 'ALLOWED' : value.toUpperCase();
}

function derivePiecesTags(workflow: Record<string, unknown> | null) {
  const tags = new Set<string>(['lexframe-core', 'lexframe-runtime']);
  const steps = Array.isArray(workflow?.steps)
    ? workflow.steps
    : Array.isArray(workflow?.nodes)
      ? workflow.nodes
      : [];

  for (const step of steps) {
    if (typeof step !== 'object' || step === null) {
      continue;
    }
    const moduleCode =
      typeof (step as Record<string, unknown>).moduleCode === 'string'
        ? ((step as Record<string, unknown>).moduleCode as string)
        : typeof (step as Record<string, unknown>).module_code === 'string'
          ? ((step as Record<string, unknown>).module_code as string)
          : '';

    if (moduleCode.startsWith('legal.')) {
      tags.add('lexframe-legal');
      tags.add('legal-core');
    } else if (moduleCode.startsWith('document.')) {
      tags.add('lexframe-artifact');
      tags.add('document-core');
    } else if (moduleCode.startsWith('delivery.')) {
      tags.add('lexframe-delivery');
      tags.add('delivery-safe');
    } else if (moduleCode.startsWith('workflow.')) {
      tags.add('lexframe-callback');
      tags.add('workflow-control');
    } else if (moduleCode.startsWith('ai.')) {
      tags.add('lexframe-ai-gateway');
    }
  }

  return [...tags];
}

function hashCanonical(value: unknown) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
