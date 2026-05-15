# Part 7 Security / RBAC / Audit Bug Hunt

Date: 2026-05-14

## Scope

Inspected and changed security/runtime surfaces:

- `apps/backend/src/modules/audit/audit.service.ts`
- `apps/backend/src/modules/audit/audit-redaction.ts`
- `apps/backend/src/modules/audit/audit.service.spec.ts`
- `apps/backend/src/modules/authorization/authorization.service.ts`
- `apps/backend/src/modules/settings/*`
- `apps/backend/src/modules/stage15-projects/*`
- `apps/backend/src/modules/chat/*`
- `apps/backend/src/modules/documents/*`
- `apps/backend/src/modules/activepieces/*`
- `apps/backend/src/modules/runs/*`
- `apps/backend/src/modules/security-operations/*`
- `apps/backend/src/modules/secrets/*`
- `scripts/stage16-e2e-preflight.mjs`
- `scripts/stage16-e2e-preflight.test.mjs`
- `tests/e2e/playwright.config.ts`
- `tests/e2e/helpers/auth.ts`
- Part 7 security e2e specs listed below.

Intentionally not repeated as new work:

- static `secret-scan` or `validate:web-bundle-secrets` as the only security proof;
- Part 6 write-only settings key DOM/storage proof without cross-domain audit/browser journey;
- Part 5 simple signed URL DOM proof without forced cross-workspace access;
- Part 4 simple AP JWT cleanup/no AP login proof;
- Part 3 no direct provider calls in chat-only flows;
- basic sign-in smoke and simple admin page happy path.

Added axes:

- forced URL/API access across project, project chat, and document IDs;
- wrong `X-Workspace-Id` spoofing;
- viewer direct calls to audit/security/secrets endpoints;
- live audit redaction after a real settings secret action;
- combined browser DOM/storage/console/network scan across security-relevant routes;
- scoped security preflight.

## Bugs Found

### P1 security/test infra bug: `security` scoped preflight did not exist

Reproduction:

1. Run `node scripts/stage16-e2e-preflight.mjs --scope=security --json --fail-on-required`.
2. Preflight throws `unknown preflight scope: security`.

Impact: Part 7 browser tests could not classify required vs optional infrastructure before running product tests.

Fix:

- Added `security` scope requiring only main LexFrame runtime/Postgres.
- Marked Activepieces, storage, delivery, and OpenSearch as not required for this security matrix.
- Updated Playwright scope inference for `security`, `rbac`, `audit`, `forced-route`, `cross-workspace`, and `permission` specs.

Regression guard:

- `scripts/stage16-e2e-preflight.test.mjs`
- Preflight artifact: `artifacts/system-tests/part7-preflight.security.json`

### P1 security bug: AuditService persisted raw secret-like metadata if a caller forgot local redaction

Reproduction:

1. Call `AuditService.record` with metadata containing:
   - `secret_ref_id`
   - `Authorization: Bearer ...`
   - a signed storage URL
   - `backendSecretId`
2. Inspect the JSONB params sent to `audit.audit_events`.

Before fix: `AuditService` wrote caller-supplied metadata directly. Some modules had local redactors, but audit was not a final boundary.

Impact: future cross-domain audit writes could leak secret refs, signed URLs, Authorization values, JWT-like strings, raw content keys, or private/service-key markers even if individual modules missed a redactor.

Fix:

- Added `apps/backend/src/modules/audit/audit-redaction.ts`.
- `AuditService.record` now sanitizes `metadata` and `redactionSummary` before persistence.
- `AuditService.list` sanitizes legacy rows before returning them.
- `redaction_applied` is set when the audit boundary redacts anything.

Regression guard:

- `apps/backend/src/modules/audit/audit.service.spec.ts`
- `tests/e2e/security-audit-redaction-live.spec.ts`

### P2 test/runtime issue: sign-in helper had a short post-onboarding URL assertion

Reproduction:

1. Create a fresh e2e user.
2. Let onboarding create a new workspace.
3. Immediately assert `/app` or `/dashboard` with the default 5s timeout.

Impact: security tests that create fresh owner/viewer workspaces could fail before the actual security assertion.

Fix:

- Increased the final `signInAsDemo` post-onboarding URL assertion to 15s.
- No product behavior or UI change.

### P3 test fixture issue: forced-route document setup used a non-contract document kind

Reproduction:

1. Call `POST /documents/upload-intents` with `kind: "claim"`.
2. Backend returns `400` because `claim` is not a valid `DocumentKind`.

Fix:

- Updated Part 7 forced-route fixture to use `case_material`.
- Final forced-route evidence now includes 3 blocked foreign-resource API checks: project, project chat, document.

## Tests Added / Changed

New e2e:

- `tests/e2e/security-forced-route-access.spec.ts`
- `tests/e2e/security-cross-workspace-data-leakage.spec.ts`
- `tests/e2e/security-admin-route-guard.spec.ts`
- `tests/e2e/security-audit-redaction-live.spec.ts`
- `tests/e2e/security-browser-storage-network-full.spec.ts`

Changed tests/helpers:

- `tests/e2e/helpers/auth.ts`
- `tests/e2e/playwright.config.ts`
- `scripts/stage16-e2e-preflight.test.mjs`
- `apps/backend/src/modules/audit/audit.service.spec.ts`

## Results

Preflight:

- Command: `node scripts/stage16-e2e-preflight.mjs --scope=security --json --fail-on-required`
- Result: `READY`
- Required services ready: Node, corepack, pnpm, application ports, Docker, main Postgres, `127.0.0.1:54322`.
- Optional/not required for scope: Activepieces DB/Redis/app/worker, storage sandbox, delivery sandbox, OpenSearch.
- Artifact: `artifacts/system-tests/part7-preflight.security.json`

