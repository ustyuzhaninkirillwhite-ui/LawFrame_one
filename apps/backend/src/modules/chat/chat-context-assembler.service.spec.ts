import type { ChatAttachmentMode } from '@lexframe/contracts';
import { ChatContextAssemblerService } from './chat-context-assembler.service';

describe('ChatContextAssemblerService', () => {
  it('uses reference_only for legal_secret attachments when the route policy is not secure-approved', () => {
    const service = new ChatContextAssemblerService();

    const result = service.assemble({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      threadId: 'thread-1',
      requestedItems: [
        {
          id: 'item-1',
          sourceType: 'document_version',
          sourceId: 'document-version-1',
          mode: 'full_context',
          classification: 'legal_secret',
          pinned: true,
          enabledForChat: true,
          citationRequired: true,
        },
      ],
      policy: {
        allowExternalProviderForClientMaterial: false,
        allowLegalSecretExternalProvider: false,
        ragAvailable: true,
      },
    });

    expect(result.policyDecision).toBe('reference_substitution');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sourceId: 'document-version-1',
      selectedMode: 'reference_only' satisfies ChatAttachmentMode,
      blocked: true,
      reasonCode: 'legal_secret_policy_blocked',
    });
  });
});
