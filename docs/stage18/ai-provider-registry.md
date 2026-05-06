# Stage 18 AI Provider Registry

LexFrame owns provider routing in backend config/DB seed, not frontend or Activepieces flow JSON.

- Default provider connection: `owner_default_ai`
- Provider code: `cometapi`
- Base URL placeholder: `https://api.cometapi.com/v1`
- API key material: server-only env fallback or Local Owner Key Vault by `apiKeyRef`; raw values are never serialized.
- Reference influence: LibreChat custom endpoints and AnythingLLM provider separation were used as clean-room architecture patterns only.
