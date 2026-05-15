# Part 3 Chat Runtime Bug Hunt

Р”Р°С‚Р°: 2026-05-14

РћР±Р»Р°СЃС‚СЊ: `/chat`, `/chat/:chatId`, `/app/projects/:projectId/chats`, `/app/projects/:projectId/chats/:chatId`, optimistic UI, SSE/JSON lifecycle, reload recovery, cancel/retry, attachments, branches, sidebar/history scope, browser security isolation.

## Inspected Files

- `apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameChatShell.test.tsx`
- `apps/web/src/features/ai-chat/components/BranchSwitcher.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameAttachmentTile.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameComposer.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameThread.tsx`
- `apps/web/src/features/ai-chat/domain/chatStateMachine.ts`
- `apps/web/src/features/ai-chat/domain/chatStateMachine.test.ts`
- `apps/web/src/features/ai-chat/api/chatApi.ts`
- `apps/web/src/components/shell/project-sidebar.tsx`
- `packages/api-client/src/chat-client.ts`
- `packages/api-client/src/core.ts`
- `apps/web/src/mocks/stage15-handlers.ts`
- `tests/e2e/utils/*`

## Not Repeated

- Part 1 AppShell/sidebar/preflight checks were used only as route readiness helpers.
- Part 2 Project Workspace tab/composer persistence was not repeated.
- Basic optimistic user append and basic assistant placeholder smoke were not counted as new coverage without reload/race/failure axes.
- Static secret scan was not used as the only browser security proof; browser DOM/storage/network assertions run in e2e.

## New Tests Added

- `tests/e2e/chat-live-reload-recovery.spec.ts`
- `tests/e2e/chat-stream-race-conditions.spec.ts`
- `tests/e2e/chat-attachments-failure-lifecycle.spec.ts`
- `tests/e2e/chat-branch-persistence-live.spec.ts`
- `tests/e2e/chat-multitab-consistency.spec.ts`
- `tests/e2e/chat-browser-security-isolation.spec.ts`
- `tests/e2e/utils/chat-runtime-part3.ts`

Support tests added/extended:

- `LexFrameChatShell.test.tsx`: route hydrate replacement, old stream event isolation, global chat creation, attachment upload/complete, cancel, branch/regenerate guards.
- `chatStateMachine.test.ts`: hydrate replaces thread snapshot instead of retaining messages from another thread.

## Bugs Found And Fixed

P1 product bug: hydrate leaked messages across threads.
Repro: open project chat A, load messages, navigate/rerender to chat B. Before the fix, reducer merged hydrate payload with existing messages, so chat A content could remain in B/global DOM.
Fix: `hydrate` now replaces the visible snapshot with `mergeMessages([], action.messages)` and resets run/error state.

P1 product bug: late SSE events could mutate the wrong route.
Repro: send delayed message in project chat A, navigate to global/project chat B, let A stream finish. Old stream events could update current UI.
Fix: stream events/snapshots/catch/finally are guarded by active thread id and stream request id.

P2 product bug: new-thread optimistic state could be erased by immediate route hydrate or forced reload.
Repro: create a new chat and send immediately while route changes; an empty/lagging snapshot could remove the optimistic user/assistant messages.
Fix: skip the first automatic message load for newly created thread, preserve active streams during non-forced loads, and reconcile missing optimistic messages after forced reload/failure.

P2 product bug: cancel could use stale runtime state.
Repro: start a stream and click cancel after state changes; stale closure could miss the active stream id.
Fix: `cancelStream` reads current runtime from a ref and invalidates the current stream request.

P3 test-only/infra issue: MSW/Next dev false failures.
Repro: first dynamic chat route or browser API call during Next Fast Refresh could hit empty dev manifest (`Unexpected end of JSON input`) or bypass MSW once for `/session/context` and return Next 404.
Fix: e2e helper retries only recognized Next dev manifest race and only retries `Session context failed: 404` in MSW mode. Backend-backed 404 is not masked.

## Changed Files

