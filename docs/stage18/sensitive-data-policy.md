# Stage 18 Sensitive Data Policy

- `public` and `internal` may use default external route unless workspace policy forbids it.
- `confidential`, `personal_data`, and `client_material` require redaction, reference-only context, summary mode, or explicit workspace policy.
- `legal_secret` is blocked from external provider by default.
- Secrets, signed URLs, provider keys, service tokens, scoped runtime tokens, AP JWTs and Local Owner Key Vault values are never sent to a model.
