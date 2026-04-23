# Trust Boundaries

## Zones

- Browser zone: public-safe code, publishable keys only, no privileged secrets.
- LexFrame trusted backend: policy enforcement, secret handling, approval logic, gateway routing.
- Supabase controlled data plane: Auth, Postgres, Storage, Realtime with RLS.
- Activepieces runtime plane: embedded builder and runtime execution.
- AI provider plane: external LLM providers behind the gateway.
- Analytics plane: PostHog/ClickHouse fed by product events only.
- External delivery plane: e-mail, Telegram, publication, client notifications.

## Hard Constraints

- Browser never receives `SUPABASE_SECRET_KEY`.
- Browser never receives `ACTIVEPIECES_API_KEY` or signing private key.
- Activepieces flow identifiers are references, not product IDs.
- Workflow JSON must validate against the LexFrame schema before persistence.
- Product events must not contain raw prompt text or sensitive document bodies.

