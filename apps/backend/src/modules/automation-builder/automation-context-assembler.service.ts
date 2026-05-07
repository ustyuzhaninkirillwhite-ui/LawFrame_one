import type {
  AutomationBuilderContextItemType,
  AutomationContextMode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface AutomationContextRequestedItem {
  readonly id: string;
  readonly type: AutomationBuilderContextItemType;
  readonly sourceId: string;
  readonly classification: string;
  readonly requestedMode: AutomationContextMode | 'full_context';
}

export interface AutomationContextAssemblerInput {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly intentId: string;
  readonly requestedItems: readonly AutomationContextRequestedItem[];
  readonly policy: {
    readonly allowLegalSecretExternalProvider: boolean;
    readonly allowExternalProviderForClientMaterial: boolean;
    readonly ragAvailable: boolean;
  };
}

export interface AutomationContextAssemblerResult {
  readonly workspaceId: string;
  readonly projectId?: string | null;
  readonly intentId: string;
  readonly policyDecision:
    | 'allowed'
    | 'reference_substitution'
    | 'focused_rag'
    | 'blocked';
  readonly contextBudgetTokens: number;
  readonly items: readonly {
    readonly id: string;
    readonly type: AutomationBuilderContextItemType;
    readonly sourceId: string;
    readonly sourceHash: string;
    readonly classification: string;
    readonly selectedMode: AutomationContextMode;
    readonly blocked: boolean;
    readonly reasonCode: string | null;
  }[];
}

@Injectable()
export class AutomationContextAssemblerService {
  assemble(
    input: AutomationContextAssemblerInput,
  ): AutomationContextAssemblerResult {
    const items = input.requestedItems.map((item) => {
      const selection = selectMode(item, input.policy);
      return {
        id: item.id,
        type: item.type,
        sourceId: item.sourceId,
        sourceHash: hashText(
          `${input.workspaceId}:${item.type}:${item.sourceId}`,
        ),
        classification: item.classification,
        selectedMode: selection.mode,
        blocked: selection.blocked,
        reasonCode: selection.reasonCode,
      };
    });
    const blocked = items.filter((item) => item.blocked);
    const hasSubstitution = items.some(
      (item) => item.selectedMode === 'reference_only' && item.blocked,
    );

    return {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      intentId: input.intentId,
      policyDecision: hasSubstitution
        ? 'reference_substitution'
        : blocked.length === items.length && items.length > 0
          ? 'blocked'
          : items.some((item) => item.selectedMode === 'focused_rag')
            ? 'focused_rag'
            : 'allowed',
      contextBudgetTokens: 120_000,
      items,
    };
  }
}

function selectMode(
  item: AutomationContextRequestedItem,
  policy: AutomationContextAssemblerInput['policy'],
): {
  readonly mode: AutomationContextMode;
  readonly blocked: boolean;
  readonly reasonCode: string | null;
} {
  if (
    item.classification === 'legal_secret' &&
    !policy.allowLegalSecretExternalProvider
  ) {
    return {
      mode: 'reference_only',
      blocked: true,
      reasonCode: 'legal_secret_policy_blocked',
    };
  }

  if (
    ['client_material', 'personal_data'].includes(item.classification) &&
    !policy.allowExternalProviderForClientMaterial
  ) {
    return {
      mode: policy.ragAvailable ? 'focused_rag' : 'reference_only',
      blocked: false,
      reasonCode: policy.ragAvailable
        ? 'client_material_focused_rag'
        : 'client_material_reference_only',
    };
  }

  if (item.requestedMode === 'full_context') {
    return { mode: 'summary', blocked: false, reasonCode: null };
  }

  return { mode: item.requestedMode, blocked: false, reasonCode: null };
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
