# Getting Started

## Install

```bash
corepack pnpm install
```

## Configure

1. Copy `.env.example` to `.env`.
2. Replace all placeholder secrets before running Stage 12 readiness checks.
3. Keep `ACTIVEPIECES_SIMULATE_RUNS=0` for any MVP review that should represent the real runtime path.
4. Configure delivery transport if you want `run -> approval -> delivery -> completed` to be a real send:

```bash
LEXFRAME_DELIVERY_TRANSPORT=webhook
LEXFRAME_DELIVERY_WEBHOOK_URL=https://your-delivery-endpoint.example/send
LEXFRAME_DELIVERY_WEBHOOK_TOKEN=optional_bearer_token
```

## Database Bootstrap

Start the local Docker Postgres:

```bash
docker compose -f compose.yaml up -d postgres
```

Bootstrap the minimal Supabase-compatible `auth` and `storage` objects used by the LexFrame migrations:

```bash
Get-Content -Raw scripts/bootstrap-local-supabase-compat.sql | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres
```

Apply migrations and seeds in deterministic order:

```bash
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object { Get-Content -Raw $_.FullName | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres }
Get-ChildItem supabase/seed/*.sql | Sort-Object Name | ForEach-Object { Get-Content -Raw $_.FullName | docker exec -i law_frame_main-postgres-1 psql -v ON_ERROR_STOP=1 -U postgres -d postgres }
```

## Build And Validate

```bash
corepack pnpm build
corepack pnpm check:contracts
corepack pnpm check:backend
corepack pnpm check:security
```

## Run

```bash
corepack pnpm dev:backend
corepack pnpm dev:web
```

## Local Notes

- Frontend uses the real API by default. MSW stays disabled unless `NEXT_PUBLIC_ENABLE_MSW=1`.
- Backend readiness is live-derived from env, DB relations, release gates, mining snapshots, and realtime activity.
- Recommendation APIs now block when Stage 9 storage is not migrated instead of returning fixtures.
- Document signed URL issuance now fails if Supabase storage signing is unavailable instead of returning a deterministic demo URL.
- Delivery uses an explicit transport configuration. If no transport is configured, send attempts fail fast and the run is not marked as delivered.