Backend-backed e2e:

- Command: `corepack pnpm --filter @lexframe/e2e exec playwright test security-forced-route-access.spec.ts security-cross-workspace-data-leakage.spec.ts security-admin-route-guard.spec.ts security-audit-redaction-live.spec.ts security-browser-storage-network-full.spec.ts --reporter=json --output=artifacts/playwright-part7-backend-final`
- Environment: `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1`, `LEXFRAME_E2E_USE_MSW=0`
- Result: 5/5 PASS, 0 skipped, 0 unexpected, 0 flaky.
- Results JSON: `artifacts/system-tests/part7-results.backend-security-runtime.json`
- Playwright artifacts: `tests/e2e/artifacts/playwright-part7-backend-final/`

MSW:

- Not used as proof for Part 7.
- Reason: RBAC, workspace spoofing, audit persistence, and backend security boundaries must be backend-backed.

Static/backend:

- `node --test scripts/stage16-e2e-preflight.test.mjs` PASS 5/5.
- `corepack pnpm --filter @lexframe/backend test -- audit.service` PASS.
- `corepack pnpm --filter @lexframe/backend test -- authorization audit settings activepieces documents chat runs security-operations secrets` PASS 22 suites / 85 tests.
- `corepack pnpm --filter @lexframe/backend test -- audit.service settings-redactor ai-base-url-ssrf` PASS 3 suites / 9 tests.
- `corepack pnpm --filter @lexframe/backend typecheck` PASS.
- `corepack pnpm --filter @lexframe/backend lint` PASS.
- `corepack pnpm --filter @lexframe/e2e typecheck` PASS.
- `corepack pnpm --filter @lexframe/e2e lint` PASS.

Security scans:

- `corepack pnpm validate:web-bundle-secrets` PASS.
- `corepack pnpm secret-scan` PASS.

## Evidence Summary

Forced route access:

- API checks blocked: 3.
- Covered foreign project detail, foreign project chat detail, foreign document detail.
- Browser forced project/chat URLs did not render foreign project/chat markers.
- Final document setup: `200`, document ID created, foreign access blocked.

Cross-workspace spoofing:

- Wrong `X-Workspace-Id` denied in both directions: 2/2.
- Workspace B project list contained only Workspace B marker and not Workspace A marker.

Admin/security route guard:

- Viewer direct API denied with `403`: `/audit/events`, `/admin/security/audit-events`, `/admin/security/secrets`, `/admin/security/alerts`, `/admin/security/incidents`.
- Viewer forced `/admin/security` route did not show security overview heading or admin nav entry.

Audit redaction:

- Real settings secret action produced 2 settings audit events.
- Fake provider key marker absent from audit response.
- Audit response did not contain raw `Authorization: Bearer`, signed URL token, raw `secret_ref_id` UUID, or `backendSecretId` value.
- Audit metadata contained `[REDACTED]` evidence.

Browser storage/network:

- Routes scanned: `/app/projects`, `/chat`, `/documents`, `/admin/security`, `/settings/profile/audit`.
- DOM scan: PASS.
- localStorage/sessionStorage scan: PASS.
- Console leak scan: PASS, leaks `[]`.
- Network forbidden hosts: `[]`.
- Network secret leaks: `[]`.
- Network response leaks: `[]`.

Artifacts:

- Final Playwright failure traces/videos/screenshots: none; final run passed.
- Earlier RED/debug artifacts are retained under:
  - `tests/e2e/artifacts/playwright-part7-backend-security/`
  - `tests/e2e/artifacts/playwright-part7-backend-rerun/`
  - `tests/e2e/artifacts/playwright-part7-forced-route-rerun/`
  These correspond to fixed test helper/fixture issues, not remaining product failures.

## Changed Files

- `apps/backend/src/modules/audit/audit-redaction.ts`
- `apps/backend/src/modules/audit/audit.service.ts`
- `apps/backend/src/modules/audit/audit.service.spec.ts`
- `scripts/stage16-e2e-preflight.mjs`
- `scripts/stage16-e2e-preflight.test.mjs`
- `tests/e2e/playwright.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/security-forced-route-access.spec.ts`
- `tests/e2e/security-cross-workspace-data-leakage.spec.ts`
- `tests/e2e/security-admin-route-guard.spec.ts`
- `tests/e2e/security-audit-redaction-live.spec.ts`
- `tests/e2e/security-browser-storage-network-full.spec.ts`
- `docs/testing/part7-security-rbac-audit-bug-hunt.md`
- `artifacts/system-tests/part7-preflight.security.json`
- `artifacts/system-tests/part7-results.backend-security-runtime.json`

## Unresolved Risks

- Stale-permission downgrade was not fully automated in browser because role changes require admin reauth. Viewer invite/direct-denial coverage proves backend denial for low-privilege sessions, but not live downgrade propagation mid-session.
- The final live matrix covers project, project chat, document, admin/security/audit, settings-audit redaction, and browser isolation. It does not exhaust every endpoint in chat branches, runs artifacts, delivery, recommendations, and legal search; backend targeted suites cover part of that surface.
- Audit sanitizer redacts secret-like values and high-risk field names at the audit boundary. It intentionally preserves safe metadata keys with `[REDACTED]` values so operators can see which field class was removed.
- Browser trace response-body capture is still Playwright-runner dependent on failures. Final Part 7 run had no failures, and network response scans in-browser found no forbidden response leaks.
