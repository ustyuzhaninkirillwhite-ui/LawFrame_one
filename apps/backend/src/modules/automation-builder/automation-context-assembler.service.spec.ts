import { AutomationContextAssemblerService } from './automation-context-assembler.service';

describe('AutomationContextAssemblerService', () => {
  it('keeps legal-secret context reference-only unless secure planner policy is enabled', () => {
    const service = new AutomationContextAssemblerService();

    const result = service.assemble({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      intentId: 'intent-1',
      requestedItems: [
        {
          id: 'context-1',
          type: 'selected_document',
          sourceId: 'document-version-1',
          classification: 'legal_secret',
          requestedMode: 'full_context',
        },
      ],
      policy: {
        allowLegalSecretExternalProvider: false,
        allowExternalProviderForClientMaterial: false,
        ragAvailable: true,
      },
    });

    expect(result.policyDecision).toBe('reference_substitution');
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'context-1',
        selectedMode: 'reference_only',
        blocked: true,
        reasonCode: 'legal_secret_policy_blocked',
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('document-version-1?token=');
  });
});
