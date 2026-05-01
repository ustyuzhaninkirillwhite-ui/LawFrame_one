import type {
  KeyResolverResult,
  LocalKeyRuntimeRecord,
  LocalOwnerKeyProvider,
  ResolveLocalKeyInput,
  SafeLocalKeysStatus,
} from './local-owner-key-vault.types';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { LocalKeyFingerprintService } from './local-key-fingerprint.service';
import {
  LocalKeysFileReader,
  LOCAL_KEYS_MAX_BYTES,
} from './local-keys-file-reader';
import { LocalKeysPathResolver } from './local-keys-path-resolver';
import { LocalKeysSchemaValidator } from './local-keys-schema-validator';
import { SecretString } from './secret-string';
import { WindowsAclInspector } from './windows-acl-inspector';

const DISABLED_STATUS: SafeLocalKeysStatus = {
  status: 'disabled',
  disabled: true,
  source: null,
  file: {
    exists: false,
    readable: false,
    acl_ok: false,
    path_hint: null,
  },
  schema: {
    valid: false,
    schema_version: null,
    errors: [
      {
        code: 'LOCAL_KEYS_DISABLED',
        path: '$env.LEXFRAME_LOCAL_KEYS_DISABLED',
      },
    ],
  },
  keys: {
    total: 0,
    enabled: 0,
    disabled: 0,
    routes: [],
  },
  warnings: [],
};

@Injectable()
export class LocalOwnerKeyVaultService implements OnModuleInit {
  private status: SafeLocalKeysStatus = DISABLED_STATUS;
  private records: readonly LocalKeyRuntimeRecord[] = [];
  private defaultRoute: string | null = null;

  constructor(
    private readonly pathResolver: LocalKeysPathResolver,
    private readonly fileReader: LocalKeysFileReader,
    private readonly aclInspector: WindowsAclInspector,
    private readonly schemaValidator: LocalKeysSchemaValidator,
    private readonly fingerprintService: LocalKeyFingerprintService,
    @Optional() private readonly databaseService?: DatabaseService,
  ) {}

  async onModuleInit() {
    await this.reloadFromDisk();
  }

  getSafeStatus(): SafeLocalKeysStatus {
    return this.status;
  }

  isReady() {
    return this.status.status === 'ready';
  }

  hasUsableKeys() {
    return this.records.some((record) => record.enabled);
  }

