# Security Checklist

## Token And Secret Boundary

- [ ] Frontend receives only short-lived provisioning JWTs.
- [ ] JWT TTL is clamped to 60-300 seconds.
- [ ] DB stores only token hash/fingerprint and `jti` hash.
- [ ] Browser storage checks prove no token in localStorage, sessionStorage or
  cookies.
- [ ] Logs and audit payloads never contain full JWT values.
- [ ] AP API key, signing private key, provider keys and Supabase service keys
  are server-only.
- [ ] No backend-only secret uses `NEXT_PUBLIC_*`.

## RBAC And Tenant Boundary

- [ ] Every session starts with LexFrame auth and workspace context.
- [ ] `workspace_id` in body must match the active workspace context.
- [ ] Cross-workspace automation ids are denied before AP is contacted.
- [ ] AP role never exceeds LexFrame permission.
- [ ] Viewer cannot receive EDITOR/ADMIN.
- [ ] AP project is not treated as LexFrame tenant boundary.

## Pieces Policy

- [ ] MVP uses `piecesFilterType=ALLOWED`.
- [ ] Direct external AI provider pieces are hidden/blocked.
- [ ] Unrestricted HTTP, database CRUD, unsafe storage admin and code steps are
  blocked unless explicitly approved later.
- [ ] AP custom AI piece calls LexFrame AI Gateway with scoped runtime token.
- [ ] End users are not asked to enter provider API keys.

## Browser And Runtime Evidence

- [ ] AP login page is not reachable through the MVP route.
- [ ] `/automation-runtime/*` loads assets/API/WebSockets without 404 or CSP
  blocks.
- [ ] AP logs do not contain provider keys or raw confidential payloads.
- [ ] Snapshot redaction removes secrets before diagnostics/audit display.

## Stop-List

- Do not move canonical automation state to AP DB.
- Do not copy/import Activepieces enterprise-only code or assets without legal
  sign-off.
- Do not redesign AP Canvas layout/functions during 17.2.
- Do not hardcode real secrets in code, docs, migrations, seeds, examples,
  Dockerfiles, images or screenshots.
