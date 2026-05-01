# Stage 17.10 Debranding Coverage Report

Status: generated gate target; final status is written by `pnpm stage17:release-gate`.

## Scope

- Activepieces logo, wordmark, title, favicon and route-level visible product naming.
- Assistive surfaces: aria-label, alt text, help strings, empty states and onboarding/login strings exposed inside the user route.
- License and third-party notices are preserved.

## Pass Criteria

- User-facing route uses LexFrame/`Автоматизация` naming.
- Visible Activepieces branding is absent from the MVP route.
- Debranding does not hide or remove AP builder functions.

## Evidence Sources

- `docs/stage17/17.7/debranding-coverage-report.md`
- `docs/stage17/17.7/branding-inventory.md`
- `docs/stage17/17.7/license-notice-preservation-report.md`
- `scripts/branding/check-visible.mjs`
- `scripts/license/check-license-notices.mjs`
