# Stage 17.12 Debranding Runtime Audit

## Current Surfaces

- AP default theme points to `/lexframe-automation-logo.svg` and `/lexframe-automation-icon.svg`.
- LexFrame wrapper sets iframe title to `Конструктор автоматизаций`.
- Runtime fallback replaces branded AP images only when they match AP brand/logo paths.
- Repo-local neutral SVG assets now exist in `apps/web/public`.

## Stage 17.12 Decision

Visible user-facing AP logo/wordmark/icon must not appear in the embedded automation workspace. Neutral local LexFrame Automation assets are used instead. Technical identifiers, package names, internal route names and license/notice files are not renamed or removed.

## Evidence

- Static/browser evidence: `artifacts/stage17/debranding-icon-evidence.json`
- Scanner: `pnpm stage17:debranding:check`
- E2E spec: `tests/e2e/stage17-debranding-icon.spec.ts`
