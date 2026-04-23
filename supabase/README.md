# Supabase Assets

This directory now contains both the original Stage 0 draft artifacts and the Stage 1 security foundation.

- `000001`-`000004`: original Stage 0 exploratory schema direction.
- `000005`-`000008`: Stage 1 multi-tenant foundation with `app/api/audit/private` schemas, RBAC catalog, RLS helpers, audit table and draft-table lockdown.
- `seed/000001_stage0_seed.sql`: Stage 1 RBAC seed catalog.
- `tests/pgtap/rls_smoke.sql`: Stage 1 pgTAP smoke checks for schemas, tables, helper functions and RLS enablement.
- `tests/pgtap/stage1_access_matrix.sql`: Stage 1 pgTAP policy/grant suite for schema exposure, API view access and RBAC-linked RLS policies.
