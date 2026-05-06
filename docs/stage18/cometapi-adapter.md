# Stage 18 CometAPI Adapter

CometAPI is implemented as an OpenAI-compatible provider adapter inside LexFrame AI Gateway.

- Endpoint comes from `LEXFRAME_COMETAPI_BASE_URL` and is used only by the adapter.
- Default model is `deepseek-v4-flash` through route registry.
- Adapter supports JSON mode, tool-call request mapping, usage normalization, timeout and transient retry.
- Request payload never carries raw provider key from frontend or Activepieces.
- Artifacts may contain provider/model/fingerprint metadata, never raw key values.
