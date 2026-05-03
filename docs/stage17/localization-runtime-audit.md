# Stage 17.12 Localization Runtime Audit

## Current Mechanisms

- AP source has `packages/web/src/lib/lexframe-locale-resolver.ts`, returning Russian locale.
- AP `packages/web/src/i18n.ts` initializes i18next with forced `lng` and `fallbackLng`.
- AP `packages/web/src/main.tsx` imports `./i18n` before mounting `App`.
- `scripts/stage17/patch-activepieces-runtime.mjs` copies patched `ru` and `en` translation bundles into AP containers.
- LexFrame wrapper sets localStorage locale keys and passes `locale: "ru"` to embed SDK.
- Runtime DOM overlay remains only as fallback for hardcoded/stale strings and now records count/fingerprints only.

## Stage 17.12 Decision

Known strings must be localized bundle-first before user-visible render. The wrapper keeps the iframe covered until configure/auth/locale/init complete and a first visible-paint check has sampled the iframe document. If known English is detected, fallback overlay runs before the shell is removed.

## Non-Translated Technical Surfaces

Package names, slugs, npm package names, action IDs, trigger IDs, connection keys, JSON schema fields, API route names, technical error codes, audit event codes and runtime binding identifiers remain unchanged.
