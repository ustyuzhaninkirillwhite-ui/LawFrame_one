const REDACTED = '[REDACTED]';

const SECRET_KEY_NAMES = new Set([
  'apiKey',
  'api_key',
  'apikey',
  'authorization',
  'Authorization',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'jwt',
  'token',
  'providerKey',
  'provider_key',
  'secretRefId',
  'secret_ref_id',
  'backendSecretId',
  'backend_secret_id',
  'vaultSecretId',
  'vault_secret_id',
]);

const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,}]{8,}/gi,
];

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

export function redactText(value: string): string {
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, REDACTED),
    value,
  );
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEY_NAMES.has(key) ? REDACTED : redactValue(item);
  }

  return output;
}
