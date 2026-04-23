# Supabase Contract

## Role

Supabase provides Auth, Postgres, Storage, and Realtime as infrastructure. Backend remains the owner of product decisions.

## Allowed Direct Browser Access

- Session bootstrap via publishable key.
- RLS-safe reads for workspace-scoped lists.
- Realtime only after explicit private-channel policy is defined.

## Backend-Only Operations

- Signed URLs
- service role access
- admin mutations
- publication flow
- AI gateway calls
- Activepieces provisioning

