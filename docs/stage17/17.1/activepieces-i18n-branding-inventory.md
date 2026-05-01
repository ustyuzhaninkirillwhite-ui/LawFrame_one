# Activepieces i18n and Branding Inventory

Status: PARTIAL / BLOCKED for runtime coverage
Date: 2026-04-28

## Observed Source Surfaces

- Root `package.json` contains i18n scripts:
  - `pull-i18n`
  - `push-i18n`
  - `i18n:extract`
  - `bump-translated-pieces`
- `crowdin.yml` exists at the Activepieces root.
- Codebase Memory found `readLocaleFile` in
  `packages/pieces/framework/src/lib/i18n.ts`.
- Codebase Memory found branding/theme surfaces:
  - `packages/web/src/components/providers/theme-provider.tsx`
  - `packages/server/api/src/app/flags/theme.ts`
  - `packages/web/src/components/custom/full-logo.tsx`
- `ThemeProvider` sets document title, favicon, and CSS primary color variables
  from website branding.
- `FullLogo` renders `branding.logos.fullLogoUrl` with localized logo alt text.

Full filename/path evidence is in
`artifacts/stage17.1/inventories/activepieces-source-files-sanitized.txt`.

## Branding Items To Cover Before PASS

- Logo and full logo URL
- Favicon URL
- Website title / `document.title`
- Wordmark usage
- Alt/aria labels for logos and navigation
- Footer/help/powered-by strings
- Login/onboarding/settings strings
- Any hardcoded `Activepieces`, `activepieces`, or `cloud.activepieces`
  user-facing references

## i18n Items To Cover Before PASS

- RU locale file location and coverage
- Missing RU strings in builder, palette, inspector, connections, runs/debug,
  settings, empty states, and error states
- Piece/action-specific translation files
- Crowdin workflow compatibility with local patches

## Blockers

- Activepieces runtime was not available, so visible RU coverage and debranding
  could not be verified in AP-01..AP-08 screenshots.
- Checkout has no git metadata, so i18n/branding inventory cannot be tied to a
  precise upstream commit.
