import type { AiSecretBackend } from '@lexframe/contracts';
import type { AuthenticatedActor } from '../../common/types/lexframe-request';
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';

export interface AiSecretWriteResult {
  readonly secretRefId: string;
  readonly backend: AiSecretBackend;
  readonly backendSecretId: string | null;
  readonly fingerprint: string;
  readonly status: 'active';
  readonly lastUpdatedAt: string;
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

  private resolveWriteBackend(): AiSecretBackend {
    const requested = process.env.LEXFRAME_AI_SECRET_BACKEND as
      | AiSecretBackend
      | undefined;
    const production = process.env.NODE_ENV === 'production';
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
      const row = await this.databaseService.one<{
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
