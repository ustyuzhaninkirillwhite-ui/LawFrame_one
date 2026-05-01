import type { SecretInventoryItem } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

interface SecretRow {
  readonly id: string;
  readonly secret_code: string;
  readonly provider: string;
  readonly status: SecretInventoryItem['status'];
  readonly backend_only: boolean;
  readonly last_rotated_at: string | null;
  readonly next_rotation_due_at: string | null;
  readonly used_by: readonly string[] | null;
  readonly last_used_at: string | null;
}

interface SecretCatalogEntry {
  readonly secretCode: string;
  readonly provider: string;
  readonly backendOnly: boolean;
  readonly usedBy: readonly string[];
}

export interface RuntimeSecretResolution {
  readonly configured: boolean;
  readonly source: 'env' | 'file' | 'missing';
  readonly ref: string | null;
  readonly value: string | null;
  readonly diagnostics: Record<string, unknown>;
}

@Injectable()
export class SecretsService {
  private readonly env = loadServerEnv();
  private readonly secretCatalog: readonly SecretCatalogEntry[] = [
    {
      secretCode: 'SUPABASE_PUBLISHABLE_KEY',
      provider: 'supabase',
      backendOnly: false,
      usedBy: ['web', 'backend'],
    },
    {
      secretCode: 'SUPABASE_SECRET_KEY',
      provider: 'supabase',
      backendOnly: true,
      usedBy: ['backend', 'storage-signed-urls'],
    },
    {
      secretCode: 'ACTIVEPIECES_API_KEY',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['runtime-sync', 'builder'],
    },
    {
      secretCode: 'ACTIVEPIECES_API_KEY_SECRET_REF',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['runtime-sync', 'builder'],
    },
    {
      secretCode: 'ACTIVEPIECES_SIGNING_PRIVATE_KEY',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['embed-signing'],
    },
    {
      secretCode: 'ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['embed-signing'],
    },
    {
      secretCode: 'ACTIVEPIECES_WORKER_TOKEN_SECRET_REF',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['activepieces-worker'],
    },
    {
      secretCode: 'AP_JWT_SECRET',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['activepieces-app', 'activepieces-worker'],
    },
    {
      secretCode: 'AP_ENCRYPTION_KEY',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['activepieces-app'],
    },
    {
      secretCode: 'AP_POSTGRES_PASSWORD',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: [
        'activepieces-postgres',
        'activepieces-app',
        'activepieces-worker',
      ],
    },
    {
      secretCode: 'AP_REDIS_PASSWORD',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['activepieces-redis', 'activepieces-app', 'activepieces-worker'],
    },
    {
      secretCode: 'XAI_API_KEY',
      provider: 'xai',
      backendOnly: true,
      usedBy: ['ai-gateway'],
    },
    {
      secretCode: 'COMETAPI_API_KEY',
      provider: 'cometapi',
      backendOnly: true,
      usedBy: ['ai-gateway'],
    },
    {
      secretCode: 'LEXFRAME_RUNTIME_MASTER_SECRET',
      provider: 'lexframe',
      backendOnly: true,
      usedBy: ['runtime-signing'],
    },
    {
      secretCode: 'LEXFRAME_DELIVERY_WEBHOOK_TOKEN',
      provider: 'delivery',
      backendOnly: true,
      usedBy: ['delivery'],
    },
  ];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async listInventory(): Promise<readonly SecretInventoryItem[]> {
    const rows = await this.loadInventoryRows();
    const rowsByCode = new Map(rows.map((row) => [row.secret_code, row]));
    const catalogCodes = new Set(
      this.secretCatalog.map((entry) => entry.secretCode),
    );
    const merged = this.secretCatalog.map((entry, index) => {
      const row = rowsByCode.get(entry.secretCode);

      return row ? this.mapRow(row) : this.mapEnvSecret(entry, `env-${index}`);
    });

    for (const row of rows) {
      if (!catalogCodes.has(row.secret_code)) {
        merged.push(this.mapRow(row));
      }
    }

    return merged.sort((left, right) =>
      left.secretCode.localeCompare(right.secretCode),
    );
  }

