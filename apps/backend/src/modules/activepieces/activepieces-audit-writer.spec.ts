import { ActivepiecesAuditWriter } from './activepieces-audit-writer';

describe('ActivepiecesAuditWriter', () => {
  it('redacts JWTs, API keys and credentials before audit persistence', async () => {
    const auditService = {
      record: jest.fn(() => Promise.resolve()),
    };
    const writer = new ActivepiecesAuditWriter(auditService as never);

    await writer.record({
      actor: {
        id: 'usr_block4',
        email: 'block4@example.test',
        fullName: 'Block4 User',
        emailConfirmedAt: '2026-05-13T00:00:00.000Z',
        assuranceLevel: 'aal1',
        accessToken: 'actor-access-token',
        sessionId: 'sess_block4',
      },
      workspaceId: 'ws_block4',
      automationId: 'aut_block4',
      sessionId: 'ap_sess_block4',
      action: 'activepieces.session.issued',
      result: 'success',
      meta: {
        requestId: 'req_block4',
        traceId: 'trace_block4',
      },
      metadata: {
        tokenHashPrefix: 'raw-token-hash-prefix',
        jwtToken: 'eyJhbGciOiJSUzI1NiJ9.payload.signature',
        nested: {
          apiKey: 'sk-secret-provider-key',
          credential: 'runtime-credential',
          safeStatus: 'ready',
        },
      },
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        redactionApplied: true,
        redactionSummary: {
          rawJwtStored: false,
          secretsStored: false,
        },
        metadata: expect.objectContaining({
          tokenHashPrefix: '[redacted]',
          jwtToken: '[redacted]',
          nested: expect.objectContaining({
            apiKey: '[redacted]',
            credential: '[redacted]',
            safeStatus: 'ready',
          }),
        }),
      }),
    );
    expect(JSON.stringify(auditService.record.mock.calls[0])).not.toContain(
      'sk-secret-provider-key',
    );
  });
});
