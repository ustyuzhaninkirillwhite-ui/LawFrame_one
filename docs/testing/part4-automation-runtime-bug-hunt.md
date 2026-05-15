# Part 4 Automation Runtime Bug Hunt

Date: 2026-05-14

Scope: project automations, embedded Activepieces Canvas route, Activepieces session bridge, automation route cache, dry-run idempotency, runtime evidence, browser security isolation, scoped runtime readiness.

## Inspected Files

- `apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx`
- `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx`
- `apps/web/src/features/automation-canvas/use-activepieces-session.ts`
- `apps/web/src/features/automation-canvas/activepieces-browser-session.ts`
- `apps/web/src/components/shell/project-home.tsx`
- `apps/web/src/components/shell/project-automations.tsx`
- `apps/web/src/components/shell/project-automations-landing.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/providers/session-provider.tsx`
- `apps/backend/src/modules/activepieces/activepieces.service.ts`
- `apps/backend/src/modules/activepieces/activepieces.controller.ts`
- `apps/backend/src/modules/automation-builder/automation-builder.service.ts`
- `scripts/stage16-e2e-preflight.mjs`
- `tests/e2e/utils/activepieces.ts`
- `tests/e2e/utils/automation.ts`
- `tests/e2e/utils/canvas-runtime.ts`
- `tests/e2e/utils/run-evidence.ts`
- `tests/e2e/utils/browser-secret-scan.ts`

## Not Repeated

- Part 1 AppShell/sidebar/floating composer checks were only used as route readiness assertions.
- Part 2 Project Workspace generic tab/composer checks were not repeated except where automation row navigation depended on project tab route state.
- Part 3 Chat Runtime checks were not rerun.
- Static secret scans were not used as the only proof; browser DOM/storage/network checks ran in Playwright.
- Basic "automation tab exists" and basic "no AP login" smoke were extended with route, session, request-count, storage, and security assertions.

## New Or Extended Tests

- `tests/e2e/automation-runtime-readiness-live.spec.ts`
- `tests/e2e/automation-session-refresh-expiry.spec.ts`
- `tests/e2e/automation-dry-run-idempotency.spec.ts`
- `tests/e2e/automation-route-family-cache-live.spec.ts`
- `tests/e2e/automation-browser-security-isolation.spec.ts`
- `tests/e2e/automation-runtime-evidence-live.spec.ts`
- `tests/e2e/automation-cross-scope-access.spec.ts`
- Extended `tests/e2e/automation-route-cache-cleanup.spec.ts` with MSW backend-only skips for request-count/page.route assertions.
- Added backend regression coverage in `automation-builder.service.spec.ts` and `activepieces.service.spec.ts`.
- Added `session-provider.test.tsx` for demo-session recovery after browser history restores a pending protected route.

## Bugs Found And Fixed

P1 product bug: AI automation builder route snapshot could expose a null key fingerprint.
Repro: run `automation-ai-builder-runtime.spec.ts`; `plan.blueprint.routeSnapshot.keyFingerprint` was `null`, while runtime evidence expects a redacted server reference.
Fix: extracted `buildSafeAutomationRouteSnapshot()` and replaced null fingerprints with `server_route_ref`.

P1 product bug: backend dry-run idempotency was not enforced before run creation.
Repro: POST twice to `/automations/:automationId/run` with the same `idempotencyKey`. Before the fix the service proceeded into runtime readiness/transaction path instead of returning the existing run.
Fix: `ActivepiecesService.startRun()` now loads an existing run by workspace, automation, mode, and idempotency key before dispatch.

P1 product/navigation bug: Project Workspace automation tab used raw `window.history.pushState`, desynchronizing Next router state.
Repro: open `/app/projects/:projectId`, switch to `РђРІС‚РѕРјР°С‚РёР·Р°С†РёРё`, click an automation row. DOM could render the canvas while URL stayed `/app/projects/:projectId?tab=automations`.
Fix: `ProjectHome.selectTab()` now uses `router.push(nextUrl, { scroll: false })`, keeping App Router state and browser URL aligned.

P2 runtime recovery bug: a restored protected app route could remain in pending session state after browser history navigation.
Repro: keep the first demo bootstrap pending, dispatch `pageshow`, and observe the protected route staying in `authPending`.
Fix: SessionProvider now has generation guards and a bounded demo recovery path for `pageshow`/`popstate`/pending watchdog.

P3 test-only issue: two backend request-count tests were not valid under MSW.
Repro: run `automation-route-cache-cleanup.spec.ts` with `LEXFRAME_E2E_USE_MSW=1`; service worker accounting differs from backend network accounting and `page.route` can miss MSW-handled requests.
Fix: those two assertions are explicitly backend-backed-only in MSW mode. Backend-backed still runs and passes them.

Infra blocker resolved: AP runtime was initially unavailable for automation scope.
Repro: `stage16-e2e-preflight --scope=automation` reported AP DB/Redis/app/worker down.
Fix: started `postgres`, `activepieces-postgres`, `activepieces-redis`, `activepieces-app`, and `activepieces-worker` via the local integrated compose profile. Final preflight is `READY`.

## Changed Files

