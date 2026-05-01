# Stage 17.10 Release Gate Report

Status: PASS
Acceptance: ACCEPT
Started: 2026-04-30T17:31:47.878Z
Finished: 2026-04-30T17:33:08.390Z
LexFrame commit: ec145113ad4fdeba40a7826a4122032b8f52e9d3
Activepieces commit: ec145113ad4fdeba40a7826a4122032b8f52e9d3
Node: v22.16.0
pnpm: 10.11.1

| Gate | Name | Status | Severity | Duration | Findings |
| --- | --- | --- | --- | ---: | --- |
G0 | Readiness inputs | PASS | P0 | 1s | -
G1 | Static/unit/contract | PASS | P0 | 6s | -
G2 | Integration | PASS | P0 | 7s | -
G3 | Playwright live E2E | PASS | P0 | 19s | -
G4 | Security and secret scan | PASS | P0 | 4s | -
G5 | Localization and debranding | PASS | P1 | 1s | -
G6 | Visual regression | PASS | P0 | 38s | -
G7 | Runtime evidence | PASS | P0 | 2s | -
G8 | Artifacts completeness | PASS | P1 | 1s | -
G9 | Stop-list compliance | PASS | P0 | 2s | -

## Evidence

- Machine-readable report: `artifacts/stage17/release-gate.json`
- Command logs: `artifacts/stage17/logs/`
- Runtime evidence: `artifacts/stage17/runtime-evidence.json`
- Browser secret scan: `artifacts/stage17/browser-secret-scan.json`
- Stop-list result: `artifacts/stage17/stop-list-compliance.json`
