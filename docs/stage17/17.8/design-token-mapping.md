# 17.8 Design Token Mapping

Status: IMPLEMENTED
Date: 2026-04-28

## Source

Activepieces source root: `E:/activepieces-main`

Observed source state:

- `activepieces@0.82.0`
- package manager: `bun@1.3.3`
- git metadata unavailable in local checkout
- allowed source zones: `packages/web/src/styles.css`, `packages/web/src/styles/globals.css`, `packages/web/src/components/ui/*`
- forbidden source zones: `packages/ee`, `packages/server/api/src/app/ee`

## Delivery

The stable LexFrame-facing bridge is implemented in
`packages/design-system-activepieces-bridge`.

Public interfaces:

- `@lexframe/design-system-activepieces-bridge/css/activepieces-theme.css`
- `@lexframe/design-system-activepieces-bridge/css/activepieces-theme.dark.css`
- `@lexframe/design-system-activepieces-bridge/tailwind`
- `@lexframe/design-system-activepieces-bridge/recipes`
- `@lexframe/design-system-activepieces-bridge/tokens`

## Stable Mapping

Required token groups are present:

- colors: app/card/panel/muted surfaces, foreground, muted text, primary, success, warning, destructive, info
- radius: control, card, panel, badge
- border/focus: default, input, selected, ring
- shadows: card, panel, popover
- spacing: page, panel, control, navigation item
- typography: sans stack, body, heading, metadata, diagnostics
- component states: hover, active, selected, disabled, skeleton, error, empty
- recipes: buttons, badges, cards, forms, navigation, panels, tables, overlays, tabs, skeletons

The TypeScript map lives in
`packages/design-system-activepieces-bridge/src/tokens/lexframe-to-activepieces.map.ts`.

## Adoption

LexFrame web imports the bridge CSS from `apps/web/src/app/globals.css` and maps
legacy variables such as `--background`, `--panel`, `--line`, `--accent`,
`--danger` and `--success` to `--lf-*` bridge variables.

Base UI wrappers now consume bridge recipes:

- Button
- Badge
- Card
- Input
- Textarea
- Separator
- Select
- Table
- Skeleton
- Tabs
- Dialog
- Sheet
- Dropdown
- Tooltip
- Toast
