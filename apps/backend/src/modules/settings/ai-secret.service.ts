import type { AiSecretBackend } from '@lexframe/contracts';
import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { SecretString } from '../local-owner-key-vault/secret-string';

export interface AiSecretWriteResult {
  readonly secretRefId: string;
  readonly backend: AiSecretBackend;
  readonly backendSecretId: string | null;
  readonly fingerprint: string;
  readonly status: 'active';
  readonly lastUpdatedAt: string;
}

export interface AiProviderCallSecret {
  readonly providerConnectionId: string;
  readonly providerCode: string;
  readonly baseUrl: string;
  readonly modelId: string;
  readonly secretRefId: string;
  readonly fingerprint: string | null;
  readonly apiKey: SecretString;
}

interface ProviderCallSecretRow {
  readonly provider_connection_id: string;
  readonly provider_code: string;
  readonly base_url: string;
  readonly default_model: string;
  readonly secret_ref_id: string | null;
  readonly backend: AiSecretBackend | null;
  readonly backend_secret_id: string | null;
  readonly fingerprint: string | null;
  readonly status: string | null;
}

@Injectable()
export class AiSecretService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createOrRotateSecret(input: {
    readonly actor: AuthenticatedActor;
    readonly workspaceId: string;
    readonly ownerScope: 'user' | 'workspace' | 'system';
    readonly ownerUserId: string | null;
    readonly providerConnectionId: string | null;
    readonly providerCode: string;
    readonly apiKey: string;
    readonly previousSecretRefId?: string | null;
  }): Promise<AiSecretWriteResult> {
    const backend = this.resolveWriteBackend();
    const fingerprint = fingerprintSecret(input.apiKey);
    const secretRefId = input.previousSecretRefId ?? randomUUID();
    const backendSecretId = await this.writeBackendSecret({
      backend,
      secretRefId,
      apiKey: input.apiKey,
      providerCode: input.providerCode,
      workspaceId: input.workspaceId,
    });
    const now = new Date().toISOString();

    await this.databaseService.query(
      `
        insert into app.ai_secret_refs (
          id,
          workspace_id,
          owner_scope,
          owner_user_id,
          provider_connection_id,
          backend,
          backend_secret_id,
          fingerprint,
          status,
          created_by,
          last_rotated_by,
          last_rotated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $9, timezone('utc', now()))
        on conflict (id) do update
        set
          backend = excluded.backend,
          backend_secret_id = excluded.backend_secret_id,
          fingerprint = excluded.fingerprint,
          status = 'active',
          last_rotated_by = excluded.last_rotated_by,
          last_rotated_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      `,
      [
        secretRefId,
        input.workspaceId,
        input.ownerScope,
        input.ownerUserId,
        input.providerConnectionId,
        backend,
        backendSecretId,
        fingerprint,
        input.actor.id,
      ],
    );

    return {
      secretRefId,
      backend,
      backendSecretId,
      fingerprint,
      status: 'active',
      lastUpdatedAt: now,
    };
  }

  async resolveProviderCallSecret(input: {
    readonly workspaceId: string;
    readonly providerConnectionId: string;
  }): Promise<AiProviderCallSecret> {
    const row = await this.databaseService.one<ProviderCallSecretRow>(
      `
        select
          c.id::text as provider_connection_id,
          c.provider_code,
          c.base_url,
          c.default_model,
          c.secret_ref_id::text,
          s.backend,
          s.backend_secret_id,
          s.fingerprint,
          s.status
        from app.ai_provider_connections c
        left join app.ai_secret_refs s
          on s.id = c.secret_ref_id
        where c.workspace_id = $1
          and c.id = $2
          and c.enabled = true
        limit 1
      `,
      [input.workspaceId, input.providerConnectionId],
    );

    if (!row) {
      throw new AppHttpException(
        'AI_PROVIDER_UNAVAILABLE',
        404,
        'AI provider connection was not found or is disabled.',
      );
    }

    if (!row.secret_ref_id || row.status !== 'active') {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'AI provider connection does not have an active callable secret.',
      );
    }

    if (row.backend === 'dev_mock') {
      const devSecret = resolveDevMockProviderSecret(row);
      if (devSecret) {
        return {
          providerConnectionId: row.provider_connection_id,
          providerCode: row.provider_code,
          baseUrl: row.base_url,
          modelId: row.default_model,
          secretRefId: row.secret_ref_id,
          fingerprint: row.fingerprint,
          apiKey: new SecretString(devSecret),
        };
      }
    }

    if (row.backend !== 'supabase_vault') {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'AI provider keys for live calls must be stored in Supabase Vault.',
      );
    }

    if (!row.backend_secret_id) {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'Supabase Vault secret reference is missing.',
      );
    }

    let vaultSecret: { readonly decrypted_secret: string | null } | null;

    try {
      vaultSecret = await this.databaseService.one<{
        readonly decrypted_secret: string | null;
      }>(
        `
          select decrypted_secret
          from vault.decrypted_secrets
          where id::text = $1
          limit 1
        `,
        [row.backend_secret_id],
      );
    } catch (error) {
      if (isSupabaseVaultUnavailable(error)) {
        throw supabaseVaultUnavailable();
      }

      throw error;
    }

    if (!vaultSecret?.decrypted_secret) {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'Supabase Vault did not return a decrypted AI provider key.',
      );
    }

    return {
      providerConnectionId: row.provider_connection_id,
      providerCode: row.provider_code,
      baseUrl: row.base_url,
      modelId: row.default_model,
      secretRefId: row.secret_ref_id,
      fingerprint: row.fingerprint,
      apiKey: new SecretString(vaultSecret.decrypted_secret),
    };
  }

  async markProviderConnectionUsed(input: {
    readonly workspaceId: string;
    readonly providerConnectionId: string;
  }): Promise<void> {
    await this.databaseService.query(
      `
        update app.ai_provider_connections
        set last_used_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        where workspace_id = $1
          and id = $2
      `,
      [input.workspaceId, input.providerConnectionId],
    );
  }

  private resolveWriteBackend(): AiSecretBackend {
    const requested = process.env.LEXFRAME_AI_SECRET_BACKEND as
      | AiSecretBackend
      | undefined;
    const production =
      process.env.LEXFRAME_DEPLOY_ENV === 'production' ||
      process.env.LEXFRAME_ENV_PROFILE === 'production';
    const backend = requested ?? (production ? 'supabase_vault' : 'dev_mock');

    if (production && backend !== 'supabase_vault') {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'Production AI secret writes require Supabase Vault.',
      );
    }

    if (backend === 'env_secret') {
      throw new AppHttpException(
        'AI_SECRET_BACKEND_UNAVAILABLE',
        503,
        'env_secret is read-only and cannot store user-provided API keys.',
      );
    }

    return backend;
  }

  private async writeBackendSecret(input: {
    readonly backend: AiSecretBackend;
    readonly secretRefId: string;
    readonly apiKey: string;
    readonly providerCode: string;
    readonly workspaceId: string;
  }): Promise<string | null> {
    if (input.backend === 'supabase_vault') {
      let row: { readonly vault_secret_id: string } | null;

      try {
        row = await this.databaseService.one<{
          readonly vault_secret_id: string;
        }>(
          `
            select vault.create_secret(
              $1,
              $2,
              $3
            )::text as vault_secret_id
          `,
          [
            input.apiKey,
            `lexframe_ai_${input.workspaceId}_${input.secretRefId}`,
            `LexFrame AI ${input.providerCode} key`,
          ],
        );
      } catch (error) {
        if (isSupabaseVaultUnavailable(error)) {
          throw supabaseVaultUnavailable();
        }

        throw error;
      }

      if (!row?.vault_secret_id) {
        throw new AppHttpException(
          'AI_SECRET_BACKEND_UNAVAILABLE',
          503,
          'Supabase Vault did not return a secret id.',
        );
      }

      return row.vault_secret_id;
    }

    if (input.backend === 'local_owner_vault') {
      return `local_owner_vault:${input.secretRefId}`;
    }

    if (input.backend === 'dev_mock') {
      return `dev_mock:${input.secretRefId}`;
    }

    throw new AppHttpException(
      'AI_SECRET_BACKEND_UNAVAILABLE',
      503,
      'AI secret backend is not writable.',
    );
  }
}

