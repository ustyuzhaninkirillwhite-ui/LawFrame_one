# Stage 18-20 Open Blockers Root Cause

Generated: 2026-05-07T13:03:07.0687813Z

Branch: main
Commit before remediation: 72ab40ad5fe947b46256b358029c5cf70e1809f6
Commit after remediation: 72ab40ad5fe947b46256b358029c5cf70e1809f6

## Previous blocker state

| Blocker | Previous severity | Previous status | Remediation status |
|---|---:|---|---|
| OPEN-1 runtime | P1 | BLOCKED | PASS |
| OPEN-2 full_check | P0 | BLOCKED | PASS |

## OPEN-1 runtime

The runtime was not generally broken by missing live provider credentials. The concrete failure was in the Stage 16 full runtime readiness gate: `scripts/stage16-runtime-up-full.mjs` rejected any `/system/status` component that was not exactly `healthy`. In the local-integrated profile, selected runtime components can legitimately report `degraded` while infrastructure is healthy. The gate therefore failed after bootstrap even when required services were usable.

Additional contributing issues were found during runtime diagnostics:

| Cause | Impact | Fix |
|---|---|---|
| Over-strict readiness predicate for optional local-integrated components | `stage16-runtime-up-full-after-bootstrap-settled` failed with infrastructure up | Extracted readiness evaluation and allowed `degraded` only for optional runtime components in the local-integrated profile |
| Controlled backend/web services could stay connected during DB reset/bootstrap | Repeated runs could observe stale DB connections or inconsistent startup order | Stopped only controlled compose services before reset/bootstrap/start |
| Stage 17 up did not preflight occupied ports with a clear controlled-process boundary | Runtime startup diagnostics were ambiguous when ports were already in use | Added a port preflight script that reports occupied ports without killing unrelated user processes |
| Live provider smoke was not separated from infrastructure readiness | Missing live credentials could be misreported as total runtime failure | Kept live provider smoke explicit and opt-in; when enabled without required env, it reports `LIVE_PROVIDER_ENV_REQUIRED` separately |

Final runtime proof:

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm stage16:runtime:up-full` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T11-57-36-635Z-runtime-stage16-up-full-final.log` |

## OPEN-2 full_check

The full check blocker had multiple concrete root causes. The initial e2e blocker was amplified by runtime bootstrap failure. After runtime was repaired, remaining failures grouped into backend fixture/data defects, Activepieces binding drift, stale selectors, and Playwright runtime configuration.

| Cause group | Impact | Fix |
|---|---|---|
| Runtime/bootstrap unavailable | Many specs failed before reaching their assertions | Repaired runtime readiness, controlled service startup, backend webServer startup, and Playwright default runtime profile |
| Activepieces binding status drift | Backend wrote legacy binding status that no longer matched Stage 17+ migrations | Updated binding writes to use `provisioned` and added regression coverage |
| Activepieces project identity mismatch | Runtime flow operations used deterministic LexFrame IDs where AP runtime needed the real project ID | Split deterministic external project identity from AP runtime project identity and added CE fallback |
| Legacy workflow source shape | Older Stage 3 template module codes did not compile to Stage 16+ canonical block codes | Added source normalizer and regression coverage |
| Missing dynamic workspace grants | Search-related e2e users lacked required Stage 6 permissions after bootstrap | Added Stage 6 permission grant seed and applied it to the local runtime DB |
| Ambiguous runtime binding SQL | Stage 16 live audit sync could fail on `runtime_hash` ambiguity | Qualified runtime hash references and added regression coverage |
| Stale e2e selectors and config | Tests depended on old builder text/route and stale reused servers | Switched to current route/testid assertions and made remediation Playwright output/config explicit |

Final full check proof:

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm check:e2e` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T11-49-57-520Z-check-e2e-full-after-remediation-fixes.log` |
| `corepack pnpm check` | PASS | `artifacts/stage18-20/remediation/command-logs/2026-05-07T12-43-28-355Z-full-regression-check-final.log` |

## Acceptance impact

Both previous blockers are closed. The post-remediation acceptance status is ACCEPT because runtime, full check, e2e, security, and Stage 18/19/20 gates passed after the fixes, with no open P0/P1 blockers.
