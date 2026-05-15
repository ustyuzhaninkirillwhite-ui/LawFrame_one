# Backend / Contract / DB / Security Test Inventory

Date: 2026-05-13

Scope:

- `apps/backend/**`
- `packages/contracts/**`
- `packages/api-client/**`
- `packages/config/**`
- `packages/workflow/**`
- `packages/workflow-dsl/**`
- `packages/ai-gateway/**`
- `supabase/migrations/**`
- `supabase/tests/**`
- `scripts/*security*`, `scripts/*validate*`, `scripts/stage18/**`, `scripts/stage19/**`, `scripts/stage20/**`, `scripts/stage21/**`

## Root Gates Found

Core checks:

- `check`
- `check:backend`
- `check:contracts`
- `check:db`
- `check:ai`
- `check:security`
- `check:activepieces`
- `check:e2e`

Stage gates:

- Stage 18: license, reference analyze, AI inventory, route registry, provider adapter, stream protocol, piece gateway, secret scan, direct provider scan, readiness, release gate.
- Stage 19: chat DB/API contracts, stream resume, attachments, project knowledge, context assembler, branching, search, legal skills, cross-workspace security, browser secrets, direct provider scan, readiness, release gate.
- Stage 20: automation builder contracts, planner orchestration, clarification, context assembler, module resolver, blueprint validation/conversion, runtime draft, MCP adapter, security scans, readiness, release gate.
- Stage 21: settings schema/API/frontend/e2e, route resolution, connection test, no secrets in settings response, no secrets in browser/audit, SSRF guard, release gate.

New Block 1 scripts added:

- `test:block1:backend`
- `test:block1:contracts`
- `test:block1:db-security`
- `test:block1`
- `check:audit-redaction`
- `check:db-secret-like-values`
- `check:contract-security-invariants`

## Backend Spec Inventory

Existing spec coverage by module:

| Module | Spec Count | Current Level | Notes |
| --- | ---: | --- | --- |
| `activepieces` | 7 | unit/integration-smoke | Session, JWT signer, role mapper, pieces policy, provisioning, service orchestration. |
| `ai-gateway` | 5 | unit/integration-smoke | Provider adapters, gateway service, stream protocol, route registry, route group resolver. |
| `automation-builder` | 4 | unit | Blueprint validation/conversion, context assembler, runtime draft. |
| `canvas` | 10 | unit | Operations, validation, locking, runtime projection, policy-facing services. |
| `canvas-ai` | 2 | unit/security | Policy validator and redaction. |
| `chat` | 4 | unit/integration-smoke | Thread persistence, stream events, context assembly, project knowledge. |
| `database` | 1 | unit | Pool error handling. |
| `delivery` | 1 | unit | Dispatch, approval gate, webhook and audit flow. |
| `documents` | 1 | unit/integration-smoke | Upload intent, byte validation, hash/size/mime, signed URL policy. |
| `identity` | 1 | unit/integration-smoke | Session context, workspace access resolution, MFA/email states. |
| `local-owner-key-vault` | 1 | unit/security | Local vault resolution and path safety. |
| `ops` | 1 | unit | Runtime health readiness. |
| `readiness` | 2 | unit/contract | Readiness profile and service contract. |
| `recommendations` | 1 | unit | Recommendation readiness fallback. |
| `runtime` | 1 | unit/security | Scoped token issue/verify/expiry. |
| `settings` | 4 | unit/security | AI settings, secret service, redaction, SSRF guard. |
| `stage15-projects` | 2 | unit/integration-smoke | Project registry and backend web search. |
| `workflow-compiler` | 3 | unit/security | Runtime binding, Activepieces sync, direct AI provider blockers. |
| `workspaces` | 1 | unit/security | Invite token hashing and last-owner protection. |
| `authorization` | 1 | unit/security | Added in Block 1: DB-backed permission matrix, cross-workspace null access, role/permission DTOs. |
| `runs` | 1 | unit/smoke | Added in Block 1: preflight runtime mapping/input blockers and controlled failure classifier. |

