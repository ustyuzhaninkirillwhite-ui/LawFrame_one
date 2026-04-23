# ADR-0001: Product Ownership And Source Of Truth

- Status: accepted
- Date: 2026-04-20

## Decision

LexFrame backend plus product PostgreSQL schema own canonical business entities: `users`, `workspaces`, `profiles`, `automation_templates`, `installed_automations`, `publication_requests`, `recommendations`, `audit_events`, and `permissions`.

## Consequences

- Activepieces flow IDs remain external bindings, never product identifiers.
- Supabase Auth provides identity and secure data primitives, but business authorization stays in backend policy code.
- Recommendations are built from product events owned by LexFrame, not from builder-internal logs.

