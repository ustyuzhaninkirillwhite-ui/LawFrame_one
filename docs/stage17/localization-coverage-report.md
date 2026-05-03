# Stage 17.12 Localization Coverage Report

Status: generated gate target; final status is written by `pnpm stage17:release-gate`.

## Scope

- Embedded Activepieces builder route.
- LexFrame automation wrapper, loading, empty, blocked and error states.
- Activepieces/LexFrame custom pieces used by the MVP flow.
- Visible text, title, aria-label, alt text, placeholders and tooltips.
- First visible paint and route navigation inside the embedded builder.

## Pass Criteria

- User-facing MVP strings are Russian.
- English is allowed only for package names, API enum values, protocol names, slugs, trace ids, model identifiers and version strings.
- Missing AP RU translations fail `stage17:localization:check` unless explicitly allowlisted.
- Known English labels from `scripts/stage17/localization-manifest.json` must be absent before the iframe becomes visible.
- Runtime overlay is fallback only and records count/fingerprint evidence without raw sensitive text.

## Evidence Sources

- `docs/stage17/17.7/localization-coverage-report.md`
- `docs/stage17/17.7/localization-inventory.md`
- `scripts/i18n/check-activepieces-ru-coverage.mjs`
- `scripts/i18n/check-activepieces-pieces-ru.mjs`
- `artifacts/stage17/localization-flicker-evidence.json`
- `tests/e2e/stage17-localization-flicker.spec.ts`
