jest.mock('jose', () => ({
  importPKCS8: jest.fn(),
  SignJWT: jest.fn(),
}));

import { ActivepiecesJwtSigner } from './activepieces-jwt-signer';

describe('ActivepiecesJwtSigner', () => {
  const originalKey = process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY;

  afterEach(() => {
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY = originalKey;
  });

  it('does not fall back to a dev token when the RS256 signing key is unavailable', async () => {
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY = 'stage0_signing_private_key';
    const signer = new ActivepiecesJwtSigner();

    await expect(
      signer.issue({
        actor: {
          id: 'usr_test',
          email: 'user@example.com',
          fullName: 'Test User',
          emailConfirmedAt: '2026-04-28T00:00:00.000Z',
          assuranceLevel: 'aal1',
          accessToken: 'access',
          sessionId: 'sess',
        },
        access: {
          activeWorkspace: null,
          roles: ['viewer'],
          permissions: ['automation.read'],
        },
        externalUserId: 'lex_user_usr_test',
        externalProjectId: 'lex_ws_ws_test',
        projectDisplayName: 'Workspace',
        role: 'VIEWER',
        piecesPolicy: {
          piecesFilterType: 'ALLOWED',
          piecesTags: ['lexframe-core'],
          denylistedPieces: [],
          policyHash: 'sha256:policy',
        },
        issuedAtSeconds: 1,
        expiresAtSeconds: 121,
        jti: 'jti_test',
      }),
    ).rejects.toMatchObject({ code: 'SIGNING_KEY_UNAVAILABLE' });
  });
});
