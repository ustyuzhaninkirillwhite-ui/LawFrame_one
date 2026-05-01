# Secrets Inventory

| Secret | Scope | Owner | Browser allowed |
| --- | --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Backend infra | platform | No |
| `SUPABASE_DB_URL` | Backend / migrations | platform | No |
| `ACTIVEPIECES_API_KEY` | Runtime integration | integrations | No |
| `ACTIVEPIECES_API_KEY_SECRET_REF` | Runtime integration reference | integrations | No |
| `ACTIVEPIECES_API_KEY_FILE` | Local Stage 17 secret file path | integrations | No |
| `ACTIVEPIECES_SIGNING_PRIVATE_KEY` | Builder embed JWT | integrations | No |
| `ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF` | Builder embed JWT reference | integrations | No |
| `ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE` | Local Stage 17 signing key file path | integrations | No |
| `AP_JWT_SECRET` | Activepieces app/worker internal JWT | integrations | No |
| `AP_ENCRYPTION_KEY` | Activepieces connection encryption | integrations | No |
| `AP_POSTGRES_PASSWORD` | Activepieces runtime database | integrations | No |
| `AP_REDIS_PASSWORD` | Activepieces runtime queue | integrations | No |
| `AP_WORKER_TOKEN` | Activepieces worker authentication JWT signed by `AP_JWT_SECRET` | integrations | No |
| `XAI_API_KEY` | AI routing | ai-platform | No |
| `COMETAPI_API_KEY` | AI routing | ai-platform | No |
| `LEXFRAME_LOCAL_KEYS_FILE` | Local Owner Key Vault path | ai-platform | No browser exposure |
| `OPENSEARCH_URL` | Search infrastructure | search | No |
| `POSTHOG_KEY` | Analytics ingest | analytics | No direct browser secret |

Stage 17.4 rule: examples may contain only placeholders or secret refs. Real
values live in `.env.stage17.local` and `.local/secrets/stage17/*`, both ignored
by Git and excluded from Docker build context.