- `apps/web/src/features/ai-chat/domain/chatStateMachine.ts`
- `apps/web/src/features/ai-chat/domain/chatStateMachine.test.ts`
- `apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx`
- `apps/web/src/features/ai-chat/components/LexFrameChatShell.test.tsx`
- `apps/web/src/mocks/stage15-handlers.ts`
- `tests/e2e/utils/chat-runtime-part3.ts`
- `tests/e2e/chat-live-reload-recovery.spec.ts`
- `tests/e2e/chat-stream-race-conditions.spec.ts`
- `tests/e2e/chat-attachments-failure-lifecycle.spec.ts`
- `tests/e2e/chat-branch-persistence-live.spec.ts`
- `tests/e2e/chat-multitab-consistency.spec.ts`
- `tests/e2e/chat-browser-security-isolation.spec.ts`
- `artifacts/system-tests/part3-results.backend-chat-runtime.json`
- `artifacts/system-tests/part3-results.msw-chat-runtime.json`

No visual design files/tokens/layout/colors/spacing/labels were intentionally changed.

## Commands And Results

- `corepack pnpm --filter @lexframe/web typecheck` - PASS
- `corepack pnpm --filter @lexframe/web lint` - PASS
- `corepack pnpm --filter @lexframe/web test -- LexFrameChatShell chatStateMachine BranchSwitcher LexFrameAttachmentTile project-sidebar` - PASS, 35 files / 150 tests
- `corepack pnpm --filter @lexframe/backend test -- chat chat-thread chat-stream project-knowledge` - PASS, 4 suites / 14 tests
- `corepack pnpm --filter @lexframe/e2e typecheck` - PASS
- `corepack pnpm --filter @lexframe/e2e lint` - PASS
- `LEXFRAME_E2E_USE_MSW=1 playwright test chat-live-reload-recovery.spec.ts chat-stream-race-conditions.spec.ts chat-attachments-failure-lifecycle.spec.ts chat-branch-persistence-live.spec.ts chat-multitab-consistency.spec.ts chat-browser-security-isolation.spec.ts` - PASS, 7 passed / 1 skipped
- `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1 LEXFRAME_E2E_USE_MSW=0 playwright test ...` - BLOCKED_INFRASTRUCTURE before product tests
- `corepack pnpm validate:web-bundle-secrets` - PASS, scanned 564 files
- `corepack pnpm secret-scan` - PASS

Backend-backed blocker:

- Preflight failed before browser tests: Postgres/Supabase unavailable on `127.0.0.1:54322` and `127.0.0.1:54323`.
- `docker version` also failed: Docker Desktop Linux engine pipe not found, so local DB runtime could not be started in this session.

## Playwright Results

- Backend-backed blocked result: `artifacts/system-tests/part3-results.backend-chat-runtime.json`
- MSW deterministic result: `artifacts/system-tests/part3-results.msw-chat-runtime.json`
- Current Playwright report JSON: `tests/e2e/playwright-report/results.json`
- Trace/video/screenshot paths: none for final MSW run; backend-backed stopped in webServer preflight before browser artifacts.

## Console, Network, Storage

MSW covered scenarios passed `assertNoChatRuntimeLeaks`:

- no React hydration errors in covered chat routes;
- no unhandled page errors observed by the guards;
- no direct browser calls to OpenAI, Azure OpenAI, CometAPI, Anthropic, xAI, Gemini or Tavily hosts;
- no server secret patterns in browser requests/console;
- no JWT-like/provider/service-role/private-key/signed URL patterns in DOM or browser storage beyond the allowed dev auth token path guarded by existing helpers.

Request count metrics asserted in browser:

- Attachment upload intent failure: `upload-intents` requests = 1, chat stream requests = 0 before retry.
- Double submit guard: chat stream requests = 1 after rapid Enter + click.
- Security representative flow: chat stream requests >= 2, direct provider host requests = 0.
- Reload recovery: user message count remains 1 after reload during stream.
- Route isolation: old project prompt is absent from global route while delayed stream completes.

## Backend-Backed Vs MSW

Backend-backed persistence/multi-tab live verification is not closed in this run because infrastructure was blocked before test execution. The blocked result is preserved as infrastructure evidence, not marked as product pass.

