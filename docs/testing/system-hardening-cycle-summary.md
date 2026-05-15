# System Hardening Cycle Summary

Generated: 2026-05-14

## Executive Summary

Parts 1-9 completed targeted hardening for shell/navigation, project workspace, chat runtime, automation runtime, documents/storage, settings/secrets, security/RBAC/audit, search/RAG, and the full system gate.

The current release proof is a documented reuse-runtime PASS. Full backend-backed Playwright coverage in Part 9 passed 19/19 with evidence scan safe. Part 10 consolidates the worktree, artifact hygiene, release evidence, and PR scope.

## Scope

The cycle covered:

- AppShell, session bootstrap, navigation, sidebar, settings focus, preflight.
- Project workspace tabs, composer, web-search persistence, rename, source cache.
- Chat runtime reload recovery, stream race conditions, attachments, branching, browser isolation.
- Automation runtime, Activepieces canvas/session bridge, dry-run idempotency, runtime evidence.
- Documents/storage upload, download, lifecycle failure modes, cross-scope access.
- Settings/profile/organization, AI route preferences, write-only secrets, SSRF guards.
- Security/RBAC/audit cross-domain matrix.
- Search/RAG/legal sources/project knowledge.
- Full release gate and evidence redaction.

## Architecture Invariants Preserved

- LexFrame backend/product DB remains the source of truth.
- Frontend is not treated as a security boundary.
- Activepieces remains runtime/builder projection, not product DB.
- AI requests go through AI Gateway, not direct browser provider calls.
- Search/RAG uses OpenSearch as an index layer, not source of truth.
- Documents remain domain entities with backend-controlled storage routes.
- Audit/evidence excludes raw secrets, raw document bytes, raw provider errors, auth headers, and unsafe URL material.
- Streaming/realtime flows keep snapshot/recovery coverage.
- BLOCKED infrastructure is classified as blocked, not pass.
- MSW is deterministic support, not final backend-backed proof.

## Parts 1-9 Matrix

| part | domain | result | backend-backed evidence | MSW evidence | artifact paths | residual risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | AppShell/sidebar/navigation/preflight | PASS | targeted shell gate | deterministic support | `artifacts/system-tests/block1-results.backend-shell.json` | none blocking |
| 2 | Project Workspace | PASS | 17/17 | 17/17 | `artifacts/system-tests/part2-results.backend-project-workspace.json` | none blocking |
| 3 | Chat Runtime | PASS | 8/8 | deterministic PASS | `artifacts/system-tests/part3-results.backend-chat-runtime.json` | none blocking |
| 4 | Automation / Activepieces runtime | PASS | 24/24 | 9 PASS / 2 SKIP | `artifacts/system-tests/part4-results.backend-automation-runtime.json` | AP runtime must be READY for automation/full gates |
| 5 | Documents / Storage / Upload-Download | PASS | targeted PASS | deterministic PASS | `artifacts/system-tests/part5-results.backend-documents-runtime.json` | `DocumentDetailPanel` new-version UX lacks real upload input; backlog, not release blocker |
| 6 | Settings / AI route preferences / write-only secrets | PASS | targeted PASS | deterministic PASS | `artifacts/system-tests/part6-results.backend-settings-runtime.json` | none blocking |
| 7 | Security / RBAC / Audit | PASS | targeted PASS | not final proof | `artifacts/system-tests/part7-results.backend-security-runtime.json` | none blocking |
| 8 | Search / RAG / Legal Sources / Project Knowledge | PASS | targeted PASS | not final proof | `artifacts/system-tests/part8-results.backend-search-runtime.json` | DB unique index for project knowledge dedupe is recommended backlog |
| 9 | Full System Gate | PASS | backend-backed 19/19 | not used as final proof | `artifacts/system-tests/full-gate/full-system-gate.json` | reuse-runtime, not destructive clean DB reset |

## Full System Gate Status

Mode: reuse-runtime.

Command:

```powershell
node scripts/testing/full-system-gate.mjs --reuse-runtime --json --artifacts-dir=artifacts/system-tests/full-gate --fail-on-blocked --scope=full
```

Preflight: READY.

Playwright backend-backed result: 19 passed, 0 failed.

Evidence scan: safe.

Key artifacts:

- `artifacts/system-tests/full-gate/full-system-gate.json`
- `artifacts/system-tests/full-gate/preflight.full.json`
- `artifacts/system-tests/full-gate/evidence-summary.json`
- `artifacts/system-tests/full-gate/playwright-results.backend-full-system.json`
- `docs/testing/part9-full-system-gate.md`

## Merge Readiness Artifacts

- `docs/testing/merge-readiness-report.md`
- `docs/testing/clean-runtime-rc-plan.md`
- `artifacts/system-tests/merge-readiness/worktree-classification.json`
- `artifacts/system-tests/merge-readiness/artifact-hygiene-scan.json`
- `artifacts/system-tests/merge-readiness/artifact-redaction-log.json`

## Remaining Risks

- Clean-runtime destructive DB reset has not been run. Current proof is reuse-runtime PASS.
- Worktree contains many Part 1-9 dirty and untracked files; PR staging needs explicit scope selection.
- Project knowledge `saveResults` has service-level dedupe; DB unique index remains recommended hardening.
- `DocumentDetailPanel` new-version flow needs a real upload input in a future product task.
- Binary screenshots/videos/traces are local-only evidence and should not be committed.

## Merge Readiness Recommendation

Proceed to PR review only after staging an explicit include list from `worktree-classification.json`.

Recommended PR include categories:

- Code/test/script/docs marked `includeInPr: "yes"`.
- `review` files only after manual owner review.
- Exclude generated binary artifacts, local Playwright artifacts, `.codex-dev-logs`, and other `includeInPr: "no"` entries.

## Next RC Steps

1. Run `corepack pnpm system:full-gate` once more before staging.
2. Run `node scripts/testing/merge-readiness.mjs --redact-local-artifacts` if a fresh Playwright JSON report embeds attachment bodies.
3. Confirm clean-runtime plan with explicit destructive reset approval before attempting DB/volume wipe.
4. Stage only reviewed PR files; do not commit generated local-only artifacts.
