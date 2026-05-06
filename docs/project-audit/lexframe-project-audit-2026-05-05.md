# LexFrame / Lextreme Project Audit

Дата аудита: 2026-05-05
Ветка: `main`
HEAD на момент подготовки файла: `f7869ab` (`Включен максимальный каталог Activepieces для Stage 17`)
Предыдущий runtime recovery commit: `24d6e7b` (`Восстановлен Stage 17 runtime`)
Рабочее дерево до создания этого файла: без строк в `git status --short`
Формат: Markdown, технический аудит для планирования дальнейшей разработки

## 1. Executive Summary

LexFrame / Lextreme сейчас является pnpm monorepo для юридической automation-платформы. Проект сочетает:

- NestJS/Fastify backend с продуктовой доменной логикой, readiness, Canvas, Activepieces provisioning, AI Gateway, documents, runs, compliance, security и workspace control plane.
- Next.js frontend на App Router с рабочими экранами продукта, embedded Activepieces canvas/runtime route, admin/security views, documents, recommendations, library, modules, chat and project flows.
- Shared packages для contracts, workflow DSL, workflow semantic validation, API client, config, logger, telemetry, Activepieces catalog/inventory/sync, design-token bridge and custom Activepieces AI Gateway piece.
- Supabase/Postgres schema track with migrations through Stage 17.9.
- Docker/runtime infrastructure for Stage 14/16 integrated profile and dedicated Stage 17 local-integrated stack.
- Extensive scripts and evidence gates for contracts, database, security, Stage16 Canvas, Stage17 embedded Activepieces runtime, localization/debranding and pieces catalog.

Текущее состояние по последним артефактам:

- Stage17 release gate: `PASS / ACCEPT`, stage `17.12`, finished at `2026-05-05T07:17:29.926Z`.
- Stage17 readiness evidence: HTTP 200 from `http://localhost:3100/api/readiness/stage17`, overall `DEGRADED`, with no blocking errors.
- Stage17 G0-G10: all pass, `continue_on_p0=false`.
- Activepieces runtime image in Stage17 compose: `ghcr.io/activepieces/activepieces:0.80.1`.
- Stage17 pieces inventory: 684 inventory pieces, runtime catalog check saw 9017 metadata rows and 688 distinct piece names.
- Known readiness warnings: Activepieces worker heartbeat not recorded, Local Owner Key Vault missing/degraded. Both are non-blocking in the captured Stage17 evidence.
- The repository README still says "Stage 14 Runtime Track", while the code and docs now include Stage16 and Stage17 tracks. This is a documentation drift risk.

Most important architectural rule: LexFrame backend and product Postgres remain the canonical source of truth. Activepieces is treated as embedded builder/runtime projection, not as the owner of product entities. AI providers must be accessed through LexFrame AI Gateway, not directly from browser or arbitrary runtime pieces for production legal-data workflows.

## 2. Source Material Used

This audit was built from local repository state only. No internet research was used.

Primary inspected sources:

- `package.json`, `pnpm-workspace.yaml`, package-level `package.json` files.
- `README.md`.
- `apps/backend/src/app.module.ts`, `apps/backend/src/main.ts`, backend controllers and module inventory.
- `apps/web/src/app`, `apps/web/src/features`, web package scripts.
- `packages/*/package.json` and source entrypoint inventory.
- `docs/architecture`, `docs/integrations`, `docs/readiness`, `docs/security`, `docs/stage17`.
- `docs/contracts/api/openapi.yaml`.
- `supabase/migrations`, `supabase/seed`, `supabase/tests`.
- `compose.yaml`, `infra/docker/docker-compose.stage17.local-integrated.yml`, `infra/docker/nginx.stage17.local-integrated.conf`.
- `artifacts/stage17/*.json`.
- `.github/workflows/*.yml`.
- codebase-memory graph summary for project `E-Law_frame_main`.

Important graph facts:

- Total graph nodes: 37372.
- Total graph edges: 74586.
- File nodes: 5317.
- Function nodes: 4542.
- Method nodes: 3358.
- Class nodes: 3312.
- Route nodes: 431, although route graph includes noise from `.codex-runtime`; OpenAPI currently has 237 paths.
- No ADR stored in codebase-memory ADR store, but repository docs contain ADR markdown files under `docs/architecture/adr` and `docs/stage17`.

## 3. Repository Top-Level Map

Tracked file count by top-level area from `git ls-files`:

| Area | Tracked files | Role |
| --- | ---: | --- |
| `apps` | 528 | Product applications: backend, web, mining worker. |
| `packages` | 141 | Shared contracts, workflow, config, runtime integration libraries. |
| `docs` | 128 | Architecture, stage docs, evidence docs, contracts, operations, security. |
| `supabase` | 72 | SQL migrations, seed data, RLS/security tests. |
| `scripts` | 65 | Validation, release gates, Stage16/Stage17 runtime automation. |
| `artifacts` | 53 | Generated Stage17/Stage17.1 evidence artifacts currently tracked. |
| `tests` | 43 | Playwright e2e and live integrated tests. |
| `.github` | 20 | CI, release, security, canvas and deployment workflows. |
| `infra` | 11 | Docker, deployment examples, analytics/storage/delivery sandbox. |
| `config` | 1 | Readiness profile registry. |

Additional local directories observed but not necessarily tracked/product-owned:

| Directory | Current interpretation |
| --- | --- |
| `.codex-runtime` | Local runtime/tooling output, includes Postgres/pgAdmin files; should not be treated as application source. |
| `.codex-dev-logs` | Local assistant/dev logs. |
| `.local` | Local secrets/runtime state; must stay outside commits except intentionally safe examples. |
| `.playwright-mcp` | Browser automation local state. |
| `node_modules` | Installed dependencies. |
| `tmp`, `tmp_docker_diag` | Local diagnostics/tmp files. |
| `activepieces` | Empty at inspection time; actual external AP source is referenced by `ACTIVEPIECES_SOURCE_DIR`, normally `E:/activepieces-main`. |
| `stage16-audit-evidence-20260426-000827` | Historical Stage16 audit evidence folder. |

Root files:

| File | Role |
| --- | --- |
| `package.json` | Root pnpm script registry and workspace command surface. |
| `pnpm-workspace.yaml` | Workspace includes `apps/*`, `packages/*`, `tests/*`. |
| `pnpm-lock.yaml` | Dependency lock. |
| `tsconfig.base.json` | Shared TypeScript base settings. |
| `eslint.config.mjs` | Root lint config. |
| `compose.yaml` | Legacy/integrated local runtime stack through Stage14/Stage16. |
| `.env.example` | General local environment example; contains placeholders only. |
| `.env.stage17.local.example` | Stage17 local-integrated example; contains placeholders/secret refs only. |
| `.dockerignore` | Docker build exclusion policy. |
| `README.md` | Still describes Stage14 runtime track; outdated relative to Stage17 work. |
| `stage17-*.png` | UI screenshots/evidence around Stage17 flows. |

## 4. Product And Architecture Intent

The documented product intent is a legal automation platform for lawyers/teams. The core model combines:

- workspace-scoped identity and RBAC;
- legal profiles and legal modules;
- automation templates and installed automations;
- documents and document versions;
- workflow runs, run steps, artifacts and approval/delivery gates;
- recommendations and analytics;
- AI-assisted workflow/canvas drafting through a backend gateway;
- Activepieces embedded builder/runtime as a projection layer.

Key architectural decisions already accepted in repository docs:

| ADR / Doc | Decision |
| --- | --- |
| `docs/architecture/adr/0001-product-ownership.md` | LexFrame backend plus product PostgreSQL own canonical business entities. |
| `docs/architecture/adr/0002-supabase-data-layer.md` | Supabase is infrastructure/data layer, not application owner. Backend makes privileged policy decisions. |
| `docs/architecture/adr/0003-activepieces-runtime.md` | Activepieces is self-hosted runtime and embedded builder, not product source of truth. |
| `docs/architecture/adr/0004-ai-gateway-only.md` | AI calls must go through LexFrame AI Gateway. |
| `docs/architecture/adr/0007-canvas-v2-control-plane.md` | Canvas v2 edits LexFrame Workflow DSL; Activepieces JSON is runtime projection only. |
| `docs/stage17/ADR-stage17-canvas-strategy.md` | Stage17 MVP opens embedded Activepieces Canvas; future simplified LexFrame Canvas is separate/deferred. |

