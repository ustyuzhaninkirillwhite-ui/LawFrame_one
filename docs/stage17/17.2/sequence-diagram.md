# Stage 17.2 Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Web as LexFrame Web
  participant Backend as LexFrame Backend
  participant DB as LexFrame DB
  participant AP as Activepieces App
  participant Worker as Activepieces Worker

  User->>Web: Click "Автоматизация"
  Web->>Web: Open /app/projects/:projectId/automations/:automationId/automation
  Web->>Backend: POST /activepieces/session
  Backend->>Backend: Auth, workspace, RBAC, feature and license gates
  Backend->>DB: Load automation and existing runtime bindings
  Backend->>AP: Ensure project/user/flow if runtime is available
  AP-->>Backend: Read-back AP ids
  Backend->>DB: Upsert bindings and token hash only
  Backend->>DB: Audit activepieces.session.requested/issued
  Backend-->>Web: Ready response with short-lived JWT
  Web->>Web: Store JWT in memory only
  Web->>AP: Mount builder under /automation-runtime/*
  AP->>Worker: Execute builder/runtime operations
  Worker->>Backend: Runtime callbacks with scoped token
  Backend->>DB: Normalize run events, snapshots and audit
```

## Failure Branches

- Workspace/RBAC failure returns a LexFrame permission error; AP is never
  opened.
- License/provisioning gate unresolved returns structured unavailable.
- AP unavailable returns `ACTIVEPIECES_RUNTIME_UNAVAILABLE`; frontend shows
  LexFrame unavailable state, not AP login.
- Token expiry triggers a fresh backend session request; frontend never redirects
  to AP auth pages.
