import type { ActivepiecesJwtIssueInput } from './activepieces-session.types';
import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { SecretsService } from '../secrets/secrets.service';

export interface ActivepiecesJwtIssueResult {
  readonly jwtToken: string;
  readonly tokenHash: string;
  readonly jtiHash: string;
}

@Injectable()
export class ActivepiecesJwtSigner {
  private readonly env = loadServerEnv();

  constructor(
    @Optional()
    private readonly secretsService?: SecretsService,
  ) {}

  async issue(input: ActivepiecesJwtIssueInput): Promise<ActivepiecesJwtIssueResult> {
    const signingKey = this.resolveSigningPrivateKey();

    if (!signingKey.includes('BEGIN PRIVATE KEY')) {
      throw new AppHttpException(
        'SIGNING_KEY_UNAVAILABLE',
        503,
        'Activepieces signing private key is not an RS256 private key.',
        {
          signingKeyId: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
        },
      );
    }

    const nameParts = splitDisplayName(input.actor.fullName);
    const claims = {
      version: 'v3',
      externalUserId: input.externalUserId,
      externalProjectId: input.externalProjectId,
      projectDisplayName: input.projectDisplayName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      role: input.role,
      piecesFilterType: input.piecesPolicy.piecesFilterType,
      piecesTags: input.piecesPolicy.piecesTags,
    } as const;

    try {
      const privateKey = await importPKCS8(signingKey, 'RS256');
      const jwtToken = await new SignJWT(claims)
        .setProtectedHeader({
          alg: 'RS256',
          typ: 'JWT',
          kid: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
        })
        .setIssuedAt(input.issuedAtSeconds)
        .setExpirationTime(input.expiresAtSeconds)
        .setJti(input.jti)
        .sign(privateKey);

      return {
        jwtToken,
        tokenHash: this.hashRuntimeSecretScoped(jwtToken),
        jtiHash: this.hashRuntimeSecretScoped(input.jti),
      };
    } catch (error) {
      throw new AppHttpException(
        'TOKEN_SIGNING_FAILED',
        503,
        'Activepieces session JWT could not be signed.',
        {
          signingKeyId: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          reason:
            error instanceof Error ? error.message : 'token_signing_failed',
        },
      );
    }
  }

  hashRuntimeSecretScoped(value: string) {
    return createHash('sha256')
      .update(`${value}${this.env.LEXFRAME_RUNTIME_MASTER_SECRET}`)
      .digest('hex');
  }

  private resolveSigningPrivateKey() {
    const resolution = this.secretsService?.resolveRuntimeSecret({
      secretCode: 'ACTIVEPIECES_SIGNING_PRIVATE_KEY',
      secretRef: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF,
      envValue: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY,
      filePath: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE,
      fallbackFilePaths: [
        '/run/lexframe-stage17-secrets/activepieces_signing_private_key.pem',
        '/run/secrets/activepieces_signing_private_key',
      ],
      placeholderValues: ['stage0_signing_private_key'],
    }) ?? {
      configured: isUsableSecret(this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY),
      source: 'env' as const,
      ref: this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF || null,
      value: isUsableSecret(this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY)
        ? this.env.ACTIVEPIECES_SIGNING_PRIVATE_KEY.trim()
        : null,
      diagnostics: {},
    };

    if (!resolution.value) {
      throw new AppHttpException(
        'SIGNING_KEY_UNAVAILABLE',
        503,
        'Activepieces signing private key is unavailable.',
        {
          signingKeyId: this.env.ACTIVEPIECES_SIGNING_KEY_ID,
          source: resolution.source,
          secretRef: resolution.ref,
        },
      );
    }

    return resolution.value;
  }
}

function splitDisplayName(fullName: string | null) {
  const fallback = {
    firstName: 'LexFrame',
    lastName: 'User',
  };

  if (!fullName?.trim()) {
    return fallback;
  }

  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || fallback.firstName,
    lastName: rest.join(' ') || fallback.lastName,
  };
}

function isUsableSecret(value: string | undefined) {
  const trimmed = value?.trim();
  return Boolean(
    trimmed &&
      trimmed !== 'stage0_signing_private_key' &&
      !/^(stage0_|replace_with_|demo_|placeholder|example|change_me|PASTE_|YOUR_|<)/i.test(
        trimmed,
      ),
  );
}
