# Part 6 Settings / Profile / Organization / AI Route Preferences Bug Hunt

Date: 2026-05-14

## Scope

Inspected and changed only settings/security/runtime testability surfaces:

- `apps/web/src/features/settings/components/ai-settings-panel.tsx`
- `apps/web/src/features/settings/components/ai-route-group-card.tsx`
- `apps/web/src/features/settings/components/ai-provider-connection-form.tsx`
- `apps/web/src/features/settings/components/ai-key-write-only-field.tsx`
- `apps/web/src/features/settings/components/ai-connection-test-button.tsx`
- `apps/web/src/features/settings/components/ai-settings-panel.test.tsx`
- `apps/backend/src/modules/settings/ai-base-url-ssrf.guard.ts`
- `apps/backend/src/modules/settings/ai-base-url-ssrf.guard.spec.ts`
- `apps/backend/src/modules/settings/settings-redactor.ts`
- `apps/backend/src/modules/settings/settings-redactor.spec.ts`
- `scripts/stage16-e2e-preflight.mjs`
- `scripts/stage16-e2e-preflight.test.mjs`
- `tests/e2e/playwright.config.ts`
- `tests/e2e/utils/settings-security.ts`
- Part 6 settings e2e specs listed below.

Intentionally not repeated as new work:

- Part 1 settings dialog open/focus/Escape shell recovery, except as setup for real settings flows.
- Block 5 MSW-only generic profile/org/AI failure tests without backend persistence or security checks.
- Static `secret-scan` / bundle scan as the only security proof.
- Simple settings button smoke and simple route-tab presence checks.
- Chat, automation, project workspace, and documents scenarios from Parts 2-5 unless settings state was the dependency.

## Bugs Found

### P1 product bug: saving one AI route group overwrote the other route group

Reproduction:

1. Open settings AI configuration.
2. Configure only the chat route group.
3. Save the chat route.
4. Observe route-group update calls for both `chat_ai` and `automation_ai`.

Impact: chat and automation provider preferences could drift together even though the product requires separate route groups.

Fix:

- `persistAiSettings` now updates only `input.routeGroup`.
- Added regression coverage in `ai-settings-panel.test.tsx`.
- Backend-backed e2e proves `chat_ai` and `automation_ai` resolve to distinct provider connection IDs through `/settings/ai/effective-policy`.

### P1 product bug: automation route reused chat connection implicitly

Reproduction:

1. Configure a chat route preference.
2. Leave automation route unconfigured.
3. Open automation AI route card.
4. Save/update without an automation route preference.

Impact: the automation card could use `connections[0]`, which made the chat connection an implicit automation connection.

Fix:

- `pickConnection` returns `null` unless the current route group preference explicitly points to a connection.
- Automation route now creates/uses its own route-specific connection.
- Added unit regression and backend-backed multitab route consistency e2e.

### P1 security bug: literal private/localhost provider base URLs were blocked only in production

Reproduction:

1. Submit AI provider base URL `http://127.0.0.1:11434/v1` or `http://localhost`.
2. In non-production runtime the guard accepted the literal host before the fix.

Impact: local/dev backend-backed settings tests could persist SSRF-prone provider endpoints, weakening the invariant that provider calls are backend-only and policy-checked.

Fix:

- `assertNoLiteralPrivateHost` now runs in all environments.
- Production still performs DNS resolution for public-host verification.
- Backend and live e2e now reject localhost, private, metadata, and IPv6 loopback URLs with controlled `AI_BASE_URL_BLOCKED`.

### P2 security/audit bug: backend secret references were not redacted by settings redactor

Reproduction:

1. Call the settings redactor with audit metadata containing `secret_ref_id`, `secretRefId`, `backendSecretId`, or `vault_secret_id`.
2. Observe raw backend secret references in the redacted output.

Impact: audit or diagnostic metadata could expose internal secret reference identifiers.

Fix:

- Added those fields to `SECRET_KEY_NAMES`.
- Added `settings-redactor.spec.ts` regression coverage.

### P3 testability issue: AI provider fields lacked route-stable selectors

Reproduction:

1. Open both chat and automation AI route cards.
2. Browser tests had to rely on duplicate/non-route-scoped field IDs and labels.

Fix:

- Added route-scoped `data-testid` values and per-route API key input IDs.
- No layout, color, copy, spacing, icon, animation, or visual hierarchy change.

## Tests Added / Changed

New e2e:

- `tests/e2e/settings-profile-organization-live.spec.ts`
- `tests/e2e/settings-ai-route-preferences-live.spec.ts`
- `tests/e2e/settings-secret-write-only-security.spec.ts`
- `tests/e2e/settings-network-failure-resilience.spec.ts`
- `tests/e2e/settings-multitab-consistency.spec.ts`
- `tests/e2e/settings-browser-security-isolation.spec.ts`
- `tests/e2e/settings-ssrf-guard-live.spec.ts`
- `tests/e2e/utils/settings-security.ts`

Changed support tests:

- `apps/web/src/features/settings/components/ai-settings-panel.test.tsx`
- `apps/backend/src/modules/settings/ai-base-url-ssrf.guard.spec.ts`
- `apps/backend/src/modules/settings/settings-redactor.spec.ts`
- `scripts/stage16-e2e-preflight.test.mjs`

Runtime/test config:

- Added `settings` scoped preflight.
- E2E scope inference maps settings/profile/organization/route-preference/secret-write-only/SSRF specs to `settings`.

## Results

Preflight:

- Command: `node scripts/stage16-e2e-preflight.mjs --scope=settings --json --fail-on-required`
- Result: `READY`
- Required services ready: Node, corepack, pnpm, application ports, Docker, main Postgres, `127.0.0.1:54322`.
- Optional services not required for scope: Activepieces DB/Redis/app/worker, storage sandbox, delivery sandbox, OpenSearch.
- Artifact: `artifacts/system-tests/part6-preflight.settings.json`

Backend-backed e2e:

- Command: `corepack pnpm --filter @lexframe/e2e exec playwright test settings-profile-organization-live.spec.ts settings-ai-route-preferences-live.spec.ts settings-secret-write-only-security.spec.ts settings-network-failure-resilience.spec.ts settings-multitab-consistency.spec.ts settings-browser-security-isolation.spec.ts settings-ssrf-guard-live.spec.ts --reporter=json --output=artifacts/playwright-part6-backend-final`
- Environment: `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1`, `LEXFRAME_E2E_USE_MSW=0`
- Result: 8/8 PASS, 0 skipped, 0 unexpected, 0 flaky.
- Results JSON: `artifacts/system-tests/part6-results.backend-settings-runtime.json`
- Playwright artifacts: `tests/e2e/artifacts/playwright-part6-backend-final/`

MSW deterministic:

- Command: `corepack pnpm --filter @lexframe/e2e exec playwright test settings-network-failure-resilience.spec.ts --reporter=json --output=artifacts/playwright-part6-msw-final`
- Environment: `LEXFRAME_E2E_USE_MSW=1`
- Result: 1/1 PASS, 0 skipped, 0 unexpected, 0 flaky.
- Results JSON: `artifacts/system-tests/part6-results.msw-settings-runtime.json`
- Playwright artifacts: `tests/e2e/artifacts/playwright-part6-msw-final/`

Static/unit/backend:

- `node --test scripts/stage16-e2e-preflight.test.mjs` PASS 4/4.
- `corepack pnpm --filter @lexframe/e2e typecheck` PASS.
- `corepack pnpm --filter @lexframe/e2e lint` PASS.
- `corepack pnpm --filter @lexframe/web typecheck` PASS.
- `corepack pnpm --filter @lexframe/web lint` PASS.
- `corepack pnpm --filter @lexframe/web test -- settings` PASS.
- `corepack pnpm --filter @lexframe/web test -- settings-shell ai-settings-panel ai-key-write-only-field ai-provider-connection-form` PASS.
- `corepack pnpm --filter @lexframe/backend test -- ai-base-url-ssrf` PASS.
- `corepack pnpm --filter @lexframe/backend test -- settings-redactor` PASS.
- `corepack pnpm --filter @lexframe/backend test -- settings ai-gateway secrets` PASS.

Security:

- `corepack pnpm validate:web-bundle-secrets` PASS.
- `corepack pnpm secret-scan` PASS.

## Backend-backed vs MSW

Backend-backed was the source of truth for:

- profile and organization persistence after reload;
- route preference persistence and effective backend resolution;
- write-only secret response/DOM/storage behavior;
- SSRF/base URL guard;
- browser direct-provider isolation.

MSW was used only for deterministic failure recovery:

- fail-once AI provider metadata/secret save;
- dirty state remains recoverable;
- provider-like error is redacted.