MSW deterministic coverage is green for delay/failure/race/security paths. Multi-tab is skipped in MSW because the fixture persists chat state in per-tab `sessionStorage`; this is intentionally reserved for backend-backed mode.

## Unresolved Risks

- Backend-backed chat runtime e2e must be rerun after Postgres/Supabase and Docker/runtime are available.
- Live DB persistence for multi-tab same-chat convergence remains unverified in this session.
- Provider-specific live SSE behavior such as reasoning-only chunks is covered by deterministic stream contract shape, not by a real provider run here.
- Attachment signed download live storage path remains covered by browser leak assertions and unit/backend tests, but backend-backed attachment e2e did not run due the infrastructure blocker.

## Backend-Backed Rerun After Docker Start

Р”Р°С‚Р° РѕР±РЅРѕРІР»РµРЅРёСЏ: 2026-05-14.

РРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂРЅР°СЏ Р±Р»РѕРєРёСЂРѕРІРєР° РґР»СЏ chat scope СЃРЅСЏС‚Р°:

- Docker daemon РґРѕСЃС‚СѓРїРµРЅ: `29.3.1`.
- `STAGE16_DB_RESTART_APPS=0 corepack pnpm stage16:db:apply-local` - PASS; `stage16_runtime` РїРµСЂРµСЃРѕР·РґР°РЅ, РјРёРіСЂР°С†РёРё Рё seed РїСЂРёРјРµРЅРµРЅС‹, compose `backend/web` РЅРµ РїРµСЂРµР·Р°РїСѓСЃРєР°Р»РёСЃСЊ Рё РЅРµ Р·Р°РЅСЏР»Рё РїРѕСЂС‚С‹ Playwright.
- `node scripts/stage16-e2e-preflight.mjs --scope=chat --fail-on-required` - PASS / `READY`.
- `node scripts/stage16-e2e-preflight.mjs --scope=automation --json` - `BLOCKED_REQUIRED` СЃ `AP_RUNTIME_BLOCKED`; СЌС‚Рѕ РѕР¶РёРґР°РµРјРѕ РґР»СЏ automation scope Рё РЅРµ Р±Р»РѕРєРёСЂСѓРµС‚ chat scope.
- Р¤РёРЅР°Р»СЊРЅС‹Р№ teardown/runtime state: app ports `3000/3014/3029/3100/3129` СЃРІРѕР±РѕРґРЅС‹; `127.0.0.1:54322` СЃР»СѓС€Р°РµС‚ healthy compose Postgres; `54323` РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ РґР»СЏ chat Рё РѕСЃС‚Р°РµС‚СЃСЏ РѕСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Рј AP DB.

РќРѕРІС‹Рµ РїСЂРѕР±Р»РµРјС‹, РЅР°Р№РґРµРЅРЅС‹Рµ СѓР¶Рµ РїРѕСЃР»Рµ СЃРЅСЏС‚РёСЏ infra blocker:

- P1 product bug: manual SSE response for `/chat/threads/:id/messages:stream` lacked CORS headers, so backend-backed browser streams were blocked by the browser before product assertions.
- P1 product bug: cancel before server stream id arrival sent optimistic `client-stream-*` to backend and produced invalid UUID backend errors / unhandled rejection.
- P2 product bug: branch thread creation created an empty branch; source prompt disappeared after branch navigation/reload.
- P2 infra/testability issue: old preflight did not distinguish `COMPOSE_SERVICE_STOPPED`, `PORT_UNREACHABLE`, AP optional services, and required chat DB; `stage16:db:apply-local` also lacked a db-only mode for Playwright-owned app ports.

Fixes added:

