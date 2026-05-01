# 17.8 Check Results

Date: 2026-04-28

## Passed

- `corepack pnpm stage17:17.8:check`
  - bridge build
  - bridge token-map validation
  - web typecheck
  - e2e typecheck
  - static 17.8 gate
  - secret scan
- `corepack pnpm --filter @lexframe/web lint`
- `corepack pnpm --filter @lexframe/web build`
  - Next.js production build completed successfully
  - routes generated successfully
- `next start` on `http://127.0.0.1:3001`
  - `/` returned HTTP 200
  - `/app` returned HTTP 200

## Not Run

- `LEXFRAME_STAGE17_17_8_VISUAL=1 corepack pnpm --filter @lexframe/e2e test -- stage17-design-convergence.spec.ts`

Reason: live screenshot/a11y proof requires intentional baseline capture and
review. The spec is present and skips by default to avoid accidental baseline
churn in normal e2e runs.
