# Stage 17.10 Design Token Mapping

Status: root artifact for 17.10; detailed mapping lives in Stage 17.8 evidence.

## Source

- Activepieces token inventory: `docs/stage17/17.1/activepieces-design-token-inventory.md`.
- LexFrame target mapping: `docs/stage17/17.8/design-token-mapping.md`.
- Bridge package: `packages/design-system-activepieces-bridge`.

## Required Mapping Areas

- Color: background, panel, card, border, muted, primary, success, warning, danger.
- Radius: card, control, panel.
- Spacing and density: AppShell, cards, tabs, forms and diagnostics panels.
- Typography: display/body/mono choices and status label scale.
- Component recipes: Button, Card, Badge, Input, Textarea and migrated UI primitives.

## Gate

`pnpm stage17:visual:regression` must prove LexFrame surfaces are AP-like while AP Canvas layout remains stock-like.
