import type {
  ChatAttachmentMode,
  ChatDataClassification,
  ProjectKnowledgeSourceType,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

export interface ChatContextRequestedItem {
  readonly id: string;
  readonly sourceType: ProjectKnowledgeSourceType;
  readonly sourceId: string;
  readonly mode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly pinned: boolean;
  readonly enabledForChat: boolean;
  readonly citationRequired: boolean;
}

export interface ChatContextPolicy {
  readonly allowExternalProviderForClientMaterial: boolean;
  readonly allowLegalSecretExternalProvider: boolean;
  readonly ragAvailable: boolean;
}

export interface ChatContextAssemblyInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly threadId: string;
  readonly requestedItems: readonly ChatContextRequestedItem[];
  readonly policy: ChatContextPolicy;
}

export interface AssembledChatContextItem {
  readonly id: string;
  readonly sourceType: ProjectKnowledgeSourceType;
  readonly sourceId: string;
  readonly requestedMode: ChatAttachmentMode;
  readonly selectedMode: ChatAttachmentMode;
  readonly classification: ChatDataClassification;
  readonly blocked: boolean;
  readonly reasonCode: string | null;
  readonly citationRequired: boolean;
}

export interface ChatContextAssemblyResult {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly threadId: string;
  readonly policyDecision:
    | 'allow'
    | 'reference_substitution'
    | 'focused_rag'
    | 'blocked';
  readonly items: readonly AssembledChatContextItem[];
  readonly contextItemCount: number;
}

@Injectable()
export class ChatContextAssemblerService {
  assemble(input: ChatContextAssemblyInput): ChatContextAssemblyResult {
    const items = input.requestedItems
      .filter((item) => item.enabledForChat)
      .map((item) => this.applyPolicy(item, input.policy));
    const hasBlocked = items.some((item) => item.blocked);
    const hasReference = items.some(
      (item) => item.selectedMode === 'reference_only',
    );
    const hasFocusedRag = items.some(
      (item) => item.selectedMode === 'focused_rag',
    );

    return {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      threadId: input.threadId,
      policyDecision: hasBlocked
        ? 'reference_substitution'
        : hasReference
          ? 'reference_substitution'
          : hasFocusedRag
            ? 'focused_rag'
            : 'allow',
      items,
      contextItemCount: items.length,
    };
  }

  private applyPolicy(
    item: ChatContextRequestedItem,
    policy: ChatContextPolicy,
  ): AssembledChatContextItem {
    if (
      item.classification === 'legal_secret' &&
      !policy.allowLegalSecretExternalProvider
    ) {
      return this.withDecision(
        item,
        'reference_only',
        true,
        'legal_secret_policy_blocked',
      );
    }

    if (
      (item.classification === 'client_material' ||
        item.classification === 'personal_data') &&
      !policy.allowExternalProviderForClientMaterial
    ) {
      return this.withDecision(
        item,
        policy.ragAvailable ? 'focused_rag' : 'reference_only',
        false,
        policy.ragAvailable ? 'requires_redaction_or_rag' : 'rag_unavailable',
      );
    }

    if (item.mode === 'full_context' && !policy.ragAvailable) {
      return this.withDecision(
        item,
        'reference_only',
        false,
        'rag_unavailable',
      );
    }

    return this.withDecision(item, item.mode, false, null);
  }

  private withDecision(
    item: ChatContextRequestedItem,
    selectedMode: ChatAttachmentMode,
    blocked: boolean,
    reasonCode: string | null,
  ): AssembledChatContextItem {
    return {
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      requestedMode: item.mode,
      selectedMode,
      classification: item.classification,
      blocked,
      reasonCode,
      citationRequired: item.citationRequired,
    };
  }
}
