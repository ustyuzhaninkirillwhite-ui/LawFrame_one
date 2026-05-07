# Stage 18-20 Blocker Remediation Fixes

Generated: 2026-05-07T13:03:07.0687813Z

| Defect | Severity | Files | Test added or updated | Verification command |
|---|---:|---|---|---|
| OPEN-1 runtime readiness rejected permitted degraded optional components | P1 | `scripts/stage16-runtime-status.mjs`, `scripts/stage16-runtime-up-full.mjs` | `scripts/stage16-runtime-status.test.mjs` | `corepack pnpm stage16:runtime:up-full` |
| OPEN-1 repeated runtime start could keep stale controlled backend/web processes | P1 | `scripts/stage16-runtime-up-full.mjs` | covered by runtime gate | `corepack pnpm stage16:runtime:up-full` |
| OPEN-1 Stage 17 up lacked explicit controlled port preflight | P2 | `scripts/stage17-port-preflight.mjs`, `scripts/stage17-compose.mjs` | `scripts/stage17-port-preflight.test.mjs` | `corepack pnpm stage17:up` |
| OPEN-1 Playwright backend runtime could start from the wrong cwd | P1 | `scripts/stage16-start-backend-runtime.mjs`, `tests/e2e/playwright.config.ts` | `scripts/stage16-start-backend-runtime.test.mjs` | `corepack pnpm test` |
| OPEN-2 Activepieces binding wrote legacy status | P0 | `apps/backend/src/modules/activepieces/activepieces.service.ts`, `apps/backend/src/modules/workflow-compiler/activepieces-sync.service.ts` | `activepieces.service.spec.ts`, `activepieces-sync.service.spec.ts` | backend targeted specs |
| OPEN-2 Activepieces deterministic project ID collided with AP runtime project ID | P0 | `activepieces-runtime-client.service.ts`, `activepieces-sync.service.ts`, `workflow-compiler.service.ts`, `activepieces.service.ts` | `activepieces-sync.service.spec.ts`, `workflow-compiler.service.spec.ts` | targeted e2e four-spec run |
| OPEN-2 local AP CE could lack project-management route | P1 | `activepieces-runtime-client.service.ts` | `activepieces-sync.service.spec.ts` | targeted e2e four-spec run |
| OPEN-2 legacy workflow source used obsolete module codes | P0 | `workflow-source-normalizer.ts`, `workflow-compiler.service.ts` | `workflow-compiler.service.spec.ts` | backend workflow compiler specs |
| OPEN-2 legacy delivery template lacked local-integrated connection fallback | P0 | `connection-requirement-resolver.service.ts`, `workflow-source-normalizer.ts` | `workflow-compiler.service.spec.ts` | Stage 8 targeted spec |
| OPEN-2 Stage 6 dynamic workspaces lacked legal search grants | P1 | `supabase/seed/000006_stage6_legal_search_permission_grants_seed.sql` | e2e coverage | Stage 6 targeted spec |
| OPEN-2 runtime binding query had ambiguous runtime hash reference | P0 | `runtime-binding.service.ts` | `runtime-binding.service.spec.ts` | backend runtime binding spec |
| OPEN-2 Activepieces e2e helper kept dry-run sync for real integration test | P1 | `tests/e2e/helpers/activepieces-demo.ts`, `stage4-activepieces-integrated.spec.ts` | e2e coverage | Stage 4 targeted spec |
| OPEN-2 stale builder selector and Playwright full-run config | P1 | `stage4-activepieces-integrated.spec.ts`, `tests/e2e/playwright.config.ts` | e2e coverage | `corepack pnpm check:e2e`, `corepack pnpm check` |

## Final verification

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm stage18:release-gate` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-00-49-325Z-stage18-release-gate.log` |
| `corepack pnpm stage19:release-gate` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-02-44-559Z-stage19-release-gate.log` |
| `corepack pnpm stage20:release-gate` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-04-06-756Z-stage20-release-gate.log` |
| `corepack pnpm check:e2e` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T11-49-57-520Z-check-e2e-full-after-remediation-fixes.log` |
| `corepack pnpm check` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-43-28-355Z-full-regression-check-final.log` |
