# Backend / Contract / DB / Security Test Plan

Date: 2026-05-13

## Goal

Block 1 validates backend contracts, shared schemas, API client boundaries, DB/RLS/security gates, readiness, audit redaction, settings secret handling, AI Gateway route isolation, documents/storage contracts, chat persistence, automation/run contracts and Activepieces backend security.

Frontend visual UI is out of scope.

## Commands

Primary Block 1 command:

```bash
corepack pnpm test:block1
```

Subcommands:

```bash
corepack pnpm test:block1:contracts
corepack pnpm test:block1:backend
corepack pnpm test:block1:db-security
```

Focused commands:

```bash
corepack pnpm --filter @lexframe/backend test -- authorization run-preflight
corepack pnpm --filter @lexframe/contracts test
corepack pnpm --filter @lexframe/api-client test
corepack pnpm --filter @lexframe/ai-gateway test
corepack pnpm check:contract-security-invariants
corepack pnpm check:audit-redaction
corepack pnpm check:db-secret-like-values
```

## Test Strategy

1. Use backend unit tests for service-level RBAC, settings, documents, chat, Activepieces, canvas and runs behavior.
2. Use contract/package tests for API client and shared DTO invariants that must not depend on browser state.
3. Use validator scripts for OpenAPI, JSON schemas, workflow examples, canvas fixtures and release manifest.
4. Use static security gates for direct provider calls, secret-like values, audit metadata, frontend bundle secrets and local secret files.
5. Use existing Supabase pgTAP/security scripts for migration/RLS coverage.

## New Block 1 Coverage

| Area | Added Test/Gate |
| --- | --- |
| Authorization/RBAC | `apps/backend/src/modules/authorization/authorization.service.spec.ts` |
| Runs/preflight | `apps/backend/src/modules/runs/run-preflight.service.spec.ts` |
| Contracts | `packages/contracts/src/security-invariants.test.ts` |
| API client | `packages/api-client/src/settings-client.test.ts` |
| AI Gateway package | `packages/ai-gateway/src/route-assets.test.ts` |
| Audit redaction | `scripts/testing/check-audit-redaction.mjs` |
| DB secret-like values | `scripts/testing/check-db-secret-like-values.mjs` |
| Contract security invariants | `scripts/testing/check-contract-security-invariants.mjs` |

## Acceptance Mapping

| Acceptance Item | Verification |
| --- | --- |
| Backend targeted tests pass | `test:block1:backend` and focused backend command |
| Contracts validation passes | `test:block1:contracts` |
| DB readiness/RLS/security checks pass | `test:block1:db-security` |
| Settings AI key remains write-only | `packages/contracts` and `packages/api-client` tests; Stage 21 security gates |
| No provider key in GET response | `check:contract-security-invariants`, Stage 21 no-secrets settings gate |
| No direct provider route through frontend/API client contract | `check:contract-security-invariants`, Stage 19/20 direct provider scans |
| Chat stream persistence covered | Existing `chat-thread.service.spec.ts` and `chat-stream.service.spec.ts` |
| Document upload bytes/hash flow covered | Existing `documents.service.spec.ts` |
| Automation dry-run backend contract covered | New `run-preflight.service.spec.ts` plus existing Activepieces/canvas tests |
| Activepieces session/token/JWT covered | Existing Activepieces session/JWT/pieces policy specs |
| Audit redaction tests exist | `check:audit-redaction` |
| Secret scan passes | `secret-scan`, `check:db-secret-like-values`, `validate:web-bundle-secrets` |
| Remaining failures documented | `docs/testing/detected-defects.md` |

## Follow-up Backlog

Prioritize direct specs for modules that currently rely on indirect coverage:

1. `approvals`
2. `automation-library`
3. `document-generation`
4. `document-templates`
5. `document-validation`
6. `legal-sources`
7. `legal-search`
8. `legal-rag`
9. `legal-indexing`
10. `audit` / `security-operations`