- `apps/backend/src/modules/activepieces/activepieces.service.ts`
- `apps/backend/src/modules/activepieces/activepieces.service.spec.ts`
- `apps/backend/src/modules/automation-builder/automation-builder.service.ts`
- `apps/backend/src/modules/automation-builder/automation-builder.service.spec.ts`
- `apps/web/src/components/shell/project-home.tsx`
- `apps/web/src/providers/session-provider.tsx`
- `apps/web/src/providers/session-provider.test.tsx`
- `tests/e2e/automation-runtime-readiness-live.spec.ts`
- `tests/e2e/automation-session-refresh-expiry.spec.ts`
- `tests/e2e/automation-dry-run-idempotency.spec.ts`
- `tests/e2e/automation-route-family-cache-live.spec.ts`
- `tests/e2e/automation-browser-security-isolation.spec.ts`
- `tests/e2e/automation-runtime-evidence-live.spec.ts`
- `tests/e2e/automation-cross-scope-access.spec.ts`
- `tests/e2e/automation-route-cache-cleanup.spec.ts`
- `docs/testing/part4-automation-runtime-bug-hunt.md`

## Runtime Evidence

- Preflight: `artifacts/system-tests/part4-preflight.automation.json`
- Docker compose status: `artifacts/system-tests/part4-compose-status.txt`
- Backend-backed Playwright JSON: `artifacts/system-tests/part4-results.backend-automation-runtime.json`
- MSW deterministic Playwright JSON: `artifacts/system-tests/part4-results.msw-automation-runtime.json`
- Final backend-backed run: 24 passed, 0 skipped, 0 failed.
- Final MSW subset: 9 passed, 2 skipped as backend-backed-only, 0 failed.
- Final failure traces/videos/screenshots: none. Final targeted runs passed.

## Console, Network, Storage

- Console/hydration: guarded canvas scenarios passed `assertNoHydrationErrors` and `assertNoConsoleErrors`; controlled 503 resource errors are allowlisted where the test intentionally forces session failure.
- Browser provider calls: `automation-browser-security-isolation.spec.ts` asserted zero direct browser calls to OpenAI/Anthropic/xAI/DeepSeek/CometAPI.
- Activepieces admin calls: zero direct browser AP admin/API-key calls with `x-api-key`/admin path were allowed.
- Storage/DOM: browser storage and DOM scans passed for AP API key, signing key, provider key, service-role, private key, signed URL, and JWT-like leaks outside the automation family.
- AP token lifecycle: route-family/cache tests asserted token retention only inside automation family and cleanup after navigating to non-automation routes.

## Request Count Metrics

- Automation tab backend re-entry: no full skeleton and at most 1 extra `/projects/:id/automations` GET after returning to the tab.
- Slow automation list: one backend automation-list request is delayed; composer and tabs remain usable.
- Canvas reload: at most 1 extra `/activepieces/session` POST after reload, no session loop.
- Route family back/forward: at most 2 extra session POSTs after returning to canvas.
- Session refresh/reload: at most 3 backend-mediated session POST responses, each below 500.
- Dry-run duplicate click: frontend guard permits one backend run POST.
- Backend dry-run idempotency: repeated POST with same key returns the same `runId`, `traceId`, and `externalRunId`.

## Commands Run

- `docker compose --profile local-integrated up -d activepieces-postgres activepieces-redis activepieces-app activepieces-worker`
- `node scripts/stage16-e2e-preflight.mjs --scope=automation --json --fail-on-required --allow-reuse-runtime` -> READY
- `corepack pnpm --filter @lexframe/web typecheck` -> PASS
- `corepack pnpm --filter @lexframe/web lint` -> PASS
- `corepack pnpm --filter @lexframe/web test -- activepieces-canvas activepieces-session app-shell project-home session-provider` -> PASS, 36 files / 152 tests
- `corepack pnpm --filter @lexframe/backend typecheck` -> PASS
- `corepack pnpm --filter @lexframe/backend lint` -> PASS
- `corepack pnpm --filter @lexframe/backend test -- activepieces automation-builder canvas runs workflows` -> PASS, 27 suites / 76 tests
- `corepack pnpm --filter @lexframe/e2e typecheck` -> PASS
- `corepack pnpm --filter @lexframe/e2e lint` -> PASS
- Backend-backed e2e targeted Part 4 command -> PASS, 24/24
- MSW deterministic subset -> PASS, 9 passed / 2 backend-only skipped
- `corepack pnpm validate:web-bundle-secrets` -> PASS
- `corepack pnpm secret-scan` -> PASS

## Backend-Backed Vs MSW

Backend-backed is the source of truth for AP readiness, dry-run idempotency, run evidence, AP session endpoint, and request-count metrics. It passed all 24 targeted tests.

MSW was used only for deterministic browser branch coverage where no direct backend APIRequest proof was required. Two request-count/page.route tests are skipped in MSW because service worker request accounting is not equivalent to backend network behavior.

## Runtime State

- Main Postgres `127.0.0.1:54322`: running and healthy.
- Activepieces Postgres `127.0.0.1:54323`: running and healthy.
- Activepieces Redis `127.0.0.1:6380`: running and healthy.
- Activepieces app `127.0.0.1:8080`: running and healthy.
- Activepieces worker: running.
- Storage sandbox, delivery sandbox, and OpenSearch: not required for automation scope and do not block this part.
- Playwright backend/web servers on 3100/3000 were stopped after the run; Docker compose services were left running for the next parts.

## Unresolved Risks

- Local AP can still return controlled unavailable states for builder readiness/membership; this is covered as a safe degraded branch, but it is not the same as proving a full successful AP authoring session in every local run.
- Next dev emitted Fast Refresh full reload warnings during Playwright startup after code changes. The final assertions passed, but clean production build behavior is still a separate release-gate concern.
- Storage/delivery/OpenSearch domains were intentionally not covered in Part 4.
