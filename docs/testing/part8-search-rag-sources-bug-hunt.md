# Part 8 Search / RAG / Legal Sources / Project Knowledge Bug Hunt

Date: 2026-05-14

## Scope

Inspected and exercised:

- `apps/backend/src/modules/legal-search/*`
- `apps/backend/src/modules/legal-rag/*`
- `apps/backend/src/modules/legal-sources/*`
- `apps/backend/src/modules/stage15-projects/project-web-search.service.ts`
- `apps/backend/src/modules/chat/project-knowledge.service.ts`
- `apps/web/src/components/legal/legal-research-workspace.tsx`
- `apps/web/src/hooks/use-stage0-data.ts`
- `tests/e2e/stage6-search-integrated.spec.ts`
- `tests/e2e/project-sources-knowledge.spec.ts`
- new Part 8 e2e specs listed below

Not repeated as standalone work:

- Part 2 basic `Источники` tab presence and transient/persisted UI dedup.
- Part 5 document upload/download happy path.
- Part 7 generic forced-route/RBAC matrix and static-only secret scan.
- Stage 6 smoke was rerun only as a baseline while adding new race/security axes.

## Preflight

Initial search preflight exposed an infrastructure blocker: OpenSearch compose service was `exited (255)` and port `127.0.0.1:9200` was unreachable. It was started with `docker compose up -d opensearch`.

Final scoped preflight:

- Path: `artifacts/system-tests/part8-preflight.search.json`
- Status: `READY`
- Required ready: node, corepack, pnpm, Docker, main Postgres `127.0.0.1:54322`, OpenSearch `127.0.0.1:9200`
- Optional not required for scope: Activepieces app, storage sandbox

## Bugs Found And Fixed

### P1 security: raw legal search query in audit metadata

Reproduction:

1. Call `POST /legal-search/query` with a confidential marker query.
2. Fetch `GET /audit/events`.
3. Raw `metadata.query` and `metadata.selectedSources` were persisted.

Fix:

- `LegalSearchService` now records `queryHash`, `queryLength`, and `selectedSourceCount`.
- Raw query text and selected source arrays are not stored in legal-search audit metadata.

Regression:

- `apps/backend/src/modules/legal-search/legal-search.service.spec.ts`
- `tests/e2e/search-rag-citations-security.spec.ts`

### P1 data integrity: repeated saved web-search result created duplicate project knowledge rows

Reproduction:

1. Call project web-search with `saveResults: true`.
2. Call it again for the same normalized provider URL.
3. `project_web_search_results` upserted correctly, but `project_knowledge_items` inserted again because `on conflict do nothing` had no matching unique constraint.

Fix:

- `ProjectWebSearchService` now reuses an existing `(workspace_id, project_id, source_type='web_search_result', source_id)` knowledge row before inserting a new one.

Regression:

- `apps/backend/src/modules/stage15-projects/project-web-search.service.spec.ts`

### P2 UX/runtime: search backend failure looked like loading/empty state

Reproduction:

1. Open `/research`.
2. Force `POST /legal-search/query` to return `503`.
3. UI kept search in loading/empty path and did not show a controlled degraded state.

Fix:

- `useLegalSearch` disables automatic retry for user-visible search queries.
- `LegalResearchWorkspace` renders a controlled `Поиск временно недоступен.` state on query errors.
- Added stable `data-testid` hooks for the research workspace and query input.

Regression:

- `tests/e2e/search-readiness-degraded-state.spec.ts`

### P3 test-only: stale mojibake assertion in project sources e2e

Reproduction:

1. Run `project-sources-knowledge.spec.ts`.
2. The page rendered the correct text `Источник проекта`, but the assertion only matched mojibake variants.

Fix:

- Assertion now matches actual Russian text plus English fallback.

## New / Changed Tests

Backend:

- `legal-search.service.spec.ts`
  - audit metadata does not persist raw search text.
- `project-web-search.service.spec.ts`
  - repeated saved web result reuses existing project knowledge row.

E2E:

- `tests/e2e/search-readiness-degraded-state.spec.ts`
  - search 503 shows controlled degraded state; unrelated routes stay usable; raw backend details are hidden.
- `tests/e2e/search-rag-citations-security.spec.ts`
  - citations match allowed search sources; RAG excludes foreign source; audit redacts raw query.
- `tests/e2e/search-cross-workspace-scope.spec.ts`
  - wrong workspace header and foreign source selection do not return source data.
- `tests/e2e/search-browser-security-isolation.spec.ts`
  - browser search routes through LexFrame backend; no browser Tavily/OpenSearch/AI provider calls; DOM/storage clean.
- `tests/e2e/search-navigation-cache-race.spec.ts`
  - delayed old query response does not overwrite current query results.
- `tests/e2e/project-sources-knowledge.spec.ts`
  - test-only assertion fix for source tab text.

## Backend-Backed Results

Playwright results JSON:

- `artifacts/system-tests/part8-results.backend-search-runtime.json`

Targeted backend-backed e2e:

- `stage6-search-integrated.spec.ts`
- `project-sources-knowledge.spec.ts`
- `search-readiness-degraded-state.spec.ts`
- `search-rag-citations-security.spec.ts`
- `search-cross-workspace-scope.spec.ts`
- `search-browser-security-isolation.spec.ts`
- `search-navigation-cache-race.spec.ts`

Result: `7 passed`.

MSW distinction:

