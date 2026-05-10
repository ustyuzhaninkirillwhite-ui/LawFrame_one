import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import type { ErrorCode } from '@lexframe/contracts';

type AiBaseUrlGuardCode = Extract<ErrorCode, `AI_BASE_URL_${string}`>;

export interface AiBaseUrlGuardOptions {
  readonly production: boolean;
  readonly allowlist?: readonly string[];
  readonly resolveHost?: (hostname: string) => Promise<readonly string[]>;
}

export class AiBaseUrlGuardError extends Error {
  constructor(
    public readonly code: AiBaseUrlGuardCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiBaseUrlGuardError';
  }
}

export async function validateAiProviderBaseUrl(
  rawUrl: string,
  options: AiBaseUrlGuardOptions,
): Promise<string> {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AiBaseUrlGuardError(
      'AI_BASE_URL_INVALID',
      'AI provider base URL is invalid.',
    );
  }

  if (parsed.protocol !== 'https:' && (options.production || parsed.protocol !== 'http:')) {
    throw new AiBaseUrlGuardError(
      parsed.protocol === 'http:'
        ? 'AI_BASE_URL_HTTPS_REQUIRED'
        : 'AI_BASE_URL_PROTOCOL_BLOCKED',
      'AI provider base URL must use HTTPS in production.',
    );
  }

  if (parsed.username || parsed.password) {
    throw new AiBaseUrlGuardError(
      'AI_BASE_URL_CREDENTIALS_BLOCKED',
      'Credentials are not allowed in AI provider base URLs.',
    );
  }

  if (options.allowlist?.length) {
    const allowed = new Set(options.allowlist.map((host) => host.toLowerCase()));
    if (!allowed.has(parsed.hostname.toLowerCase())) {
      throw new AiBaseUrlGuardError(
        'AI_BASE_URL_NOT_ALLOWLISTED',
        'AI provider base URL host is not allowlisted.',
      );
    }
  }

  if (options.production) {
    await assertPublicHost(parsed.hostname, options.resolveHost);
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '/' : '');
}

async function assertPublicHost(
  hostname: string,
  resolveHost?: (hostname: string) => Promise<readonly string[]>,
) {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '0.0.0.0' ||
    lower === '[::1]'
  ) {
    throwBlocked();
  }

  const directIpVersion = isIP(hostname);
  let addresses: readonly string[];
  try {
    addresses =
      directIpVersion > 0
        ? [hostname]
        : await (resolveHost ?? defaultResolveHost)(hostname);
  } catch {
    throw new AiBaseUrlGuardError(
      'AI_BASE_URL_DNS_LOOKUP_FAILED',
      'AI provider base URL host could not be verified.',
    );
  }

  if (addresses.length === 0 || addresses.some((address) => isPrivateIp(address))) {
    throwBlocked();
  }
}

async function defaultResolveHost(hostname: string): Promise<readonly string[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function throwBlocked(): never {
  throw new AiBaseUrlGuardError(
    'AI_BASE_URL_BLOCKED',
    'AI provider base URL points to localhost or a private network.',
  );
}

function isPrivateIp(address: string): boolean {
  if (address.startsWith('::ffff:')) {
    return isPrivateIp(address.slice('::ffff:'.length));
  }

  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map((part) => Number(part));
    const [a = 0, b = 0] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a >= 224 && a <= 255)
    );
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    return (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:')
    );
  }

  return true;
}
