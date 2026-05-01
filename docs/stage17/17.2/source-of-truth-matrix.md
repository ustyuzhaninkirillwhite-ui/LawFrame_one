# Source Of Truth Matrix

| Domain | Canonical owner | Activepieces role | Rule |
| --- | --- | --- | --- |
| Workspace / tenant boundary | LexFrame DB | Runtime projection id | AP project is not a tenant boundary. |
| User identity | LexFrame identity/RBAC | External AP user id | AP role cannot exceed LexFrame permission. |
| Automation product record | LexFrame DB | AP flow reference | AP flow id is an external runtime reference. |
| Canvas / DSL | LexFrame Canvas/DSL | Builder projection/snapshot | Reverse import requires diff, policy validation and confirmation. |
| Flow version | LexFrame versioning | AP flow version id | AP version id is read-back evidence. |
| Run state | LexFrame runs | AP worker/run events | AP events are normalized into LexFrame run state. |
| Approval state | LexFrame approvals | AP step callback | AP cannot approve or bypass LexFrame approval policy. |
| Documents/artifacts | LexFrame documents | Runtime artifact callback | AP stores no canonical document record. |
| Audit | LexFrame audit | Event source | AP logs are diagnostic, not audit source of truth. |
| Provider/API secrets | LexFrame backend/secret layer | No direct access | AP pieces call LexFrame runtime endpoints with scoped tokens. |
| Pieces policy | LexFrame security policy | Allowed AP tags/list | Direct provider AI, unrestricted HTTP/database/code pieces are blocked by default. |
| License/edition decision | LexFrame owners | Gate input | Paid AP features cannot be assumed available. |

## Table Policy

Use existing Stage 4/16 runtime tables:

- `app.activepieces_project_bindings`
- `app.activepieces_user_bindings`
- `app.activepieces_embed_sessions`
- `app.automation_runtime_bindings`
- `app.activepieces_flow_snapshots`

Do not introduce a duplicate `activepieces_flow_bindings` table. If Stage 17
needs more metadata, extend `app.automation_runtime_bindings` and related
session/snapshot tables.