MSW was not used as proof for backend persistence, route resolution, SSRF policy, or browser secret isolation. A broader MSW settings security run was intentionally not claimed because MSW diagnostics can log redacted request objects in the browser console and would not prove backend policy.

## Evidence Summary

Console:

- Final backend-backed Part 6 run had no console/pageerror assertion failures in covered specs.
- Failure-resilience tests assert provider-like errors are redacted and do not expose stack traces or keys.

Network/request metrics:

- Route preference e2e: one chat route save and one automation route save; final backend state contained distinct effective policies.
- Multitab e2e: two tabs saved different route groups; final API state retained both without cross-overwrite.
- Failure recovery e2e: first AI save failed once, retry recovered without duplicate stuck state.
- SSRF e2e: five blocked base URLs returned controlled backend errors and did not trigger browser direct calls to those hosts.
- Browser security e2e: no direct browser calls to OpenAI, Anthropic, xAI, DeepSeek, CometAPI, Activepieces provider-key surfaces, or localhost/private provider URLs.

DOM/storage scan:

- `settingsSecuritySnapshot` scanned DOM, localStorage, sessionStorage, cookies, console messages, and network responses.
- Unique fake provider key markers were allowed only in outbound backend request bodies for save/test.
- Final backend-backed scans found no marker in responses, DOM, localStorage, sessionStorage, cookies, or console.
- Secret-like checks covered provider keys, JWT-like values, `Authorization`, `service_role`, private key markers, and signed URL markers.

Artifacts:

- Final backend-backed failure traces/videos/screenshots: none; final run passed.
- Final MSW failure traces/videos/screenshots: none for the passing final MSW spec.
- Earlier debug runs left historical artifacts under:
  - `tests/e2e/artifacts/playwright-part6-backend/`
  - `tests/e2e/artifacts/playwright-part6-backend-rerun/`
  - `tests/e2e/artifacts/playwright-part6-msw-final/`
  These correspond to fixed test authoring issues and non-claimed broader MSW attempts, not final product failures.

## Changed Files

- `scripts/stage16-e2e-preflight.mjs`
- `scripts/stage16-e2e-preflight.test.mjs`
- `tests/e2e/playwright.config.ts`
- `apps/backend/src/modules/settings/ai-base-url-ssrf.guard.ts`
- `apps/backend/src/modules/settings/ai-base-url-ssrf.guard.spec.ts`
- `apps/backend/src/modules/settings/settings-redactor.ts`
- `apps/backend/src/modules/settings/settings-redactor.spec.ts`
- `apps/web/src/features/settings/components/ai-settings-panel.tsx`
- `apps/web/src/features/settings/components/ai-settings-panel.test.tsx`
- `apps/web/src/features/settings/components/ai-route-group-card.tsx`
- `apps/web/src/features/settings/components/ai-provider-connection-form.tsx`
- `apps/web/src/features/settings/components/ai-key-write-only-field.tsx`
- `apps/web/src/features/settings/components/ai-connection-test-button.tsx`
- `tests/e2e/settings-profile-organization-live.spec.ts`
- `tests/e2e/settings-ai-route-preferences-live.spec.ts`
- `tests/e2e/settings-secret-write-only-security.spec.ts`
- `tests/e2e/settings-network-failure-resilience.spec.ts`
- `tests/e2e/settings-multitab-consistency.spec.ts`
- `tests/e2e/settings-browser-security-isolation.spec.ts`
- `tests/e2e/settings-ssrf-guard-live.spec.ts`
- `tests/e2e/utils/settings-security.ts`
- `docs/testing/part6-settings-security-bug-hunt.md`
- `artifacts/system-tests/part6-preflight.settings.json`
- `artifacts/system-tests/part6-results.backend-settings-runtime.json`
- `artifacts/system-tests/part6-results.msw-settings-runtime.json`

## Unresolved Risks

- IndexedDB was not deep-scanned in Part 6 because settings code under test does not intentionally persist provider secrets there. DOM, local/session storage, cookies, network responses, and console were covered.
- DNS rebinding class checks remain production DNS-resolution policy. Literal localhost/private/link-local/metadata hosts are now blocked in every environment.
- The browser necessarily sends a secret marker in the outbound backend request body for save/test operations. The regression guard verifies it is not returned, rendered, stored, or sent to direct provider hosts.
- Workspace-switch permission edge cases were covered through active-workspace save behavior, not a full RBAC matrix for every non-admin role. Backend permission expansion should remain a separate authorization-focused part if needed.
