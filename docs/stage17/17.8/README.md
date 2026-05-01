# Stage 17.8 Design Convergence

Status: IMPLEMENTED / LIVE VISUAL EVIDENCE PENDING
Date: 2026-04-28

17.8 introduces a LexFrame-owned Activepieces design bridge:

- `packages/design-system-activepieces-bridge`
- stable LexFrame-facing CSS variables
- Tailwind preset export
- component recipes for base UI wrappers
- route shell adoption through AppShell, PageShell, sidebar surfaces, project home and Canvas wrapper

The Activepieces Canvas remains stock-like. This work does not move, hide or
replace Activepieces builder controls, inspector, palette, connections,
runs/debug, settings or builder mechanics.

## Gates

- Static gate: `corepack pnpm stage17:17.8:gate`
- Bridge package tests: `corepack pnpm --filter @lexframe/design-system-activepieces-bridge test`
- Web typecheck: `corepack pnpm --filter @lexframe/web typecheck`
- Optional live visual/a11y gate: `LEXFRAME_STAGE17_17_8_VISUAL=1 corepack pnpm --filter @lexframe/e2e test -- stage17-design-convergence.spec.ts`