  resolveRuntimeSecret(input: {
    readonly secretCode: string;
    readonly secretRef?: string;
    readonly envValue?: string;
    readonly filePath?: string;
    readonly fallbackFilePaths?: readonly string[];
    readonly placeholderValues?: readonly string[];
  }): RuntimeSecretResolution {
    const ref = normalizeOptional(input.secretRef);
    const envValue = normalizeOptional(input.envValue);
    const placeholderValues = input.placeholderValues ?? [];

    if (isUsableSecretValue(envValue, placeholderValues)) {
      return {
        configured: true,
        source: 'env',
        ref,
        value: envValue,
        diagnostics: {
          configured: true,
          source: 'env',
          secret_ref: ref,
          value_exposed: false,
        },
      };
    }

    const filePaths = [
      normalizeOptional(input.filePath),
      ...(input.fallbackFilePaths ?? []).map((item) => normalizeOptional(item)),
    ].filter((item): item is string => Boolean(item));
    const match = filePaths.find((filePath) => existsSync(filePath));

    if (match) {
      const value = readFileSync(match, 'utf8').trim();

      if (isUsableSecretValue(value, placeholderValues)) {
        return {
          configured: true,
          source: 'file',
          ref,
          value,
          diagnostics: {
            configured: true,
            source: 'file',
            secret_ref: ref,
            file_hint: basename(match),
            value_exposed: false,
          },
        };
      }
    }

    return {
      configured: false,
      source: 'missing',
      ref,
      value: null,
      diagnostics: {
        configured: false,
        source: 'missing',
        secret_ref: ref,
        file_hints: filePaths.map((filePath) => basename(filePath)),
        value_exposed: false,
      },
    };
  }

