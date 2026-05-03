# Stage 17.12 Localization Flicker Hardening

## Goal

Embedded Activepieces Canvas should open in Russian without a visible English-to-Russian text replacement for known strings.

## Implementation

- `scripts/stage17/localization-manifest.json` defines known forbidden user-facing English strings.
- AP locale resolver and i18next config force `ru` before React app mount.
- Runtime patch copies `ru` bundle and mirrors it over `en` as a local MVP safety net.
- LexFrame wrapper waits for the embedded document, samples visible text/labels/titles/placeholders, and keeps the loading shell until known English strings are absent.
- DOM overlay is fallback only. It records invocation count and fingerprints, never raw user content or secrets.

## Evidence

- Machine-readable evidence: `artifacts/stage17/localization-flicker-evidence.json`
- E2E spec: `tests/e2e/stage17-localization-flicker.spec.ts`
- Static gate: `pnpm stage17:localization:check`

## Acceptance

- Known strings are covered bundle-first.
- Overlay count is expected to be `0` for covered strings.
- Navigation through builder/palette/inspector/runs/connections must not expose transient known English labels.
