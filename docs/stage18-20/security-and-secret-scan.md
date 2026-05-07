# Stage 18-20 Security and Secret Scan

Security gate: PASS

- Browser/provider/runtime secret scans are logged under `artifacts/stage18-20/audit/command-logs`.
- Docs/artifacts scan excludes binary media and must remain clean before ACCEPT.
- Provider keys, service role keys, AP/MCP credentials, JWTs, signed URLs and private keys are redacted by the audit harness.
