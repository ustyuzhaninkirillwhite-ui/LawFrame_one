# Clean Runtime RC Plan

Generated: 2026-05-14

## Current Status

Current release proof: reuse-runtime PASS.

Clean-runtime destructive reset: not run in Part 10.

Reason: a true clean-runtime candidate can require DB teardown, Docker volume removal, or data reset. That is intentionally not performed without explicit confirmation.

## Safe Non-Destructive RC Check

Run this first:

```powershell
node scripts/stage16-e2e-preflight.mjs --scope=full --json --fail-on-required
corepack pnpm system:full-gate
node scripts/testing/merge-readiness.mjs --redact-local-artifacts
```

Expected result:

- Preflight status `READY`.
- Full gate status `PASS`.
- Backend-backed Playwright 19/19 or a documented real failure.
- Artifact hygiene unsafe findings: 0.
- No blocked infrastructure marked as pass.

## Clean Runtime Candidate

Only run a destructive clean candidate after explicit approval.

Required confirmation:

```powershell
# human confirmation required before any DB/volume reset
# use a future dedicated command with --confirm-destructive
```

Candidate sequence:

1. Stop app servers and stale dev processes.
2. Capture current Docker compose status and port inventory.
3. Stop full runtime services.
4. Remove only explicitly approved runtime containers/volumes.
5. Recreate DB/storage/search/AP runtime from project scripts.
6. Run full-scope preflight.
7. Run `corepack pnpm system:full-gate`.
8. Run final artifact hygiene scan.

## Destructive Safety Rules

- Do not delete Docker volumes unless the command includes an explicit destructive confirmation.
- Do not reset product DB while user data may be needed.
- Do not remove unrelated containers.
- Do not treat missing AP, OpenSearch, storage, or DB as pass for full scope.
- Do not publish raw environment values or connection strings in logs.

## Reuse Runtime Acceptance

Reuse-runtime is acceptable for the current merge-readiness evidence because:

- Full-scope preflight reported READY.
- App ports were clean before the Playwright app server phase.
- Backend-backed full gate passed 19/19.
- Evidence scan was safe.
- The mode is explicitly documented as reuse-runtime.

## Remaining Clean-Runtime Gap

The remaining gap is destructive reset reproducibility, not product behavior under the already validated runtime. Treat this as an RC follow-up unless the release process requires a clean DB proof before merge.
