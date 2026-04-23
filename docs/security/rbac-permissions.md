# RBAC And Permissions

## Roles

- `owner`
- `admin`
- `lawyer`
- `assistant`
- `viewer`
- `security_admin`
- `billing_admin`

## Core Permissions

- Workspace: `workspace.read`, `workspace.manage`, `workspace.members.manage`
- Profiles: `profile.read`, `profile.manage`
- Documents: `document.read`, `document.upload`, `document.generate`
- Automations: `automation.read`, `automation.install`, `automation.edit`, `automation.publish`, `automation.run`
- Runtime: `activepieces.open_builder`, `activepieces.sync_flow`
- Governance: `recommendation.read`, `recommendation.accept`, `audit.read`, `admin.security.read`, `admin.security.manage`

## Stage 0 Rules

- `automation.publish` implies moderation and audit readiness.
- `activepieces.open_builder` never bypasses workspace context.
- `security_admin` can inspect gates and inventory, but not silently bypass approval rules.

