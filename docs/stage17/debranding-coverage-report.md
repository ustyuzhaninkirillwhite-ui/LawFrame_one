# Stage 17.12 Debranding Coverage Report

Status: generated gate target; final status is written by `pnpm stage17:release-gate`.

## Scope

- Activepieces logo, wordmark, title, favicon and route-level visible product naming.
- Assistive surfaces: aria-label, alt text, help strings, empty states and onboarding/login strings exposed inside the user route.
- License and third-party notices are preserved.
- Neutral local LexFrame Automation icon/logo assets.
- Browser-visible image `src`, `alt`, `title`, `aria-label`, document title and favicon references.

## Pass Criteria

- User-facing route uses LexFrame/`Автоматизация` naming.
- Visible Activepieces branding is absent from the MVP route.
- Debranding does not hide or remove AP builder functions.
- Neutral icon loads locally from `apps/web/public/lexframe-automation-icon.svg`.
- Remote AP brand image references are forbidden in visible runtime surfaces.

## Evidence Sources

- `docs/stage17/17.7/debranding-coverage-report.md`
- `docs/stage17/17.7/branding-inventory.md`
- `docs/stage17/17.7/license-notice-preservation-report.md`
- `scripts/branding/check-visible.mjs`
- `scripts/license/check-license-notices.mjs`
- `artifacts/stage17/debranding-icon-evidence.json`
- `tests/e2e/stage17-debranding-icon.spec.ts`
