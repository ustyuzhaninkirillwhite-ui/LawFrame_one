import { validateAiProviderBaseUrl } from './ai-base-url-ssrf.guard';

describe('Stage 21 AI provider base URL SSRF guard', () => {
  it('blocks localhost and private IP targets in production', async () => {
    await expect(
      validateAiProviderBaseUrl('https://localhost/v1', {
        production: true,
      }),
    ).rejects.toMatchObject({ code: 'AI_BASE_URL_BLOCKED' });

    await expect(
      validateAiProviderBaseUrl('https://10.0.0.4/v1', {
        production: true,
      }),
    ).rejects.toMatchObject({ code: 'AI_BASE_URL_BLOCKED' });
  });

  it('requires https and rejects credentials in production URLs', async () => {
    await expect(
      validateAiProviderBaseUrl('http://api.example.test/v1', {
        production: true,
      }),
    ).rejects.toMatchObject({ code: 'AI_BASE_URL_HTTPS_REQUIRED' });

    await expect(
      validateAiProviderBaseUrl('https://user:pass@api.example.test/v1', {
        production: true,
      }),
    ).rejects.toMatchObject({ code: 'AI_BASE_URL_CREDENTIALS_BLOCKED' });
  });

  it('returns a normalized safe URL without query or hash', async () => {
    await expect(
      validateAiProviderBaseUrl('https://api.example.test/v1?key=bad#frag', {
        production: true,
        resolveHost: async () => ['203.0.113.10'],
      }),
    ).resolves.toBe('https://api.example.test/v1');
  });

  it('returns a controlled guard error when production DNS verification fails', async () => {
    await expect(
      validateAiProviderBaseUrl('https://api.example.test/v1', {
        production: true,
        resolveHost: async () => {
          throw new Error('getaddrinfo EAI_AGAIN api.example.test');
        },
      }),
    ).rejects.toMatchObject({ code: 'AI_BASE_URL_DNS_LOOKUP_FAILED' });
  });
});
