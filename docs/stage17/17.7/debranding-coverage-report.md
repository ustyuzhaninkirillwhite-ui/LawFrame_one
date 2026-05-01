# Stage 17.7 Debranding Coverage Report

## Implemented

- Session response exposes `brand` with Russian white-label strings.
- Frontend wrapper uses `brand.documentTitle` and `brand.ariaLabel`.
- Activepieces theme default website name is `Автоматизация`.
- Activepieces default logo, icon and favicon are local white-label assets.
- Activepieces `ru` translation values have no visible `Activepieces`, `Powered by Activepieces`, `Save`, `Run`, `Publish`, `Connections`, `Runs`, `Settings`, `Error` or `Warning` hits after placeholder stripping.

## Check

Run `corepack pnpm branding:check-visible`.
