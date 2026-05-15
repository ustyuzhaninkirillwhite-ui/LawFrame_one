# Block 3 Project Chat / Documents Evidence

This folder stores Block 3 execution notes and future screenshots/traces.

Planned command group:

```bash
corepack pnpm test:block3:backend
corepack pnpm test:block3:web-unit
corepack pnpm test:block3:e2e
```

Current evidence is recorded in:

- `docs/testing/project-chat-documents-inventory.md`
- `docs/testing/project-chat-documents-test-plan.md`
- `docs/testing/chat-runtime-scenario-matrix.md`
- `docs/testing/documents-upload-test-matrix.md`
- `docs/testing/project-knowledge-sources-test-matrix.md`

If the integrated runtime is unavailable, record the failing service and port here before accepting the block.

## 2026-05-13 Execution Notes

Passed:

- `corepack pnpm test:block3:backend` - 9 suites, 34 tests.
- `corepack pnpm --filter @lexframe/api-client test` - settings and chat API client contract tests.
- `corepack pnpm test:block3:web-unit` - 5 files, 28 tests.
- `corepack pnpm --filter @lexframe/backend typecheck`
- `corepack pnpm --filter @lexframe/backend lint`
- `corepack pnpm --filter @lexframe/web typecheck`
- `corepack pnpm --filter @lexframe/web lint`
- `corepack pnpm --filter @lexframe/e2e typecheck`
- `corepack pnpm --filter @lexframe/e2e lint`

Blocked:

- `corepack pnpm test:block3:e2e` failed before tests because OpenSearch readiness failed in `prepare-stage14-search-index.mjs`.
- `$env:LEXFRAME_E2E_SKIP_SEARCH_INDEX='1'; corepack pnpm test:block3:e2e` started the specs but all six failed during `signInAsDemo`; backend `/auth/bootstrap` returned `connect ECONNREFUSED 127.0.0.1:54322`.
