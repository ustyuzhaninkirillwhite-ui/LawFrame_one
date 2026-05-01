# Stage 17.2 - Activepieces MVP Integration Architecture

Status: Draft implemented
Date: 2026-04-28

Stage 17.2 defines the architecture for opening Activepieces as the primary MVP
automation Canvas from LexFrame without making Activepieces the product source
of truth.

## Artifacts

- `ADR-17.2-activepieces-mvp-integration.md` - architecture decision.
- `api-contract-activepieces-session.md` - `POST /api/activepieces/session`
  contract and physical Nest route mapping.
- `source-of-truth-matrix.md` - ownership boundaries between LexFrame and
  Activepieces.
- `sequence-diagram.md` - user/session/binding/event sequence.
- `route-state-matrix.md` - frontend route states and fallback behavior.
- `proxy-csp-design.md` - `/automation-runtime/*` proxy and CSP baseline.
- `security-checklist.md` - token, secret, RBAC and browser storage gates.
- `license-gate-memo.md` - paid-edition and enterprise-boundary gate.
- `implementation-backlog.md` - implementation order for 17.4-17.6.
- `db-migration-draft.md` - intended DB evolution and table reuse policy.

## Current Repo Integration Points

The implementation path extends existing code instead of creating a parallel
integration:

- Backend: `apps/backend/src/modules/activepieces/*`
- Contracts: `packages/contracts/src/domain.ts`
- API client: `packages/api-client/src/index.ts`
- Runtime bindings: `app.automation_runtime_bindings`
- Flow snapshots: `app.activepieces_flow_snapshots`
- Legacy endpoint kept: `POST /activepieces/embed-token`
- Stage 17 primary endpoint: `POST /activepieces/session`

## Gates

17.2 is architecture-ready when these artifacts are present, reviewed and kept
consistent with code contracts. It is not full runtime acceptance. Runtime PASS
still depends on Stage 17.1 blockers, Activepieces license/edition decision,
local-integrated runtime evidence, localization/debranding evidence, and
Playwright browser/proxy evidence.
