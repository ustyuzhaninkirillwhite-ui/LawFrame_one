# Automation / Activepieces / Runtime Inventory

Date: 2026-05-13

Scope: Block 4 covers project automations, embedded Activepieces Canvas, session/provisioning bridge, JWT/role/pieces policy, route cache, dry-run/run evidence, Canvas validation and AI automation builder runtime gates. No visual classes or UI layout were changed.

## Automation Routes

| Route | Surface | Ready Marker | Notes |
| --- | --- | --- | --- |
| `/app/projects/:projectId/automations` | project automation list | automation body/links | Entry point for project automation rows and Canvas links. |
| `/app/projects/:projectId/automations/:automationId/automation` | embedded Activepieces Canvas | `activepieces-canvas-container` or `builder-unavailable-state` | Immersive route; should not expose standalone AP login. |
| `/app/projects/:projectId/automation-builder` | AI automation builder | builder heading/body | Planner and blueprint creation must route through LexFrame backend. |
| `/runs` and `/runs/:runId` | run center/detail when available | run status/timeline | Evidence/timeline surface for automation execution. |

## Backend Endpoints

Activepieces bridge:
- `POST /activepieces/session`
- `POST /activepieces/embed-token`
- `GET /projects/:projectId/automations/:automationId/canvas-readiness`
- `POST /activepieces/session/:sessionId/initialized`
- `POST /activepieces/session/:sessionId/iframe-health`
- `POST /activepieces/managed-authn/external-token`
- `GET /integrations/activepieces/status`
- `POST /automations/:id/runtime/sync`
- `POST /automations/:id/run`

Runtime callbacks:
- `POST /runtime/activepieces/callbacks/step-event`
- `POST /runtime/activepieces/callbacks/run-event`
- `POST /runtime/activepieces/runs/:runId/artifacts`
- `POST /runtime/approval-gates`
- `POST /runtime/delivery-gates`

Runs:
- `GET /runs`
- `POST /automations/:id/runs/preflight`
- `POST /automations/:id/runs`
- `GET /runs/:runId`
- `GET /runs/:runId/live-snapshot`

Canvas and builder:
- `POST /canvas/validate-block`
- `POST /canvas/validate-connection`
- `POST /automations/:automationId/canvas/validate`
- `POST /automations/:automationId/canvas/compile-preview`
- `POST /automation-builder/security/preflight`
- `POST /projects/:projectId/automation-intents`
- `POST /automation-intents/:intentId/plan`
- `POST /automation-blueprints/:blueprintId/validate`
- `POST /automation-blueprints/:blueprintId/compile-preview`
- `POST /automation-blueprints/:blueprintId/create-runtime-draft`

## Session / JWT Contract

| Field | Source | Browser Exposure | Audit/DB Policy |
| --- | --- | --- | --- |
| `session_id` | backend generated | yes | safe ID only |
| `jwt_token` | backend RS256 signer | yes, short-lived embed token only | raw value never audited; only hashes/JTI hashes persisted |
| `ttl_seconds` | workspace security policy, clamped | yes | should be short, currently max 300 seconds |
| `role` | backend role mapper | yes | no client upgrade |
| `pieces_policy` | backend pieces policy service | yes | policy hash/tags safe |
| `sdk_config` | backend session service | yes | config only, no AP API key/signing key/provider key |
| `flow_binding` | backend provisioning/sync | yes | AP project/flow IDs are safe identifiers |

## Role Mapping And Pieces Policy

| LexFrame Role | AP Capability Intent | Existing Coverage |
| --- | --- | --- |
| owner/admin/lawyer | editor-style access where policy allows | `activepieces-role-mapper.spec.ts`, session service tests |
| viewer | view-only or fail-closed when read-only is unsupported | `activepieces-role-mapper.spec.ts` |
| assistant | no member/workspace management upgrade | covered by backend RBAC and session policy boundaries |

Pieces policy is built by `ActivepiecesPiecesPolicyService`. Existing tests cover allowlist restriction, max tag limits and incident-lock rollback. Block 4 E2E asserts `pieces_policy` exists in browser config without exposing server secrets.

## Browser Storage And Route Cache

| Behavior | Intended Outcome | Test Surface |
| --- | --- | --- |
| Canvas route family session reuse | Avoid unnecessary session/iframe reload when route cache is still valid | `automation-route-cache-cleanup.spec.ts` |
| Leaving automation family | Stale AP browser JWTs removed by shell/session cleanup | `automation-route-cache-cleanup.spec.ts` |
| Browser storage scan | No AP API key, signing key, provider key, runtime master secret, service role key | `browser-secret-scan.ts`, `activepieces.ts` helpers |

## Current Test Inventory

| Area | Existing Tests | Level |
| --- | --- | --- |
| Activepieces backend session/provisioning | `activepieces.service.spec.ts`, `activepieces-session.service.spec.ts`, provisioning specs | unit/integration-smoke |
| JWT signer/role/pieces policy | `activepieces-jwt-signer.spec.ts`, `activepieces-role-mapper.spec.ts`, `activepieces-pieces-policy.service.spec.ts` | unit/security |
| Canvas backend/contracts | `canvas-validation.service.spec.ts`, `canvas-runtime-projection.service.spec.ts`, other canvas specs | unit/security |
| Runs/delivery | `run-preflight.service.spec.ts`, `delivery.service.spec.ts` | unit/security |
| Web wrapper/route | `activepieces-canvas-wrapper.test.tsx`, `activepieces-canvas-route.test.tsx`, `use-activepieces-session.test.tsx` | component/unit |
| E2E stage gates | Stage 4, Stage 16 live audit, Stage 17 Canvas, Stage 18-20 security/builder specs | smoke/live gates |

## Newly Covered By Block 4

| Scenario | Coverage |
| --- | --- |
| AP session response safe config and denylisted client fields | backend/session security E2E and frontend wrapper unit |
| RS256/kid/JTI/TTL JWT signer contract | backend JWT signer spec |
| Token/audit redaction | `activepieces-audit-writer.spec.ts` |
| Runtime-scoped token hash/JTI evidence | `activepieces.service.spec.ts` |
| Runtime callback auth rejection | `activepieces.service.spec.ts` |
| Direct AI provider and cross-workspace document Canvas blockers | `canvas-validation.service.spec.ts` |
| Embedded AP Canvas no-login regression | `automation-activepieces-canvas-full.spec.ts` |
| Dry-run through LexFrame backend and run evidence scan | `automation-runtime-dry-run-full.spec.ts` |
| Route cache and token cleanup | `automation-route-cache-cleanup.spec.ts` |
| AI automation builder policy gates | `automation-ai-builder-runtime.spec.ts` |

## Risks / Gaps

| Risk | Severity | Notes |
| --- | --- | --- |
| Live Activepieces runtime availability | High | E2E accepts controlled unavailable state, but full builder surface requires AP services. |
| Local DB dependency | High | Integrated E2E still depends on backend Postgres/Supabase at the configured local port. |
| Approvals direct specs | Medium | Delivery tests cover approval-linked behavior; `approvals` still lacks a direct service spec. |
| Full route-cache reload metric | Medium | E2E bounds session requests, but exact iframe reload identity is only measurable when live AP iframe is available. |
