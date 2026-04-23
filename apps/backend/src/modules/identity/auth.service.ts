import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { loadServerEnv } from '@lexframe/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';

interface DevTokenPayload {
  readonly id: string;
  readonly email: string;
  readonly fullName?: string | null;
  readonly emailConfirmedAt?: string | null;
  readonly assuranceLevel?: 'aal1' | 'aal2';
}

@Injectable()
export class AuthService {
  private readonly env = loadServerEnv();
  private readonly jwks = createRemoteJWKSet(
    new URL(`${this.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  );

  async authenticateFromHeader(
    authorizationHeader: string | undefined,
  ): Promise<AuthenticatedActor> {
    const token = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      throw new AppHttpException(
        'AUTH_REQUIRED',
        UnauthorizedException.prototype.getStatus.call(
          new UnauthorizedException(),
        ),
        'Authorization bearer token is required.',
      );
    }

    return this.authenticateToken(token);
  }

  async authenticateToken(token: string): Promise<AuthenticatedActor> {
    if (token.startsWith('dev.')) {
      return this.parseDevToken(token);
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks);
      const subject = typeof payload.sub === 'string' ? payload.sub : null;
      const email = typeof payload.email === 'string' ? payload.email : null;

      if (!subject || !email) {
        throw new AppHttpException(
          'SESSION_INVALID',
          401,
          'Supabase access token does not contain required claims.',
        );
      }

      const fullName = this.pickFirstString(
        payload.user_metadata as Record<string, unknown> | undefined,
        ['full_name', 'name'],
      );
      const emailConfirmedAt =
        this.pickKnownString(
          payload.email_confirmed_at,
          payload.confirmed_at,
        ) ?? new Date().toISOString();
      const assuranceLevel = payload.aal === 'aal2' ? 'aal2' : 'aal1';

      return {
        id: subject,
        email,
        fullName,
        emailConfirmedAt,
        assuranceLevel,
        accessToken: token,
        sessionId: this.deriveSessionId(token, subject),
      };
    } catch (error) {
      if (error instanceof AppHttpException) {
        throw error;
      }

      throw new AppHttpException(
        'SESSION_INVALID',
        401,
        'Supabase access token is invalid or expired.',
        {
          cause:
            error instanceof Error
              ? error.message
              : 'unknown_auth_verification_error',
        },
      );
    }
  }

  private parseDevToken(token: string): AuthenticatedActor {
    const encoded = token.slice('dev.'.length);

    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as DevTokenPayload;

      if (!payload.id || !payload.email) {
        throw new Error('Missing required dev token fields.');
      }

      return {
        id: payload.id,
        email: payload.email,
        fullName: payload.fullName ?? null,
        emailConfirmedAt: payload.emailConfirmedAt ?? new Date().toISOString(),
        assuranceLevel: payload.assuranceLevel ?? 'aal1',
        accessToken: token,
        sessionId: this.deriveSessionId(token, payload.id),
      };
    } catch (error) {
      throw new AppHttpException(
        'SESSION_INVALID',
        401,
        'Development access token is malformed.',
        {
          cause: error instanceof Error ? error.message : 'invalid_dev_token',
        },
      );
    }
  }

  private pickKnownString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private pickFirstString(
    source: Record<string, unknown> | undefined,
    keys: readonly string[],
  ): string | null {
    if (!source) {
      return null;
    }

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  private deriveSessionId(token: string, subject: string): string {
    return createHash('sha256')
      .update(`${subject}:${token}`)
      .digest('hex')
      .slice(0, 32);
  }
}