Modules with no direct `.spec.ts` at inventory time:

- `admin-console`
- `ai-secrets`
- `approvals`
- `audit`
- `automation-import`
- `automation-library`
- `clauses`
- `compliance`
- `dashboard`
- `document-generation`
- `document-templates`
- `document-types`
- `document-validation`
- `legal-indexing`
- `legal-modules`
- `legal-rag`
- `legal-search`
- `legal-sources`
- `notifications`
- `profile-imports`
- `profiles`
- `realtime`
- `secrets`
- `security-operations`
- `stage7-support`
- `telemetry`
- `workflows`

Several uncovered modules are exercised indirectly by stage gates or adjacent service specs, but they remain explicit unit-test gaps.

## Contract And Schema Validators

Existing validators:

- `scripts/validate-openapi.mjs`
- `scripts/validate-json-schemas.mjs`
- `scripts/validate-example-workflows.mjs`
- `scripts/validate-canvas-fixtures.mjs`
- `scripts/validate-release-manifest.mjs`
- `scripts/validate-ai-assets.mjs`
- `scripts/validate-activepieces-package.mjs`
- `scripts/validate-canvas-security.mjs`
- `scripts/validate-canvas-release-gates.mjs`

Existing package tests:

- `packages/workflow/src/semantic-validator.test.ts`
- `packages/workflow-dsl/test/*.test.cjs`

New Block 1 package tests:

- `packages/contracts/src/security-invariants.test.ts`
- `packages/api-client/src/settings-client.test.ts`
- `packages/ai-gateway/src/route-assets.test.ts`

## DB And Security Gates

Existing DB/security gates:

- `check:db` -> `scripts/validate-db-readiness.mjs` and `db:test:rls`
- `db:test:rls` -> `scripts/validate-stage11-security.mjs --mode=rls`
- `validate:web-bundle-secrets`
- `secret-scan`
- `security:check-no-local-secrets`
- `stage21:security:no-secrets-in-settings-response`
- `stage21:security:ssrf-guard-test`
- `stage21:security:no-secrets-in-audit`
- `stage19:security:no-direct-provider-calls`
- `stage20:security:no-direct-provider-calls`

Existing SQL tests:

- `supabase/tests/pgtap/rls_smoke.sql`
- `supabase/tests/pgtap/stage1_access_matrix.sql`
- `supabase/tests/pgtap/stage2_documents.sql`
- `supabase/tests/pgtap/stage3_library.sql`
- `supabase/tests/pgtap/stage4_runtime.sql`
- `supabase/tests/pgtap/stage6_legal_search.sql`
- `supabase/tests/pgtap/stage7_profiles_templates.sql`
- `supabase/tests/pgtap/stage10_realtime_dashboard.sql`
- `supabase/tests/pgtap/stage11_*`

New focused scripts:

- `scripts/testing/check-audit-redaction.mjs`
- `scripts/testing/check-db-secret-like-values.mjs`
- `scripts/testing/check-contract-security-invariants.mjs`

## Risks And Gaps

| Severity | Gap |
| --- | --- |
| High | Several backend modules in legal/document-generation/approvals/automation-library still lack direct unit specs. |
| High | DB/RLS validation is script/pgTAP-driven; no local Postgres run was forced in the initial focused pass. |
| Medium | Contracts now have runtime invariant tests, but OpenAPI compatibility is still validated by schema, not by generated client round-trip fixtures. |
| Medium | `test:block1:backend` runs the full backend Jest suite; some dependencies use ESM and need existing mocks when adding new specs that import those paths. |
| Medium | Activepieces callback/webhook auth is covered in service/session specs, but callback controller parsing has no dedicated direct spec. |
| Low | Some gates are static scans; they catch direct regressions but do not replace live integrated security tests. |
