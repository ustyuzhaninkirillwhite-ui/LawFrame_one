# Activepieces Design Token Inventory

Status: PARTIAL / BLOCKED for visual baseline
Date: 2026-04-28

## Observed Token Sources

Codebase Memory and file inventory identified these likely token/component
surfaces:

- `packages/server/api/src/app/flags/theme.ts`
- `packages/web/src/components/providers/theme-provider.tsx`
- `packages/web/src/components/ui/badge.tsx`
- `packages/web/src/components/ui/sheet.tsx`
- `packages/web/src/components/custom/full-logo.tsx`
- Additional path/name matches for theme, colors, radius, shadows, cards,
  buttons, dialogs, tabs, toasts, skeletons, and Tailwind surfaces are listed in
  `artifacts/stage17.1/inventories/activepieces-source-files-sanitized.txt`.

## Token Categories Observed

- Color: primary variants, danger, warn, success, selection, avatar,
  blue-link.
- Branding-driven CSS variables: `--primary`, `--primary-100`,
  `--primary-300`.
- Component patterns: badges, sheets, buttons, cards, dialogs, tabs, toasts,
  skeletons, logo containers.
- Runtime theme behavior: light/dark class switching and favicon/title update
  from website branding.

## Mapping Targets For 17.8

- LexFrame color tokens should map AP primary, muted, border, danger, warning,
  success, and selection states into LexFrame status taxonomy.
- LexFrame card/control/dialog radius must be reviewed against AP component
  radius and density. Current LexFrame `Card` uses `panel-surface rounded-[28px]`,
  which is a visible gap to verify during design convergence.
- LexFrame automation/run/status badges should adopt AP-like badge density and
  state language while preserving LexFrame legal domain labels.
- Visual regression must compare LexFrame before/after routes against this AP
  token inventory and confirm AP Canvas layout was not redesigned.

## Blockers

- AP-01..AP-08 screenshots were not captured because Activepieces runtime was
  unavailable.
- Exact color/radius/spacing values remain source-inventory observations until
  AP baseline screenshots and license review are complete.
- Do not copy enterprise-only components/assets as design-token source.
