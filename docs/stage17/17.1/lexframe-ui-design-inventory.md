# LexFrame UI Design Inventory

Status: PARTIAL / BLOCKED for protected-route visual baseline
Date: 2026-04-28

## Observed UI Surfaces

Codebase Memory found these current UI surfaces:

- `AppShell`: `apps/web/src/components/app-shell.tsx`
- `NavSidebar`: `apps/web/src/components/nav-sidebar.tsx`
- `WorkspaceSwitcher`: `apps/web/src/components/workspace-switcher.tsx`
- `Card`: `apps/web/src/components/ui/card.tsx`
- `Badge`: `apps/web/src/components/ui/badge.tsx`
- `RunTimeline`: `apps/web/src/components/run-timeline.tsx`
- `DocumentPicker`: `apps/web/src/components/document-picker.tsx`
- `ProcessingStatusCard`: `apps/web/src/components/processing-status-card.tsx`

Path-level evidence is in
`artifacts/stage17.1/inventories/lexframe-ui-design-sanitized.txt`.

## Route Baseline Targets

- LF-01 AppShell / workspace home
- LF-02 Project home
- LF-03 Automations list
- LF-04 Automation detail
- LF-05 Chat
- LF-06 Documents UI
- LF-07 Run center
- LF-08 Admin integrations
- LF-09 Forms/settings
- LF-10 Error/empty/loading states

PNG and metadata attempts are in
`artifacts/stage17.1/screenshots/lexframe/`.

## Screenshot Result

LexFrame services were listening on local ports `3000`, `3100`, and `8080`.
However, a fresh Playwright context received HTTP 500 from
`POST /auth/bootstrap` during demo sign-in. Most protected route captures
therefore redirected to `/sign-in`, and the route choices for LF-07/LF-09
produced 404 pages in this unauthenticated context.

The current PNGs are useful evidence for sign-in/auth/error state at commit
`ec145113ad4fdeba40a7826a4122032b8f52e9d3`, but they do not satisfy the full
LF-01..LF-10 protected-route baseline requirement for PASS.

## Design Gaps To Carry Into 17.8

- LexFrame cards currently use large rounded surfaces and should be mapped
  against AP component radius/density.
- AppShell/sidebar density, active route marker, workspace switcher, user menu,
  forms, dialogs, tables, badges, loading/empty/error states, and focus rings
  must be reviewed route-by-route.
- LexFrame legal labels, RBAC, audit, AI gateway, documents, approvals, and
  source-of-truth model must remain LexFrame-specific.
