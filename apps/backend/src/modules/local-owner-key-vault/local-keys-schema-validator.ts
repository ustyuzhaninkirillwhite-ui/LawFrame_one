import type {
  LocalOwnerKey,
  LocalOwnerKeysFile,
  LocalOwnerKeyProvider,
  LocalOwnerKeyPurpose,
  SafeLocalKeysStatus,
} from './local-owner-key-vault.types';
import { localOwnerKeysSchema } from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

type ValidationIssue = SafeLocalKeysStatus['schema']['errors'][number];

export interface LocalKeysValidationResult {
  readonly valid: boolean;
  readonly value: LocalOwnerKeysFile | null;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}

const PROVIDERS_REQUIRING_BASE_URL = new Set<LocalOwnerKeyProvider>([
  'openai_compatible',
]);

@Injectable()
export class LocalKeysSchemaValidator {
  private readonly ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  private readonly validateSchema: ReturnType<Ajv2020['compile']>;

  constructor() {
    addFormats(this.ajv);
    this.validateSchema = this.ajv.compile(localOwnerKeysSchema);
  }

  validate(parsed: unknown): LocalKeysValidationResult {
    if (!this.validateSchema(parsed)) {
      return {
        valid: false,
        value: null,
        errors: (this.validateSchema.errors ?? []).map((error) => ({
          code:
            error.keyword === 'const' &&
            error.instancePath === '/schema_version'
              ? 'LOCAL_KEYS_SCHEMA_VERSION_UNSUPPORTED'
              : 'LOCAL_KEYS_SCHEMA_INVALID',
          path: toJsonPath(error.instancePath),
        })),
        warnings: [],
      };
    }

    const value = parsed as LocalOwnerKeysFile;
    const semanticErrors = validateSemantics(value);
    const warnings = buildWarnings(value);

    return {
      valid: semanticErrors.length === 0,
      value,
      errors: semanticErrors,
      warnings,
    };
  }
}

function validateSemantics(value: LocalOwnerKeysFile): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const ids = new Set<string>();

  value.keys.forEach((key, index) => {
    if (ids.has(key.id)) {
      errors.push({
        code: 'LOCAL_KEYS_SCHEMA_INVALID',
        path: `$.keys[${index}].id`,
      });
    }
    ids.add(key.id);

    if (isPlaceholderSecret(key.api_key)) {
      errors.push({
        code: 'LOCAL_KEYS_PLACEHOLDER_VALUE',
        path: `$.keys[${index}].api_key`,
      });
    }

    if (
      PROVIDERS_REQUIRING_BASE_URL.has(key.provider) &&
      !isNonEmptyString(key.base_url)
    ) {
      errors.push({
        code: 'LOCAL_KEYS_SCHEMA_INVALID',
        path: `$.keys[${index}].base_url`,
      });
    }

    if (key.base_url && !baseUrlAllowed(key.provider, key.base_url)) {
      errors.push({
        code: 'LOCAL_KEYS_SCHEMA_INVALID',
        path: `$.keys[${index}].base_url`,
      });
    }

    if (key.purposes.length === 0) {
      errors.push({
        code: 'LOCAL_KEYS_SCHEMA_INVALID',
        path: `$.keys[${index}].purposes`,
      });
    }
  });

  if (!ids.has(value.default_route)) {
    errors.push({
      code: 'LOCAL_KEYS_DEFAULT_ROUTE_INVALID',
      path: '$.default_route',
    });
  }

  if (!value.keys.some((key) => key.enabled)) {
    errors.push({
      code: 'LOCAL_KEYS_NO_ENABLED_ROUTE',
      path: '$.keys',
    });
  }

  return errors;
}

function buildWarnings(value: LocalOwnerKeysFile): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  const seenFingerprints = new Map<string, string>();

  value.keys.forEach((key, index) => {
    if (!key.enabled && key.id === value.default_route) {
      warnings.push({
        code: 'LOCAL_KEYS_NO_ENABLED_ROUTE',
        path: `$.keys[${index}]`,
      });
    }

    const duplicateOf = seenFingerprints.get(key.api_key);
    if (duplicateOf) {
      warnings.push({
        code: 'LOCAL_KEYS_DUPLICATE_FINGERPRINT',
        path: `$.keys[${index}].api_key`,
      });
    }
    seenFingerprints.set(key.api_key, key.id);
  });

  return warnings;
}

function isPlaceholderSecret(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'paste_key_here' ||
    normalized === 'redacted' ||
    normalized.startsWith('example') ||
    normalized.startsWith('test_')
  );
}

function baseUrlAllowed(provider: LocalOwnerKeyProvider, value: string) {
  try {
    const url = new URL(value);

    if (provider === 'local') {
      return (
        url.protocol === 'http:' &&
        (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      );
    }

    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toJsonPath(instancePath: string) {
  if (instancePath.length === 0) {
    return '$';
  }

  return `$${instancePath.replaceAll('/', '.')}`;
}

export function isLocalOwnerKeyProvider(
  value: unknown,
): value is LocalOwnerKeyProvider {
  return (
    value === 'xai' ||
    value === 'openai_compatible' ||
    value === 'cometapi' ||
    value === 'local'
  );
}

export function isLocalOwnerKeyPurpose(
  value: unknown,
): value is LocalOwnerKeyPurpose {
  return (
    value === 'ai_gateway' ||
    value === 'workflow_planning' ||
    value === 'activepieces_custom_piece'
  );
}

export function sanitizeLocalOwnerKey(value: LocalOwnerKey): LocalOwnerKey {
  return {
    ...value,
    api_key: '[REDACTED]',
  };
}
