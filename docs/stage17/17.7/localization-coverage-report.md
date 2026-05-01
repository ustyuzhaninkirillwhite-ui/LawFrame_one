# Stage 17.7 Localization Coverage Report

## Current Static Coverage

- Activepieces base keys: `1503`
- Activepieces `ru` keys: `1503`
- Missing keys: `0`
- Empty values: `0`
- Extra keys: `0`
- Forbidden visible terms in translated values: `0`
- Playwright fallback hits: `0` static placeholder until integrated E2E is run

## Implemented Gates

- `corepack pnpm i18n:check-activepieces-ru`
- `corepack pnpm pieces:i18n:check -- --locale ru`

## Runtime Locale Decision

`resolveActivepiecesLocale()` returns `ru` and is used by the global i18n bootstrap and embed route.