- `scripts/stage16-e2e-preflight.mjs`: scoped preflight, JSON output, `--fail-on-required`, `--allow-reuse-runtime`, `--clean-stale-next-cache`, and statuses `READY`, `DEGRADED_OPTIONAL`, `BLOCKED_REQUIRED`, `STALE_PROCESS`, `STALE_BUILD`, `DOCKER_UNAVAILABLE`, `COMPOSE_SERVICE_STOPPED`, `PORT_UNREACHABLE`, `AUTH_BOOTSTRAP_BLOCKED`, `AP_RUNTIME_BLOCKED`, `SEARCH_BLOCKED`, `NOT_REQUIRED_FOR_SCOPE`.
- `scripts/stage16-db-apply-local.mjs`: `STAGE16_DB_RESTART_APPS=0` db-only mode.
- `tests/e2e/playwright.config.ts`: runtime preflight scope inference and `LEXFRAME_E2E_SCOPE` override.
- `apps/backend/src/modules/chat/chat-sse-headers.ts` / `chat.controller.ts`: origin-aware CORS headers for manual SSE.
- `apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx`: local cancel for optimistic stream ids and guarded cancel rejection handling.
- `apps/backend/src/modules/chat/chat-thread.service.ts`: non-UUID stream cancel is controlled; branch creation copies source messages/parts up to the source message.

Additional changed files:

- `scripts/stage16-e2e-preflight.test.mjs`
- `apps/backend/src/modules/chat/chat.controller.spec.ts`
- `apps/backend/src/modules/chat/chat-thread.service.spec.ts`
- `apps/backend/src/modules/activepieces/activepieces-jwt-signer.spec.ts` (prettier-only lint cleanup)
- `artifacts/system-tests/part3-results.backend-chat-runtime.json`

Commands after fixes:

- `node --test scripts/stage16-e2e-preflight.test.mjs` - PASS, 3 tests.
- `corepack pnpm --filter @lexframe/e2e typecheck` - PASS.
- `corepack pnpm --filter @lexframe/e2e lint` - PASS.
- `corepack pnpm --filter @lexframe/backend typecheck` - PASS.
- `corepack pnpm --filter @lexframe/backend lint` - PASS.
- `corepack pnpm --filter @lexframe/backend exec jest chat chat-thread chat-stream project-knowledge` - PASS, 5 suites / 16 tests.
- `corepack pnpm --filter @lexframe/web typecheck` - PASS.
- `corepack pnpm --filter @lexframe/web lint` - PASS.
- `corepack pnpm --filter @lexframe/web exec vitest run LexFrameChatShell chatStateMachine BranchSwitcher LexFrameAttachmentTile project-sidebar` - PASS, 4 files / 33 tests.
- `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1 LEXFRAME_E2E_USE_MSW=0 LEXFRAME_E2E_SCOPE=chat corepack pnpm --filter @lexframe/e2e exec playwright test chat-live-reload-recovery.spec.ts chat-stream-race-conditions.spec.ts chat-attachments-failure-lifecycle.spec.ts chat-branch-persistence-live.spec.ts chat-multitab-consistency.spec.ts chat-browser-security-isolation.spec.ts` - PASS, 8 passed / 0 failed.

Backend-backed Playwright artifacts:

- Results JSON: `artifacts/system-tests/part3-results.backend-chat-runtime.json`
- Current report JSON: `tests/e2e/playwright-report/results.json`
- Trace/video/screenshot paths: none for the final passing backend-backed run; earlier failing run artifacts were removed by Playwright when the passing rerun started.

Console/network/storage summary after backend-backed rerun:

- Console/pageerror assertions passed.
- SSE CORS browser errors after fix: 0.
- Direct browser provider calls: 0.
- Browser DOM/storage scan: no provider key, service-role key, private key, raw JWT, Authorization value, or signed URL patterns outside the allowed dev auth token.
- Request-count guards: upload-intent failure did not start a stream; rapid Enter+click produced one stream request; route-switch stream isolation kept old project stream out of the global route; branch source prompt persisted after reload; multitab same project chat converged without duplicates.

Updated backend-backed/MSW distinction:

- Backend-backed Part 3 chat runtime is now closed for targeted scope: 8/8 PASS against real backend and real Postgres.
- MSW deterministic result remains useful for controlled delay/failure paths, but no longer substitutes for backend persistence.
- Automation/full-runtime remains unresolved until AP Postgres/Redis/app/worker are started; preflight now reports that as `AP_RUNTIME_BLOCKED` rather than mixing it into chat.
