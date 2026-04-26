# Canvas v2 test strategy

Stage 16.17 proves that Canvas v2 is safe to release as a production no-code editor for legal workflows. The test target is the complete product chain:

`Canvas UI -> LexFrame Workflow DSL v2 -> Canvas operations -> validation engine -> compiler/runtime projection -> Activepieces sync/reverse sync -> step testing/dry-run -> publish/release gates`.

## Architecture rules under test

- LexFrame backend and product database are the source of truth for Canvas drafts, versions, validation and published automation state.
- Activepieces is runtime and advanced builder only; it is not the product source of truth.
- AI calls must route through LexFrame AI Gateway.
- External delivery requires a human approval path before publish/run/sync.
- Frontend must never receive privileged secrets, service-role keys, Activepieces admin keys, signing private keys, raw signed URLs or direct AI provider keys.
- Runtime edits from Activepieces import only as reviewed drafts and never overwrite published canonical versions automatically.

## Gate matrix

| Layer | Owner | Command | Release gate | Required | Artifact |
| --- | --- | --- | --- | --- | --- |
| DSL/schema | Platform | `corepack pnpm --filter @lexframe/workflow-dsl test:schema` | Contract | Yes | schema report |
| Operation reducer | Backend | `corepack pnpm --filter @lexframe/workflow-dsl test:operations` | Validation | Yes | operation test report |
| Validation engine | Backend | `corepack pnpm --filter @lexframe/workflow-dsl test:validation` | Validation/Security | Yes | validation report |
| Compiler/projection | Backend | `corepack pnpm --filter @lexframe/workflow-dsl test:compiler` | Runtime | Yes | compiler report |
| Shared fixtures | Platform | `corepack pnpm validate:canvas-fixtures` | Contract/Runtime | Yes | fixture validation output |
| Frontend unit/component | Frontend | `corepack pnpm --filter @lexframe/web test:canvas:unit && corepack pnpm --filter @lexframe/web test:canvas:components` | E2E/Security | Yes | Vitest report |
| MSW contracts | Frontend | `corepack pnpm --filter @lexframe/web test:canvas:contracts` | Contract | Yes | API fixture report |
| Visual states | Frontend | `corepack pnpm --filter @lexframe/web storybook:build` | E2E | Yes | visual state registry output |
| Canvas E2E | QA | `corepack pnpm --filter @lexframe/e2e test:canvas` | E2E | Yes | Playwright HTML report |
| Runtime integrated | QA/Platform | `corepack pnpm --filter @lexframe/e2e test:canvas:integrated` | Integrated Readiness | Yes before production | Playwright traces on failure |
| Security | Security | `corepack pnpm validate:canvas-security && corepack pnpm secret-scan && corepack pnpm validate:web-bundle-secrets` | Security | Yes | security report |
| Performance | Frontend/QA | `corepack pnpm --filter @lexframe/e2e test:canvas:performance` | Performance | Yes before production | performance smoke report |
| Release governance | Release manager | `corepack pnpm canvas:release-gate` | Manifest | Yes | release manifest validation |

## Required outcomes

- At least 20 valid and 20 invalid Canvas workflow fixtures exist.
- Schema-compatible invalid fixtures carry stable `WF_*` validation codes.
- Hard gates fail closed: missing validation, missing test reports, missing rollback plan or missing protected environment approval blocks production release.
- Canvas v2 rollout is feature-flagged and reversible.
