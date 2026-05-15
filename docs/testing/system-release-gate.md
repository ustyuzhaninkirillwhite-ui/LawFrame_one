# System Release Gate

Date: 2026-05-13

## Commands

Quick local gate:

```bash
corepack pnpm system:test-gate:quick
```

Full gate:

```bash
corepack pnpm system:test-gate:full
```

Stage alias:

```bash
corepack pnpm stage22:system-test-gate
```

## Gate Contents

Quick gate includes:
- contracts/backend/web typecheck;
- targeted backend and web unit tests;
- secret scan and web bundle secret scan;
- representative clickability, project, automation, browser security and performance E2E specs.

Full gate adds:
- contracts/backend/web lint;
- DB readiness/RLS;
- broader system E2E set across Blocks 2-5;
- evidence collection and artifact validation.

## Runtime Requirements

The E2E portion requires the local integrated runtime:
- backend at `127.0.0.1:3100`;
- web at `127.0.0.1:3000`;
- Postgres/Supabase runtime at configured `SUPABASE_DB_URL`;
- OpenSearch unless `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1`;
- Activepieces runtime for full iframe-ready evidence.
