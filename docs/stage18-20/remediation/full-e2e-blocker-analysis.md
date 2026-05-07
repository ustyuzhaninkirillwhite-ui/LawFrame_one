# Full E2E Blocker Analysis

Generated: 2026-05-07T13:03:07.0687813Z

## Baseline

The previous audit recorded `OPEN-2 full_check: BLOCKED` with `e2e-check-after-stage16-up` failing. The initial remediation reproduction confirmed that the suite was not failing for a single reason. Runtime unavailability caused broad failures first; after runtime was repaired, the remaining failures narrowed to Activepieces binding, workflow compiler, seed, selector, and Playwright configuration defects.

## Failing tests before remediation

The baseline audit recorded 17 failing tests. The first remediation reproduction surfaced the same failure groups and also exercised the Stage 16 live audit sync path under the full suite. The table below is reconstructed from the e2e command logs and the latest failing Playwright report used for remediation.

| Spec path | Test title or group | Failure type | Affected stage | Root cause | Fix required |
|---|---|---|---|---|---|
| `tests/e2e/auth-workspace-rbac.spec.ts` | owner admin/security access | runtime unavailable / route bootstrap | global | Runtime startup was blocked before reliable UI assertions | Runtime readiness and controlled web/backend startup |
| `tests/e2e/auth-workspace-rbac.spec.ts` | viewer admin/security denial | runtime unavailable / route bootstrap | global | Same runtime bootstrap failure group | Runtime readiness and controlled web/backend startup |
| `tests/e2e/dashboard-live.spec.ts` | live dashboard data | runtime unavailable | global | Suite started against unavailable or stale services | Runtime readiness and Playwright webServer profile fix |
| `tests/e2e/recommendations-live.spec.ts` | live recommendations data | runtime unavailable | global | Suite started against unavailable or stale services | Runtime readiness and Playwright webServer profile fix |
| `tests/e2e/builder-readiness.spec.ts` | builder readiness smoke | runtime unavailable | global | Reused stale services could carry wrong runtime profile | Disable default stale server reuse for full/root test |
| `tests/e2e/stage4-activepieces-integrated.spec.ts` | owner opens automation canvas | selector/config/backend | 4 / 16 / 20 | Old builder text/route, dry run sync, and AP project identity drift | Current route/testid assertions, real sync, project identity split |
| `tests/e2e/stage5-ai-gateway-policy.spec.ts` | policy-gated AI request | runtime unavailable | 5 / 18 | Runtime bootstrap failure prevented reaching policy assertion | Runtime readiness fix |
| `tests/e2e/stage6-search-integrated.spec.ts` | legal search integrated path | seed/permission/backend | 6 / 16 | Dynamic e2e workspaces lacked Stage 6 grants and legacy workflow source needed normalization | Permission seed and workflow source normalizer |
| `tests/e2e/stage8-delivery-sandbox.spec.ts` | delivery sandbox integrated path | backend fixture | 8 / 16 | Legacy external delivery node lacked local-integrated connection fallback | Delivery connection fallback for legacy template source |
| `tests/e2e/stage10-realtime-integrated.spec.ts` | realtime workflow status path | backend compiler/runtime | 10 / 16 | Legacy Stage 3 module codes did not map to Stage 16+ blocks | Workflow source normalizer |
| `tests/e2e/stage11-security-control-plane.spec.ts` | security control panels | selector/auth/runtime | 11 | Old English navigation assumptions and runtime instability | Route/access based assertions and runtime fix |
| `tests/e2e/stage18-20-security-live.spec.ts` | Stage 18-20 live security smoke | runtime unavailable | 18 / 19 / 20 | Runtime bootstrap failure prevented reaching assertions | Runtime readiness fix |
| `tests/e2e/stage20-ai-automation-builder-live.spec.ts` | automation builder draft path | backend/compiler/runtime | 20 | Runtime and compiler binding failures prevented draft creation | Runtime, binding, and compiler fixes |
| `tests/e2e/stage16-live-audit.spec.ts` | scenario: runtime sync/binding | backend SQL | 16 / global | Ambiguous `runtime_hash` reference in runtime binding query | Qualified runtime binding query and regression test |
| `tests/e2e/stage16-live-audit.spec.ts` | scenario: workflow compile path | backend compiler | 16 / global | Legacy source did not normalize to canonical runtime modules | Source normalizer regression |
| `tests/e2e/stage16-live-audit.spec.ts` | scenario: Activepieces provisioning | backend Activepieces | 16 / 17 / 20 | Binding status/project identity drift | Provisioned binding status and AP project identity split |
| `tests/e2e/stage16-live-audit.spec.ts` | scenario: full runtime audit tail | config/runtime | 16 / global | Playwright reused stale services and defaulted the wrong profile | Root Playwright runtime profile and reuse defaults |

## Fix groups and verification

| Group | Fix summary | Targeted verification |
|---|---|---|
| Runtime/auth/bootstrap | Fixed runtime status predicate, controlled service startup, port preflight, and backend runtime start script | `corepack pnpm stage16:runtime:up-full` PASS |
| Selector/test config | Updated Activepieces canvas assertions to current route/testid; enabled remediation Playwright output dir and retained failure media through config | targeted Stage 4 spec PASS |
| Seed/migration/fixture | Added Stage 6 permission seed; changed Activepieces binding status to `provisioned` | backend unit tests and targeted Stage 6 spec PASS |
| Real backend defects | Added workflow source normalizer, Activepieces project identity split, CE fallback, delivery fallback, and runtime binding SQL fix | backend targeted specs PASS |
| Full root config | Defaulted e2e to local-integrated runtime and disabled silent stale-server reuse in full/root test | `corepack pnpm test` PASS and `corepack pnpm check` PASS |

## Final E2E result

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm check:e2e` | PASS, 51 passed, 17 skipped | `artifacts/stage18-20/remediation/command-logs/2026-05-07T11-49-57-520Z-check-e2e-full-after-remediation-fixes.log` |
| `corepack pnpm check` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-43-28-355Z-full-regression-check-final.log` |
