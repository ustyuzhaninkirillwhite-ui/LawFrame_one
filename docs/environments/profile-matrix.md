# Readiness Profile Matrix

`LEXFRAME_READINESS_PROFILE` is the source of truth for readiness enforcement. It is intentionally separate from `LEXFRAME_ENV_PROFILE` and `LEXFRAME_DEPLOY_ENV` so release readiness does not get conflated with execution environment markers.

## Profiles

| Profile            | allowReadinessGateBlocked | Required services                                                                                                       | Typical use                                                                                                    |
| ------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `local-basic`      | `true`                    | `postgres`, `backend`, `web`                                                                                            | Fast local work with optional integrations allowed to stay blocked                                             |
| `local-integrated` | `false`                   | `postgres`, `supabase-storage`, `backend`, `web`, `activepieces`, `redis`, `opensearch`, `delivery-sandbox`             | Stage 14 local smoke with real signed URLs, real Activepieces dispatch, search readiness, and delivery sandbox |
| `staging-rc`       | `false`                   | `postgres`, `supabase-storage`, `backend`, `web`, `activepieces`, `redis`, `opensearch`, `real-ai-provider`, `realtime` | Release-candidate validation                                                                                   |
| `production`       | `false`                   | All readiness services                                                                                                  | Full production enforcement                                                                                    |

## Service Model

The readiness service now classifies the following service keys:

- `postgres`
- `supabase-storage`
- `backend`
- `web`
- `activepieces`
- `redis`
- `opensearch`
- `delivery-sandbox`
- `real-ai-provider`
- `realtime`

## Stage 14 Iteration 1 Rules

- `local-basic` may keep optional integrations blocked and still satisfy the readiness contract.
- `local-integrated` must not report blocked storage signing, Activepieces runtime, OpenSearch, or delivery sandbox dependencies.
- `local-integrated` keeps AI policy tests deterministic with `AI_PROVIDER_MODE=mock`; `staging-rc` and `production` require `AI_PROVIDER_MODE=controlled-real` plus at least one configured real provider key.
- Stage 14 strict e2e smoke must fail fast when `LEXFRAME_READINESS_PROFILE` is missing or does not match the expected contract.
- Canonical profile definitions live in [config/readiness/profiles.json](/E:/Law_frame_main/config/readiness/profiles.json).
