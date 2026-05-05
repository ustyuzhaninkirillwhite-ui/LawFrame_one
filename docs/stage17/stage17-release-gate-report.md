# Stage 17.12 Release Gate Report

Status: PASS
Acceptance: ACCEPT
Started: 2026-05-05T07:13:30.114Z
Finished: 2026-05-05T07:17:29.926Z
LexFrame commit: 24d6e7b21ba73b284964c6b4c4b536392a0b704c
Activepieces commit: 24d6e7b21ba73b284964c6b4c4b536392a0b704c
Node: v22.16.0
pnpm: 10.11.1

| Gate | Name | Status | Severity | Duration | Findings |
| --- | --- | --- | --- | ---: | --- |
G0 | Readiness inputs | PASS | P0 | 1s | -
G1 | Static/unit/contract | PASS | P0 | 85s | -
G2 | Integration | PASS | P0 | 17s | -
G3 | Playwright live E2E | PASS | P0 | 36s | -
G4 | Security and secret scan | PASS | P0 | 50s | -
G5 | Localization and debranding | PASS | P1 | 1s | -
G6 | Visual regression | PASS | P0 | 39s | -
G7 | Runtime evidence | PASS | P0 | 2s | -
G8 | Artifacts completeness | PASS | P1 | 1s | -
G9 | Stop-list compliance | PASS | P0 | 6s | -
G10 | Stage 17.12 closure | PASS | P0 | 0s | -

## Evidence

- Machine-readable report: `artifacts/stage17/release-gate.json`
- Command logs: `artifacts/stage17/logs/`
- Runtime evidence: `artifacts/stage17/runtime-evidence.json`
- Browser secret scan: `artifacts/stage17/browser-secret-scan.json`
- Localization flicker evidence: `artifacts/stage17/localization-flicker-evidence.json`
- Debranding icon evidence: `artifacts/stage17/debranding-icon-evidence.json`
- Pieces inventory/build/sync: `artifacts/stage17/pieces-*.json`
- Stop-list result: `artifacts/stage17/stop-list-compliance.json`
