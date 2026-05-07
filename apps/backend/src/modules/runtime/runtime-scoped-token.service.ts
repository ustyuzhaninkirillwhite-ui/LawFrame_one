import { loadServerEnv } from '@lexframe/config';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export type RuntimeScope =
  | 'runtime.ai.invoke'
  | 'runtime.callback.write'
  | 'artifact.create';

export type ScopedRuntimeTokenPurpose =
  | 'activepieces_ai_gateway_action'
  | 'activepieces_callback'
  | 'artifact_write';

export interface ScopedRuntimeTokenClaims {
  readonly iss: 'lexframe-runtime';
  readonly sub: `service:activepieces:${string}`;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly run_id: string;
  readonly ap_project_id: string;
  readonly ap_flow_id: string;
  readonly ap_flow_version_id?: string;
  readonly step_name: string;
  readonly purpose: ScopedRuntimeTokenPurpose;
  readonly scope: readonly RuntimeScope[];
  readonly exp: number;
  readonly iat: number;
  readonly jti: string;
  readonly trace_id: string;
}

export interface IssueScopedRuntimeTokenInput {
  readonly workspaceId: string;
  readonly automationId: string;
  readonly runId: string;
  readonly apProjectId: string;
  readonly apFlowId: string;
  readonly apFlowVersionId?: string | null;
  readonly stepName: string;
  readonly purpose: ScopedRuntimeTokenPurpose;
  readonly scope: readonly RuntimeScope[];
  readonly traceId: string;
  readonly ttlSeconds?: number;
  readonly issuedAtSeconds?: number;
  readonly jti?: string;
}

export interface VerifyScopedRuntimeTokenInput {
  readonly token: string;
  readonly requiredScope?: RuntimeScope;
  readonly requiredAnyScope?: readonly RuntimeScope[];
  readonly purpose?: ScopedRuntimeTokenPurpose;
  readonly expectedRunId?: string | null;
  readonly expectedWorkspaceId?: string | null;
  readonly expectedAutomationId?: string | null;
  readonly expectedFlowId?: string | null;
  readonly expectedStepName?: string | null;
}

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;
const DEFAULT_TTL_SECONDS = 10 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 15 * 60;

@Injectable()
export class RuntimeScopedTokenService {
  private readonly env = loadServerEnv();

  issue(input: IssueScopedRuntimeTokenInput): {
    readonly token: string;
    readonly claims: ScopedRuntimeTokenClaims;
    readonly tokenHash: string;
    readonly jtiHash: string;
    readonly expiresAt: Date;
  } {
    const iat = input.issuedAtSeconds ?? Math.floor(Date.now() / 1000);
    const ttl = clampTtl(input.ttlSeconds ?? DEFAULT_TTL_SECONDS);
    const claims: ScopedRuntimeTokenClaims = {
      iss: 'lexframe-runtime',
      sub: `service:activepieces:${input.apProjectId}`,
      workspace_id: input.workspaceId,
      automation_id: input.automationId,
      run_id: input.runId,
      ap_project_id: input.apProjectId,
      ap_flow_id: input.apFlowId,
      ...(input.apFlowVersionId
        ? { ap_flow_version_id: input.apFlowVersionId }
        : {}),
      step_name: input.stepName,
      purpose: input.purpose,
      scope: Array.from(new Set(input.scope)).sort(),
      exp: iat + ttl,
      iat,
      jti: input.jti ?? randomUUID(),
      trace_id: input.traceId,
    };
    const token = sign(claims, this.secret());

    return {
      token,
      claims,
      tokenHash: hashValue(token),
      jtiHash: hashValue(claims.jti),
      expiresAt: new Date(claims.exp * 1000),
    };
  }

  verify(input: VerifyScopedRuntimeTokenInput): ScopedRuntimeTokenClaims {
    const claims = verifySignedToken(input.token, this.secret());
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp <= now) {
      throw new AppHttpException(
        'SCOPED_RUNTIME_TOKEN_EXPIRED',
        401,
        'Scoped runtime token has expired.',
        {
          jtiHash: hashValue(claims.jti),
          exp: claims.exp,
        },
      );
    }

    if (input.purpose && claims.purpose !== input.purpose) {
      throw invalidScopedToken('Scoped runtime token purpose is invalid.');
    }
    if (input.requiredScope && !claims.scope.includes(input.requiredScope)) {
      throw invalidScopedToken('Scoped runtime token scope is invalid.');
    }
    if (
      input.requiredAnyScope &&
      !input.requiredAnyScope.some((scope) => claims.scope.includes(scope))
    ) {
      throw invalidScopedToken('Scoped runtime token scope is invalid.');
    }
    if (input.expectedRunId && claims.run_id !== input.expectedRunId) {
      throw invalidScopedToken('Scoped runtime token run boundary is invalid.');
    }
    if (
      input.expectedWorkspaceId &&
      claims.workspace_id !== input.expectedWorkspaceId
    ) {
      throw invalidScopedToken(
        'Scoped runtime token workspace boundary is invalid.',
      );
    }
    if (
      input.expectedAutomationId &&
      claims.automation_id !== input.expectedAutomationId
    ) {
      throw invalidScopedToken(
        'Scoped runtime token automation boundary is invalid.',
      );
    }
    if (input.expectedFlowId && claims.ap_flow_id !== input.expectedFlowId) {
      throw invalidScopedToken(
        'Scoped runtime token flow boundary is invalid.',
      );
    }
    if (input.expectedStepName && claims.step_name !== input.expectedStepName) {
      throw invalidScopedToken(
        'Scoped runtime token step boundary is invalid.',
      );
    }