Hard constraints already documented:

- Browser never receives `SUPABASE_SECRET_KEY`.
- Browser never receives `ACTIVEPIECES_API_KEY` or Activepieces signing private key.
- Activepieces flow IDs are external references, never product IDs.
- Workflow JSON must validate against LexFrame schema before persistence.
- Product events must exclude raw sensitive prompt/document bodies.
- Canvas publish/runtime sync require backend validation, compile preview, policy gates and audit.
- Reverse sync from Activepieces must create reviewed draft/conflict, not overwrite canonical workflow directly.

## 5. Workspace Packages And Applications

Workspace definition:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tests/*"
```

### 5.1 Applications

| Package | Path | Runtime | Responsibility | Key local scripts |
| --- | --- | --- | --- | --- |
| `@lexframe/backend` | `apps/backend` | NestJS 11 + Fastify | Product API, policy, DB access, runtime integrations, readiness, Activepieces provisioning, AI Gateway orchestration. | `build`, `start`, `start:dev`, `lint`, `test`, `typecheck`. |
| `@lexframe/web` | `apps/web` | Next.js 16, React 19 | Product UI, app shell, admin/security screens, workspace flows, canvas and embedded Activepieces experience. | `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:canvas:*`, `storybook:build`. |
| mining worker | `apps/mining-worker` | Python worker image | Local worker skeleton for mining/search-like processing; not part of pnpm workspace package list because no `package.json`. | Dockerfile + `worker.py`; no root script observed. |
| `@lexframe/e2e` | `tests/e2e` | Playwright | Browser and integrated runtime coverage for Stage1/2/4/5/6/8/10/11/16/17 flows. | `test`, `test:stage17:release-gate`, `test:stage17:activepieces-canvas`, etc. |

### 5.2 Shared Packages

| Package | Path | Responsibility | Internal dependencies |
| --- | --- | --- | --- |
| `@lexframe/contracts` | `packages/contracts` | Canonical DTOs, enums, permissions, errors, release manifest schema, canvas schemas, local owner key schema, fixtures. | None. |
| `@lexframe/api-client` | `packages/api-client` | Typed API client and Stage15 client helpers. | `@lexframe/contracts`, `@lexframe/workflow-dsl`. |
| `@lexframe/config` | `packages/config` | Public/server env loaders and Zod validation. | None. |
| `@lexframe/logger` | `packages/logger` | Shared structured logging primitive. | None. |
| `@lexframe/telemetry` | `packages/telemetry` | Event/telemetry helpers around contract event catalog. | `@lexframe/contracts`. |
| `@lexframe/workflow` | `packages/workflow` | Workflow schema examples and semantic validator. | `@lexframe/contracts`, AJV. |
| `@lexframe/workflow-dsl` | `packages/workflow-dsl` | Canvas block schemas, node/edge/bindings schemas, validation rules, canvas block registry. | None. |
| `@lexframe/workflow-compiler` | `packages/workflow-compiler` | Workflow compiler package wrapper/smoke-tested library. | `@lexframe/workflow`. |
| `@lexframe/canvas-test-fixtures` | `packages/canvas-test-fixtures` | Versioned canvas fixtures used by validation gates. | None. |
| `@lexframe/ai-gateway` | `packages/ai-gateway` | AI gateway assets: constants, fixtures, evals, prompts and schema assets. | `@lexframe/contracts`. |
| `@lexframe/activepieces-legal-pieces` | `packages/activepieces-legal-pieces` | LexFrame-specific Activepieces legal pieces and RU locale file. | `@lexframe/contracts`. |
| `@lexframe/activepieces-bridge` | `packages/activepieces-bridge` | Thin bridge package for Activepieces integration semantics. | None. |
| `@lexframe/activepieces-inventory` | `packages/activepieces-inventory` | Inventory tooling for Activepieces pieces. | None. |
| `@lexframe/activepieces-catalog-sync` | `packages/activepieces-catalog-sync` | Catalog sync CLI/package built on inventory data. | `@lexframe/activepieces-inventory`. |
| `@lexframe/activepieces-template-ingestor` | `packages/activepieces-template-ingestor` | Activepieces template ingestion CLI/package. | None. |
| `@lexframe/design-system-activepieces-bridge` | `packages/design-system-activepieces-bridge` | Token extraction, token normalization, CSS theme, Tailwind preset and recipes for AP visual convergence. | None. |
| `@lexframe/piece-ai-gateway` | `packages/piece-ai-gateway` | Custom Activepieces piece for routing AI work through LexFrame AI Gateway. Version `0.1.0-stage17.9.0`. | None. |

## 6. Backend Application

Backend entrypoints:

- `apps/backend/src/main.ts`: loads server env, creates Nest Fastify app, registers CORS, global error mapping filter and audit interceptor, listens on configured `PORT`.
- `apps/backend/src/app.module.ts`: imports all product modules and applies `RequestIdMiddleware` + `TraceMiddleware` to all routes.

Backend technology:

- NestJS 11.
- Fastify adapter.
- PostgreSQL access via `pg`.
- Validation via AJV and local contract packages.
- JWT/signing via `jose`.
- Document templating via `docxtemplater` and `pizzip`.

Backend module inventory from `apps/backend/src/modules`:

| Module | TS files | Responsibility |
| --- | ---: | --- |
| `activepieces` | 19 | Activepieces session/provisioning/catalog/runtime callbacks, run smoke, connections, admin catalog/status. |
| `admin-console` | 3 | Admin security overview. |
| `ai-gateway` | 12 | AI chat sessions, workflow drafts/patches, redaction preview, runtime actions/callbacks. |
| `approvals` | 3 | Approval routes/tasks and runtime approval request execution. |
| `audit` | 4 | Audit event listing and admin audit export. |
| `authorization` | 3 | RBAC roles and permissions. |
| `automation-import` | 3 | Activepieces automation import planning. |
| `automation-library` | 4 | Library, automation templates, versions, install/fork, moderation/publication flows. |
| `canvas` | 57 | Largest control-plane module: block types, modules, validation, canvas state, operations, versioning, publish, runtime sync/import, locks, IO, inspector. |
| `canvas-ai` | 17 | Canvas AI messages, patch proposals, explanations, fixes, config, tests and patch lifecycle. |
| `clauses` | 3 | Clauses and phrase rules. |
| `compliance` | 3 | Processing activities, retention policies/report, DSR, ROPA, access reviews. |
| `dashboard` | 3 | Dashboard snapshot and events. |
| `database` | 2 | DB provider/module. |
| `delivery` | 5 | Delivery request lifecycle and delivery sandbox status/test. |
| `document-generation` | 3 | Document generation previews/finalization and runtime document template execution. |
| `document-templates` | 3 | Template CRUD, placeholder parse, publish draft. |
| `document-types` | 3 | Document type and structure configuration. |
| `document-validation` | 3 | Document validation recheck and runtime validation execution. |
| `documents` | 5 | Documents, versions, upload intents, signed URLs, archive/restore/delete. |
| `identity` | 5 | Auth bootstrap, session context, account security, admin sessions, workspace policies, reauth. |
| `legal-indexing` | 2 | Legal indexing service/module; no controller observed. |
| `legal-modules` | 3 | Legal module registry and admin version publish/deprecate. |
| `legal-rag` | 3 | Legal RAG analysis and runtime RAG action. |
| `legal-search` | 3 | Legal search query and runtime search action. |
| `legal-sources` | 3 | Legal source import jobs and source/job lookup. |
| `local-owner-key-vault` | 13 | Local owner key status/security handling. |
| `notifications` | 4 | Device registration and notifications read/read-all. |
| `ops` | 4 | Liveness/readiness/dependency health, system status, metrics. |
| `profile-imports` | 3 | Profile import jobs. |
| `profiles` | 3 | Profile current/effective, draft/validate/publish/versions/restore/preview. |
| `readiness` | 6 | Readiness contract, summary/details, Stage17 readiness. |
| `realtime` | 3 | Realtime support module. |
| `recommendations` | 4 | Recommendations lifecycle and admin analytics/patterns. |
| `runs` | 8 | Runs, preflight/start/cancel/retry, step retry, artifacts, signed URLs, accept-as-document. |
| `runtime` | 3 | Runtime support module. |
| `secrets` | 3 | Admin secret inventory and rotation lifecycle. |
| `security-operations` | 3 | Admin alerts/incidents lifecycle. |
| `stage15-projects` | 3 | Projects, project snapshot/chats/automations and Stage17 canvas ensure endpoint. |
| `stage7-support` | 1 | Stage7 support helper/service. |
| `telemetry` | 3 | Event capture. |
| `workflow-compiler` | 20 | Workflow compiler services/tests and runtime projection. |
| `workflows` | 2 | Workflow module/service. |
| `workspaces` | 4 | Workspace CRUD/switch, members, invitations. |

### 6.1 Backend Route Surface

OpenAPI contract:

- Title: `LexFrame Stage 8 API`.
- Version: `0.8.0`.
- Path count: 237.

Observed controller route families:

| Family | Example paths | Purpose |
| --- | --- | --- |
| Identity/session | `/auth/bootstrap`, `/session/context`, `/account/security` | Session bootstrap and account/security context. |
| Workspace/RBAC | `/workspaces`, `/workspaces/:workspaceId`, `/rbac/roles`, `/rbac/permissions` | Workspace management and authorization lookup. |
| Admin security | `/admin/security/overview`, `/admin/security/sessions`, `/admin/security/alerts`, `/admin/security/incidents`, `/admin/security/secrets` | Control-plane security, sessions, alerts, incidents and secret rotation. |
| Compliance | `/admin/compliance/*` | Processing activities, retention, DSR, ROPA, access reviews. |
| Automation library | `/library`, `/automation-templates`, `/publication-requests`, `/moderation/publication-requests` | Template catalog, install/fork/publish/moderation. |
| Canvas control plane | `/canvas/*`, `/automations/:automationId/canvas/*` | Canvas metadata, operations, validation, versions, publish, rollback, locks, runtime sync/import. |
| Canvas AI | `/automations/:automationId/canvas/ai/*` | AI assistant messages, patch proposals and patch lifecycle. |
| Activepieces | `/activepieces/session`, `/activepieces/embed-token`, `/admin/activepieces/catalog`, `/integrations/activepieces/status`, runtime callbacks | Embedded AP session, catalog, runtime integration. |
| AI Gateway | `/ai/chat/*`, `/ai/workflow-drafts`, `/ai/workflow-patches`, `/ai/redaction/preview`, runtime AI actions | AI chat/workflow generation and runtime gateway. |
| Documents | `/documents/*`, `/document-generation/*`, `/document-templates/*`, `/document-types/*`, `/document-validations/*` | Document lifecycle, templates, generation, validation. |
| Legal data | `/legal-modules`, `/legal-sources`, `/legal-search/query`, `/legal-rag/analyze` | Legal module/source/search/RAG functionality. |
| Runs/artifacts | `/runs`, `/automations/:id/runs`, `/runs/:runId/*`, `/artifacts/:artifactId/signed-url` | Runtime execution and artifacts. |
| Delivery/approvals | `/delivery-requests/:id/*`, `/approval-routes`, `/approval-tasks`, runtime approval/delivery gates | External delivery and approvals. |
| Ops/readiness | `/health/live`, `/health/ready`, `/health/dependencies`, `/health/readiness`, `/readiness/stage17` | Health and readiness. |

### 6.2 Backend Observations

- Backend is not a thin API shell; it owns product policy and integration boundaries.
- `canvas` and `activepieces` are currently among the highest-blast-radius modules.
- `ai-gateway.service.ts` is large and contains workflow draft/patch generation, request tracking and provider-policy logic.
- Many controllers expose admin/security/compliance routes; frontend must not bypass backend policy.
- OpenAPI still reports Stage 8 version metadata, while runtime/docs are Stage17. This is documentation/contract metadata drift.

## 7. Frontend Application

Frontend entrypoints:

- `apps/web/src/app/layout.tsx`: root layout, `lang="ru"`, wraps all pages in `AppProviders`.
- `apps/web/src/app/page.tsx`: redirects `/` to `/app`.

Frontend technology:

- Next.js 16 App Router.
- React 19.
- TanStack Query.
- Supabase JS for publishable/RLS-safe client access.
- XYFlow/React Flow for canvas UI.
- TipTap for rich editing.
- Lucide React for icons.
- Tailwind CSS v4.
- Vitest for unit/component tests.
- MSW support for mocked tests.

Frontend source areas:

| Area | Role |
| --- | --- |
| `apps/web/src/app` | Next.js route tree and layouts. |
| `apps/web/src/components` | Shared UI components. |
| `apps/web/src/features/activepieces` | Embedded Activepieces UI integration. |
| `apps/web/src/features/automation-canvas` | Automation canvas feature area. |
| `apps/web/src/features/builder` | Builder-specific feature code. |
| `apps/web/src/features/canvas` | Main canvas UI/state/fixtures/libs/components. |
| `apps/web/src/hooks` | Shared React hooks. |
| `apps/web/src/lib` | API/config/route utilities. |
| `apps/web/src/messages` | Localized/static messages. |
| `apps/web/src/mocks` | MSW/test mock data. |
| `apps/web/src/providers` | App provider composition. |
| `apps/web/src/stores` | Client state stores. |
| `apps/web/src/test` | Frontend test setup/helpers. |

Observed page routes include:

- `/app`
- `/app/projects/[projectId]`
- `/app/projects/[projectId]/automations`
- `/app/projects/[projectId]/automations/[automationId]`
- `/app/projects/[projectId]/automations/[automationId]/automation`
- `/app/projects/[projectId]/automations/[automationId]/builder`
- `/app/projects/[projectId]/automations/[automationId]/advanced-builder`
- `/app/projects/[projectId]/automations/[automationId]/canvas`
- `/app/projects/[projectId]/chats/[chatId]`
- `/app/runs/[runId]`
- `/automations`, `/automations/[id]`, `/automations/[id]/builder`, `/automations/[id]/updates`
- `/dashboard`
- `/documents`, `/documents/[id]`, `/documents/generation/[jobId]`
- `/library`, `/library/my`, `/library/[templateId]`
- `/modules`, `/modules/[code]`
- `/recommendations`
- `/research`
- `/sources`, `/sources/[id]`
- `/templates/[id]/edit`, `/templates/[id]/publish`, `/templates/[id]/publication-status`
- `/settings/documents/*`
- `/settings/profile/*`
- `/admin`, `/admin/modules`, `/admin/security/*`, `/admin/compliance`, `/admin/recommendations`, `/admin/moderation/publications`
- `/sign-in`, `/onboarding/workspace`, `/invite/[token]`

Frontend observations:

- The UI has both older LexFrame canvas paths and Stage17 embedded Activepieces paths. Stage17 docs clarify that embedded Activepieces Canvas is MVP primary for the current milestone, while future proprietary LexFrame Canvas is deferred.
- `NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL`, `NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL`, `NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED`, `NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED` and embed SDK URL are the critical browser-facing AP variables.
- Browser-facing variables must remain public-safe. No long-lived AP/Supabase/provider secrets may be exposed.

## 8. Data Layer And Supabase

Supabase directory:

- `supabase/migrations`: 49 SQL migrations.
- `supabase/seed`: 7 seed files.
- `supabase/tests`: 14 SQL test files.

Migration track:

| Range | Theme |
| --- | --- |
| `000001` - `000004` | Extensions, enums, core tables, helper functions. |
| `000005` - `000008` | Stage1 schemas, access tables, RLS, Stage0 draft lock. |
| `000009` - `000010` | Stage2 documents and document RLS. |
| `000011` - `000012` | Stage3 library and library RLS. |
| `000013` - `000014` | Stage4 runtime and runtime RLS. |
| `000015` | Stage5 AI Gateway. |
| `000016` - `000017` | Stage6 legal search and RLS. |
| `000018` - `000019` | Stage7 profiles/templates and RLS. |
| `000020` - `000021` | Stage8 execution core and RLS. |
| `000022` - `000023` | Stage9 product events/recommendations and RLS. |
| `000024` - `000025` | Stage10 realtime dashboard and RLS. |
| `000026` - `000031` | Stage11 identity, security, audit, secrets, compliance, release gates. |
| `000032` - `000046` | Stage16 Canvas, IO, DSL projection, modules, persistence, validation, compiler, reverse sync, testing, AI, versioning, no-code UX, security, live audit compatibility, Activepieces catalog bridge. |
| `000047` - `000049` | Stage17 Activepieces session architecture, session tables, runtime AI Gateway. |

Seed track:

| Seed | Role |
| --- | --- |
| `000001_stage0_seed.sql` | Base demo/product data. |
| `000002_stage3_seed.sql` | Library seed. |
| `000003_stage4_seed.sql` | Runtime seed. |
| `000004_stage7_seed.sql` | Profiles/templates seed. |
| `000005_stage9_recommendations_permissions_seed.sql` | Recommendations permissions. |
| `000006_stage14_search_seed.sql` | Search seed. |
| `000007_stage16_canvas_live_seed.sql` | Canvas live seed. |

Data ownership:

- Product workspace/user/automation/document/run entities live in LexFrame product DB.
- Activepieces DB is separate and stores runtime/builder internals.
- Stage17 local stack uses a dedicated product DB named `stage17_runtime`.
- Activepieces Stage17 DB uses separate `activepieces-postgres` with DB `activepieces`.
- Stage17 compose uses `pgvector/pgvector:0.8.0-pg16` for Activepieces Postgres.

Readiness profile registry:

| Profile | Enforcement | Required services |
| --- | --- | --- |
| `local-basic` | Allows readiness blocked | `postgres`, `backend`, `web`. |
| `local-integrated` | Does not allow blocked readiness | `postgres`, `supabase-storage`, `backend`, `web`, `activepieces`, `redis`, `opensearch`, `delivery-sandbox`. |
| `staging-rc` | Strict release candidate | Integrated runtime/search/real AI/local owner/realtime, delivery sandbox optional. |
| `production` | Full enforcement | All listed runtime dependencies required. |

## 9. Activepieces Runtime And Catalog

Stage17 selected runtime:

- Compose project: `lexframe-stage17`.
- Public reverse proxy: `http://localhost:3100`.
- Embedded Activepieces URL: `http://localhost:3100/automation-runtime`.
- Stage17 readiness URL: `http://localhost:3100/api/readiness/stage17`.
- Activepieces app health through reverse proxy: `http://localhost:3100/automation-runtime/api/v1/health`.
- Activepieces app/worker image: `ghcr.io/activepieces/activepieces:0.80.1`.
- Activepieces DB: `pgvector/pgvector:0.8.0-pg16`.
- Redis: `redis:7-alpine`.
- Reverse proxy: `nginx:1.27-alpine`.

Important Stage17 env interface:

| Variable | Purpose |
| --- | --- |
| `ACTIVEPIECES_CATALOG_MODE` | `max` by default for maximal catalog; `restricted` is rollback/allowlist mode. |
| `AP_PIECES_SOURCE` | Defaults to `CLOUD_AND_DB`. |
| `AP_PIECES_SYNC_MODE` | Defaults to `OFFICIAL_AUTO`. |
| `ACTIVEPIECES_NETWORK_MODE` | Defaults to `STRICT`. |
| `ACTIVEPIECES_SSRF_ALLOW_LIST` | Restricts allowed SSRF target(s), defaults to backend URL. |
| `ACTIVEPIECES_MVP_CANVAS_ENABLED` | Enables embedded Activepieces MVP canvas path. |
| `ACTIVEPIECES_FORCE_RU_LOCALE` | Forces Russian locale behavior. |
| `ACTIVEPIECES_BRAND_DISPLAY_NAME` | Neutral runtime brand display name. |
| `ACTIVEPIECES_SIMULATE_RUNS` | `0` in integrated runtime; no simulated runs. |

Current catalog evidence:

- `docs/stage17/open-source-pieces-pack.md`: Status `PASS`.
- Inventory total: 684 pieces.
- Community pieces: 657.
- Core pieces: 27.
- Actions: 4367.
- Triggers: 1258.
- Gmail found with RU locale.
- CometAPI found without RU locale.
- `artifacts/stage17/pieces-verify-report.json`: runtime catalog checked.
- Runtime `piece_metadata`: 9017 rows, 688 distinct names.
- Known runtime pieces present: OpenAI, Gmail, Google Drive, Slack, HTTP, Webhook.

Known build/sync caveat:

- `stage17:pieces:build` recorded `DOCUMENTED_BLOCKER`, not a full local build, because external AP source prerequisites are missing locally: git metadata, bun, node_modules.
- `stage17:pieces:sync` recorded `DOCUMENTED`, not attempted against API, because sync requires explicit env/API credentials and must not commit secrets.
- The runtime catalog was still verified through Activepieces DB metadata after the `0.80.1` runtime and max catalog mode changes.

Policy interpretation:

- For local Stage17, maximal catalog is now default.
- Production policy still needs explicit review before allowing all pieces against legal data.
- Direct AI provider pieces may appear in UI, but production legal-data workflows should route AI through LexFrame AI Gateway.
- OAuth/API credentials are intentionally not committed. Piece visibility does not imply connected accounts.

## 10. Stage17 Runtime State

Latest Stage17 release gate artifact:

| Field | Value |
| --- | --- |
| Stage | `17.12` |
| Status | `PASS` |
| Acceptance | `ACCEPT` |
| Started | `2026-05-05T07:13:30.114Z` |
| Finished | `2026-05-05T07:17:29.926Z` |
| `continue_on_p0` | `false` |
| Node | `v22.16.0` |
| pnpm | `10.11.1` |
| Runtime evidence commit recorded inside gate | `24d6e7b21ba73b284964c6b4c4b536392a0b704c` |
| Audit file HEAD | `f7869ab`, later commit that captured max catalog changes. |

Gate results:

| Gate | Name | Severity | Status | Command |
| --- | --- | --- | --- | --- |
| G0 | Readiness inputs | P0 | pass | `pnpm stage17:readiness:evidence` |
| G1 | Static/unit/contract | P0 | pass | `pnpm stage17:test:unit && pnpm stage17:pieces:inventory` |
| G2 | Integration | P0 | pass | `pnpm stage17:test:integration && pnpm stage17:pieces:build && pnpm stage17:pieces:sync && pnpm stage17:pieces:verify` |
| G3 | Playwright live E2E | P0 | pass | `pnpm stage17:e2e:activepieces-canvas` |
| G4 | Security and secret scan | P0 | pass | `pnpm stage17:security:scan-secrets && pnpm stage17:security:scan-frontend-bundle && pnpm stage17:security:scan-browser-evidence` |
| G5 | Localization and debranding | P1 | pass | `pnpm stage17:localization:check && pnpm stage17:debranding:check` |
| G6 | Visual regression | P0 | pass | `pnpm stage17:visual:regression` |
| G7 | Runtime evidence | P0 | pass | `pnpm stage17:runtime:evidence` |
| G8 | Artifacts completeness | P1 | pass | `pnpm stage17:artifacts:verify` |
| G9 | Stop-list compliance | P0 | pass | `pnpm stage17:stop-list:verify` |
| G10 | Stage 17.12 closure | P0 | pass | `pnpm stage17:closure:verify` |

Readiness evidence:

| Check | Status | Blocking | Summary |
| --- | --- | --- | --- |
| `activepieces_app` | PASS | true | Activepieces app reachable internally and through reverse proxy. |
| `activepieces_worker` | WARN | false | Worker heartbeat has not been recorded yet. |
| `activepieces_db` | PASS | true | Activepieces Postgres reachable, migrated, separate from product DB. |
| `activepieces_redis` | PASS | true | Redis queue dependency responded to PING. |
| `local_owner_keys` | WARN | false | Local Owner Key Vault missing, disabled or degraded. |
| `activepieces_signing_key` | PASS | true | Signing private key resolved and RS256 dry-run succeeded. |
| `i18n` | PASS | false | Stage17 Russian locale inventory present. |
| `branding` | PASS | false | Branding inventory and display name configured. |
| `design_tokens` | PASS | false | Design-token bridge evidence present. |

Runtime evidence:

- Product workspace/user/project bindings read back from Activepieces.
- Flow binding read back from Activepieces.
- Flow run not required for non-AI builder canvas.
- AI Gateway route evidence skipped because AI Gateway is optional/degraded for opening non-AI builder canvas.
- Secret absence checks passed for frontend bundle, network HAR, browser storage and logs audit.

## 11. Stage16 Canvas Track

Stage16 appears to be the preceding Canvas control-plane track.

Evidence from git history and scripts:

- Recent commits include `bafead8 Закрыты release gates Stage 16 Canvas`, `bce3f0c Стабилизирован Stage 16 release gate`, `0be6e80 Восстановлен Docker-контур Stage 16`.
- Root scripts include 12 Stage16 commands:
  - `stage16:db:bootstrap`
  - `stage16:db:apply-local`
  - `stage16:runtime:health`
  - `stage16:runtime:up-full`
  - `stage16:build:backend-runtime`
  - `stage16:build:web-runtime`
  - `stage16:activepieces:evidence`
  - `stage16:validate:compose-helpers`
  - `stage16:validate:release-gate-integrity`
  - `stage16:run-live-audit`
  - `stage16:mutation-proof`
  - `stage16:release-gate`
- Supabase migrations `000032` through `000046` are Stage16-related.
- `docs/testing/canvas-v2-*` and `.github/workflows/canvas-*` define the Canvas v2 validation/release gate surface.

Stage16 current interpretation:

- Canvas v2 contract/control plane is materially implemented.
- Stage16 release gate appears closed from git history and scripts, but this audit did not rerun Stage16 gate.
- Stage17 MVP embedded Activepieces canvas temporarily supersedes the custom LexFrame Canvas as the default authoring route for the current milestone.
- Future simplified LexFrame Workflow DSL Canvas remains a separate post-Stage17 track.

## 12. Stage14 / Legacy Integrated Runtime

README and `compose.yaml` still describe a Stage14 local-integrated profile.

Stage14 components in `compose.yaml`:

- `postgres`
- `redis`
- `redpanda`
- `clickhouse`
- `activepieces-postgres`
- `activepieces-redis`
- `opensearch`
- `storage-sandbox`
- `delivery-sandbox`
- `stage16-db-bootstrap`
- `stage16-activepieces-catalog-sync`
- `backend`
- `web`
- Activepieces app/worker entries later in the file

Stage14 CI:

- `.github/workflows/stage14-integrated.yml` starts Stage14 infra, installs Playwright Chromium, applies local schema/seed, runs Stage2/4/5/6/8/10 integrated smoke tests, generates release manifest and uploads logs.

Risk:

- Root README says "LexFrame Stage 14 Runtime Track", while current work has advanced through Stage17. This can mislead onboarding and future planning.
- `docs/contracts/api/openapi.yaml` title/version still says Stage8 API. This may be valid as historical contract versioning, but should be checked.

## 13. Infrastructure

### 13.1 General Local Runtime

`compose.yaml` is the older/general local stack. It supports:

- PostgreSQL.
- Redis.
- Redpanda.
- ClickHouse/PostHog-like analytics dependencies.
- Activepieces runtime dependencies.
- OpenSearch.
- Storage signing sandbox.
- Delivery sandbox.
- Stage16 DB bootstrap/catalog sync helpers.
- Backend/web image builds.

### 13.2 Stage17 Dedicated Runtime

`infra/docker/docker-compose.stage17.local-integrated.yml` is the current Stage17 dedicated local-integrated stack.

Services:

| Service | Image/build | Purpose |
| --- | --- | --- |
| `lexframe-product-postgres` | `postgres:16-alpine` | Product Postgres for Stage17 runtime DB. |
| `lexframe-product-db-bootstrap` | local build | Drops/recreates `stage17_runtime`, applies Supabase compatibility, migrations and seeds. |
| `activepieces-postgres` | `pgvector/pgvector:0.8.0-pg16` | Activepieces DB. |
| `activepieces-redis` | `redis:7-alpine` | Activepieces queue/cache dependency. |
| `activepieces-app` | `ghcr.io/activepieces/activepieces:0.80.1` | Activepieces app/API/frontend. |
| `activepieces-worker` | `ghcr.io/activepieces/activepieces:0.80.1` | Activepieces worker. |
| `lexframe-backend` | `lexframe-backend:stage17-local` | Backend API for Stage17. |
| `lexframe-web` | `lexframe-web:stage17-local` | Web UI for Stage17. |
| `reverse-proxy` | `nginx:1.27-alpine` | Single public entrypoint on `localhost:3100`, routes `/api` and `/automation-runtime`. |

Volumes:

- `lexframe-product-postgres-data`
- `activepieces-postgres-data`
- `activepieces-redis-data`
- `activepieces-worker-cache`

Secret handling:

- Compose uses Docker secrets from `.local/secrets/stage17/*`.
- `.env.stage17.local` is local and must not be committed.
- `.env.stage17.local.example` documents placeholders and secret refs.

### 13.3 Deployment

Deployment-related files:

- `infra/deploy/env/preview.env.example`
- `infra/deploy/env/staging.env.example`
- `infra/deploy/env/production.env.example`
- `infra/deploy/release-manifest.example.json`
- `.github/workflows/deploy-preview-staging.yml`
- `.github/workflows/deploy-production.yml`

Deployment workflows currently:

- Build workspace.
- Create release manifest.
- Upload manifest artifact.

No evidence in this audit proves production deployment is complete or healthy. Production readiness still depends on Stage12/14 hardening and runtime deployment work.

## 14. Scripts And Gates

Root script groups:

| Group | Count | Purpose |
| --- | ---: | --- |
| `check:*` + `check` | 9 | Main package/domain validation gates. |
| `validate:*` | 12 | OpenAPI, JSON schemas, workflows, release manifest, canvas, AI assets, Activepieces package, security. |
| `stage16:*` | 12 | Stage16 DB/runtime/evidence/release-gate lifecycle. |
| `stage17:*` | 35 | Stage17 local secrets, compose, runtime patch/provision, readiness, tests, pieces, evidence, release gate. |
| `security:*` + `secret-scan` | 5 | Secret scans and frontend bundle/provider key checks. |
| `dev:*` | 2 | Local backend/web dev servers. |
| Other | 10 | Workspace build/typecheck/lint/test, canvas release gate, i18n, branding, license. |

Most important top-level commands:

| Command | Role |
| --- | --- |
| `corepack pnpm build` | Recursive workspace build. |
| `corepack pnpm typecheck` | Recursive TypeScript typecheck. |
| `corepack pnpm lint` | Recursive lint. |
| `corepack pnpm test` | Recursive tests. |
| `corepack pnpm check` | Full root check combining build, contracts, backend, frontend, DB, AI, Activepieces, security, e2e. |
| `corepack pnpm check:backend` | Backend build/lint/typecheck/test. |
| `corepack pnpm check:frontend` | Web build/lint/typecheck/test. |
| `corepack pnpm check:contracts` | Contracts build and schema/openapi/fixture validations. |
| `corepack pnpm check:db` | DB readiness and RLS/security checks. |
| `corepack pnpm check:security` | Stage1/11/canvas security, frontend bundle, secret scan. |
| `corepack pnpm canvas:release-gate` | Canvas fixture/release-manifest gates. |
| `corepack pnpm stage17:release-gate` | Stage17 G0-G10 release gate. |

Stage17-specific workflow:

1. `corepack pnpm stage17:init-local-secrets`
2. `corepack pnpm stage17:compose:config`
3. `corepack pnpm stage17:up`
4. `corepack pnpm stage17:activepieces:patch-runtime`
5. `corepack pnpm stage17:provision-canvas`
6. `corepack pnpm stage17:readiness:evidence`
7. `corepack pnpm stage17:runtime:evidence`
8. `corepack pnpm stage17:release-gate`

Pieces workflow:

1. `corepack pnpm stage17:pieces:inventory`
2. `corepack pnpm stage17:pieces:build`
3. `corepack pnpm stage17:pieces:sync`
4. `corepack pnpm stage17:pieces:verify`
5. Optional checks: `stage17:pieces:gmail-check`, `stage17:pieces:cometapi-check`

## 15. CI / GitHub Workflows

Observed workflows:

| Workflow | Purpose |
| --- | --- |
| `backend-ci.yml` | Backend gate. |
| `frontend-ci.yml` | Frontend gate and e2e smoke. |
| `contracts-ci.yml` | Contract gate and OpenAPI artifact upload. |
| `db-ci.yml` | Supabase CLI + DB gate. |
| `ai-ci.yml` | AI gate. |
| `activepieces-pieces-ci.yml` | Activepieces pieces package gate. |
| `security-ci.yml` | Security gate. |
| `security-secrets.yml` | Secret scan with full checkout history. |
| `stage14-integrated.yml` | Stage14 integrated smoke runtime. |
| `canvas-ci.yml` | Canvas contracts/backend/frontend/storybook coverage. |
| `canvas-ai-ci.yml` | Canvas AI contracts/backend/frontend/security checks. |
| `canvas-e2e.yml` | Canvas integrated Playwright runtime. |
| `canvas-integrated.yml` | Canvas integrated readiness. |
| `canvas-release-gate.yml` | Multi-job Canvas release gate. |
| `canvas-security-ci.yml` | Canvas security and live browser scenarios. |
| `workflow-dsl-ci.yml` | Workflow DSL schema/operations/validation/compiler tests. |
| `workflow-compiler-ci.yml` | Workflow compiler backend/package coverage. |
| `workflow-versioning-ci.yml` | Workflow versioning CI. |
| `deploy-preview-staging.yml` | Build + release manifest for preview/staging. |
| `deploy-production.yml` | Build + release manifest for production. |

CI observation:

- There is strong coverage for contracts, backend, frontend, canvas, security and Stage14 runtime.
- There is no dedicated Stage17 GitHub workflow observed in `.github/workflows`; Stage17 gate currently appears local-script/artifact driven.

## 16. Documentation State

Documentation inventory:

| Area | Files | Status |
| --- | ---: | --- |
| `docs/architecture` | 14 | Good architectural base, ADRs and diagrams. Some files contain mojibake in Russian text. |
| `docs/canvas` | 8 | Canvas behavior, taxonomy, IO, runtime mapping and security rules. |
| `docs/contracts/api/openapi.yaml` | 1 | Large OpenAPI contract, 237 paths, metadata still says Stage8. |
| `docs/design` | 2 | Activepieces token inventory/map. |
| `docs/development` | 1 | Getting started. |
| `docs/environments` | 1 | Readiness profile matrix. |
| `docs/evidence` | 2 | Stage17.8 evidence. |
| `docs/frontend` | 1 | Routes/screens. |
| `docs/integrations` | 5 | Activepieces, AI Gateway, analytics, OpenSearch, Supabase. |
| `docs/operations` | 3 | Healthchecks, rollback, Stage12 governance. |
| `docs/product` | 1 | Canvas copywriting guide. |
| `docs/readiness` | 4 | DoD, contract registry, checklists, risk register. |
| `docs/security` | 3 | Data classification, RBAC, secrets inventory. |
| `docs/stage17` | 70 | Extensive Stage17 closure, evidence, localization, debranding, pieces and risk docs. |
| `docs/testing` | 7 | Canvas v2 test strategy, gates, fixtures, risk, performance, manual QA. |

Documentation risks:

- Root README is outdated relative to Stage17.
- OpenAPI title/version lags current stage naming.
- Some markdown files show mojibake for Russian content, likely encoding issue from earlier edits.
- There is already `docs/project-state-audit-2026-05-04.docx`, but the current requested audit is Markdown and more implementation-oriented.

## 17. Security And Secrets

Security posture from docs and scripts:

- Backend-only secrets are enumerated in `docs/security/secrets-inventory.md`.
- Stage17 examples must contain placeholders/secret refs only.
- Real values live in `.env.stage17.local` and `.local/secrets/stage17/*`.
- Secret scan scripts:
  - `scripts/secret-scan.mjs`
  - `scripts/security/check-no-local-secrets.mjs`
  - `scripts/security/check-stage17-no-provider-key.mjs`
  - `scripts/stage17/scan-browser-evidence.mjs`
  - `scripts/validate-web-bundle-secrets.mjs`

Browser-forbidden secret classes:

- Supabase service/secret key and DB URL.
- Activepieces API key.
- Activepieces signing private key.
- Activepieces internal JWT/encryption/worker tokens.
- Activepieces Postgres/Redis passwords.
- AI provider keys.
- Local Owner Key Vault contents.

Stage17 captured evidence:

- Frontend bundle secret scan: pass.
- Network HAR secret scan: pass.
- Browser storage secret scan: pass.
- Logs audit: pass.
- G4 security and secret scan: pass.

Security risks still open:

- Maximal Activepieces catalog in local dev can expose many integrations. Production policy must decide allowlist vs max catalog with governance.
- Direct AI provider pieces can appear in UI; production legal-data workflows must enforce AI Gateway routing.
- Local Owner Key Vault is missing/degraded in current Stage17 readiness evidence, but non-blocking.
- Activepieces paid/enterprise feature/license boundary remains explicit risk in Stage17 docs.

## 18. Current Stage / Subsystem Status Matrix

| Area | Current status | Evidence | Notes |
| --- | --- | --- | --- |
| Stage1 foundation | Implemented baseline | README, Stage1 migrations, security validators | Original project description still says Stage1 foundation, but repo progressed beyond it. |
| Stage2 documents/storage | Implemented local/integrated coverage | migrations `000009-000010`, e2e `stage2-storage-integrated.spec.ts` | Requires storage sandbox or Supabase-compatible storage for live profile. |
| Stage3 library | Implemented | migrations/seeds, automation-library module | Publication/moderation flows exist. |
| Stage4 runtime/Activepieces boundary | Implemented and evolved | migrations `000013-000014`, Activepieces module, docs | Stage17 supersedes runtime setup details. |
| Stage5 AI Gateway | Implemented | migration `000015`, package/backend module/e2e | Real provider mode not proven in current local evidence; mock mode used. |
| Stage6 legal search | Implemented local profile | migrations `000016-000017`, e2e `stage6-search-integrated` | Depends on OpenSearch readiness. |
| Stage7 profiles/templates | Implemented | migrations `000018-000019`, profile modules | Document template/profile screens exist. |
| Stage8 execution core | Implemented | migrations `000020-000021`, runs module | OpenAPI metadata still Stage8. |
| Stage9 recommendations/events | Implemented | migrations `000022-000023`, recommendations module/e2e | Recommendation behavior is advisory by ADR. |
| Stage10 realtime/dashboard | Implemented local tests | migrations `000024-000025`, dashboard/realtime modules | Production realtime policy still needs strict readiness. |
| Stage11 security/control plane | Implemented checks | migrations `000026-000031`, security CI/e2e | Strong local validation surface. |
| Stage14 local-integrated | Existing but docs drift | README, compose, Stage14 CI | README centers Stage14 even after Stage17 work. |
| Stage16 Canvas | Closed per git/docs/scripts | Stage16 migrations, canvas docs, release-gate scripts | Not rerun during this audit. |
| Stage17 embedded AP canvas | PASS / ACCEPT | `artifacts/stage17/release-gate.json`, docs/stage17 | Current strongest runtime evidence. |
| Stage17 max AP catalog | Implemented local default | commit `f7869ab`, pieces verify report | Production governance still open. |
| Future LexFrame simplified Canvas | Not implemented | Stage17 closure docs | Deferred post-Stage17. |
| Production deployment | Not proven | deploy workflows only create manifests | Needs deployment hardening/evidence. |

## 19. Open Work

### P0 / Blocking Before Production-Like Release

1. Resolve Activepieces license/edition boundary for embedded builder, provisioning, piece visibility policy, branding/debranding and any enterprise-like feature surfaces.
2. Decide production catalog policy: full catalog, restricted allowlist, or governed tiered policy. Current `max` is local default; production legal-data workflows likely need stricter controls.
3. Restore or document exact Activepieces source provenance. Current Stage17 docs say `E:/activepieces-main` lacks git metadata, so AP source commit evidence is unavailable.
4. Fix documentation drift: README Stage14 wording, OpenAPI Stage8 metadata, Stage17 docs vs latest `f7869ab` commit.
5. Make Stage17 release gate available in CI or document why it remains local-only.
6. Convert Stage17 `DEGRADED` readiness warnings into explicit accepted risk or harden them:
   - Activepieces worker heartbeat evidence.
   - Local Owner Key Vault availability.
7. Establish production deployment runbook and evidence, not just release manifest generation.
8. Recheck mojibake/encoding issues in Russian docs/env examples and prevent recurrence.

### P1 / Important Stabilization

1. Split or further modularize high-complexity backend services if test velocity or review safety suffers:
   - `canvas`
   - `activepieces`
   - `ai-gateway`
   - `workflow-compiler`
2. Add a dedicated Stage17 GitHub workflow or reusable manual CI recipe.
3. Add an explicit architecture decision for `ACTIVEPIECES_CATALOG_MODE=max` default and production fallback behavior.
4. Turn pieces build blockers into an actionable setup path:
   - ensure AP source is git checkout;
   - install expected package manager/runtime such as bun when required;
   - document whether local `.tgz` piece builds are required or only runtime DB metadata is sufficient.
5. Align docs/integrations/activepieces.md with Stage17 `0.80.1`, max catalog mode and current AP env variables.
6. Strengthen AI provider governance for visible direct provider pieces.
7. Audit frontend route duplication and clarify canonical route for:
   - `/app/projects/.../automation`
   - `/builder`
   - `/advanced-builder`
   - `/canvas`
   - older `/automations/[id]/builder`.
8. Create route ownership table matching OpenAPI paths to backend modules and frontend consumers.

### P2 / Cleanup And Maintainability

1. Remove or archive stale local screenshots/logs if not intentionally tracked evidence.
2. Clean empty `activepieces` directory or document why it exists.
3. Move historical Stage16 evidence folder into `artifacts` or archive policy if it is still needed.
4. Add documentation index page linking architecture, Stage16, Stage17, readiness, security, testing and deployment docs.
5. Add machine-readable audit summary for future agents, e.g. `docs/project-audit/manifest.json`.
6. Review root metadata strings such as "Stage 0", "Stage 8", "Stage 14" and decide which are historical vs stale.

## 20. Risks And Technical Debt

| Risk | Impact | Current mitigation | Next action |
| --- | --- | --- | --- |
| Documentation drift across Stage14/16/17 | New contributors and agents may follow wrong runtime path. | Stage17 docs and artifacts exist. | Update README and docs index. |
| Activepieces source provenance incomplete | Hard to reproduce pieces inventory/build status exactly. | Runtime image pinned to `0.80.1`; inventory artifacts recorded. | Restore AP source as git checkout or vendor provenance metadata. |
| Stage17 local readiness is DEGRADED | Non-blocking warnings may hide future regressions. | G0 accepts warnings because no blocking errors. | Decide whether worker heartbeat/local owner keys should become required. |
| Max catalog overexposes integrations | Production data exfiltration or policy bypass risk. | Local-only profile notes, secret absence, AI Gateway warning. | Define production piece governance. |
| Direct AI pieces visible | Users may bypass legal-data AI Gateway policy. | Policy docs warn against bypass. | Enforce route/piece policy for production data classes. |
| Mojibake in docs/examples | Russian docs and brand names become unreadable or untrustworthy. | Localization runtime evidence passes. | Normalize file encoding and add check. |
| Huge backend modules | Harder reviews, higher regression blast radius. | Unit/integration gates exist. | Refactor by bounded responsibilities only after stable tests. |
| CI lacks Stage17 full local-integrated gate | Stage17 regressions may be caught only manually. | Local release-gate artifacts tracked. | Add optional/manual Stage17 workflow. |
| Production readiness not proven | Deploy workflows build manifests but do not prove runtime. | Local integrated evidence exists. | Add staging smoke and production runbook evidence. |
| Local secrets dependency | Runtime can fail when `.local/secrets/stage17` or owner keys missing. | `stage17:init-local-secrets` exists. | Improve diagnostics and bootstrap docs. |

## 21. Recommended Next Plan

### Iteration A: Documentation Alignment

Goal: make repository self-describing for current Stage17 state.

Actions:

1. Update `README.md` from Stage14-centered runtime track to current Stage17-centered overview, while keeping Stage14/16 historical commands.
2. Add a docs index linking:
   - architecture overview;
   - readiness profiles;
   - Stage16 Canvas;
   - Stage17 embedded Activepieces;
   - security/secrets;
   - deployment/runbooks.
3. Normalize OpenAPI title/version or document why it remains Stage8.
4. Fix mojibake in Russian docs and examples.
5. Add "current stage status" table to docs root.

Acceptance:

- New engineer can find the canonical local runtime path in under 2 minutes.
- No conflicting "current stage" statements remain without explanation.
- `security:check-no-local-secrets` and `secret-scan` still pass.

### Iteration B: Stage17 CI And Reproducibility

Goal: make Stage17 release evidence repeatable beyond one local machine.

Actions:

1. Add manual GitHub workflow for Stage17 release gate or a documented local-only limitation.
2. Capture Docker image tags/digests and AP source provenance.
3. Make worker heartbeat readiness decision explicit.
4. Improve Stage17 pieces build prerequisites documentation.
5. Ensure `stage17:compose:config` and release gate logs are easy to collect.

Acceptance:

- Stage17 gate can be run by another engineer with documented prerequisites.
- Runtime evidence identifies exact LexFrame and Activepieces source/image provenance.

### Iteration C: Production Policy Hardening

Goal: separate local maximal catalog convenience from production legal-data policy.

Actions:

1. Add ADR for Activepieces catalog governance.
2. Define piece risk tiers:
   - utility/internal safe;
   - OAuth external SaaS;
   - file/document egress;
   - direct AI provider;
   - webhook/HTTP/code execution.
3. Enforce production defaults through backend provisioning and env policy.
4. Keep `restricted` rollback tested.
5. Update readiness/security checks to assert production policy.

Acceptance:

- Production cannot accidentally enable broad pieces without explicit env/ADR.
- Direct AI pieces cannot process sensitive legal data outside AI Gateway policy.

### Iteration D: Future LexFrame Canvas

Goal: plan the deferred proprietary simplified LexFrame Canvas separately from Stage17 MVP.

Actions:

1. Define product requirements for simplified legal-workflow authoring.
2. Confirm canonical DSL/schema gaps.
3. Define migration/import path from Activepieces MVP flows to LexFrame DSL drafts.
4. Reuse Stage16 Canvas validation/publish/runtime sync gates.
5. Keep embedded Activepieces as advanced/admin mode if accepted.

Acceptance:

- Stage17 MVP scope remains stable.
- Future Canvas work has its own roadmap, gates and migration strategy.

## 22. Validation Checklist For This Audit File

Completed during audit preparation:

- Root branch and commit inspected.
- Root package scripts inspected and grouped.
- Workspace packages inspected.
- Backend modules and controller route families inspected.
- Frontend route tree inspected.
- Supabase migrations/seeds/tests inventoried.
- Docs and Stage17 artifacts inventoried.
- Stage17 release gate and readiness artifacts parsed.
- Activepieces pieces inventory/build/sync/verify artifacts parsed.
- Docker Compose Stage17 service/env surface inspected.
- CI workflow inventory inspected.
- Local `.env` real values were not copied into this file.

Not performed during this audit:

- Did not rerun `corepack pnpm stage17:release-gate`.
- Did not restart Docker runtime.
- Did not regenerate artifacts.
- Did not validate production deployment.
- Did not run full `corepack pnpm check`.

Recommended commands if this audit must be revalidated live:

```bash
corepack pnpm stage17:compose:config
corepack pnpm stage17:readiness:evidence
corepack pnpm stage17:runtime:evidence
corepack pnpm stage17:pieces:verify
corepack pnpm stage17:release-gate
corepack pnpm security:check-no-local-secrets -- --all
corepack pnpm security:scan-secrets
```

## 23. Appendix A: Key Files

| File | Why it matters |
| --- | --- |
| `package.json` | Command surface and release-gate orchestration. |
| `pnpm-workspace.yaml` | Workspace membership. |
| `apps/backend/src/app.module.ts` | Backend module composition. |
| `apps/backend/src/main.ts` | Backend runtime bootstrap. |
| `apps/web/src/app/layout.tsx` | Frontend root layout/providers. |
| `docs/contracts/api/openapi.yaml` | HTTP API contract. |
| `config/readiness/profiles.json` | Readiness profile source of truth. |
| `compose.yaml` | General local-integrated stack. |
| `infra/docker/docker-compose.stage17.local-integrated.yml` | Stage17 dedicated local stack. |
| `infra/docker/nginx.stage17.local-integrated.conf` | Stage17 reverse proxy routes. |
| `scripts/stage17/release-gate.mjs` | Stage17 G0-G10 release gate. |
| `scripts/stage17/provision-canvas.mjs` | Stage17 Activepieces project/user/flow provisioning. |
| `scripts/stage17/patch-activepieces-runtime.mjs` | Runtime localization/debranding patching. |
| `scripts/stage17/collect-open-source-pieces.mjs` | Pieces inventory collection. |
| `scripts/stage17/verify-open-source-pieces.mjs` | Pieces verification and runtime catalog check. |
| `artifacts/stage17/release-gate.json` | Machine-readable Stage17 release result. |
| `artifacts/stage17/readiness-stage17.json` | Stage17 readiness evidence. |
| `artifacts/stage17/runtime-evidence.json` | Stage17 runtime binding and secret scan evidence. |
| `artifacts/stage17/pieces-verify-report.json` | Max catalog verification evidence. |
| `docs/stage17/stage17-release-gate-report.md` | Human-readable Stage17 release report. |

## 24. Appendix B: Environment Variable Catalog Without Values

General product/runtime variable groups observed in examples and compose:

| Group | Variables |
| --- | --- |
| Node/runtime | `NODE_ENV`, `PORT` |
| LexFrame app | `LEXFRAME_APP_BASE_URL`, `LEXFRAME_ENV_PROFILE`, `LEXFRAME_READINESS_PROFILE`, `LEXFRAME_DEPLOY_ENV`, `LEXFRAME_CONTRACTS_VERSION`, `LEXFRAME_RELEASE_SHA`, `LEXFRAME_METRICS_ENABLED`, `LEXFRAME_HEALTHCHECK_TIMEOUT_MS` |
| Session/security policy | `LEXFRAME_REQUIRE_MFA_FOR_ADMIN_ACTIONS`, `LEXFRAME_REQUIRE_REAUTH_FOR_ADMIN_ACTIONS`, `LEXFRAME_DEFAULT_SESSION_MAX_AGE_MINUTES`, `LEXFRAME_DEFAULT_IDLE_TIMEOUT_MINUTES` |
| AI policy | `LEXFRAME_AI_SENSITIVE_DATA_POLICY`, `AI_PROVIDER_MODE`, `LEXFRAME_AI_TEST_FORCE_COMETAPI`, `LEXFRAME_AI_TEST_MODEL`, `XAI_API_KEY`, `COMETAPI_API_KEY`, `COMETAPI_API_KEYS` |
| Delivery | `LEXFRAME_DELIVERY_TRANSPORT`, `LEXFRAME_DELIVERY_WEBHOOK_URL`, `LEXFRAME_DELIVERY_WEBHOOK_TOKEN`, `LEXFRAME_DELIVERY_TIMEOUT_MS`, `LEXFRAME_DELIVERY_FROM_EMAIL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Activepieces backend | `ACTIVEPIECES_BASE_URL`, `ACTIVEPIECES_PUBLIC_URL`, `ACTIVEPIECES_API_KEY`, `ACTIVEPIECES_API_KEY_SECRET_REF`, `ACTIVEPIECES_API_KEY_FILE`, `ACTIVEPIECES_SIGNING_PRIVATE_KEY`, `ACTIVEPIECES_SIGNING_PRIVATE_KEY_SECRET_REF`, `ACTIVEPIECES_SIGNING_PRIVATE_KEY_FILE`, `ACTIVEPIECES_SIGNING_KEY_ID` |
| Activepieces infra | `AP_POSTGRES_PASSWORD`, `AP_REDIS_PASSWORD`, `AP_JWT_SECRET`, `AP_ENCRYPTION_KEY`, `AP_WORKER_TOKEN`, `ACTIVEPIECES_POSTGRES_HOST`, `ACTIVEPIECES_POSTGRES_PORT`, `ACTIVEPIECES_POSTGRES_DATABASE`, `ACTIVEPIECES_POSTGRES_USERNAME`, `ACTIVEPIECES_POSTGRES_PASSWORD_FILE`, `ACTIVEPIECES_REDIS_HOST`, `ACTIVEPIECES_REDIS_PORT`, `ACTIVEPIECES_REDIS_PASSWORD_FILE`, `ACTIVEPIECES_REDIS_TYPE` |
| Activepieces catalog/policy | `ACTIVEPIECES_CATALOG_MODE`, `AP_PIECES_SOURCE`, `AP_PIECES_SYNC_MODE`, `ACTIVEPIECES_NETWORK_MODE`, `ACTIVEPIECES_SSRF_ALLOW_LIST`, `ACTIVEPIECES_MVP_CANVAS_ENABLED`, `ACTIVEPIECES_FORCE_RU_LOCALE`, `ACTIVEPIECES_BRAND_DISPLAY_NAME`, `ACTIVEPIECES_SIMULATE_RUNS` |
| Frontend public AP | `NEXT_PUBLIC_ACTIVEPIECES_INSTANCE_URL`, `NEXT_PUBLIC_ACTIVEPIECES_RUNTIME_URL`, `NEXT_PUBLIC_ACTIVEPIECES_MVP_CANVAS_ENABLED`, `NEXT_PUBLIC_LEXFRAME_AP_DESIGN_SYSTEM_ENABLED`, `NEXT_PUBLIC_LEXFRAME_CANVAS_RESERVE_ENABLED`, `NEXT_PUBLIC_ACTIVEPIECES_EMBED_SDK_URL` |
| Search/analytics | `OPENSEARCH_URL`, `OPENSEARCH_INDEX_ALIAS`, `OPENSEARCH_SEARCH_PIPELINE`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `GRAFANA_BASE_URL`, `SENTRY_DSN` |
| Temporal | `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE` |
| Local owner keys | `LEXFRAME_LOCAL_KEYS_HOST_DIR`, `LEXFRAME_LOCAL_KEYS_FILE`, `LEXFRAME_LOCAL_KEYS_DISABLED` |
| Stage17 gates | `LEXFRAME_STAGE17_READINESS_ENABLED`, `LEXFRAME_STAGE17_REQUIRE_WORKER_HEARTBEAT`, `LEXFRAME_STAGE17_REQUIRE_UX_ARTIFACTS`, `LEXFRAME_AP_DESIGN_SYSTEM_ENABLED`, `LEXFRAME_STAGE17_I18N_ARTIFACT_PATH`, `LEXFRAME_STAGE17_BRANDING_ARTIFACT_PATH`, `LEXFRAME_STAGE17_DESIGN_TOKENS_ARTIFACT_PATH` |

No real secret values are included in this audit.

## 25. Appendix C: Recent Git Context

Recent commits:

```text
f7869ab Включен максимальный каталог Activepieces для Stage 17
24d6e7b Восстановлен Stage 17 runtime
f25691f Исправлен локальный запуск Activepieces Canvas на 3200
a7d9b03 Завершён Stage 17.12: closure, локализация без flicker, pieces pack и debranding hardening
08e0b3c Завершён Stage 17 с канвасом автоматизаций
ec14511 Добавлен full-runtime режим Stage 16
bafead8 Закрыты release gates Stage 16 Canvas
bce3f0c Стабилизирован Stage 16 release gate
5b60183 Подключён каталог Activepieces к палитре автоматизаций
ddccd0a Завершён мост каталога Activepieces для Canvas
0be6e80 Восстановлен Docker-контур Stage 16
2abf1b7 Закрыт Stage 16 Scenario 20 accessibility gate
```

Interpretation:

- Stage16 Canvas work was completed before Stage17.
- Stage17 then introduced embedded Activepieces canvas, localization/debranding and pieces pack work.
- The latest commit made maximal Activepieces catalog the Stage17 default and captured release-gate PASS evidence.

## 26. Appendix D: Glossary

| Term | Meaning in this repo |
| --- | --- |
| LexFrame / Lextreme | Product platform name used by the user/project context; repository package name is `lexframe`. |
| Product DB | LexFrame-owned Postgres schema containing canonical business entities. |
| Activepieces DB | Separate Postgres DB for AP runtime/builder internals. |
| Runtime projection | Executable representation sent to AP or compiled from LexFrame workflow state. |
| Canvas v2 | LexFrame workflow control plane based on workflow DSL and backend validation. |
| Embedded Activepieces Canvas | Stage17 MVP authoring surface opened inside LexFrame. |
| AI Gateway | Backend-controlled AI routing and policy layer. |
| Local Owner Key Vault | Owner-machine-bound local key surface used by Stage17 security model. |
| Release gate | Scripted acceptance gate producing machine-readable and human-readable evidence. |
| Readiness profile | Configured dependency enforcement profile such as `local-basic`, `local-integrated`, `staging-rc`, `production`. |
