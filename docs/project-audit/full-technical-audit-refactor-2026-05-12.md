# LexFrame Technical Audit And Refactor Report - 2026-05-12

## Scope

This pass was executed on `codex/safe-cleanup-refactor` with a conservative compatibility policy: no public HTTP routes, DTO wire shapes, env names, package exports, migration history, Stage 17-21 compatibility paths, or database contracts were removed.

## Architecture Reviewed

- Monorepo surfaces: `apps/backend`, `apps/web`, `packages/*`, `supabase/*`, `infra/*`, `scripts/*`, `tests/e2e`.
- Critical runtime areas preserved: Activepieces runtime/session/canvas, AI Gateway/settings secrets, workflow compiler, readiness gates, local owner key vault, Stage 17-21 compatibility routes.
- Codebase graph `degree=0` was treated only as a hint. Nest DI providers and Next entrypoints were verified with static search before any deletion decision.

## Changes Made

- Baseline commit: `8f396c1` preserved the already-green cleanup state before new refactor work.
- Dependencies: upgraded `next` and `eslint-config-next` to `16.2.6`; added `pnpm.overrides` for `fastify 5.8.5`, `fast-uri 3.1.2`, and `postcss 8.5.10`. `pnpm audit --prod` is now clean.
- Artifact cleanup: removed 66 generated files from `artifacts/**` plus 9 root smoke PNG files; tracked artifact count is now 152. Release-critical JSON evidence and manifest-linked Stage17.1 screenshots were kept.
- Backend: replaced chat/project/stage15 wildcard SQL and `returning *` with explicit column lists. Removed duplicate expensive calls in Stage15 project detail/snapshot paths and added a regression test.
- Backend runtime stability: added an idle `pg.Pool` error handler in `DatabaseService` after Docker validation exposed backend crashes when DB bootstrap terminates old connections.
- Frontend: removed remaining `react-hooks/set-state-in-effect` disables, derived chat active thread state from route props plus local override, and narrowed Project Automations landing effect dependencies from whole query objects to specific fields/callbacks.

## Database

- No migrations were edited or added.
- No tables, fields, constraints, or indexes were dropped.
- `check:db` passed: migration/readiness structure and Stage 11 RLS validation are intact.
- Runtime Docker validation found a DB reconnect resilience issue in backend pooling, fixed in source without schema changes.

## Validation Summary

- Passed: contracts typecheck/lint/build, OpenAPI/schema/workflow/canvas fixture/release manifest validation.
- Passed: backend build/lint/typecheck/test, 52 suites / 171 tests after adding `database.service.spec.ts`.
- Passed: web build/lint/typecheck/test, 29 Vitest files / 94 tests.
- Passed: `pnpm audit --prod`, `check:security`, web bundle secret scan, secret scan.
- Passed: `stage21-up`, `stage21-up smoke-automation-runtime`, and Docker `ps` health for backend/web/proxy/product DB/Activepieces app.
- Readiness: `/api/readiness/stage17` returned `DEGRADED` with no blocking errors. Warnings were Activepieces worker heartbeat not yet recorded and missing local owner key vault.
- Final `corepack pnpm check`: all blocks passed until `check:e2e`.

## E2E Status

- `corepack pnpm check` failed at `check:e2e` because `127.0.0.1:3100/health/live` was already occupied by the Stage21 Docker runtime.
- Retried with `LEXFRAME_E2E_REUSE_EXISTING_SERVER=1`; Playwright ran but failed because default/stage16 specs expect a separate Stage16 compose service named `postgres` and demo auth bootstrap, while the active environment was Stage21 local-integrated.
- E2E result with reuse: 9 passed, 18 skipped, 42 failed. This is an environment/profile mismatch, not a failing unit/build/security baseline.

## Performance Notes

- Stage15 project detail/snapshot no longer duplicate `listInstalled`, `getSnapshot`, and project chat loading. New test asserts each expensive dependency is called once.
- Backend SQL mappers now select only required columns for chat/project knowledge/stage15 rows.
- Latest web production build completed on Next `16.2.6`: compile 17.5s, TypeScript 34.8s, 47 static pages in 1.482s.

## Remaining Risks And Backlog

- Large services remain in `ai-gateway`, `activepieces`, `canvas`, `readiness`, and `workflow-compiler`; they should be split only with module-specific tests and no route/export churn.
- Stage 17 compatibility names remain where they are runtime contracts or evidence paths.
- Stage17/18/19/20/21 JSON evidence remains tracked because readiness/gate scripts reference it.
- E2E needs a dedicated run profile: either stop Stage21 runtime and launch the expected Stage16 stack, or create a Stage21-specific Playwright config with `reuseExistingServer` and matching auth/bootstrap assumptions.
- Git still reports many unreachable loose objects during auto-pack; no prune was run because that is repository maintenance, not source cleanup.
