# Automation / Activepieces / Runtime Test Plan

Date: 2026-05-13

## Backend

| Area | Tests | Assertions |
| --- | --- | --- |
| Session/JWT | `activepieces-session.service.spec.ts`, `activepieces-jwt-signer.spec.ts`, `activepieces-audit-writer.spec.ts` | short-lived RS256 token, `kid`, safe claims, no raw JWT/key audit |
| Provisioning/role/policy | Activepieces provisioning, role mapper and pieces policy specs | AP project/user/flow binding, viewer downgrade, allowlist policy |
| Runtime/dry-run | `activepieces.service.spec.ts`, `run-preflight.service.spec.ts` | LexFrame backend dispatch, runtime token hash/JTI evidence, missing mapping controlled failures |
| Callbacks/webhooks | `activepieces.service.spec.ts` | invalid bearer rejected before receipts, safe callback flow |
| Canvas contracts | `canvas-validation.service.spec.ts`, `canvas-runtime-projection.service.spec.ts` | no direct provider node, approval required, cross-workspace document refs blocked |
| Delivery/approvals | `delivery.service.spec.ts` | delivery cannot bypass approval, safe audit metadata |

## Web Unit

| Component | Tests | Assertions |
| --- | --- | --- |
| `ActivepiecesCanvasWrapper` | `activepieces-canvas-wrapper.test.tsx` | safe SDK config, iframe sizing, AP login auth failure, stuck loading, no theme remount |
| `ActivepiecesCanvasRoute` | `activepieces-canvas-route.test.tsx` | session lifecycle, controlled unavailable state, dry-run via backend, canonical route replacement |
| Canvas components | existing `features/canvas` specs | validation rails, projection contracts, no raw secret inspector behavior |

## E2E

| Spec | Scenario |
| --- | --- |
| `automation-activepieces-canvas-full.spec.ts` | automation list/open Canvas, no AP login, safe session response, no blocking overlay |
| `automation-activepieces-session-security.spec.ts` | JWT/config security, client field denylist, browser storage scans |
| `automation-route-cache-cleanup.spec.ts` | route-family session reuse and token cleanup after leaving automation |
| `automation-runtime-dry-run-full.spec.ts` | dry-run through LexFrame backend, timeline/evidence safety |
| `automation-canvas-validation-security.spec.ts` | invalid Canvas/provider operations return controlled responses |
| `automation-ai-builder-runtime.spec.ts` | planner/backend policy gates and no auto publish/run |

## Commands

```bash
corepack pnpm test:block4:backend
corepack pnpm test:block4:web-unit
corepack pnpm test:block4:packages
corepack pnpm test:block4:e2e
corepack pnpm test:block4
```

## Acceptance Mapping

| Criterion | Evidence |
| --- | --- |
| Automation routes covered | E2E route specs and inventory |
| Embedded AP Canvas route covered | wrapper/route unit tests and Canvas E2E |
| AP login regression covered | wrapper unit and E2E no-login checks |
| JWT/config tested | backend signer/session security and E2E session payload scan |
| Role/pieces policy tested | role mapper/pieces policy/session specs |
| Token cleanup and route cache covered | `automation-route-cache-cleanup.spec.ts` |
| Dry-run through backend | route unit and dry-run E2E |
| Run evidence/audit safe metadata | activepieces service/audit writer specs and run evidence helper |
| Canvas validation/security | canvas validation spec and E2E validation security |
| AI builder policy | AI builder E2E and Stage20-style backend checks |
| No visual changes | tests/docs/helpers only; no class/layout token edits |
