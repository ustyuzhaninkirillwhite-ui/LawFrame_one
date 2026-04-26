import { CanvasAiRedactionService } from './canvas-ai-redaction.service';

describe('CanvasAiRedactionService', () => {
  const service = new CanvasAiRedactionService();

  it('redacts secrets, signed URLs, raw document text, and direct contact data', () => {
    const result = service.redact({
      label: 'Safe label',
      signed_url: 'https://storage.example/signed',
      rawDocumentText: 'client secret facts',
      nested: {
        email: 'client@example.com',
        note: 'Call +1 555 111 2222',
        apiKey: 'sk_test_12345678901234567890',
      },
    });

    expect(result.value).toMatchObject({
      label: 'Safe label',
      signed_url: '[redacted]',
      rawDocumentText: '[redacted]',
      nested: {
        email: '[redacted]',
        note: 'Call <PHONE>',
        apiKey: '[redacted]',
      },
    });
    expect(result.redactions).toEqual(
      expect.arrayContaining([
        'key:signed_url',
        'key:rawDocumentText',
        'key:email',
        'key:apiKey',
        'entity:phone',
      ]),
    );
  });

  it('hashes raw inputs without exposing plaintext', () => {
    expect(service.hash('secret')).toMatch(/^[a-f0-9]{64}$/);
    expect(service.safePreview('Email user@example.com')).toBe('Email <EMAIL>');
  });
});
