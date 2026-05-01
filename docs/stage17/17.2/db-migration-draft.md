# DB Migration Draft

Stage 17.2 reuses existing Stage 4/16 tables and extends them only where needed.

## Existing Tables To Reuse

- `app.activepieces_project_bindings`
- `app.activepieces_user_bindings`
- `app.activepieces_embed_sessions`
- `app.automation_runtime_bindings`
- `app.activepieces_flow_snapshots`

## New Table

`app.activepieces_runtime_instances` records runtime contour metadata:

- environment
- base URL and public URL
- API/signing secret refs
- edition/license gate status
- health status and last health check time

## Extensions

The Stage 17.2 migration may add:

- project binding read-back metadata and runtime instance reference.
- user binding AP user id and last-login timestamp.
- embed session role, pieces policy, trace id, mode and reason code.
- runtime binding read-back timestamp, AP flow version metadata and session
  trace.

## Explicit Non-Decision

Do not create `app.activepieces_flow_bindings`. The existing
`app.automation_runtime_bindings` table is the flow-binding table for LexFrame
automations.
