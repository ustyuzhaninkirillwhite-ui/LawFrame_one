# Backend Contract DB Security Coverage Matrix

Date: 2026-05-13

| Direction | Coverage Status | Evidence | Remaining Gap |
| --- | --- | --- | --- |
| Identity/session context | Partial direct | `identity.service.spec.ts` | Add multi-workspace integration fixture with real permission rows. |
| Workspace/RBAC/permissions | Improved direct | `workspaces.service.spec.ts`, `authorization.service.spec.ts`, `permission.guard.spec.ts` | Add controller-level forbidden/audit event tests. |
| Stage15 project isolation | Partial direct | `stage15-projects.service.spec.ts`, `project-web-search.service.spec.ts` | Add explicit cross-workspace project detail test if not covered by service fixture. |
| Settings/profile/org | Partial direct | `settings.service.ts` coverage through service tests and controller guards | Add `settings.controller.spec.ts` for parser and request metadata. |
| AI settings secrets/SSRF | Direct | `ai-settings.service.spec.ts`, `ai-secret.service.spec.ts`, `ai-base-url-ssrf.guard.spec.ts` | Add negative model-id/provider-template fixtures if schema expands. |
| AI Gateway/provider isolation | Direct | `ai-provider.adapters.spec.ts`, `ai-gateway.service.spec.ts`, `ai-route-group-resolver.service.spec.ts`, `packages/ai-gateway/src/route-assets.test.ts` | Add malformed SSE parser table tests if parser is extracted. |
| Chat persistence/stream lifecycle | Direct | `chat-thread.service.spec.ts`, `chat-stream.service.spec.ts` | Add controller-level retry/regenerate branch API tests. |
| Documents/upload/storage | Direct | `documents.service.spec.ts` | Add `documents.controller.spec.ts` for request parsing edge cases. |
| Legal sources/search/RAG | Partial indirect | `stage6_legal_search.sql`, `project-web-search.service.spec.ts`, `project-knowledge.service.spec.ts` | Add direct specs for `legal-sources`, `legal-search`, `legal-rag`, `legal-indexing`. |
| Automation/run backend | Improved direct | `run-preflight.service.spec.ts`, `delivery.service.spec.ts`, canvas/Activepieces tests | Add direct `run-command.service.spec.ts` for `RUN_PREFLIGHT_BLOCKED` and idempotency. |
| Activepieces session/security | Direct | `activepieces-session.service.spec.ts`, `activepieces-jwt-signer.spec.ts`, role mapper and pieces policy specs | Add controller callback auth tests. |
| Contracts/schemas | Improved direct | `validate:*` scripts, workflow/workflow-dsl tests, `packages/contracts/src/security-invariants.test.ts` | Add negative fixture suite under `packages/contracts/src`. |
| API client contracts | Improved direct | `packages/api-client/src/settings-client.test.ts`, `check:contract-security-invariants` | Add response shape tests for chat/documents/runs clients. |
| DB migrations/RLS | Script/pgTAP | `check:db`, `supabase/tests/pgtap/*.sql` | Run against a live local Supabase/Postgres profile in CI. |
| Audit redaction | Improved static + unit | `settings-redactor.spec.ts`, `canvas-ai-redaction.service.spec.ts`, `check:audit-redaction` | Add audit event snapshot tests for forbidden access paths. |
| Secret scans | Direct static | `secret-scan`, `validate:web-bundle-secrets`, `check-db-secret-like-values` | Keep allowlists minimal; add signed URL fixture regression if one is found. |
