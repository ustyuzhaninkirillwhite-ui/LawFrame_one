# Activepieces Session Contract

## Route

Architecture route:

```http
POST /api/activepieces/session
```

Current Nest route:

```http
POST /activepieces/session
```

`/api` is reserved for edge/proxy mounting and must not be duplicated inside the
current Nest controller unless the app adopts a global prefix.

## Request

Headers:

- `Authorization: Bearer <lexframe_access_token>`
- `X-Workspace-Id: <workspace_id>`
- `X-Client-Trace-Id: <trace_id>` optional

Wire body uses snake_case:

```json
{
  "workspace_id": "uuid-or-stable-id",
  "project_id": "project_claim_001",
  "automation_id": "uuid",
  "purpose": "automation_canvas",
  "preferred_mode": "auto"
}
```

`preferred_mode` is `auto`, `iframe_embed` or `reverse_proxy`.

## Ready Response

```json
{
  "status": "ready",
  "mode": "iframe_embed",
  "instance_url": "http://localhost:3100/automation-runtime",
  "builder_url": "http://localhost:3100/automation-runtime/flows/flow_01",
  "jwt_token": "short-lived-provisioning-jwt",
  "expires_at": "2026-04-28T14:05:00.000Z",
  "locale": "ru",
  "brand_display_name": "Автоматизация",
  "role": "EDITOR",
  "design_system": "activepieces_like",
  "flow_binding": {
    "automation_id": "uuid",
    "activepieces_project_id": "proj_01",
    "activepieces_flow_id": "flow_01",
    "activepieces_flow_version_id": null,
    "sync_status": "synced"
  },
  "runtime_status": {
    "ap_app": "ok",
    "ap_worker": "unknown",
    "ap_db": "unknown",
    "redis": "unknown"
  }
}
```

## Error Taxonomy

Structured backend errors use the normal LexFrame error envelope. Stage 17.2
codes include:

- `ACTIVEPIECES_FEATURE_DISABLED`
- `ACTIVEPIECES_RUNTIME_UNAVAILABLE`
- `ACTIVEPIECES_WORKER_UNAVAILABLE`
- `ACTIVEPIECES_SIGNING_KEY_MISSING`
- `ACTIVEPIECES_LICENSE_GATE_UNRESOLVED`
- `ACTIVEPIECES_BINDING_BROKEN`
- `ACTIVEPIECES_FLOW_READBACK_FAILED`
- `ACTIVEPIECES_PROXY_MISCONFIGURED`
- `ACTIVEPIECES_WEBSOCKET_BLOCKED`
- `ACTIVEPIECES_CSP_BLOCKED`
- `ACTIVEPIECES_TOKEN_EXPIRED`
- `ACTIVEPIECES_TOKEN_ISSUE_FAILED`
- `WORKSPACE_ACCESS_DENIED`
- `AUTOMATION_ACCESS_DENIED`
- `PIECES_POLICY_EMPTY`
- `LOCAL_OWNER_KEYS_MISSING`
- `AI_LOCAL_KEY_UNAVAILABLE`

## Token Policy

- JWT TTL is 60-300 seconds.
- JWT is stored only in frontend memory state.
- DB stores token hash or fingerprint only.
- Logs, audit payloads, URLs, localStorage, sessionStorage and cookies must not
  contain the full token.
