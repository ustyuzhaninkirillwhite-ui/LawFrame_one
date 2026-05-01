# Stage 17.10 Secret Surface Inventory

Status: baseline for release-gate verification.

## Backend-only secret surfaces

- Local Owner Key Vault: `%USERPROFILE%/.lexframe/secrets/lexframe.keys.local.json` or `LEXFRAME_LOCAL_KEYS_FILE`.
- Activepieces API key and signing private key: backend env or secret refs only.
- Supabase service/secret keys: backend/runtime only.
- AI provider keys: resolved only inside LexFrame AI Gateway through Local Owner Key Vault.

## Browser-forbidden surfaces

- `NEXT_PUBLIC_*` values must not contain provider keys, private keys, service keys or local vault paths.
- AP iframe/embed config may contain only short-lived AP session JWT and route config.
- Browser storage, HAR, console logs and `window` globals must not contain provider key values.

## Evidence

- Repo/staged scan: `pnpm stage17:security:scan-secrets`.
- Bundle scan: `pnpm stage17:security:scan-frontend-bundle`.
- Browser evidence scan: `pnpm stage17:security:scan-browser-evidence`.
- Runtime absence evidence: `artifacts/stage17/runtime-evidence.json`.
