import { redactSecrets } from './settings-redactor';

describe('Stage 21 settings redactor', () => {
  it('redacts API keys, bearer tokens, Authorization headers and JWT-like strings', () => {
    const value = {
      apiKey: 'sk-stage21-secret-value-1234567890',
      headers: {
        Authorization: 'Bearer secret-bearer-token-1234567890',
      },
      nested: [
        'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature1234567890',
      ],
    };

    expect(redactSecrets(value)).toEqual({
      apiKey: '[REDACTED]',
      headers: {
        Authorization: '[REDACTED]',
      },
      nested: ['token [REDACTED]'],
    });
  });

  it('does not mutate the original object while redacting nested data', () => {
    const value = {
      message: 'provider failed with key sk-stage21-secret-value-1234567890',
    };

    const redacted = redactSecrets(value);

    expect(value.message).toContain('sk-stage21-secret-value');
    expect(redacted).toEqual({
      message: 'provider failed with key [REDACTED]',
    });
  });

  it('redacts backend secret references from audit metadata', () => {
    const value = {
      connection_id: 'conn_workspace_ai',
      secret_ref_id: '00000000-0000-4000-8000-000000000099',
      nested: {
        secretRefId: '00000000-0000-4000-8000-000000000099',
        backendSecretId: 'vault_secret_001',
      },
      vault_secret_id: 'vault_secret_002',
    };

    expect(redactSecrets(value)).toEqual({
      connection_id: 'conn_workspace_ai',
      secret_ref_id: '[REDACTED]',
      nested: {
        secretRefId: '[REDACTED]',
        backendSecretId: '[REDACTED]',
      },
      vault_secret_id: '[REDACTED]',
    });
  });
});
