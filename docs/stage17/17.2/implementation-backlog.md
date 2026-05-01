# Implementation Backlog

## 17.2 Delivered In This Slice

- Create Stage 17.2 architecture artifacts.
- Add `POST /activepieces/session` contract while keeping legacy
  `/activepieces/embed-token`.
- Add typed API-client method that maps camelCase client input to snake_case
  wire input.
- Add Stage 17.2 DB migration draft that reuses Stage 4/16 tables.

## Order For 17.4-17.6

1. Close Stage 17.1 blockers or record explicit waivers.
2. Pin AP source/runtime version and license/edition decision.
3. Finalize local-integrated AP app/worker/Postgres/Redis profile.
4. Validate signing key resolver and secret refs.
5. Connect real ensureProject/ensureUser/ensureFlow read-back evidence.
6. Implement frontend route wrapper and memory-only session hook.
7. Add `/automation-runtime/*` reverse proxy and browser network evidence.
8. Add snapshots/read-back reconciliation and audit events.
9. Add Playwright security/proxy/token-leak tests.
10. Move to localization/debranding and design convergence gates.

## Acceptance For Architecture Readiness

- ADR accepted.
- Source-of-truth matrix accepted.
- Session contract accepted.
- DB table reuse and migration draft accepted.
- Proxy/CSP design accepted.
- License gate recorded.
- Security checklist accepted by Stage 11/security owner.
