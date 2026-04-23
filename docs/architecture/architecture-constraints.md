# Architecture Constraints

- `CONSTRAINT-001`: frontend never receives Supabase secret/service_role key.
- `CONSTRAINT-002`: frontend never receives Activepieces API key or signing private key.
- `CONSTRAINT-003`: Activepieces flow id is an external reference, not a product id.
- `CONSTRAINT-004`: AI providers are never called directly from browser code.
- `CONSTRAINT-005`: Workflow JSON validates against `LexFrameWorkflow` before persistence.
- `CONSTRAINT-006`: External delivery modules require approval metadata.
- `CONSTRAINT-007`: Product events are privacy-reviewed and exclude raw client payloads.

