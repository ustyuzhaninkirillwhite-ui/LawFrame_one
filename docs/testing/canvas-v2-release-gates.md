# Canvas v2 release gates

Production release is blocked unless every hard gate below passes. Any P0 or unresolved P1 issue blocks the release candidate.

## Gate: Contract

Blocks release when:

- Workflow DSL v2 schema is invalid.
- OpenAPI changes without compatible API client and MSW fixtures.
- Canvas API error shapes are inconsistent.
- Frontend uses raw fetch outside the shared API client for Canvas surfaces.
- `@lexframe/canvas-test-fixtures` has fewer than 20 valid or 20 invalid fixtures.

Required commands:

- `corepack pnpm validate:json-schemas`
- `corepack pnpm validate:openapi`
- `corepack pnpm validate:canvas-fixtures`
- `corepack pnpm --filter @lexframe/web test:canvas:contracts`

## Gate: Validation

Blocks release when:

- Invalid workflow can be saved as valid.
- Missing required input does not block publish.
- External delivery without approval can be published.
- Cross-workspace reference passes validation.
- Unsupported runtime node compiles silently.

Required commands:

- `corepack pnpm --filter @lexframe/workflow-dsl test:operations`
- `corepack pnpm --filter @lexframe/workflow-dsl test:validation`
- `corepack pnpm --filter @lexframe/backend test -- canvas`

## Gate: Security

Blocks release when:

- Secret appears in frontend bundle, network payload, localStorage or sessionStorage.
- Activepieces API key or signing private key appears outside backend.
- Direct AI provider call is possible from frontend or Canvas AI tools.
- Viewer can edit, publish, sync, import runtime, approve or view raw data.
- External delivery can run without approval.
- Cross-workspace document, connection or runtime-flow access is possible.

Required commands:

- `corepack pnpm validate:canvas-security`
- `corepack pnpm security:scan-secrets`
- `corepack pnpm security:frontend-bundle`
- `corepack pnpm --filter @lexframe/e2e test:canvas:security`

## Gate: Runtime

Blocks release when:

- Compile preview fails for the baseline valid workflow.
- Runtime sync fails for the baseline workflow.
- Advanced builder cannot open with valid token or mishandles expired token.
- Runtime modified status is not detected.
- Safe reverse sync cannot create reviewed draft.
- Unsafe reverse sync is not blocked.

Required commands:

- `corepack pnpm --filter @lexframe/workflow-dsl test:compiler`
- `corepack pnpm --filter @lexframe/backend test -- workflow-compiler`
- `corepack pnpm --filter @lexframe/e2e test:canvas:activepieces`

## Gate: E2E

Blocks release when the baseline Canvas journey fails:

- Create from empty Canvas.
- Add trigger and legal modules.
- Map inputs and outputs through Data Picker.
- Add approval before delivery.
- Validate, test step, compile preview, publish, sync and dry-run.
- Open advanced builder and view redacted output.

Required command:

- `corepack pnpm --filter @lexframe/e2e test:canvas`

## Gate: Integrated Readiness

Blocks release when:

- local-integrated or staging-rc readiness has a blocked required service.
- Storage signed URL boundary is unavailable.
- Activepieces worker is unavailable.
- Delivery sandbox is unavailable.
- AI Gateway policy tests fail.
- Realtime snapshot/delta recovery fails.

Required command:

- `corepack pnpm --filter @lexframe/e2e test:canvas:integrated`

## Gate: Performance

Blocks release, or moves it to degraded release review, when:

- 100-node Canvas freezes.
- Operation apply p95 exceeds 200ms.
- Validation after a small operation exceeds 500ms p95.
- Compile preview 50-node p95 exceeds 3000ms.
- Repeated operations show confirmed memory leak.

Required command:

- `corepack pnpm --filter @lexframe/e2e test:canvas:performance`

## Gate: Manifest

Blocks release when the release manifest misses:

- Commit SHA.
- Backend and frontend image digests.
- Migration versions.
- Activepieces piece versions.
- Workflow compiler version.
- Canvas DSL version.
- Canvas workflow/runtime schema hashes.
- Canvas feature flag plan.
- Canvas test reports.
- Canvas rollback plan.

Production deployment must use a protected environment, manual reviewer approval and a rollback manifest.

Required command:

- `corepack pnpm canvas:release-gate`

## Rollout flags

Each flag must define owner, default value, allowed roles, kill switch, monitoring signal and rollback behavior.

- `canvas_v2_enabled`
- `canvas_v2_readonly_preview`
- `canvas_v2_step_testing_enabled`
- `canvas_v2_dry_run_enabled`
- `canvas_v2_publish_enabled`
- `canvas_v2_reverse_sync_enabled`
- `canvas_v2_advanced_builder_enabled`
- `canvas_v2_ai_assistant_enabled`

Canvas API responses expose the normalized runtime feature flags:

- `canvas_v2`
- `canvas_ai_assistant`
- `canvas_advanced_graph`
- `canvas_reverse_sync`
