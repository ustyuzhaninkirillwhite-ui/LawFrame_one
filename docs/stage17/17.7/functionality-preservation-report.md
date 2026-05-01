# Stage 17.7 Functionality Preservation Report

## Preserved Canvas Mechanics

- Builder navigation is not disabled.
- Flow name is not hidden.
- Sidebar, folders, import/export, duplicate flow, flows navbar and page header are not hidden.
- Runs, settings and diagnostics tabs remain in the LexFrame route.
- No CSS or DOM monkey patch is used for localization or debranding.

## Check

Run `corepack pnpm stage17:functionality-preservation`.
