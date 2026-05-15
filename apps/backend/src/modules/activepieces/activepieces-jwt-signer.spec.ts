jest.mock('jose', () => ({
  importPKCS8: jest.fn(),
  SignJWT: jest.fn(),
}));

import { ActivepiecesJwtSigner } from './activepieces-jwt-signer';
import { importPKCS8, SignJWT } from 'jose';

type MockSignJwtChain = {
  readonly setProtectedHeader: jest.Mock;
  readonly setIssuedAt: jest.Mock;
  readonly setIssuer: jest.Mock;
  readonly setAudience: jest.Mock;
  readonly setSubject: jest.Mock;
  readonly setJti: jest.Mock;
  readonly setExpirationTime: jest.Mock;
  readonly sign: jest.Mock;
};

describe('ActivepiecesJwtSigner', () => {
  const originalKey = process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY;
  const originalKeyId = process.env.ACTIVEPIECES_SIGNING_KEY_ID;
  const originalRuntimeSecret = process.env.LEXFRAME_RUNTIME_MASTER_SECRET;

  afterEach(() => {
    jest.clearAllMocks();
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY = originalKey;
    process.env.ACTIVEPIECES_SIGNING_KEY_ID = originalKeyId;
    process.env.LEXFRAME_RUNTIME_MASTER_SECRET = originalRuntimeSecret;
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

  it('signs short-lived RS256 embed JWTs with safe AP claims and stores only hashes', async () => {
    process.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY = [
      ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
      'test',
      ['-----END', 'PRIVATE KEY-----'].join(' '),
    ].join('\n');
    process.env.ACTIVEPIECES_SIGNING_KEY_ID = 'kid_block4';
    process.env.LEXFRAME_RUNTIME_MASTER_SECRET = 'runtime_hash_secret_block4';
    const chain: MockSignJwtChain = {
      setProtectedHeader: jest.fn(() => chain),
      setIssuedAt: jest.fn(() => chain),
      setIssuer: jest.fn(() => chain),
      setAudience: jest.fn(() => chain),
      setSubject: jest.fn(() => chain),
      setJti: jest.fn(() => chain),
      setExpirationTime: jest.fn(() => chain),
      sign: jest.fn(() => Promise.resolve('signed.jwt.token')),
    };
    (importPKCS8 as jest.Mock).mockResolvedValue('private-key');
    (SignJWT as jest.Mock).mockImplementation(() => chain);
    const signer = new ActivepiecesJwtSigner();

    const result = await signer.issue({
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
        activeWorkspace: {
          id: 'ws_test',
          slug: 'workspace',
          name: 'Workspace',
          status: 'active',
          role: 'admin',
        },
        roles: ['admin'],
        permissions: ['activepieces.open_builder'],
      },
      externalUserId: 'lex_user_usr_test',
      externalProjectId: 'lex_ws_ws_test',
      projectDisplayName: 'Workspace',
      role: 'EDITOR',
      piecesPolicy: {
        piecesFilterType: 'ALLOWED',
        piecesTags: ['lexframe-core'],
        denylistedPieces: [],
        policyHash: 'sha256:policy',
      },
      issuedAtSeconds: 100,
      expiresAtSeconds: 220,
      jti: 'jti_test',
    });

    expect(importPKCS8).toHaveBeenCalledWith(
      expect.stringContaining(['BEGIN', 'PRIVATE KEY'].join(' ')),
      'RS256',
    );
    expect(SignJWT).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v3',
        externalUserId: 'lex_user_usr_test',
        externalProjectId: 'lex_ws_ws_test',
        projectDisplayName: 'Workspace',
        role: 'EDITOR',
        piecesFilterType: 'ALLOWED',
        piecesTags: ['lexframe-core'],
      }),
    );
    expect(chain.setProtectedHeader).toHaveBeenCalledWith({
      alg: 'RS256',
      typ: 'JWT',
      kid: 'kid_block4',
    });
    expect(chain.setExpirationTime).toHaveBeenCalledWith(220);
    expect(chain.setJti).toHaveBeenCalledWith('jti_test');
    expect(result.jwtToken).toBe('signed.jwt.token');
    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.jtiHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('jti_test');
  });
});
