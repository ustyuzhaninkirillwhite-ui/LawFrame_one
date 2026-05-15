# Browser Security Scan Plan

Date: 2026-05-13

## Forbidden Browser Exposure

- OpenAI, CometAPI, xAI, Anthropic, Google model, DeepSeek keys.
- Activepieces API key, signing private key, `AP_JWT_SECRET`, `AP_ENCRYPTION_KEY`.
- Supabase service role / secret key.
- LexFrame runtime master secret.
- Long-lived JWTs and signed URLs in DOM/storage.
- Authorization header text in DOM/console.
- Raw provider errors that include keys or headers.

## Scan Surfaces

| Surface | Helper |
| --- | --- |
| DOM text, attributes, script text | `scanDomForSecretLikeStrings` |
| localStorage/sessionStorage/cookies | `scanStorageForSecretLikeStrings` |
| console messages | `scanConsoleForSensitiveStrings` |
| request URLs/header keys/post bodies | `scanNetworkForForbiddenHosts` |
| text/json/html/js response bodies | `network-security.ts` response scanner |
| artifacts manifest | `collect-system-test-evidence.mjs` safe-for-sharing checks |

## Allowed Hosts

- LexFrame backend and reverse proxy.
- Activepieces iframe/runtime public assets.
- Supabase publishable/anon RLS endpoints if used by current app.
- Static assets from the local app.

## Output

Browser scans write `artifacts/system-tests/block5-security/browser-security-scan.json`.
