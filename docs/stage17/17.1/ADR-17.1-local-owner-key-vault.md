# ADR-17.1 - Local Owner Key Vault

Status: Accepted for Stage 17 design; security sign-off pending before PASS
Date: 2026-04-28
Owners: product, technical, security

## Context

Stage 17 requires automatic provider-key usage for MVP automation/AI flows
without asking end users to manage API keys. The same stage also forbids secrets
in Git, Docker images, frontend bundles, Activepieces iframe payloads, logs,
audit payloads, examples, screenshots, and docs.

## Decision

LexFrame will use a Local Owner Key Vault: a local-only file outside the repo,
read by backend/runtime code only. The default path is
`%USERPROFILE%\.lexframe\secrets\lexframe.keys.local.json`; the override is
`LEXFRAME_LOCAL_KEYS_FILE`.

Frontend, Activepieces Canvas, and custom pieces never receive provider API key
values. Custom pieces call LexFrame runtime/AI Gateway with scoped runtime
tokens. Audit/status surfaces may expose key id, provider/model metadata, and
fingerprint only.

## Consequences

- Backend needs schema validation, path/ACL checks, redacted errors, status
  checks, and fingerprint-only audit.
- Local keys must be excluded from tracking and examples.
- Missing/invalid keys produce readiness/status errors without printing values.
- Any leaked real key is treated as compromised and must be rotated.

## Non-Goals

- No hardcoded keys.
- No `NEXT_PUBLIC_*` secret exposure.
- No provider keys in Activepieces iframe payloads or browser storage.
- No implementation of the backend key resolver during 17.1.

## Evidence

- `secret-config-surface.md`
- `artifacts/stage17.1/inventories/lexframe-secret-config-sanitized.txt`
- `artifacts/stage17.1/inventories/activepieces-secret-config-sanitized.txt`