  async reloadFromDisk() {
    const pathResult = await this.pathResolver.resolve();

    if (pathResult.disabled) {
      this.records = [];
      this.defaultRoute = null;
      this.status = DISABLED_STATUS;
      await this.persistSafeStatus().catch(() => undefined);
      return this.status;
    }

    if (pathResult.error || !pathResult.canonicalPath) {
      this.setInvalidStatus(pathResult, [
        pathResult.error ?? {
          code: 'LOCAL_KEYS_FILE_NOT_FOUND',
          path: '$file.path',
        },
      ]);
      return this.status;
    }

    const file = await this.fileReader
      .inspect(pathResult.canonicalPath)
      .catch(() => {
        this.setInvalidStatus(pathResult, [
          { code: 'LOCAL_KEYS_FILE_UNREADABLE', path: '$file' },
        ]);
        return null;
      });

    if (!file) {
      return this.status;
    }

    if (!file.exists) {
      this.records = [];
      this.defaultRoute = null;
      this.status = baseStatus('missing', pathResult, {
        exists: false,
        readable: false,
        aclOk: false,
        errors: [{ code: 'LOCAL_KEYS_FILE_NOT_FOUND', path: '$file' }],
      });
      await this.persistSafeStatus().catch(() => undefined);
      return this.status;
    }

    if (!file.isFile) {
      this.setInvalidStatus(pathResult, [
        { code: 'LOCAL_KEYS_NOT_REGULAR_FILE', path: '$file' },
      ]);
      return this.status;
    }

    if (file.isSymlink) {
      this.setInvalidStatus(pathResult, [
        { code: 'LOCAL_KEYS_PATH_SYMLINK', path: '$file' },
      ]);
      return this.status;
    }

    if (file.size > LOCAL_KEYS_MAX_BYTES) {
      this.setInvalidStatus(pathResult, [
        { code: 'LOCAL_KEYS_FILE_TOO_LARGE', path: '$file.size' },
      ]);
      return this.status;
    }

    const acl = await this.aclInspector.inspect(pathResult.canonicalPath);
    if (!acl.ok) {
      this.setInvalidStatus(pathResult, acl.warnings, { aclOk: false });
      return this.status;
    }

    const content = await this.fileReader
      .readUtf8(pathResult.canonicalPath)
      .catch(() => {
        this.setInvalidStatus(pathResult, [
          { code: 'LOCAL_KEYS_FILE_UNREADABLE', path: '$file' },
        ]);
        return null;
      });

    if (content === null) {
      return this.status;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      this.setInvalidStatus(pathResult, [
        { code: 'LOCAL_KEYS_INVALID_JSON', path: '$' },
      ]);
      return this.status;
    }

    const validation = this.schemaValidator.validate(parsed);
    if (!validation.valid || !validation.value) {
      this.setInvalidStatus(pathResult, validation.errors, {
        warnings: validation.warnings,
        schemaVersion: readSchemaVersion(parsed),
      });
      return this.status;
    }

    const validKeysFile = validation.value;
    const records = validKeysFile.keys.map((key) => ({
      keyId: key.id,
      provider: key.provider,
      baseUrl: key.base_url,
      model: key.model,
      apiKey: new SecretString(key.api_key),
      enabled: key.enabled,
      priority: key.priority,
      purposes: new Set(key.purposes),
      maxMonthlyBudget: key.max_monthly_budget,
      fingerprint: this.fingerprintService.fingerprint(key.api_key),
      defaultRoute: key.id === validKeysFile.default_route,
    }));
    const warnings = [
      ...validation.warnings,
      ...duplicateFingerprintWarnings(records),
    ];
    const enabled = records.filter((record) => record.enabled);

    this.records = records;
    this.defaultRoute = validKeysFile.default_route;
    this.status = {
      ...baseStatus(enabled.length > 0 ? 'ready' : 'degraded', pathResult, {
        exists: true,
        readable: true,
        aclOk: true,
        schemaVersion: validKeysFile.schema_version,
      }),
      schema: {
        valid: true,
        schema_version: validKeysFile.schema_version,
        errors: [],
      },
      keys: {
        total: records.length,
        enabled: enabled.length,
        disabled: records.length - enabled.length,
        routes: records.map((record) => ({
          key_id: record.keyId,
          provider: record.provider,
          model: record.model,
          purposes: Array.from(record.purposes).sort(),
          priority: record.priority,
          fingerprint: record.fingerprint,
          enabled: record.enabled,
          default_route: record.defaultRoute,
        })),
      },
      warnings,
    };

    await this.persistSafeStatus().catch(() => undefined);
    return this.status;
  }

  resolveKey(input: ResolveLocalKeyInput): KeyResolverResult {
    if (this.status.status === 'disabled') {
      throw this.unavailable('AI_LOCAL_KEYS_DISABLED');
    }

    if (!this.isReady()) {
      throw this.unavailable('AI_LOCAL_KEY_UNAVAILABLE');
    }

    const candidates = this.records
      .filter((record) => record.enabled)
      .filter((record) => record.purposes.has(input.purpose))
      .filter((record) => !input.provider || record.provider === input.provider)
      .filter((record) => budgetPolicyAllows(record))
      .sort(byPriorityThenId);
    const preferred = input.routeId ?? this.defaultRoute;
    const selected =
      (preferred
        ? candidates.find((record) => record.keyId === preferred)
        : null) ?? candidates[0];

    if (!selected) {
      throw this.unavailable('AI_LOCAL_KEY_UNAVAILABLE');
    }

    return {
      key_id: selected.keyId,
      provider: selected.provider,
      model: selected.model,
      base_url: selected.baseUrl,
      api_key: selected.apiKey,
      fingerprint: selected.fingerprint,
      purpose: input.purpose,
      route: selected.keyId,
    };
  }

  private setInvalidStatus(
    pathResult: Parameters<typeof baseStatus>[1],
    errors: SafeLocalKeysStatus['schema']['errors'],
    options: {
      readonly aclOk?: boolean;
      readonly warnings?: SafeLocalKeysStatus['warnings'];
      readonly schemaVersion?: string | null;
    } = {},
  ) {
    this.records = [];
    this.defaultRoute = null;
    this.status = baseStatus('invalid', pathResult, {
      exists: true,
      readable: false,
      aclOk: options.aclOk ?? false,
      errors,
      warnings: options.warnings,
      schemaVersion: options.schemaVersion,
    });
    void this.persistSafeStatus().catch(() => undefined);
  }

