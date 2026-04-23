# ADR-0002: Supabase As Data Layer, Not Application Owner

- Status: accepted
- Date: 2026-04-20

## Decision

Supabase is used for Auth, Postgres, Storage, and Realtime. Backend makes the final policy decision for workspace-scoped access, privileged operations, signed URLs, publication, AI routing, and Activepieces provisioning.

## Consequences

- Browser can use only publishable keys and only for RLS-safe reads.
- `service_role` and secret keys remain backend-only.
- RLS is defense-in-depth, not a replacement for backend authorization.

