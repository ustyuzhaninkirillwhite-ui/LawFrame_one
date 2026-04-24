# Activepieces Feature Parity Blueprint

This document records the implementation target for bringing the available
Activepieces feature set into LexFrame while preserving LexFrame as the system
of record for product data.

## Executive Conclusion

- Full feature parity is feasible through a combination of embedded
  Activepieces, backend API bridge, MIT code reuse, selective fork/adaptation,
  native LexFrame reimplementation, wrappers, and catalog ingestion.
- Full direct code migration is not feasible or desirable. Activepieces runtime,
  pieces, shared flow operations, and most web code are MIT, but embedding,
  managed auth, signing keys, global connections, secret managers, platform
  admin, SCIM, billing, and several platform controls live behind the
  Enterprise license boundary.
- Activepieces must remain the technical automation layer. LexFrame remains the
  canonical owner of users, workspaces, projects, profiles, documents,
  automation templates, installed automations, automation versions, workflow
  runs, run artifacts, permissions, publications, recommendations, and audit
  events.

## Verified Activepieces Repository Map

| Area | Repo paths | Purpose | LexFrame adoption |
|---|---|---|---|
| Root monorepo | `E:\activepieces-main\package.json`, `turbo.json` | Bun 1.3.3 and Turbo workspace orchestration | Inventory input only |
| Web app | `packages/web/src/app/**`, `packages/web/src/features/**` | React builder, templates, connections, admin UI | Embed first, fork/adapt optional, native parity later |
| API server | `packages/server/api/src/app/**` | Fastify REST API, DB, flows, pieces, templates, users, platform | Backend bridge and selective MIT reuse |
| Worker | `packages/server/worker/src/**` | Socket/RPC worker, queue polling, sandbox manager, egress controls | Self-hosted runtime |
| Engine | `packages/server/engine/src/**` | Flow execution, piece execution, SSRF guard, variables | Self-hosted runtime and compatibility tests |
| Shared model | `packages/shared/src/lib/automation/**`, `packages/shared/src/lib/management/**` | Flow schema, operations, run model, template model | Direct MIT reuse concepts in compiler |
| Pieces | `packages/pieces/framework/**`, `packages/pieces/core/**`, `packages/pieces/community/**` | Piece SDK, core/community actions and triggers | Full inventory and policy-governed catalog import |
| CLI | `packages/cli/**` | Piece create/build/sync/publish commands | Optional operator tooling |
| Enterprise | `packages/ee/**`, `packages/server/api/src/app/ee/**` | Embed SDK, managed auth, signing keys, global connections, SCIM, billing, admin controls | Commercial license or native fallback |
| Docs | `docs/**`, `.agents/features/**` | Feature docs and API docs | Evidence and migration notes |
| Infra | `Dockerfile`, `docker-compose.yml`, `deploy/**`, `docker-entrypoint.sh` | AP app/worker/Postgres/Redis runtime packaging | Deployment topology input |

## Full Feature Inventory

| Feature group | Feature | Repo paths | License | Description | LexFrame adoption mode |
|---|---|---|---|---|---|
| Builder/canvas | Visual flow builder, canvas, nodes, edges, minimap, add-step UI | `packages/web/src/app/builder/flow-canvas/**` | MIT | React canvas using `@xyflow/react`, custom nodes, loop/router edges, publish/test widgets | `activepieces_embedded`, then `fork_adapt` or `native_lexframe` |
| Builder/canvas | Step settings, branch/router/loop/code settings | `packages/web/src/app/builder/step-settings/**` | MIT | Inspector panel and per-step forms | Embed first; reimplement in native LexFrame canvas |
| Builder/canvas | Piece selector and dynamic props | `packages/web/src/app/builder/pieces-selector/**`, `piece-properties/**` | MIT | Search/select pieces, render dynamic properties, connection selector | `fork_adapt` or native wrappers over AP metadata |
| Builder/canvas | Test step, sample data, run details | `packages/web/src/app/builder/test-step/**`, `run-details/**` | MIT | Test action/trigger and inspect input/output | `activepieces_embedded`; native run center later |
| Flow model | Flow schema and versioning | `packages/shared/src/lib/automation/flows/flow.ts`, `flow-version.ts` | MIT | `Flow`, `FlowVersion`, draft/locked states, schema version 20 | `direct_reuse_mit` concepts in compiler |
| Flow model | Flow operations | `packages/shared/src/lib/automation/flows/operations/**` | MIT | Add/update/delete/move/duplicate actions, branches, notes, import, publish locks | `direct_reuse_mit` reference and native LexFrame compiler ops |
| Flow model | Branches, routers, loops, code, piece actions | `packages/shared/src/lib/automation/flows/actions/action.ts` | MIT | `CODE`, `PIECE`, `LOOP_ON_ITEMS`, `ROUTER`, branch operators | Compiler and reverse sync |
| Runtime | Flow runs, logs, retry, waitpoints | `packages/server/api/src/app/flows/flow-run/**` | MIT | Run lifecycle, metadata queue, logs, retry, pause/resume | `activepieces_runtime_api` and LexFrame run sync |
| Runtime | Worker polling and sandbox | `packages/server/worker/src/lib/worker.ts`, `sandbox/**` | MIT | Socket.IO worker, lock extension, sandbox process control | Self-hosted runtime |
| Runtime | Engine execution | `packages/server/engine/src/lib/handler/**`, `operations/**` | MIT | Executes triggers/actions/loops/routers and reports progress | Self-hosted runtime |
| Runtime | Network and SSRF hardening | `packages/server/engine/src/lib/network/**`, `packages/server/worker/src/lib/egress/**` | MIT | DNS/socket/fetch guards, proxy, optional iptables lockdown | Mandatory production control |
| Pieces | Piece framework | `packages/pieces/framework/src/lib/**` | MIT | Piece/auth/action/trigger/property SDK | `direct_reuse_mit` metadata model |
| Pieces | Core pieces | `packages/pieces/core/**` | MIT | 27 core pieces including schedule, webhook, forms, delay, HTTP, tables | `library_import` with policy |
| Pieces | Community pieces | `packages/pieces/community/**` | MIT by repo license | 657 external integrations | `library_import` with risk classification |
| Templates | Template model and API | `packages/server/api/src/app/template/**`, `packages/shared/src/lib/management/template/**` | MIT core, EE for platform custom service | Official/custom/shared templates, categories, flow validation | Native LexFrame template catalog |
| Templates | Cloud official proxy | `packages/server/api/src/app/template/community-templates.service.ts` | Terms unclear for payload | Self-hosted pulls official templates from Activepieces Cloud API | Metadata only until legal confirmation |
| Connections | App connections and OAuth | `packages/server/api/src/app/app-connection/**`, `packages/shared/src/lib/automation/app-connection/**` | MIT | Project-scoped connections, OAuth URL generation, sensitive-data stripping | Backend-only bridge |
| Connections | Secret managers/global connections/OAuth apps | `packages/server/api/src/app/ee/secret-managers/**`, `ee/global-connections/**`, `ee/oauth-apps/**` | EE | External secret managers, global/preselected connections, platform OAuth apps | Commercial license or native LexFrame secrets |
| Embedding | Embed SDK, managed auth, signing keys | `packages/ee/embed-sdk/**`, `packages/server/api/src/app/ee/managed-authn/**`, `ee/signing-key/**` | EE | Iframe SDK, external token exchange, signing key service | License or native LexFrame wrapper |
| Platform admin | Platform, users, projects, pieces visibility, workers, health, API keys, audit | `packages/web/src/app/routes/platform/**`, `packages/server/api/src/app/ee/**` | Mostly EE | Operator/admin controls | Native LexFrame admin wrappers; AP admin for operators |
| Observability | Health, analytics, audit events, event destinations | `packages/server/api/src/app/health/**`, `analytics/**`, `event-destinations/**`, `ee/audit-logs/**` | Mixed | Health checks, metrics, event streaming, audit | Native LexFrame observability with AP sync |

