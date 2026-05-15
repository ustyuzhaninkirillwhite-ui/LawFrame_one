# Part 2 Project Workspace Bug Hunt

Date: 2026-05-14

Scope: Project Workspace runtime and UX/state/data-loading behavior for `/app/projects`, `/app/projects/:projectId`, project tabs, composer, plus menu, file/automation chips, web search, sources, rename, back/forward/reload, delayed/failed APIs, project switching, browser storage and network safety.

## Inspected Files

- `apps/web/src/components/shell/project-home.tsx`
- `apps/web/src/components/shell/project-home.test.tsx`
- `apps/web/src/components/shell/project-sidebar.tsx`
- `apps/web/src/hooks/domain/stage15.ts`
- `apps/web/src/hooks/use-stage0-data.ts`
- `apps/web/src/providers/session-provider.tsx`
- `apps/web/src/stores/stage15-shell-store.ts`
- `apps/web/src/app/(app)/app/projects/page.tsx`
- `apps/web/src/app/(app)/app/projects/[projectId]/page.tsx`
- `apps/web/src/app/(app)/app/projects/[projectId]/chats/*`
- `apps/web/src/app/(app)/app/projects/[projectId]/automations/*`
- `apps/web/src/mocks/stage15-handlers.ts`
- `packages/api-client/src/stage15-client.ts`
- `packages/api-client/src/chat-client.ts`
- `packages/api-client/src/index.ts`
- `packages/contracts/src/chat.ts`
- `packages/contracts/src/stage15.ts`
- `apps/backend/src/modules/stage15-projects/stage15-projects.controller.ts`
- `apps/backend/src/modules/stage15-projects/stage15-projects.service.ts`
- `apps/backend/src/modules/stage15-projects/project-web-search.service.ts`
- `apps/backend/src/modules/chat/project-knowledge.service.ts`
- existing e2e project workspace/source/chat specs and e2e helpers.

## Not Repeated

- Stage 22 old dashboard DOM gate was used only as invariant helper, not as standalone work.
- Basic presence of `Р§Р°С‚С‹/РСЃС‚РѕС‡РЅРёРєРё/РђРІС‚РѕРјР°С‚РёР·Р°С†РёРё` was not treated as sufficient; tab URL state, draft persistence, request counts and back/forward were checked.
- Block 1 shell mode/floating composer/preflight checks were not duplicated except as route readiness setup.
- Block 3 basic chat optimistic send was not repeated; composer coverage added failed create, double-click guard and project context.
- Block 4 Activepieces route/session cleanup was not repeated.
- Block 5 generic MSW settings failures were not repeated; deterministic failures target project knowledge, automations, chat create, web-search and rename.

## New Tests Added

- `tests/e2e/project-workspace-tabs-state.spec.ts`
- `tests/e2e/project-composer-context.spec.ts`
- `tests/e2e/project-web-search-sources.spec.ts`
- `tests/e2e/project-rename-navigation-race.spec.ts`
- `tests/e2e/project-workspace-api-resilience.spec.ts`
- `tests/e2e/utils/project-workspace-runtime.ts`

Support tests extended:

- `apps/web/src/components/shell/project-home.test.tsx`

## Bugs Found And Fixed

### P1 product bug: failed project chat create leaked as unhandled async failure

Repro:
1. Open `/app/projects/:projectId`.
2. Fill project composer.
3. Make `POST /projects/:projectId/chats` fail once.
4. Click send.

Before: no controlled composer error; rejected promise could surface as unhandled/page error and raw failure risk.
Fix: `ProjectHome` catches submit failures, keeps prompt/chips, re-enables send, and renders a redacted controlled message.

### P1 product bug: project-scoped transient state survived project switch

Repro:
1. Open project A.
2. Type prompt and select automation chip.
3. Navigate to project B.

Before: prompt/selected automation/web-search/menu state could remain and point links at the new project with stale A context.
Fix: projectId transition now clears project-scoped transient composer/menu/search/rename state and invalidates pending async request ids.

