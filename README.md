# LexFrame Stage 14 Runtime Track

This repository contains the current LexFrame runtime track through Stage 14 iteration 1: a NestJS backend, a Next.js workspace UI, shared contracts/packages, Supabase migrations, and production validation tooling for readiness, Activepieces runtime, storage, and security.

## Workspace

- `apps/backend` - NestJS API with live readiness, runtime, delivery, recommendations, security, and document flows
- `apps/web` - Next.js workspace UI backed by the real API by default
- `packages/contracts` - canonical DTOs, enums, fixtures, event catalog, workflow schema
- `packages/api-client` - typed client for the HTTP contract
- `packages/config` - public/server environment schemas
- `packages/logger` - shared structured logger
- `packages/telemetry` - telemetry/event helpers
- `packages/workflow` - workflow schema and semantic validation
- `docs` - ADRs, diagrams, contracts, development notes
- `supabase` - migrations, RLS, and security SQL assets

## Stage 14 Local Profiles

1. Install dependencies:

```bash
corepack pnpm install
```

2. Copy `.env.example` to `.env` and replace placeholder secrets:
   `SUPABASE_SECRET_KEY`, `ACTIVEPIECES_API_KEY`, `ACTIVEPIECES_SIGNING_PRIVATE_KEY`, `XAI_API_KEY` or `COMETAPI_API_KEY`, `LEXFRAME_RUNTIME_MASTER_SECRET`.

3. Select the readiness contract profile:
   `LEXFRAME_READINESS_PROFILE=local-basic` keeps optional integrations tolerant.
   `LEXFRAME_READINESS_PROFILE=local-integrated` enables strict Stage 14 smoke checks for storage and Activepieces.

4. Start local infrastructure for the database profile:

```bash
docker compose -f compose.yaml up -d postgres
```

5. For `local-integrated`, start the real Activepieces runtime containers plus the storage signing sandbox, delivery sandbox receiver, and OpenSearch:

```bash
docker compose -f compose.yaml --profile local-integrated up -d activepieces-postgres activepieces-redis activepieces-app activepieces-worker storage-sandbox delivery-sandbox opensearch
```

6. Bootstrap compatibility objects for the local Docker Postgres and apply schema + seed SQL:

```bash
Get-Content -Raw scripts/bootstrap-local-supabase-compat.sql | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object { Get-Content -Raw $_.FullName | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres }
Get-ChildItem supabase/seed/*.sql | Sort-Object Name | ForEach-Object { Get-Content -Raw $_.FullName | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres }
```

7. Configure the canonical local delivery path for the demo contour:
   `LEXFRAME_DELIVERY_TRANSPORT=webhook`
   `LEXFRAME_DELIVERY_WEBHOOK_URL=http://127.0.0.1:8091/hooks/delivery`
   `LEXFRAME_DELIVERY_WEBHOOK_TOKEN=local_delivery_sandbox_token`

8. Keep runtime simulation disabled for `local-integrated`:
   `ACTIVEPIECES_SIMULATE_RUNS=0`

9. Keep local AI policy deterministic for `local-integrated`:
   `AI_PROVIDER_MODE=mock`

10. Prepare the OpenSearch index alias used by the Stage 6 smoke:

```bash
node scripts/prepare-stage14-search-index.mjs
```

11. Run production validation commands:

```bash
corepack pnpm build
corepack pnpm check
```

## Commands

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm check
corepack pnpm dev:web
corepack pnpm dev:backend
```

## Notes

- `GET /health/readiness` now stays backward-compatible while also returning the effective readiness profile and service summary.
- `GET /health/readiness/details` exposes the strict profile contract, blocked reasons, and service-level diagnostics.
- `GET /integrations/delivery/status` reports webhook + sandbox receiver readiness for the delivery demo contour.
- `POST /delivery/sandbox/test` dispatches a synthetic payload into the configured webhook target without creating a workflow run.
- Recommendations, delivery, and document signed URLs now fail with explicit readiness errors when upstream runtime/storage is not configured instead of silently returning fixtures or demo URLs.
