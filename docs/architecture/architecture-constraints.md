# Architecture Constraints

- `CONSTRAINT-001`: frontend never receives Supabase secret/service_role key.
- `CONSTRAINT-002`: frontend never receives Activepieces API key or signing private key.
- `CONSTRAINT-003`: Activepieces flow id is an external reference, not a product id.
- `CONSTRAINT-004`: AI providers are never called directly from browser code.
- `CONSTRAINT-005`: Workflow JSON validates against `LexFrameWorkflow` before persistence.
- `CONSTRAINT-006`: External delivery modules require approval metadata.
- `CONSTRAINT-007`: Product events are privacy-reviewed and exclude raw client payloads.
- `CONSTRAINT-008`: Canvas v2 edits LexFrame Workflow DSL v2; React Flow state and Activepieces JSON are never canonical product state.
- `CONSTRAINT-009`: Canvas publish and runtime sync require backend validation, compile preview, policy gates, and audit.
- `CONSTRAINT-010`: Reverse sync from Activepieces creates a reviewed LexFrame draft or conflict; it never overwrites canonical workflow state directly.