### P1 product bug: stale web-search response could apply after project switch

Repro:
1. Start web search in project A.
2. Navigate to another project before response resolves.
3. Resolve A response.

Before: stale results could render in the current component instance.
Fix: web-search responses are guarded by project id and request id before mutating state.

### P2 UX bug: project rename races and duplicate submit were not guarded strongly enough

Repro:
1. Start rename.
2. Press Enter and submit while PATCH is pending, or navigate away before PATCH resolves.

Before: state relied on async React state only; late responses could close/edit the wrong current screen.
Fix: rename uses a ref/request-id guard, ignores stale completions, and preserves controlled error state.

### P2 UX/data bug: failed project knowledge and automations were indistinguishable from empty state

Repro:
1. Fail `GET /projects/:id/knowledge`.
2. Open `РСЃС‚РѕС‡РЅРёРєРё`.
3. Fail `GET /projects/:id/automations`.
4. Open `РђРІС‚РѕРјР°С‚РёР·Р°С†РёРё`.

Before: failures could look like empty data or keep retrying instead of settling.
Fix: tab-local controlled unavailable states were added, and project knowledge/project automation queries do not retry into a visible request loop.

### P2 data bug: transient web results and persisted knowledge dedup was too narrow

Repro:
1. Web search returns result.
2. Knowledge invalidate returns persisted item for same URL/source.
3. Open `РСЃС‚РѕС‡РЅРёРєРё`.

Before: dedup only compared persisted `url/sourceId` to transient `url`.
Fix: dedup now uses normalized URL, source id, knowledge item id and id keys.

### P3 test-only issue: selectors were not stable enough for project workspace controls

Fix: added stable `data-testid` only for composer input/send, plus button, web-search panel, automation picker, file inputs and skeleton rows. No layout/color/spacing/typography/token changes.

### Infra/test issue: MSW controls did not cover project workspace endpoints

Fix: extended `stage15-handlers` controls for project snapshot, knowledge, web-search, project chat create and automations.

### Infra/test issue: backend-backed runtime did not guarantee a second fixture project

Fix: backend-backed project-switch tests now create a target project through the real backend API; MSW mode still uses fixture `project_research_002`.

### Infra blocker: stale web runtime artifact

Observed: one MSW run failed with `Manifest file is empty` on `/app/projects/project_claim_001`.
Resolution: reran `corepack pnpm stage16:build:web-runtime`; clean rerun passed 17/17.

## Changed Files

- `apps/web/src/components/shell/project-home.tsx`
- `apps/web/src/components/shell/project-home.test.tsx`
- `apps/web/src/hooks/use-stage0-data.ts`
- `apps/web/src/mocks/stage15-handlers.ts`
- `tests/e2e/utils/project-workspace-runtime.ts`
- `tests/e2e/project-workspace-tabs-state.spec.ts`
- `tests/e2e/project-composer-context.spec.ts`
- `tests/e2e/project-web-search-sources.spec.ts`
- `tests/e2e/project-rename-navigation-race.spec.ts`
- `tests/e2e/project-workspace-api-resilience.spec.ts`
- `docs/testing/part2-project-workspace-bug-hunt.md`

Note: repository worktree already contained many unrelated dirty files from earlier blocks; they were not reverted.

## Command Results

