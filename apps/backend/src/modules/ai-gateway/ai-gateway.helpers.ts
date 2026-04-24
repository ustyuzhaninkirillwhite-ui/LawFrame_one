import type {
  AiChatResponse,
  AiDataClass,
  AiProvider,
  AiProviderRoute,
  DataClassification,
  LexFrameWorkflow,
} from '@lexframe/contracts';
import type { AiPolicyContext } from '../../common/types/lexframe-request';
import { createHash } from 'node:crypto';

export function cloneWorkflow(workflow: LexFrameWorkflow): LexFrameWorkflow {
  return JSON.parse(JSON.stringify(workflow)) as LexFrameWorkflow;
}

export function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function safePreview(value: string, limit = 160) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length <= limit
    ? trimmed
    : `${trimmed.slice(0, limit - 3)}...`;
}

export function buildSessionPolicySummary(policy: AiPolicyContext) {
  return {
    externalAiEnabled: policy.aiEnabled,
    confidentialDataAllowed:
      policy.allowConfidential || policy.allowLegalSecret,
    cometapiAllowedForPublicData: policy.cometapiPublicEnabled,
  };
}

export function estimateCost(
  provider: AiProvider,
  inputTokens: number,
  outputTokens: number,
) {
  const multiplier =
    provider === 'cometapi' ? 0.0000012 : provider === 'local' ? 0 : 0.000002;
  return Number(((inputTokens + outputTokens) * multiplier).toFixed(6));
}

export function buildSecurityLabels(dataClass: AiDataClass) {
  if (dataClass === 'C_LEGAL_SECRET') {
    return ['legal_secret', 'contains_confidential_documents'];
  }

  if (dataClass === 'C_CONFIDENTIAL_CLIENT') {
    return ['contains_confidential_documents'];
  }

  if (dataClass === 'B_INTERNAL_WORKSPACE') {
    return ['internal_workspace_only'];
  }

  return ['public_safe'];
}

export function mapAiDataClassToInputClass(dataClass: AiDataClass) {
  switch (dataClass) {
    case 'C_LEGAL_SECRET':
      return 'legal_secret';
    case 'C_CONFIDENTIAL_CLIENT':
      return 'confidential';
    case 'B_INTERNAL_WORKSPACE':
      return 'internal';
    case 'A_TEMPLATE_NON_SENSITIVE':
    case 'A_PUBLIC':
      return 'public';
    case 'B_ANONYMIZED_LEGAL':
      return 'anonymized';
    case 'D_AI_EXTERNAL_FORBIDDEN':
      return 'ai_forbidden_external';
    default:
      return 'internal';
  }
}

export function mapDataClassificationToAiDataClass(
  classification: DataClassification,
): AiDataClass {
  switch (classification) {
    case 'legal_secret':
      return 'C_LEGAL_SECRET';
    case 'confidential':
    case 'personal_data':
    case 'client_material':
      return 'C_CONFIDENTIAL_CLIENT';
    case 'anonymized':
      return 'B_ANONYMIZED_LEGAL';
    case 'internal':
      return 'B_INTERNAL_WORKSPACE';
    case 'ai_forbidden_external':
      return 'D_AI_EXTERNAL_FORBIDDEN';
    case 'public':
      return 'A_PUBLIC';
    default:
      return 'B_INTERNAL_WORKSPACE';
  }
}

export function withRoute(
  allowedRoutes: readonly AiProviderRoute[],
  route: AiProviderRoute,
): readonly AiProviderRoute[] {
  return Array.from(new Set([...allowedRoutes, route]));
}

export function summarizeAiResponse(response: AiChatResponse) {
  switch (response.status) {
    case 'workflow_draft_ready':
      return `Draft ready: ${response.workflow.title}`;
    case 'clarification_required':
      return `Clarification required: ${response.questions.length} item(s)`;
    case 'patch_ready':
      return `Patch ready: +${response.diff.addedSteps.length} ~${response.diff.updatedSteps.length} -${response.diff.removedSteps.length}`;
    case 'blocked_by_policy':
      return response.message;
    case 'queued':
      return `Request queued: ${response.requestId}`;
    case 'error':
      return response.message;
    default:
      return 'Assistant response';
  }
}

export function coerceOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function mergeStringArray(
  existing: readonly string[],
  value: unknown,
): string[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return Array.from(new Set([...existing, value.trim()]));
  }

  if (Array.isArray(value)) {
    return Array.from(
      new Set([
        ...existing,
        ...value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ]),
    );
  }

  return [...existing];
}

export function buildDocumentAnalysisDescription(
  documents: readonly { readonly title: string }[],
) {
  if (documents.length === 0) {
    return 'Analyze the selected source documents and extract facts, parties, and constraints.';
  }

  return `Analyze ${documents.length} selected document(s): ${documents
    .slice(0, 3)
    .map((document) => document.title)
    .join(', ')}.`;
}
