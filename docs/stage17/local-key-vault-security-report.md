# Stage 17.10 Local Key Vault Security Report

Status: generated gate target; final status is written by `pnpm stage17:release-gate`.

## Required Properties

- Default path is outside the repository: `%USERPROFILE%/.lexframe/secrets/lexframe.keys.local.json`.
- `LEXFRAME_LOCAL_KEYS_FILE` override is validated and fails closed inside the repo.
- Values are held only inside backend process memory.
- API responses, logs, audit events and errors expose only `key_id`, provider/model metadata and fingerprint.
- `LEXFRAME_LOCAL_KEYS_DISABLED=true` disables resolution without reading the file.

## Evidence Sources

- `apps/backend/src/modules/local-owner-key-vault/*`
- `apps/backend/src/modules/local-owner-key-vault/local-owner-key-vault.service.spec.ts`
- `scripts/secrets/init-local-keys.ps1`
- `scripts/security/check-no-local-secrets.mjs`
- `artifacts/stage17/runtime-evidence.json`
