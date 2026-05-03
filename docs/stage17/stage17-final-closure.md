# Stage 17 Final Closure

Date: 2026-05-03

## Summary

Stage 17 closes as a local-integrated MVP milestone for embedded automation authoring. On the MVP period, the primary Canvas mode in LexFrame opens embedded Activepieces Canvas. This is a temporary MVP solution. The long-term architecture target is a proprietary simplified LexFrame Canvas built around legal actions and LexFrame Workflow DSL. Stage 17.12 does not implement that future Canvas and does not expand Stage 16 scope.

## Git

- Branch: `codex/stage17.12-final-closure-localization-pieces`
- Start commit: `08e0b3ce733d568988de46b504f2451027a3218e`
- Final commit: this closure package commit; see `git log -1` after commit creation.

## Stage 17 Goal

Open a real embedded Activepieces Canvas inside LexFrame shell without separate AP login, without exposing privileged secrets to frontend, while LexFrame backend/product DB remain the source of truth.

## Completed In 17.10-17.11

- Workspace-scoped canvas ensure/provisioning.
- `/api/activepieces/session` with short-lived JWT and role mapping.
- Canonical `/automation` route and embedded iframe wrapper.
- Local Owner Key Vault and AI Gateway runtime contour.
- RU localization, debranding, security/evidence scripts and G0-G9 release gate.

## Added In 17.12

- Accepted ADR for Canvas strategy: AP Canvas is MVP primary; future LexFrame Canvas is deferred.
- Closure docs, traceability matrix, known limitations, risk register and evidence index.
- Bundle-first localization hardening with first visible-paint guard and overlay metrics.
- Repo-local neutral LexFrame Automation SVG icon/logo.
- Debranding manifest and stronger icon/remote-brand checks.
- Open-source pieces inventory/build/sync/verify scripts.
- Dev-only all-open-source pieces profile guarded away from production.
- Gmail and CometAPI inventory/localization/build blocker evidence.
- Release gate extended to Stage 17.12 G10 closure.

## Release Gate

Final command: `pnpm stage17:release-gate`.

Final status: `PASS / ACCEPT` at `2026-05-03T12:43:26.016Z`.

Final result is written to:

- `artifacts/stage17/release-gate.json`
- `docs/stage17/stage17-release-gate-report.md`

## Evidence Artifacts

- `artifacts/stage17/runtime-evidence.json`
- `artifacts/stage17/browser-secret-scan.json`
- `artifacts/stage17/localization-flicker-evidence.json`
- `artifacts/stage17/debranding-icon-evidence.json`
- `artifacts/stage17/pieces-inventory.json`
- `artifacts/stage17/pieces-build-report.json`
- `artifacts/stage17/pieces-sync-report.json`
- `artifacts/stage17/pieces-localization-report.json`
- `artifacts/stage17/evidence-index.json`

## Command Mapping

- Package manager evidence: `corepack pnpm --version`
- Typecheck: `corepack pnpm typecheck`
- Lint: `corepack pnpm lint`
- Pieces inventory: `corepack pnpm stage17:pieces:inventory`
- Pieces build evidence: `corepack pnpm stage17:pieces:build`
- Pieces sync evidence: `corepack pnpm stage17:pieces:sync`
- Pieces verification: `corepack pnpm stage17:pieces:verify`
- Localization: `corepack pnpm stage17:localization:check`
- Debranding: `corepack pnpm stage17:debranding:check`
- E2E: `corepack pnpm stage17:e2e:activepieces-canvas`
- Final gate: `corepack pnpm stage17:release-gate`

## Known Limitations

- Stage 17 is not production-ready without Stage 14/12 gates.
- Activepieces embedding/provisioning/show-hide pieces surfaces require license review.
- `E:/activepieces-main` lacks git metadata.
- `bun` and AP `node_modules` are unavailable, so pieces build is documented as blocked in this environment.
- Offline pieces pack does not prove real external API execution.
- Gmail/CometAPI real actions require credentials and connection policy.

## Explicit Non-Goals

- Do not build future LexFrame simplified Canvas in Stage 17.12.
- Do not restore old LexFrame canvas as main route or fallback.
- Do not move source of truth into Activepieces.
- Do not commit secrets or provider credentials.
- Do not use enterprise/ee code/assets without license decision.

## Next-Stage Notes

- Resolve Activepieces license decision before production embedding.
- Restore AP source as a real git checkout with exact commit evidence.
- Install AP build prerequisites if local .tgz/custom pieces cache must be produced.
- Plan future LexFrame Workflow DSL Canvas as a separate Stage 16+ track.