- `corepack pnpm --filter @lexframe/web typecheck` - passed.
- `corepack pnpm --filter @lexframe/web lint` - passed.
- `corepack pnpm --filter @lexframe/web test -- project-home project-sidebar` - passed on rerun: 35 files, 147 tests. A first attempt hit an unrelated transient `useActivepiecesSession` assertion, then the exact command passed.
- `corepack pnpm --filter @lexframe/web exec vitest run src/components/shell/project-home.test.tsx src/components/shell/project-sidebar.test.tsx` - passed: 2 files, 23 tests.
- `corepack pnpm --filter @lexframe/backend test -- stage15-projects project-knowledge web-search` - passed: 3 suites, 12 tests.
- `corepack pnpm --filter @lexframe/e2e typecheck` - passed.
- `corepack pnpm --filter @lexframe/e2e lint` - passed.
- `corepack pnpm stage16:build:web-runtime` - passed; used after stale manifest blocker.
- `LEXFRAME_E2E_USE_MSW=1 playwright targeted project workspace specs` - passed: 17/17.
- `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1 LEXFRAME_E2E_USE_MSW=0 playwright targeted project workspace specs` - passed: 17/17.
- `corepack pnpm validate:web-bundle-secrets` - passed.
- `corepack pnpm secret-scan` - passed.

## Backend-Backed Vs MSW

Backend-backed covered:

- real sign-in/session bootstrap;
- real project workspace routes;
- project chat create failure via route interception;
- project rename success persisted through reload;
- backend API-created second project for project-switch scenarios;
- no direct browser provider calls or browser secret leakage in covered flows.

MSW deterministic covered:

- controlled project chat create failure;
- controlled rename failure and delayed PATCH;
- controlled project snapshot delay;
- controlled knowledge/automations/web-search failures;
- deterministic web-search persistence/dedup behavior through MSW state.

## Playwright Artifacts

- Backend-backed results: `artifacts/system-tests/part2-results.backend-project-workspace.json`
- MSW deterministic results: `artifacts/system-tests/part2-results.msw-project-workspace.json`
- Latest Playwright default result path: `tests/e2e/playwright-report/results.json`
- Final passing runs produced no retained trace/video/screenshot failure artifacts. Earlier debug failure artifacts were from fixed test-infra/product red runs and were superseded by clean passing runs.

## Console, Network, Storage

Console:

- Covered specs install console guards.
- No unexpected console errors or hydration errors in final passing runs.
- `Failed to load resource` is allowlisted only for deliberately failed HTTP responses.

Network:

- Direct browser calls to external providers, including Tavily/OpenAI/Anthropic/xAI/Google provider hosts, are asserted absent in security-covered project flows.
- Web-search calls go through `/projects/:projectId/web-search`.
- No Authorization/provider key leaks were detected by e2e network assertions.

Storage/DOM:

- `assertNoProjectFlowSecurityLeaks` scanned DOM, localStorage/sessionStorage and signed URL patterns in covered project flows.
- `validate:web-bundle-secrets` passed.
- `secret-scan` passed.

## Request Count Metrics

Final regression guards enforce:

- Tab switch `Р§Р°С‚С‹ -> РСЃС‚РѕС‡РЅРёРєРё -> РђРІС‚РѕРјР°С‚РёР·Р°С†РёРё -> Р§Р°С‚С‹ -> РСЃС‚РѕС‡РЅРёРєРё`: project chats <= 3, knowledge <= 3, automations <= 3, project chat creates = 0.
- Double-click composer send: project chat create = 1, stream request = 1.
- Saved web-search source: web-search POST = 1, knowledge requests <= 4.
- Failed knowledge and failed automations flows: request count <= 3, no request storm.

## Preflight And Runtime Notes

- Playwright config preflight ran for backend-backed and MSW modes.
- No final `BLOCKED_INFRASTRUCTURE` remained.
- Transient stale web manifest was resolved with `stage16:build:web-runtime`.
- Backend-backed run used `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1` and `LEXFRAME_E2E_USE_MSW=0`.
- Playwright webServer teardown completed after runs; no manual persistent runtime was left intentionally.

## Unresolved Risks

- These specs do not exhaustively cover every project chat message-stream edge after navigation into a project chat; they focus on workspace composer creation boundary.
- Backend-backed web-search persistence is route-intercepted for deterministic provider behavior; real Tavily/provider availability remains outside this part.
- No visual redesign or layout audit was performed by design; visual invariants only assert absence of old dashboard/duplicate composer.
