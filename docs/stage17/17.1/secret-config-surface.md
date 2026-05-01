# Secret and Config Surface Audit

Status: PARTIAL / BLOCKED until final scanner review and owner sign-off
Date: 2026-04-28

## Redaction Policy

This audit records env var names, file paths, match categories, secret refs,
fingerprints, and remediation status only. It does not record raw secret values.

## LexFrame Surfaces

- Backend env/config
- Frontend `NEXT_PUBLIC_*` and runtime config
- Activepieces bridge/session/embed-token routes
- AI Gateway provider routing
- Activepieces legal pieces/custom pieces
- Docker Compose and local `.env*` files
- CI/security scripts

Observed local env files:

- `.env`
- `.env.example`
- `.env.test-secrets.local`

Only variable names were captured in
`artifacts/stage17.1/inventories/lexframe-secret-config-sanitized.txt`.

## Activepieces Surfaces

- Activepieces app/API config
- Worker/runtime config
- Postgres/Redis config
- JWT/encryption/signing config
- Connection auth props
- Enterprise/EE secret manager and signing-key areas
- Docker/compose/env examples

Only variable names and config file paths were captured in
`artifacts/stage17.1/inventories/activepieces-secret-config-sanitized.txt`.

## Local Owner Key Vault Boundary

Default path:

- `%USERPROFILE%\.lexframe\secrets\lexframe.keys.local.json`

Override:

- `LEXFRAME_LOCAL_KEYS_FILE=E:\lexframe-secrets\lexframe.keys.local.json`

Rules:

- The key vault is read only by backend/runtime code.
- Keys are not committed, bundled, copied into Docker image layers, logged,
  serialized through API responses, written into audit payloads, or passed into
  Activepieces iframe config.
- Audit/status may expose only `key_id`, provider/model metadata, and a safe
  fingerprint such as `sha256(api_key).slice(0, 12)`.

## Scan Result

Project-native scan `node scripts/secret-scan.mjs` passed after the 17.1
documents and evidence artifacts were created. `gitleaks` was not available in
PATH, so that optional scan is recorded as not run.

Report:

- `artifacts/stage17.1/reports/secret-scan-redacted.txt`

## Required Before PASS

- No unresolved P0 secret finding remains open.
- Any real exposed key is marked compromised and has revoke/rotate decision.
- Owner approval for `NEXT_PUBLIC_*` inventory and server-only boundary.
- `.gitignore` / local exclude policy reviewed for local key vault paths.