  async markCompromised(
    actor: AuthenticatedActor,
    access: AccessContext,
    secretCode: string,
    notes: string | null,
    requestId: string | null,
    traceId: string | null,
  ) {
    await this.upsertSecret(secretCode, {
      status: 'compromised',
      notes,
      actorUserId: actor.id,
    });
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'secret.rotation_compromised',
      entityType: 'secret_inventory',
      entityId: secretCode,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'secret',
      sessionId: actor.sessionId,
      metadata: { notes },
    });

    return { status: 'compromised' as const };
  }

  async startRotation(
    actor: AuthenticatedActor,
    access: AccessContext,
    secretCode: string,
    notes: string | null,
    requestId: string | null,
    traceId: string | null,
  ) {
    await this.upsertSecret(secretCode, {
      status: 'rotation_due',
      notes,
      actorUserId: actor.id,
    });
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'secret.rotation_started',
      entityType: 'secret_inventory',
      entityId: secretCode,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'secret',
      sessionId: actor.sessionId,
      metadata: { notes },
    });

    return { status: 'rotation_started' as const };
  }

  async completeRotation(
    actor: AuthenticatedActor,
    access: AccessContext,
    secretCode: string,
    notes: string | null,
    requestId: string | null,
    traceId: string | null,
  ) {
    await this.upsertSecret(secretCode, {
      status: 'configured',
      notes,
      actorUserId: actor.id,
      completed: true,
    });
    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'secret.rotation_completed',
      entityType: 'secret_inventory',
      entityId: secretCode,
      result: 'success',
      requestId,
      traceId,
      eventCategory: 'secret',
      sessionId: actor.sessionId,
      metadata: { notes },
    });

    return { status: 'rotation_completed' as const };
  }

  private async loadInventoryRows(): Promise<readonly SecretRow[]> {
    try {
      const result = await this.databaseService.query<SecretRow>(
        `
          select
            inventory.id,
            inventory.secret_code,
            inventory.provider,
            inventory.status,
            inventory.backend_only,
            inventory.last_rotated_at,
            inventory.next_rotation_due_at,
            inventory.used_by,
            usage.last_used_at
          from app.secret_inventory inventory
          left join lateral (
            select max(created_at)::text as last_used_at
            from app.secret_usage_events usage
            where usage.secret_code = inventory.secret_code
          ) usage on true
          order by inventory.secret_code asc
        `,
      );

      return result.rows;
    } catch {
      return [];
    }
  }

  private async upsertSecret(
    secretCode: string,
    input: {
      readonly status: SecretInventoryItem['status'];
      readonly notes: string | null;
      readonly actorUserId: string | null;
      readonly completed?: boolean;
    },
  ) {
    await this.databaseService.query(
      `
        insert into app.secret_inventory (
          secret_code,
          provider,
          status,
          backend_only,
          rotation_period_days,
          last_rotated_at,
          next_rotation_due_at,
          used_by
        )
        values (
          $1,
          'env',
          $2,
          true,
          90,
          case when $3 = true then timezone('utc', now()) else null end,
          case when $3 = true then timezone('utc', now()) + interval '90 days' else timezone('utc', now()) end,
          '{}'::text[]
        )
        on conflict (secret_code) do update
        set
          provider = excluded.provider,
          status = excluded.status,
          last_rotated_at = case
            when $3 = true then timezone('utc', now())
            else app.secret_inventory.last_rotated_at
          end,
          next_rotation_due_at = case
            when $3 = true then timezone('utc', now()) + interval '90 days'
            else timezone('utc', now())
          end,
          updated_at = timezone('utc', now())
      `,
      [secretCode, input.status, input.completed ?? false],
    );

    await this.databaseService.query(
      `
        insert into app.secret_rotation_events (
          secret_code,
          rotation_type,
          started_by,
          completed_by,
          status,
          notes,
          completed_at
        )
        values (
          $1,
          'manual',
          $2,
          case when $4 = true then $2 else null end,
          $3,
          $5,
          case when $4 = true then timezone('utc', now()) else null end
        )
      `,
      [
        secretCode,
        input.actorUserId,
        input.status === 'compromised'
          ? 'compromised'
          : input.completed
            ? 'completed'
            : 'started',
        input.completed ?? false,
        input.notes,
      ],
    );
  }

  private mapEnvSecret(
    entry: SecretCatalogEntry,
    id: string,
  ): SecretInventoryItem {
    return {
      id,
      secretCode: entry.secretCode,
      provider: entry.provider,
      status: resolveEnvSecretStatus(entry.secretCode, this.env),
      backendOnly: entry.backendOnly,
      lastRotatedAt: null,
      nextRotationDueAt: null,
      usedBy: entry.usedBy,
      lastUsedAt: null,
    };
  }

  private mapRow(row: SecretRow): SecretInventoryItem {
    return {
      id: row.id,
      secretCode: row.secret_code,
      provider: row.provider,
      status: row.status,
      backendOnly: row.backend_only,
      lastRotatedAt: row.last_rotated_at,
      nextRotationDueAt: row.next_rotation_due_at,
      usedBy: row.used_by ?? [],
      lastUsedAt: row.last_used_at,
    };
  }
}

function resolveEnvSecretStatus(
  secretCode: string,
  env: ReturnType<typeof loadServerEnv>,
): SecretInventoryItem['status'] {
  const value =
    env[secretCode as keyof typeof env] ??
    process.env[secretCode] ??
    process.env[`${secretCode}_FILE`] ??
    process.env[`${secretCode}_SECRET_REF`];

  if (!isUsableSecretValue(typeof value === 'string' ? value : null, [])) {
    return 'missing';
  }

  return 'configured';
}

function normalizeOptional(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function isUsableSecretValue(
  value: string | null,
  placeholderValues: readonly string[],
) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  if (placeholderValues.includes(normalized)) {
    return false;
  }

  return !/^(stage0_|replace_with_|demo_|placeholder|example|change_me|PASTE_|YOUR_|<)/i.test(
    normalized,
  );
}
