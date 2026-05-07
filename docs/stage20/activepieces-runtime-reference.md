# Activepieces Runtime Reference

Reference check: local Activepieces was reviewed for flows, drafts, versions, app connections, human input, MCP and audit-log concepts.

Applied conclusion: Stage 20 uses existing LexFrame runtime/compiler boundaries and returns `runtime_creation_unavailable` when AP/MCP is not configured. Activepieces remains runtime projection only.

Prohibited: AP API keys, signing keys, JWT secrets, encryption keys, MCP credentials and scoped runtime token values are not exposed to browser/docs/artifacts.
