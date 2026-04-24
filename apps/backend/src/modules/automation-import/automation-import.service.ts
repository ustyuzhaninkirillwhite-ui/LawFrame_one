import { Injectable } from '@nestjs/common';
import {
  classifyActivepiecesPiecePolicy,
  assertNoPrivilegedFrontendSecrets,
} from '../activepieces/activepieces-policy';

export interface ActivepiecesImportCandidate {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly title: string;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly sourceLicenseNote: string;
}

export interface ActivepiecesImportPlan {
  readonly sourcePath: string;
  readonly sourceHash: string;
  readonly title: string;
  readonly importable: boolean;
  readonly category: string;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly policy: string;
  readonly blockers: readonly string[];
}

@Injectable()
export class AutomationImportService {
  buildActivepiecesImportPlan(
    candidate: ActivepiecesImportCandidate,
  ): ActivepiecesImportPlan {
    const secretBoundary = assertNoPrivilegedFrontendSecrets(candidate);
    const piecePolicies = candidate.requiredPieces.map((piece) =>
      classifyActivepiecesPiecePolicy(piece),
    );
    const blockers = [
      ...(!secretBoundary.safe ? [secretBoundary.message] : []),
      ...(candidate.sourceLicenseNote.includes('needs legal confirmation')
        ? ['Template source requires legal confirmation before import.']
        : []),
      ...(piecePolicies.includes('forbidden_in_production')
        ? ['At least one required piece is forbidden in production.']
        : []),
    ];

    return {
      sourcePath: candidate.sourcePath,
      sourceHash: candidate.sourceHash,
      title: candidate.title,
      importable: blockers.length === 0,
      category: inferLexFrameCategory(candidate.requiredPieces),
      requiredPieces: candidate.requiredPieces,
      requiredConnections: candidate.requiredConnections,
      policy: strongestPolicy(piecePolicies),
      blockers,
    };
  }

  summarizeImportPlans(plans: readonly ActivepiecesImportPlan[]) {
    return {
      total: plans.length,
      importable: plans.filter((plan) => plan.importable).length,
      blocked: plans.filter((plan) => !plan.importable).length,
      approvalRequired: plans.filter(
        (plan) => plan.policy === 'requires_human_approval',
      ).length,
      advancedOnly: plans.filter((plan) => plan.policy === 'advanced_only')
        .length,
    };
  }
}

function strongestPolicy(policies: readonly string[]): string {
  const order = [
    'forbidden_in_production',
    'blocked_by_default',
    'advanced_only',
    'requires_admin_role',
    'requires_human_approval',
    'safe_with_workspace_policy',
    'safe_by_default',
  ];

  return order.find((policy) => policies.includes(policy)) ?? 'safe_by_default';
}

function inferLexFrameCategory(requiredPieces: readonly string[]): string {
  const joined = requiredPieces.join(' ');
  if (
    /docusign|pandadoc|pdf|google-docs|google-drive|dropbox|box/i.test(joined)
  ) {
    return 'Document Operations';
  }
  if (/gmail|slack|telegram|twilio|sendgrid|smtp|whatsapp/i.test(joined)) {
    return 'Delivery And Notifications';
  }
  if (
    /openai|anthropic|claude|gemini|bedrock|cohere|perplexity/i.test(joined)
  ) {
    return 'AI-Assisted Automation';
  }
  if (/postgres|mysql|mongodb|supabase|snowflake|bigquery/i.test(joined)) {
    return 'Data Integrations';
  }
  return 'Technical Integrations';
}
