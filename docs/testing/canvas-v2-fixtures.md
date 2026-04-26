# Canvas v2 fixtures

Shared fixtures live in `packages/canvas-test-fixtures`.

## Fixture groups

- `validFixtures`: 20 schema-valid Canvas DSL v2 workflows.
- `invalidFixtures`: 21 invalid or release-blocking workflows with stable `WF_*` expected validation codes.
- `largeFixtures`: 10, 25, 50 and 100-node performance fixtures, plus a 100-node invalid-many-errors fixture.
- `runtimeSnapshots`: Activepieces reverse-sync cases for safe change, unknown node, code step, raw HTTP, direct AI provider and approval removal before delivery.
- `mswFixtures`: Canvas API endpoint and error-shape fixtures for frontend contract tests.
- `releaseGateMatrix`: hard gates and blocking reasons.

## Required checks

- `corepack pnpm --filter @lexframe/canvas-test-fixtures test`
- `corepack pnpm validate:canvas-fixtures`
- `corepack pnpm --filter @lexframe/workflow-dsl test:schema`
- `corepack pnpm --filter @lexframe/workflow-dsl test:validation`

## Fixture policy

- Fixtures must not contain real client document text.
- Fixtures must not contain real secrets, tokens or signed URLs.
- Invalid fixtures that are intentionally schema-compatible must use expected `WF_*` validation codes.
- Runtime fixtures must never imply that Activepieces is the canonical source of truth.
