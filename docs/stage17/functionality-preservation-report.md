# Stage 17.10 Functionality Preservation Report

Status: generated gate target; final status is written by `pnpm stage17:release-gate`.

## Protected Activepieces Functions

- Builder canvas and step layout.
- Palette and allowed pieces/actions.
- Inspector and step settings.
- Connections.
- Runs/debug.
- Settings.
- Import/export and duplicate controls when allowed by RBAC/policy.

## Pass Criteria

- Debranding changes asset/text only.
- Design convergence changes LexFrame shell and wrapper surfaces, not AP builder mechanics.
- AP controls are not hidden with CSS or embed config flags to make tests pass.

## Evidence Sources

- `docs/stage17/17.7/functionality-preservation-report.md`
- `docs/stage17/17.8/canvas-stock-like-proof.md`
- `scripts/stage17-functionality-preservation.mjs`