export function fingerprintSecret(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

function supabaseVaultUnavailable(): AppHttpException {
  return new AppHttpException(
    'AI_SECRET_BACKEND_UNAVAILABLE',
    503,
    'Supabase Vault is unavailable for AI provider key storage in this environment.',
  );
}

function isSupabaseVaultUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  const message =
    error instanceof Error
      ? error.message
      : 'message' in error
        ? String(error.message)
        : '';

  return (
    ['3F000', '42P01', '42883'].includes(code) &&
    message.toLowerCase().includes('vault')
  );
}

function resolveDevMockProviderSecret(row: ProviderCallSecretRow): string | null {
  if (process.env.AI_PROVIDER_MODE !== 'controlled-real') {
    return null;
  }

  const candidates = getBackendOnlyProviderKeys(row.provider_code);
  if (candidates.length === 0 || !row.fingerprint) {
    return null;
  }

  return (
    candidates.find((candidate) => fingerprintSecret(candidate) === row.fingerprint) ??
    null
  );
}

function getBackendOnlyProviderKeys(providerCode: string): readonly string[] {
  if (providerCode !== 'cometapi' && providerCode !== 'openai_compatible') {
    return [];
  }

  const values = [
    ...(process.env.COMETAPI_API_KEYS ?? '').split(/[\s,;]+/),
    process.env.COMETAPI_KEY,
    process.env.COMETAPI_API_KEY,
  ]
    .map((value) => value?.trim() ?? '')
    .filter(isConfiguredRuntimeSecret);

  return Array.from(new Set(values));
}

function isConfiguredRuntimeSecret(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith('stage0_') &&
    !value.startsWith('replace_with_')
  );
}
