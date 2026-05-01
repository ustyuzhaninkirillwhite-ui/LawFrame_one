# 17.8 License Decision Log

Status: NO ENTERPRISE COPY
Date: 2026-04-28

## Decision

17.8 uses Activepieces design ideas, token values and component density observed
from MIT-covered web/style sources only. It does not copy, import, bundle or
port enterprise-only code/assets/components.

## Allowed Inputs

- `packages/web/src/styles.css`
- `packages/web/src/styles/globals.css`
- `packages/web/src/components/ui/button.tsx`
- `packages/web/src/components/ui/card.tsx`
- `packages/web/src/components/ui/badge.tsx`
- `packages/web/src/components/providers/theme-provider.tsx`

## Blocked Inputs

- `packages/ee`
- `packages/server/api/src/app/ee`
- enterprise embed/customization source
- commercial-only assets or components

## Evidence

The static gate checks that bridge recipes do not reference enterprise-only
paths. License notices from Activepieces must remain preserved by Stage 17.7 and
17.10 release gates.