- No MSW-only PASS is claimed for Part 8.
- Deterministic failure/race coverage was done inside backend-backed Playwright via `page.route`, while the app/backend/session/runtime remained real.

## Console / Network / Storage Summary

Final e2e run:

- Console/page errors: none in covered Part 8 scenarios.
- Browser direct runtime calls: `0` to Tavily, OpenSearch `:9200`, OpenSearch host aliases, OpenAI/Anthropic/CometAPI/xAI/DeepSeek.
- Legal search browser request count in browser-security scenario: `1 x POST /legal-search/query`.
- Delayed race scenario request count: `2 x POST /legal-search/query` (`old held`, `fresh current`); late old response did not render.
- Degraded scenario request count: `1 x POST /legal-search/query` with forced `503`; controlled error rendered.
- DOM/storage scan: no provider keys, service-role markers, signed URL tokens, Authorization bearer strings, or raw secret markers in covered scenarios.
- RAG/search API response scan: no provider key, service-role, signed URL, Authorization, or `sk-*` marker.
- Audit scan: raw search marker absent; legal-search events contain `queryHash`, not raw `query`.

## Commands Run

Infrastructure:

- `node scripts/stage16-e2e-preflight.mjs --scope=search --json --fail-on-required`
  - initial: `BLOCKED_REQUIRED` because OpenSearch was exited/unreachable.
- `docker compose up -d opensearch`
  - started OpenSearch.
- `node scripts/stage16-e2e-preflight.mjs --scope=search --json --fail-on-required`
  - final: `READY`.

Regression RED/GREEN:

- `corepack pnpm --filter @lexframe/backend test -- legal-search project-web-search`
  - RED: 2 failing tests before fix.
  - GREEN: 2 suites / 7 tests passed after fix.
- `$env:LEXFRAME_E2E_USE_MSW='0'; corepack pnpm --filter @lexframe/e2e exec playwright test search-readiness-degraded-state.spec.ts`
  - RED: controlled degraded state missing.
  - GREEN: 1 passed after fix.

Static/backend:

- `corepack pnpm --filter @lexframe/web typecheck` — passed.
- `corepack pnpm --filter @lexframe/web lint` — passed.
- `corepack pnpm --filter @lexframe/e2e typecheck` — passed.
- `corepack pnpm --filter @lexframe/e2e lint` — passed.
- `corepack pnpm --filter @lexframe/backend typecheck` — passed.
- `corepack pnpm --filter @lexframe/backend lint` — initially prettier-only failure in new spec, then passed.
- `corepack pnpm --filter @lexframe/backend test -- legal-search legal-rag legal-sources project-knowledge web-search` — 5 suites / 13 tests passed.

Security:

- `corepack pnpm validate:web-bundle-secrets` — passed.
- `corepack pnpm secret-scan` — passed.

Backend-backed e2e:

- `$env:LEXFRAME_E2E_USE_MSW='0'; corepack pnpm --filter @lexframe/e2e exec playwright test stage6-search-integrated.spec.ts project-sources-knowledge.spec.ts search-readiness-degraded-state.spec.ts search-rag-citations-security.spec.ts search-cross-workspace-scope.spec.ts search-browser-security-isolation.spec.ts search-navigation-cache-race.spec.ts`
  - Result: 7 passed.

## Trace / Video / Screenshot

Final backend-backed run passed and did not leave failure trace/video/screenshot artifacts.

During RED development, Playwright produced temporary failure artifacts for:

- `search-readiness-degraded-state.spec.ts` before the degraded-state fix.
- `project-sources-knowledge.spec.ts` before the test-only assertion fix.

Those were superseded by the final clean run; `tests/e2e/test-results/.last-run.json` reports the final pass.

## Changed Files

Product/runtime:

- `apps/backend/src/modules/legal-search/legal-search.service.ts`
- `apps/backend/src/modules/stage15-projects/project-web-search.service.ts`
- `apps/web/src/components/legal/legal-research-workspace.tsx`
- `apps/web/src/hooks/use-stage0-data.ts`

Tests:

- `apps/backend/src/modules/legal-search/legal-search.service.spec.ts`
- `apps/backend/src/modules/stage15-projects/project-web-search.service.spec.ts`
- `tests/e2e/project-sources-knowledge.spec.ts`
- `tests/e2e/search-readiness-degraded-state.spec.ts`
- `tests/e2e/search-rag-citations-security.spec.ts`
- `tests/e2e/search-cross-workspace-scope.spec.ts`
- `tests/e2e/search-browser-security-isolation.spec.ts`
- `tests/e2e/search-navigation-cache-race.spec.ts`

Artifacts/report:

- `artifacts/system-tests/part8-preflight.search.json`
- `artifacts/system-tests/part8-results.backend-search-runtime.json`
- `docs/testing/part8-search-rag-sources-bug-hunt.md`

## Unresolved Risks

- Project web-search knowledge idempotency is now enforced at service level. A true simultaneous duplicate insert race would be better closed with a DB unique index on `(workspace_id, project_id, source_type, source_id)` in a future migration.
- Live Tavily persistence was not claimed as an external-provider proof; deterministic backend unit coverage proves persistence/idempotency without requiring real provider credentials.
- Browser cross-workspace coverage used wrong workspace header and known foreign source selection. A full second-workspace UI journey remains covered more broadly by Part 7, not repeated here.
- Source detail deep reload/citation click UI was not expanded beyond Stage 6/search API citation integrity in this pass.
