# Stage 17.4 Infrastructure Runtime

## Local Profile

Stage 17.4 uses an isolated Docker Compose file:

```powershell
pnpm stage17:init-local-secrets
pnpm stage17:compose:config
pnpm stage17:up
pnpm stage17:readiness
pnpm stage17:readiness:evidence
```

The user-facing origin is `http://localhost:3100`.

Routes:

- `/` -> `lexframe-web`
- `/api/*` -> `lexframe-backend` with `/api` stripped by the reverse proxy
- `/automation-runtime/*` -> `activepieces-app`

## Secret Policy

`.env.stage17.local` and `.local/secrets/stage17/*` are local-only and ignored
by Git. Examples contain only placeholders and secret refs. Provider API keys
remain in the Local Owner Key Vault and are read only by LexFrame backend /
AI Gateway.

Activepieces custom pieces must call LexFrame runtime APIs with scoped runtime
tokens. They must not read provider keys, Supabase service keys, AP API keys, or
the Local Owner Key Vault path.

`pnpm stage17:init-local-secrets` generates `AP_WORKER_TOKEN` as an HS256 worker
JWT signed with the local `AP_JWT_SECRET`, matching Activepieces worker auth. Do
not replace it with an arbitrary random string.

## Gate

`GET /api/readiness/stage17` returns:

- `READY` when mandatory AP app, AP DB, Redis and signing checks pass.
- `DEGRADED` when non-blocking local owner key or UX artifact checks are missing.
- `NOT_READY` when a blocking infrastructure or signing check fails.

Evidence is written to `artifacts/stage17/readiness-stage17.json`.
