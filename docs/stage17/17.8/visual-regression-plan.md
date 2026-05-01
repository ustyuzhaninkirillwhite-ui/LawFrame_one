# 17.8 Visual Regression Plan

Status: TEST HOOKS ADDED / LIVE CAPTURE PENDING
Date: 2026-04-28

## Required Routes

- `/app`
- `/app/projects/project_claim_001`
- `/app/projects/project_claim_001/automations`
- `/app/projects/project_claim_001/automations/automation_claim_review`
- `/app/projects/project_claim_001/chats/chat_project_claim_001`
- `/documents`
- `/app/runs/run_project_claim`
- `/admin/security/activepieces`

## Required Checks

- LexFrame AppShell uses AP-like density and token bridge.
- Cards, badges, buttons, forms and panels use bridge recipes.
- Activepieces Canvas wrapper is visually integrated but the internal Canvas is
  not redesigned.
- No user-facing design convergence code exposes secrets.

## Command

```bash
LEXFRAME_STAGE17_17_8_VISUAL=1 corepack pnpm --filter @lexframe/e2e test -- stage17-design-convergence.spec.ts
```

Live screenshots should be copied into `docs/evidence/stage17/17.8/screenshots/`
before marking this stage PASS.
