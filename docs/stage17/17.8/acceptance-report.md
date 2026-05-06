# 17.8 Acceptance Report

Status: IMPLEMENTED / LIGHT DEFAULT UPDATED / NOT FORMALLY PASSED
Date: 2026-05-06

## Completed

- `packages/design-system-activepieces-bridge` exists and exports tokens,
  recipes, CSS and Tailwind preset.
- Web app imports bridge CSS and maps legacy LexFrame CSS variables to stable
  `--lf-*` aliases.
- Base UI wrappers consume bridge recipes.
- AppShell, PageShell, navigation/sidebar surfaces, project home and
  Activepieces Canvas wrapper have AP-like token adoption.
- LexFrame now defaults to the light bridge theme, keeps a persisted light/dark
  toggle, and passes the selected mode into the Activepieces embed SDK.
- Static gate script exists: `scripts/stage17-design-convergence-gate.mjs`.
- Activepieces Canvas internals were not edited as part of 17.8.
- No enterprise-only Activepieces code or assets were copied into the bridge.

## Checks Run In This Handoff

- `corepack pnpm stage17:17.8:check` - PASS
- `corepack pnpm --filter @lexframe/web lint` - PASS
- `corepack pnpm --filter @lexframe/web build` - PASS
- `http://127.0.0.1:3001/` - HTTP 200 from `next start`
- `http://127.0.0.1:3001/app` - HTTP 200 from `next start`

## Formal PASS Blockers

- Live visual screenshots are not captured in this handoff.
- Live axe/keyboard pass is not captured in this handoff.
- Activepieces Canvas locator/control regression must be run in the integrated
  environment before release acceptance.

## Required PASS Commands

```bash
corepack pnpm stage17:17.8:gate
corepack pnpm --filter @lexframe/design-system-activepieces-bridge test
corepack pnpm --filter @lexframe/web typecheck
LEXFRAME_STAGE17_17_8_VISUAL=1 corepack pnpm --filter @lexframe/e2e test -- stage17-design-convergence.spec.ts
```
