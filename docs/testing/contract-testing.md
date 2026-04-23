# Contract Testing Strategy

## Checks

- OpenAPI syntax and schema integrity
- Workflow JSON Schema validity
- Workflow semantic validation fixtures
- Secret scan for browser/backend boundary
- Import boundary discipline via workspace package separation

## Stage 0 Test Layers

- `packages/workflow`: schema + semantic tests
- `apps/backend`: module bootstrap smoke test
- `tests/e2e`: UI smoke path placeholders for builder/readiness
- `supabase/tests/pgtap`: RLS direction smoke plan

