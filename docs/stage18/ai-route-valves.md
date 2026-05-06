# Stage 18 AI Route Valves

Route valves are typed backend/admin metadata, not user-facing model settings.

`temperature`, `max_output_tokens`, `json_mode_enabled`, `tool_calling_enabled`, `context_budget_tokens`, `redaction_required`, `allow_external_provider_for_client_material`, `timeout_ms`, and `retry_count` are seeded for each route.

Secret valve values must be represented as `secret_ref`; no raw secret value is allowed in diagnostics, audit, artifacts or stream events.
