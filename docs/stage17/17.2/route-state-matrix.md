# Activepieces Canvas Route State Matrix

Primary route:

```text
/app/projects/:projectId/automations/:automationId/automation
```

Legacy/fallback route:

```text
/automations/:id/builder -> /app/projects/project_claim_001/automations/:id/canvas
```

## Tabs

- `Activepieces Canvas` - primary Stage 17 editor surface.
- `LexFrame Canvas (резерв)` - existing Canvas fallback/experimental route.
- `Запуски` - run state and reconciliation.
- `Настройки` - automation/runtime settings.
- `Диагностика` - session, proxy, CSP, WebSocket and binding diagnostics.

## States

| State | Trigger | UI behavior | Backend/audit |
| --- | --- | --- | --- |
| Auth loading | Session provider pending | LexFrame skeleton | No AP call. |
| Readiness loading | Route mounted | Runtime status panel pending | `activepieces.session.requested`. |
| Token issuing | Session POST in flight | Builder placeholder | Token not persisted. |
| Ready | Session response ready | Mount iframe/SDK under `/automation-runtime/*` | `activepieces.session.issued`. |
| Permission denied | 403 / missing permission | LexFrame access-denied state | No AP mount. |
| AP unavailable | Runtime health blocked | `BuilderUnavailableState` | Diagnostics ref recorded. |
| Binding broken | ensure/read-back failed | Repair guidance in diagnostics tab | `ACTIVEPIECES_BINDING_BROKEN`. |
| Token expired | Embed token expired | Request new session | No AP login page. |
| Proxy misconfigured | Asset/API rewrite failure | Diagnostics tab and retry | Browser evidence required. |
| CSP blocked | Browser blocks frame/script/connect | Diagnostics tab | Browser evidence required. |
| WebSocket failed | Upgrade/connect-src failure | Degraded runtime warning | Browser evidence required. |
| Local keys missing | AI route needs owner key | Canvas may open; AI test/run blocked as needed | No provider key prompt to end user. |

## Storage Rule

The provisioning JWT lives only in React memory state. It must not be written to
localStorage, sessionStorage, cookies, URLs, logs or audit payloads.