    return claims;
  }

  hashToken(token: string) {
    return hashValue(token);
  }

  hashJti(jti: string) {
    return hashValue(jti);
  }

  private secret() {
    return this.env.LEXFRAME_RUNTIME_MASTER_SECRET;
  }
}

function sign(claims: ScopedRuntimeTokenClaims, secret: string) {
  const header = base64UrlJson(HEADER);
  const payload = base64UrlJson(claims);
  const signature = hmac(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

function verifySignedToken(
  token: string,
  secret: string,
): ScopedRuntimeTokenClaims {
  const [header, payload, signature, extra] = token.split('.');
  if (!header || !payload || !signature || extra !== undefined) {
    throw invalidScopedToken('Runtime authorization token is malformed.');
  }
  const expected = hmac(`${header}.${payload}`, secret);
  if (!safeEqual(signature, expected)) {
    throw invalidScopedToken(
      'Runtime authorization token signature is invalid.',
    );
  }

  const decodedHeader = parseBase64UrlJson(header) as Record<string, unknown>;
  if (decodedHeader.alg !== HEADER.alg || decodedHeader.typ !== HEADER.typ) {
    throw invalidScopedToken('Runtime authorization token header is invalid.');
  }

  return validateClaims(parseBase64UrlJson(payload));
}

function validateClaims(value: unknown): ScopedRuntimeTokenClaims {
  if (!isRecord(value)) {
    throw invalidScopedToken('Runtime authorization token payload is invalid.');
  }
  const scope = value.scope;
  const claims = value as Record<string, unknown>;
  const requiredStrings = [
    'workspace_id',
    'automation_id',
    'run_id',
    'ap_project_id',
    'ap_flow_id',
    'step_name',
    'purpose',
    'jti',
    'trace_id',
    'sub',
    'iss',
  ];
  for (const key of requiredStrings) {
    if (typeof claims[key] !== 'string' || String(claims[key]).length === 0) {
      throw invalidScopedToken(
        'Runtime authorization token payload is invalid.',
      );
    }
  }
  if (claims.iss !== 'lexframe-runtime') {
    throw invalidScopedToken('Runtime authorization token issuer is invalid.');
  }
  if (
    claims.purpose !== 'activepieces_ai_gateway_action' &&
    claims.purpose !== 'activepieces_callback' &&
    claims.purpose !== 'artifact_write'
  ) {
    throw invalidScopedToken('Runtime authorization token purpose is invalid.');
  }
  if (!Array.isArray(scope) || !scope.every(isRuntimeScope)) {
    throw invalidScopedToken('Runtime authorization token scope is invalid.');
  }
  if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
    throw invalidScopedToken('Runtime authorization token timing is invalid.');
  }

  return {
    iss: 'lexframe-runtime',
    sub: claims.sub as `service:activepieces:${string}`,
    workspace_id: claims.workspace_id as string,
    automation_id: claims.automation_id as string,
    run_id: claims.run_id as string,
    ap_project_id: claims.ap_project_id as string,
    ap_flow_id: claims.ap_flow_id as string,
    ...(typeof claims.ap_flow_version_id === 'string'
      ? { ap_flow_version_id: claims.ap_flow_version_id }
      : {}),
    step_name: claims.step_name as string,
    purpose: claims.purpose as ScopedRuntimeTokenPurpose,
    scope,
    exp: claims.exp,
    iat: claims.iat,
    jti: claims.jti as string,
    trace_id: claims.trace_id as string,
  };
}

function isRuntimeScope(value: unknown): value is RuntimeScope {
  return (
    value === 'runtime.ai.invoke' ||
    value === 'runtime.callback.write' ||
    value === 'artifact.create'
  );
}

function hmac(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseBase64UrlJson(value: string): unknown {
  try {
    return JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
  } catch {
    throw invalidScopedToken('Runtime authorization token payload is invalid.');
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function clampTtl(value: number) {
  return Math.min(
    MAX_TTL_SECONDS,
    Math.max(MIN_TTL_SECONDS, Math.floor(value)),
  );
}

function invalidScopedToken(message: string) {
  return new AppHttpException('WORKSPACE_ACCESS_DENIED', 403, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
