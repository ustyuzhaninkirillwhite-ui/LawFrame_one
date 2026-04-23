import type { SecretInventoryItem } from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { loadServerEnv } from '@lexframe/config';
import { Injectable } from '@nestjs/common';
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
      secretCode: 'ACTIVEPIECES_SIGNING_PRIVATE_KEY',
      provider: 'activepieces',
      backendOnly: true,
      usedBy: ['embed-signing'],
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
  const value = env[secretCode as keyof typeof env];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'missing';
  }

  if (
    value.startsWith('stage0_') ||
    value.startsWith('replace_with_') ||
    value.startsWith('demo_')
  ) {
    return 'missing';
  }

  return 'configured';
}
