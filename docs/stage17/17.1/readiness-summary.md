# Stage 17.1 Readiness Summary

Status: BLOCKED
Date: 2026-04-28

## Decision

Stage 17.1 cannot pass yet. The audit artifacts and ADR package were created,
but required baseline evidence is incomplete and several readiness blockers are
open.

## Completed Evidence

- Stage 17 freeze document and CR log.
- LexFrame source/toolchain command log.
- Activepieces source/toolchain command log.
- Sanitized source/design/i18n/branding/license inventories.
- Sanitized LexFrame and Activepieces secret/config inventories.
- ADR-17.1 through ADR-17.4.
- LexFrame screenshot capture attempts with metadata.
- Activepieces screenshot blocker note.
- Project-native redacted secret scan passed:
  `artifacts/stage17.1/reports/secret-scan-redacted.txt`.

## Open Blockers

- B-17.1-001: `E:\activepieces-main` is not a git checkout. AP source state
  has no branch/commit evidence.
- B-17.1-002: Activepieces declares `bun@1.3.3`, but `bun` is not installed or
  available in PATH.
- B-17.1-003: Activepieces runtime was not available, so AP-01..AP-08 baseline
  screenshots were not captured.
- B-17.1-004: LexFrame demo auth bootstrap returned HTTP 500 in a fresh
  Playwright context. LF screenshots are partial and mostly redirected to
  sign-in/404 states.
- B-17.1-005: Legal/license sign-off for Activepieces enterprise boundary and
  Embed Builder paid-edition risk is pending.
- B-17.1-006: Owner sign-off for product, technical, security, legal/license,
  and frontend/design gates is pending.

## Non-Blocking Caveats

- `rg` was unavailable in this Windows Codex session with `Access is denied`.
  Fallback inventory used Codebase Memory, `git grep -l`, and PowerShell
  path/name enumeration.
- LexFrame repo already had unrelated untracked
  `stage16-audit-evidence-20260426-000827/`; it was not modified.

## Required Remediation For PASS

- Provide or restore a real Activepieces git checkout at `E:\activepieces-main`.
- Make the declared Activepieces package manager/runtime available and start AP
  app/worker/Postgres/Redis in the agreed local profile.
- Capture AP-01..AP-08 screenshots with metadata JSON.
- Fix or document LexFrame local demo auth bootstrap, confirm route map, and
  recapture LF-01..LF-10 on synthetic data.
- Review the passed project-native secret scan and decide whether `gitleaks`
  must also be installed/run before owner sign-off.
- Get owner sign-off or explicit waivers for all open blockers.