## Integration Levels

| Level | Included | LexFrame work | Activepieces role | Acceptance criteria |
|---|---|---|---|---|
| 1. Full embedded availability | AP app/worker/Postgres/Redis, embedded builder, allowed pieces, API bridge | Provision AP project/user/flow, issue short-lived embed/session tokens, sync runs | Primary runtime and advanced builder | Builder opens without frontend secrets; smoke flow runs; callbacks verified |
| 2. LexFrame UI wrapper | Run center, connection summaries, template catalog, admin gates | Backend wrappers and frontend status panels | Runtime/API provider | User stays in LexFrame for normal workflows |
| 3. Native LexFrame parity | Native canvas, compiler, reverse sync, policy engine | Implement AP-compatible workflow editor and runtime projection | Runtime target and advanced fallback | Compile/import/reverse-sync tests pass |
| 4. Full library ingestion | All safe pieces and importable templates in LexFrame catalog | Inventory generator, ingestor, seed/report output | Source catalog and optional runtime registry | 684 pieces classified; template report records all sources |
| 5. Controlled advanced automation | Power-user access to technical pieces and AP builder | Policy, audit, approvals, redaction, admin override | Advanced automation layer | Risky features are gated and audited |

## Implementation Skeleton

Created LexFrame skeleton paths:

- `packages/activepieces-inventory/**`: scans AP pieces, extracts actions,
  triggers, auth, categories, risk, exposure, and import mode.
- `packages/activepieces-template-ingestor/**`: scans local JSON/docs examples,
  records source hashes and keeps cloud templates metadata-only until legal
  approval.
- `packages/workflow-compiler/**`: compiles LexFrame workflow-like drafts to AP
  flow schema v20 and reverse-syncs AP JSON into runtime projections with
  `external_advanced_step` fallback.
- `packages/activepieces-bridge/**`: backend-only AP API client contract with
  secret-redaction helper for logs/audit, not frontend use.
- `apps/backend/src/modules/activepieces/activepieces-policy.ts`: LexFrame
  policy classifier and frontend secret-boundary guard.
- `apps/backend/src/modules/automation-import/**`: guarded import-planning
  module for AP template/flow candidates.
- `apps/web/src/features/activepieces/**`: embedded-builder URL and iframe
  skeleton that accepts no frontend AP token prop.
- `apps/web/src/features/builder/activepieces-parity-checklist.ts`: native
  canvas parity checklist tied to AP repo paths.

## Go / No-Go

- Go for full embedded parity: use AP self-hosted instance with backend-only bridge and either EE license for managed embedding or LexFrame-native token wrapper.
- Go for pieces/templates import: import all local MIT piece metadata and any locally available templates; treat cloud-proxied templates as `needs legal confirmation`.
- Go for runtime parity: use AP worker/engine as self-hosted runtime, strict egress, sandboxed execution, and LexFrame run/artifact sync.
- Go for native canvas parity: implement incrementally with `external_advanced_step` fallback and embedded AP builder as the lossless advanced editor.
- No-go only where proven: production copying of EE code without a commercial license, frontend exposure of privileged secrets, unrestricted generic HTTP/database/AI/file-export pieces in normal user mode.
