# Stage 17 Requirements Freeze

Status: Accepted for audit baseline; owner sign-off pending before PASS.
Date: 2026-04-28

## Accepted MVP Scope

Stage 17 Rev.3 is frozen around these directions:

- Activepieces Canvas is the primary MVP automation editor/runtime surface.
- LexFrame backend/product DB remain the source of truth for DSL, automations,
  workflow runs, audit, documents, approvals, security, and tenant boundaries.
- Local Owner Key Vault is a backend-only local secret loader. User-facing MVP
  flows must not require end users to enter provider API keys.
- Activepieces integration uses backend-issued short-lived session/provisioning
  JWTs. Frontend must not receive Activepieces API keys, signing private keys,
  provider keys, Supabase service keys, or equivalent secrets.
- Activepieces UI is localized/debranded for the user-facing route where license
  boundaries permit it.
- LexFrame UI moves toward an Activepieces-like visual system during later
  Stage 17 work, while Activepieces Canvas stock layout/functions remain intact.
- Release gates require runtime evidence, secret scans, localization/debranding
  checks, visual regression, and Playwright live checks.

## Non-Goals During 17.1

- No Activepieces Canvas layout, builder UX, menu order, inspector, runs/debug,
  settings, or function changes.
- No LexFrame design migration, component rewrite, route rewrite, Docker change,
  backend loader, env schema, or custom piece implementation.
- No hardcoded API keys in TypeScript, JSON, seed, migration, Dockerfile,
  Docker image, frontend env, docs, examples, fixtures, screenshots, or logs.
- No `NEXT_PUBLIC_*` variables for backend-only secrets.
- No transfer of LexFrame source of truth into Activepieces project/flow state.
- No copy/import from Activepieces enterprise-only directories without
  ADR-17.3 and legal/license sign-off.

## Change Control

All new ideas after this freeze must be recorded in `change-request-log.csv`.
Only P0 security/legal blockers may be accepted into immediate Stage 17 work.
P1 readiness gaps block PASS until resolved or explicitly waived by owners.
P2/P3 items move to backlog and must not be mixed into 17.2-17.10 work.

## Sign-Off Slots

- Product owner: pending
- Technical owner: pending
- Security owner: pending
- Legal/license reviewer: pending
- Frontend/design owner: pending
