# Runtime Blocker Analysis

Generated: 2026-05-07T13:03:07.0687813Z

## Diagnostic commands

Runtime diagnostics were run from `E:\Law_frame_main` and logs were stored under `artifacts/stage18-20/remediation/command-logs`.

| Command | Result | Evidence |
|---|---|---|
| `git status --short` | PASS | `2026-05-07T09-01-18-159Z-preflight-git-status-short.log` |
| `git rev-parse --abbrev-ref HEAD` | PASS | `2026-05-07T09-01-18-336Z-preflight-branch.log` |
| `git rev-parse HEAD` | PASS | `2026-05-07T09-01-18-446Z-preflight-head.log` |
| `git log -1 --oneline` | PASS | `2026-05-07T09-01-18-549Z-preflight-log-1.log` |
| `node --version` | PASS | `2026-05-07T09-01-18-657Z-preflight-node-version.log` |
| `corepack pnpm --version` | PASS | `2026-05-07T09-01-18-724Z-preflight-pnpm-version.log` |
| `docker --version` | PASS | `2026-05-07T09-01-19-151Z-preflight-docker-version.log` |
| `docker compose version` | PASS | `2026-05-07T09-01-19-236Z-preflight-docker-compose-version.log` |
| `corepack pnpm stage17:down` | PASS | `2026-05-07T09-01-19-391Z-runtime-stage17-down.log` |
| `corepack pnpm stage17:compose:config` | PASS | `2026-05-07T09-01-20-233Z-runtime-stage17-compose-config.log` |
| `corepack pnpm stage17:up` | PASS after preflight fix | `2026-05-07T09-06-55-193Z-runtime-stage17-up-after-port-preflight.log` |
| `corepack pnpm stage17:ps` | PASS | `2026-05-07T09-04-12-779Z-runtime-stage17-ps.log` |
| `docker compose ps --services` | PASS | `2026-05-07T09-04-14-786Z-runtime-docker-compose-services.log` |
| `docker compose logs --no-color --tail=...` | PASS | `2026-05-07T09-04-15-099Z-*` through `2026-05-07T09-04-19-218Z-*` |
| `corepack pnpm stage16:runtime:up-full` | PASS | `2026-05-07T11-57-36-635Z-runtime-stage16-up-full-final.log` |

## Required and optional runtime components

The local-integrated profile requires the infrastructure and application components to be reachable and ready. Provider-backed live smoke is separate from infrastructure readiness.

| Component | Runtime classification | Accepted status |
|---|---|---|
| storage/database | Required | `healthy` |
| Activepieces runtime bridge | Required | `healthy` |
| LexFrame backend | Required | process healthy and status endpoint reachable |
| LexFrame web | Required | process healthy and route reachable |
| AI runtime component | Optional in local-integrated unless live smoke is enabled | `healthy` or `degraded` |
| search runtime component | Optional in local-integrated unless explicitly required by a live profile | `healthy` or `degraded` |
| realtime runtime component | Optional in local-integrated unless explicitly required by a live profile | `healthy` or `degraded` |

`blocked`, `failed`, missing required components, and unreachable required endpoints still fail readiness.

## Root cause

`stage16-runtime-up-full-after-bootstrap-settled` failed because the runtime gate treated every status component as required and rejected `degraded`. In the intended local-integrated profile, provider-backed optional components can be degraded while the infrastructure gate is still valid. The failure was therefore a readiness classification defect, not proof that the complete runtime stack was unusable.

## Fixes

| Defect | Severity | Files |
|---|---:|---|
| Runtime status predicate rejected permitted degraded optional components | P1 | `scripts/stage16-runtime-status.mjs`, `scripts/stage16-runtime-up-full.mjs`, `scripts/stage16-runtime-status.test.mjs` |
| Repeated runtime starts could reuse stale controlled backend/web services | P1 | `scripts/stage16-runtime-up-full.mjs` |
| Stage 17 startup lacked explicit port preflight | P2 | `scripts/stage17-port-preflight.mjs`, `scripts/stage17-compose.mjs`, `scripts/stage17-port-preflight.test.mjs` |
| Backend runtime webServer startup could run from the wrong cwd in Playwright | P1 | `scripts/stage16-start-backend-runtime.mjs`, `tests/e2e/playwright.config.ts`, `scripts/stage16-start-backend-runtime.test.mjs` |

## Verification

| Command | Result | Evidence |
|---|---|---|
| `corepack pnpm --filter @lexframe/backend test -- stage16-runtime-status stage17-port-preflight stage16-start-backend-runtime` | PASS | remediation command logs |
| `corepack pnpm stage17:up` | PASS | `2026-05-07T09-06-55-193Z-runtime-stage17-up-after-port-preflight.log` |
| `corepack pnpm stage16:runtime:up-full` | PASS | `2026-05-07T11-57-36-635Z-runtime-stage16-up-full-final.log` |

## Final runtime status

PASS.