  private unavailable(
    code: 'AI_LOCAL_KEY_UNAVAILABLE' | 'AI_LOCAL_KEYS_DISABLED',
  ) {
    return new AppHttpException(
      code,
      503,
      'Локальный ключ владельца для AI недоступен.',
      {
        reasonCode: code,
        localKeysStatus: this.status.status,
      },
    );
  }

  private async persistSafeStatus() {
    if (!this.databaseService) {
      return;
    }

    const status = this.status;
    const sourcePathStatus =
      status.source === 'default_path'
        ? 'default_path'
        : status.source === 'env_override'
          ? 'env_override'
          : 'unavailable';

    for (const route of status.keys.routes) {
      for (const purpose of route.purposes) {
        await this.databaseService.query(
          `
            insert into app.local_owner_key_status (
              key_id,
              provider,
              model,
              route,
              fingerprint,
              enabled,
              purpose,
              priority,
              last_validation_status,
              validation_error_code,
              source_path_status,
              updated_at
            )
            values (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              timezone('utc', now())
            )
            on conflict (key_id, purpose) do update
            set
              provider = excluded.provider,
              model = excluded.model,
              route = excluded.route,
              fingerprint = excluded.fingerprint,
              enabled = excluded.enabled,
              priority = excluded.priority,
              last_validation_status = excluded.last_validation_status,
              validation_error_code = excluded.validation_error_code,
              source_path_status = excluded.source_path_status,
              updated_at = timezone('utc', now())
          `,
          [
            route.key_id,
            route.provider,
            route.model,
            route.key_id,
            route.fingerprint,
            route.enabled,
            purpose,
            route.priority,
            route.enabled ? 'valid' : 'disabled',
            null,
            sourcePathStatus,
          ],
        );
      }
    }

    if (status.keys.routes.length === 0) {
      await this.databaseService.query(
        `
          update app.local_owner_key_status
          set
            enabled = false,
            last_validation_status = 'unavailable',
            validation_error_code = $1,
            source_path_status = $2,
            updated_at = timezone('utc', now())
        `,
        [status.schema.errors[0]?.code ?? status.status, sourcePathStatus],
      );
    }
  }
}

function baseStatus(
  status: SafeLocalKeysStatus['status'],
  pathResult: {
    readonly source: SafeLocalKeysStatus['source'];
    readonly pathHint: string | null;
  },
  input: {
    readonly exists: boolean;
    readonly readable: boolean;
    readonly aclOk: boolean;
    readonly errors?: SafeLocalKeysStatus['schema']['errors'];
    readonly warnings?: SafeLocalKeysStatus['warnings'];
    readonly schemaVersion?: string | null;
  },
): SafeLocalKeysStatus {
  return {
    status,
    disabled: false,
    source: pathResult.source,
    file: {
      exists: input.exists,
      readable: input.readable,
      acl_ok: input.aclOk,
      path_hint: pathResult.pathHint,
      last_loaded_at: new Date().toISOString(),
    },
    schema: {
      valid: input.errors === undefined || input.errors.length === 0,
      schema_version: input.schemaVersion ?? null,
      errors: input.errors ?? [],
    },
    keys: {
      total: 0,
      enabled: 0,
      disabled: 0,
      routes: [],
    },
    warnings: input.warnings ?? [],
  };
}

function budgetPolicyAllows(record: LocalKeyRuntimeRecord) {
  return (
    record.maxMonthlyBudget === undefined ||
    record.maxMonthlyBudget === null ||
    record.maxMonthlyBudget > 0
  );
}

function byPriorityThenId(
  left: LocalKeyRuntimeRecord,
  right: LocalKeyRuntimeRecord,
) {
  return (
    left.priority - right.priority || left.keyId.localeCompare(right.keyId)
  );
}

function readSchemaVersion(value: unknown) {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { schema_version?: unknown }).schema_version === 'string'
    ? (value as { schema_version: string }).schema_version
    : null;
}

function duplicateFingerprintWarnings(
  records: readonly LocalKeyRuntimeRecord[],
): SafeLocalKeysStatus['warnings'] {
  const seen = new Set<string>();
  const warnings: SafeLocalKeysStatus['warnings'][number][] = [];

  records.forEach((record, index) => {
    if (seen.has(record.fingerprint)) {
      warnings.push({
        code: 'LOCAL_KEYS_DUPLICATE_FINGERPRINT',
        path: `$.keys[${index}].api_key`,
      });
    }
    seen.add(record.fingerprint);
  });

  return warnings;
}

export function toAiProvider(provider: LocalOwnerKeyProvider) {
  return provider === 'xai' || provider === 'cometapi' || provider === 'local'
    ? provider
    : null;
}
