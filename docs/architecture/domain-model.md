# Domain Model

```mermaid
erDiagram
    users ||--o{ workspace_members : joins
    workspaces ||--o{ workspace_members : contains
    workspaces ||--o{ profiles : owns
    workspaces ||--o{ automation_templates : publishes
    workspaces ||--o{ installed_automations : installs
    installed_automations ||--o{ installed_automation_versions : versions
    installed_automation_versions ||--o{ activepieces_flow_mappings : compiled_to
    workspaces ||--o{ documents : stores
    installed_automation_versions ||--o{ workflow_runs : executes
    workflow_runs ||--o{ run_steps : contains
    workspaces ||--o{ recommendations : receives
    workspaces ||--o{ publication_requests : requests
    workspaces ||--o{ audit_events : emits
```

## Notes

- Profiles are relational first. JSONB is reserved for versioned metadata and schemas.
- Installed automation version is the bridge between product contract and runtime compilation.
- Recommendation remains separate from installed automation until user acceptance.

