import { AuditService } from './audit.service';

describe('AuditService redaction boundary', () => {
  it('redacts secret references, authorization values and signed URLs before persisting metadata', async () => {
    const unsafeAuthMessage = [
      'Authorization:',
      'Bearer',
      'eyJhbGciOiJIUzI1NiJ9.secret.payload',
    ].join(' ');
    const databaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new AuditService(databaseService as never);

    await service.record({
      actorUserId: 'user_001',
      actorEmail: 'owner@example.test',
      workspaceId: 'workspace_001',
      action: 'security.redaction.probe',
      entityType: 'settings',
      entityId: 'settings_001',
      result: 'success',
      redactionApplied: false,
      redactionSummary: {
        backendSecretId: 'vault_secret_should_not_persist',
      },
      metadata: {
        secret_ref_id: '00000000-0000-4000-8000-000000000099',
        nested: {
          message: unsafeAuthMessage,
          previewUrl:
            'https://storage.local/storage/v1/object/sign/documents/a.pdf?token=signed-token',
        },
      },
    });

    const params = databaseService.query.mock.calls[0]?.[1] as
      | readonly unknown[]
      | undefined;
    expect(params).toBeDefined();
    expect(params?.[13]).toBe(true);

    const redactionSummary = JSON.parse(String(params?.[14])) as Record<
      string,
      unknown
    >;
    const metadata = JSON.parse(String(params?.[15])) as Record<
      string,
      unknown
    >;

    expect(redactionSummary).toEqual({
      backendSecretId: '[REDACTED]',
    });
    expect(metadata).toMatchObject({
      secret_ref_id: '[REDACTED]',
      nested: {
        message: '[REDACTED]',
        previewUrl: '[REDACTED]',
      },
    });
    expect(JSON.stringify(metadata)).not.toContain(
      'vault_secret_should_not_persist',
    );
    expect(JSON.stringify(metadata)).not.toContain('signed-token');
    expect(JSON.stringify(metadata)).not.toContain('Authorization: Bearer');
  });
});
