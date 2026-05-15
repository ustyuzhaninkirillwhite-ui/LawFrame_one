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
  'signedUrl',
  'signed_url',
  'downloadUrl',
  'download_url',
  'uploadUrl',
  'upload_url',
  'storagePath',
  'storage_path',
  'rawBytes',
  'raw_bytes',
  'fileBytes',
  'file_bytes',
  'base64',
]);

const RAW_CONTENT_KEY_NAMES = new Set([
  'raw_prompt',
  'rawPrompt',
  'raw_output',
  'rawOutput',
  'document_text',
  'documentText',
  'client_material_text',
  'clientMaterialText',
]);

const SECRET_VALUE_PATTERNS = [
  /\bAuthorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{12,}/i,
  /\bxai-[A-Za-z0-9_-]{12,}/i,
  /\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/i,
  /BEGIN PRIVATE KEY/i,
  /service_role/i,
  /\/storage\/v1\/object\/sign\//i,
  /[?&](?:token|X-Amz-Signature|X-Amz-Credential)=/i,
];

export function sanitizeAuditValue<T>(value: T): {
  readonly value: T;
  readonly redacted: boolean;
} {
  const result = sanitizeValue(value);
  return {
    value: result.value as T,
    redacted: result.redacted,
  };
}

function sanitizeValue(value: unknown): {
  readonly value: unknown;
  readonly redacted: boolean;
} {
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      return { value: REDACTED, redacted: true };
    }

    return { value, redacted: false };
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const items = value.map((item) => {
      const sanitized = sanitizeValue(item);
      redacted = redacted || sanitized.redacted;
      return sanitized.value;
    });

    return { value: items, redacted };
  }

  if (!value || typeof value !== 'object') {
    return { value, redacted: false };
  }

  let redacted = false;
  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_NAMES.has(key) || RAW_CONTENT_KEY_NAMES.has(key)) {
      output[key] = REDACTED;
      redacted = true;
      continue;
    }

    const sanitized = sanitizeValue(item);
    output[key] = sanitized.value;
    redacted = redacted || sanitized.redacted;
  }

  return { value: output, redacted };
}
