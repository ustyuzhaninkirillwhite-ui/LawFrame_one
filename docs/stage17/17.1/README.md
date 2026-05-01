# Stage 17.1 Readiness Audit

Status: BLOCKED
Date: 2026-04-28
Owner: Codex audit pass; product/security/legal/design sign-off pending.

## Purpose

Stage 17.1 is a stop gate before Stage 17.2-17.10. This folder records the
readiness audit, requirements freeze, inventories, ADRs, and the current
PASS/BLOCKED decision. It does not authorize runtime code changes.

## Artifact Layout

Tracked, redacted documentation lives here:

- `requirements-freeze.md`
- `change-request-log.csv`
- `source-inventory.md`
- `activepieces-license-boundary.md`
- `activepieces-i18n-branding-inventory.md`
- `activepieces-design-token-inventory.md`
- `lexframe-ui-design-inventory.md`
- `secret-config-surface.md`
- `ADR-17.1-local-owner-key-vault.md`
- `ADR-17.2-activepieces-design-unification.md`
- `ADR-17.3-activepieces-license-boundary.md`
- `ADR-17.4-stage17-requirements-freeze.md`
- `evidence-manifest.json`
- `readiness-summary.md`

Local evidence artifacts live under `artifacts/stage17.1/`:

- `command-logs/`
- `inventories/`
- `screenshots/activepieces/`
- `screenshots/lexframe/`
- `reports/`
- `redacted-findings/`

## Redaction Rules

- Do not store API keys, provider keys, signing keys, private PEM files, raw
  `.env` values, browser storage dumps, or production data in this folder.
- Secret/config inventories may contain env var names, file paths, match
  categories, owner notes, fingerprints, and remediation status only.
- Screenshots must use synthetic/local demo data. If a screenshot includes
  personal data, private URLs, keys, or production documents, it is invalid.
- Any real secret found during audit is treated as compromised and must be
  rotated before Stage 17.1 can pass.

## Current Gate Result

Stage 17.1 is BLOCKED because:

- `E:\activepieces-main` exists but is not a git checkout, so AP baseline cannot
  be tied to branch/commit evidence.
- Activepieces declares `bun@1.3.3`, but `bun` is not available in PATH.
- Activepieces app/worker runtime was not available for AP-01..AP-08 baseline
  screenshots.
- LexFrame local services were listening, but a fresh Playwright demo login
  received HTTP 500 from `POST /auth/bootstrap`; LF screenshots are therefore
  partial and mostly show sign-in/404 states rather than protected route
  baseline screens.
