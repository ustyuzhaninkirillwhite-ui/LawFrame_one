# Activepieces Session Security Checklist

| Check | Expected | Evidence |
| --- | --- | --- |
| Session endpoint requires LexFrame auth/workspace | request goes through backend auth context | existing controller guards and E2E auth helpers |
| `purpose` must be `automation_canvas` | other purposes rejected | controller parser |
| Client cannot send server-controlled fields | denylist returns `INVALID_CLIENT_FIELD` | `automation-activepieces-session-security.spec.ts` |
| JWT signed with RS256 and `kid` | no dev fallback token | `activepieces-jwt-signer.spec.ts` |
| JWT TTL is short | max 300 seconds by workspace policy | session service and E2E payload assertion |
| Role comes from backend mapper | no client role upgrade | role mapper/session service specs |
| Pieces policy comes from backend | allowlist/tags/hash in safe DTO | pieces policy/session specs |
| DTO contains no AP API key/private signing key/provider key | only embed JWT is returned | E2E session scan and wrapper unit |
| Raw JWT/key not written to audit | sensitive metadata redacted | `activepieces-audit-writer.spec.ts` |
| Browser storage cleanup outside automation family | no stale AP JWT after leaving route family | `automation-route-cache-cleanup.spec.ts` |
| AP unavailable is controlled | no infinite spinner or raw AP login | route/wrapper tests and E2E controlled state |
