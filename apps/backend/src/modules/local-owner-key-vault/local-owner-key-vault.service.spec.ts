import { createHash } from 'node:crypto';
import path from 'node:path';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { LocalKeyFingerprintService } from './local-key-fingerprint.service';
import { LocalKeysPathResolver } from './local-keys-path-resolver';
import { LocalKeysSchemaValidator } from './local-keys-schema-validator';
import { LocalOwnerKeyVaultService } from './local-owner-key-vault.service';
import { SecretString } from './secret-string';

describe('LocalOwnerKeyVaultService', () => {
  it('honors kill switch without touching the local key file', async () => {
    const fileReader = {
      inspect: jest.fn(),
      readUtf8: jest.fn(),
    };
    const service = createVaultService({
      pathResolver: {
        resolve: jest.fn().mockResolvedValue({
          disabled: true,
          source: null,
          configuredPath: null,
          canonicalPath: null,
          pathHint: null,
        }),
      },
      fileReader,
    });

    const status = await service.reloadFromDisk();

    expect(status.status).toBe('disabled');
    expect(fileReader.inspect).not.toHaveBeenCalled();
    expect(fileReader.readUtf8).not.toHaveBeenCalled();
  });

  it('loads a valid vault and resolves the safest key handle', async () => {
    const apiKey = ['unit', 'local', 'owner', 'key', 'value', '000001'].join(
      '-',
    );
    const pathResolver = {
      resolve: jest.fn().mockResolvedValue({
        disabled: false,
        source: 'env_override',
        configuredPath: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
        canonicalPath: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
        pathHint: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
      }),
    };
    const fileReader = {
      inspect: jest.fn().mockResolvedValue({
        exists: true,
        isFile: true,
        isSymlink: false,
        size: 512,
      }),
      readUtf8: jest.fn().mockResolvedValue(
        JSON.stringify({
          schema_version: '1.0',
          default_route: 'xai-main',
          keys: [
            {
              id: 'xai-main',
              provider: 'xai',
              model: 'grok-4-1-fast-non-reasoning',
              api_key: apiKey,
              enabled: true,
              priority: 10,
              purposes: ['ai_gateway', 'workflow_planning'],
            },
            {
              id: 'xai-disabled',
              provider: 'xai',
              model: 'grok-4-1-fast-non-reasoning',
              api_key: ['unit', 'disabled', 'local', 'owner', 'key'].join('-'),
              enabled: false,
              priority: 1,
              purposes: ['ai_gateway'],
            },
          ],
        }),
      ),
    };
    const service = createVaultService({
      pathResolver,
      fileReader,
    });

    const status = await service.reloadFromDisk();
    const resolved = service.resolveKey({
      purpose: 'ai_gateway',
      provider: 'xai',
      traceId: 'trace_local_keys_unit',
    });

    expect(status.status).toBe('ready');
    expect(status.keys).toEqual(
      expect.objectContaining({
        total: 2,
        enabled: 1,
        disabled: 1,
      }),
    );
    expect(resolved).toEqual(
      expect.objectContaining({
        key_id: 'xai-main',
        provider: 'xai',
        model: 'grok-4-1-fast-non-reasoning',
        fingerprint: sha256Prefix(apiKey),
      }),
    );
    expect(resolved.api_key).toBeInstanceOf(SecretString);
    expect(resolved.api_key.toString()).toBe('[REDACTED]');
    expect(resolved.api_key.revealForProviderCall()).toBe(apiKey);
    expect(() => JSON.stringify(resolved)).toThrow(
      'SECRET_SERIALIZATION_FORBIDDEN',
    );
  });

  it('reports placeholder values as invalid without exposing them', async () => {
    const service = createVaultService({
      fileReader: {
        inspect: jest.fn().mockResolvedValue({
          exists: true,
          isFile: true,
          isSymlink: false,
          size: 256,
        }),
        readUtf8: jest.fn().mockResolvedValue(
          JSON.stringify({
            schema_version: '1.0',
            default_route: 'xai-main',
            keys: [
              {
                id: 'xai-main',
                provider: 'xai',
                model: 'grok-4-1-fast-non-reasoning',
                api_key: 'PASTE_KEY_HERE',
                enabled: true,
                priority: 10,
                purposes: ['ai_gateway'],
              },
            ],
          }),
        ),
      },
    });

    const status = await service.reloadFromDisk();

    expect(status.status).toBe('invalid');
    expect(status.schema.errors).toContainEqual({
      code: 'LOCAL_KEYS_PLACEHOLDER_VALUE',
      path: '$.keys[0].api_key',
    });
    expect(JSON.stringify(status)).not.toContain('PASTE_KEY_HERE');
    expect(() =>
      service.resolveKey({
        purpose: 'ai_gateway',
        traceId: 'trace_local_keys_unit',
      }),
    ).toThrow(AppHttpException);
  });
});

describe('LocalKeysPathResolver', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('fails closed for vault paths inside the repository', async () => {
    delete process.env.LEXFRAME_LOCAL_KEYS_DISABLED;
    process.env.LEXFRAME_LOCAL_KEYS_FILE = path.join(
      process.cwd(),
      'lexframe.keys.local.json',
    );

    const result = await new LocalKeysPathResolver().resolve();

    expect(result.error).toEqual({
      code: 'LOCAL_KEYS_PATH_INSIDE_REPO',
      path: '$file.path',
    });
  });
});

function createVaultService(overrides: {
  readonly pathResolver?: {
    readonly resolve: jest.Mock;
  };
  readonly fileReader?: {
    readonly inspect: jest.Mock;
    readonly readUtf8: jest.Mock;
  };
}) {
  return new LocalOwnerKeyVaultService(
    (overrides.pathResolver ?? {
      resolve: jest.fn().mockResolvedValue({
        disabled: false,
        source: 'env_override',
        configuredPath: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
        canonicalPath: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
        pathHint: 'E:\\lexframe-secrets\\lexframe.keys.local.json',
      }),
    }) as never,
    (overrides.fileReader ?? {
      inspect: jest.fn().mockResolvedValue({
        exists: true,
        isFile: true,
        isSymlink: false,
        size: 128,
      }),
      readUtf8: jest.fn(),
    }) as never,
    {
      inspect: jest.fn().mockResolvedValue({
        ok: true,
        warnings: [],
      }),
    } as never,
    new LocalKeysSchemaValidator(),
    new LocalKeyFingerprintService(),
  );
}

function sha256Prefix(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
