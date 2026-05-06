# Stage 18 Piece AI Gateway

`@lexframe/piece-ai-gateway` is a LexFrame runtime client, not an AI provider client.

Allowed payload:

```json
{"route":"agent_general","task":"analyze_case_materials","input_refs":[{"type":"document_version","id":"docv_redacted"}],"output_schema":"lexframe.ai.legal_analysis.v1"}
```

Forbidden payload fields: `apiKey`, `api_key`, `provider`, `model`, `baseUrl`, `prompt`.
