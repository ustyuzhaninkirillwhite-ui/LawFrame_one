# LexFrame Project Audit

Дата аудита: 2026-05-06

Репозиторий: `E:\Law_frame_main`

Git context: `main`, `3b6e77b Обновлена дизайн-конвергенция Stage 17`

Краткий статус: LexFrame - pnpm-монорепозиторий юридической automation/workflow-платформы. Внутри находятся NestJS backend, Next.js web UI, shared TypeScript packages, Supabase-compatible SQL слой, Activepieces runtime contour, Stage 16/17 release gates, Playwright evidence и отдельный Python mining worker. На дату аудита основной актуальный трек - Stage 17: локальный Activepieces runtime, каталог pieces, debranding/localization, дизайн-конвергенция и светлая тема по умолчанию.

## 1. Executive Summary

LexFrame - это платформа для юридической автоматизации, построенная вокруг рабочих пространств, проектов, документов, юридических источников, AI/RAG-сценариев, canvas/workflow-модели, запусков автоматизаций, согласований и доставки результатов. Проект не является простой демонстрационной UI-оболочкой: в репозитории есть backend-контракты, SQL migrations, e2e-проверки, runtime-интеграции, security gates и evidence-документация.

Основные возможности проекта:

- Управление рабочими пространствами, проектами, профилями и доступами.
- Работа с документами: загрузка, классификация, шаблоны, генерация, валидация, signed URL/storage readiness.
- Юридический поиск, источники и RAG-анализ.
- AI gateway с политиками доступа, mock/provider режимами, redaction/security слоями.
- Workflow/canvas модель: блоки, связи, validation, snapshots, версии, test planning, runtime projection.
- Интеграция Activepieces: embedded builder, session/token flow, catalog/pieces, callbacks, run smoke, runtime evidence.
- Delivery, approvals, notifications, audit log, telemetry и readiness diagnostics.
- Stage 16/17 release gates: визуальная регрессия, секреты, localization/debranding, runtime evidence, functionality preservation.

Ключевое изменение, которое должно быть отражено в дальнейшей документации: светлая тема теперь является дефолтной поверхностью LexFrame. Это закреплено не только визуально, но и технически:

- `apps/web/src/providers/theme-provider.tsx` задает `defaultTheme = "light"` и хранит выбор в `lexframe-ui-theme`.
- `apps/web/src/app/layout.tsx` выставляет `data-theme="light"` и `className="light"` до hydration.
- `apps/web/src/app/globals.css` импортирует CSS bridge из `@lexframe/design-system-activepieces-bridge`.
- `packages/design-system-activepieces-bridge/src/css/activepieces-theme.css` содержит светлые `--lf-*` токены.
- `packages/design-system-activepieces-bridge/src/css/activepieces-theme.dark.css` оставляет dark overrides через `.dark` и `[data-theme="dark"]`.
- `apps/web/src/features/automation-canvas/*` прокидывает текущую тему в embedded Activepieces SDK через `styling.mode` и обновляет session при смене темы.

Главные сильные стороны:

- Хорошо выраженная модульность backend: домены разделены по NestJS modules.
- Контрактный подход: `packages/contracts`, JSON schemas, validation scripts, API client.
- Богатый набор release gates, особенно вокруг Stage 16/17.
- Отдельный design-system bridge для выравнивания LexFrame и Activepieces.
- Наличие evidence docs и screenshots, позволяющих восстановить ход Stage 17.

Главные риски:

- `README.md` все еще описывает Stage 14 runtime track, тогда как актуальная кодовая и скриптовая поверхность уже Stage 17.
- В корне много runtime logs, screenshots и временных файлов. Их нужно трактовать как evidence/локальный след, а не как исходный код.
- `.env` и локальные secret-файлы присутствуют в рабочей копии. Аудиты и документация не должны копировать значения секретов.
- Activepieces runtime зависит от локального Docker/compose профиля, patch/provision scripts и внешнего состояния контейнеров.
- Полная проверка проекта тяжелая: `pnpm check` включает build, contracts, backend, frontend, db, ai, Activepieces, security и e2e.

## 2. Источники Аудита

Аудит составлен как самостоятельный документ на основе текущей рабочей копии и следующих источников:

| Источник | Что использовано |
| --- | --- |
| `README.md` | Базовое описание монорепозитория, Stage 14 local profiles, команды запуска и readiness notes. |
| `package.json` | Root scripts, Stage 16/17 gates, security checks, build/typecheck/lint/test команды. |
| `pnpm-workspace.yaml` | Workspace layout: `apps/*`, `packages/*`, `tests/*`. |
| `apps/backend` | NestJS API, controllers, modules, backend dependencies and tests. |
| `apps/web` | Next.js app, routes, providers, UI layers, theme implementation, Activepieces canvas embedding. |
| `apps/mining-worker` | Отдельный Python worker и его runtime boundary. |
| `packages/*` | Shared contracts, workflow libraries, Activepieces tooling, design bridge. |
| `docs/project-audit/lexframe-project-audit-2026-05-05.md` | Предыдущий подробный аудит, использован как baseline. |
| `docs/stage17/*` | Stage 17 evidence, risk register, release gate reports, localization/debranding, design token docs. |
| `docs/stage17/17.8/design-token-mapping.md` | Подтверждение light-default update и публичных интерфейсов design bridge. |
| `docs/stage17/visual-regression-report.md` | Описание visual regression gate для AP-like surfaces и canvas preservation. |
| `docs/frontend/routes-and-screens.md` | Историческая карта экранов, дополненная фактической структурой App Router. |
| `supabase/migrations`, `supabase/seed`, `supabase/tests` | SQL migrations, seed data, pgtap/security suites. |
| `tests/e2e` | Playwright coverage по readiness, documents, Activepieces, security, Stage 17 canvas/design. |
| Git context | Последние коммиты Stage 17 и чистый `git status` на момент аудита. |
| Runtime artifacts | Логи, screenshots и evidence файлы учтены как диагностический след, без включения секретов. |

Дополнительный источник ориентации: codebase-memory graph для проекта `E-Law_frame_main`. Индекс содержит 37 372 nodes и 74 586 edges, включая functions, methods, classes, files, routes, imports, calls и тестовые связи. Граф подтверждает крупный TypeScript/NestJS/Next.js проект и используется только как вспомогательная карта кода.

## 3. Общее Назначение Проекта

LexFrame решает задачу юридической операционной платформы: собрать документы, источники, знания, AI-инструменты и автоматизации в единый workflow-контур. В пользовательской модели есть несколько ключевых сущностей.

| Сущность | Назначение |
| --- | --- |
| Workspace | Организационная граница доступа, настроек, профилей и политик. |
| Project | Контекст юридической работы: дело, клиентский запрос, пакет документов или автоматизация. |
| Document | Файл или генерируемый документ, проходящий хранение, классификацию, валидацию и генерацию. |
| Legal source | Юридический источник или материал для поиска/RAG. |
| Automation | Сценарий, который связывает действия, документы, AI, delivery и approvals. |
| Canvas | Визуальная модель workflow с nodes, edges, блоками, validation и runtime projection. |
| Run | Исполнение автоматизации или ее отдельного шага. |
| Approval | Ручное согласование, gate или контрольная точка в юридическом процессе. |
| Delivery | Отправка или публикация результата через webhook/sandbox/integration transport. |
| Readiness | Диагностика готовности runtime, storage, AI, Activepieces, delivery и security prerequisites. |

Основные пользовательские сценарии:

- Юрист или оператор открывает проект, видит состояние документов, автоматизаций и рекомендаций.
- Пользователь загружает документы, запускает классификацию или генерацию по шаблонам.
- Пользователь запускает RAG-анализ или AI chat с учетом политики провайдера и безопасности.
- Пользователь собирает workflow в canvas/Activepieces builder, проверяет readiness и запускает автоматизацию.
- Система пишет audit/telemetry, проверяет approvals и delivery gates, показывает run timeline.
- Администратор контролирует security posture, секреты, интеграции, Activepieces runtime и release gates.

Проект устроен так, что demo/local контуры и production-like gates существуют рядом. Это полезно для развития, но требует строгой документационной дисциплины: README, audit docs, Stage docs и package scripts должны быть синхронизированы.

## 4. Технологический Стек

### 4.1 Workspace

- Package manager: `pnpm@10.11.1`.
- Workspace packages: `apps/*`, `packages/*`, `tests/*`.
- Root scripts управляют build, typecheck, lint, tests, db, security, e2e, Stage 16/17 gates.
- TypeScript используется в backend, frontend и большинстве shared packages.

### 4.2 Backend

- Framework: NestJS 11.
- HTTP platform: `@nestjs/platform-fastify`, Fastify CORS.
- Database client: `pg`.
- Validation: AJV, AJV formats, DTO/contracts.
- Security/crypto: `jose`, local owner key vault, JWT/signing helpers.
- Documents: `docxtemplater`, `pizzip`.
- Workflow/canvas: internal packages `@lexframe/workflow`, `@lexframe/workflow-dsl`.
- Tests: Jest, Supertest, ts-jest.

### 4.3 Frontend

- Framework: Next.js 16 App Router.
- Runtime: React 19, React DOM 19.
- Styling: Tailwind 4, CSS variables, design-system bridge.
- Data: TanStack React Query, typed API client.
- State: Zustand and local providers.
- UI primitives: Radix Slot/Separator, local UI wrappers, lucide icons.
- Canvas: `@xyflow/react`.
- Rich text: Tiptap.
- Testing: Vitest, Testing Library, jsdom, MSW.

### 4.4 Data And Infra

- SQL layer: Supabase-compatible migrations, seed data and tests.
- Local runtime: Docker Compose.
- Services: Postgres, Redis, Activepieces app/worker, OpenSearch, storage sandbox, delivery sandbox.
- Stage runtime scripts: `stage16:*`, `stage17:*`.
- Evidence: Playwright screenshots, readiness JSON, runtime logs and generated reports.

### 4.5 Test Stack

- Unit/package tests: Jest, Vitest, Node test runner.
- Contract/schema checks: JSON schema validation, OpenAPI validation, workflow examples, release manifest.
- Database/security checks: DB readiness, RLS/security validators.
- E2E: Playwright under `tests/e2e`.
- Visual regression: Stage 17 design convergence Playwright screenshots.

## 5. Файловая Структура

### 5.1 Top-Level Map

| Путь | Назначение | Ответственность | Что не складывать |
| --- | --- | --- | --- |
| `.github` | CI/workflows и GitHub automation. | Release/CI configuration. | Runtime secrets, локальные evidence, временные логи. |
| `activepieces` | Локальный/вендорный Activepieces runtime context, если используется в Stage 17. | Runtime integration and patch/provision workflow. | LexFrame source, секреты, неописанные ручные патчи. |
| `apps` | Исполняемые приложения. | Product runtime: backend, web, worker. | Shared contracts, generated evidence, package-level libraries. |
| `artifacts` | Сгенерированные artifacts/evidence. | Diagnostics and release trace. | Исходный код и обязательные runtime dependencies. |
| `config` | Общие конфиги окружения/инфраструктуры. | Environment configuration. | Значения секретов. |
| `docs` | Архитектура, продукт, Stage docs, security, readiness, audits. | Документация и решения. | Runtime logs, приватные данные, неподтвержденные секреты. |
| `infra` | Инфраструктурные материалы. | Deploy/runtime topology. | Application source logic. |
| `packages` | Shared libraries and contracts. | Повторно используемый TypeScript код. | App-specific screens/controllers. |
| `scripts` | Validators, release gates, runtime helpers, evidence collectors. | Automation and quality gates. | Ручные одноразовые операции без описания. |
| `stage16-audit-evidence-*` | Evidence bundle Stage 16. | Исторический audit trail. | Новые исходники. |
| `supabase` | SQL migrations, seed, tests. | Data model and security SQL. | Runtime DB dumps with sensitive data. |
| `tests` | Playwright/e2e workspace and evidence. | End-to-end validation. | Application source logic. |
| `tmp`, `tmp_docker_diag` | Локальные временные diagnostics. | Debug only. | Документация, source, committed decisions. |
| `node_modules` | Installed dependencies. | Local dependency cache. | Manual edits. |
| `.env*` | Local/example environment files. | Local configuration. | Секреты в документации или audit excerpts. |
| `*.log`, `stage17-*.png`, `lexframe-light-theme-canvas-smoke.png` | Runtime logs/screenshots. | Evidence and debugging. | Source-of-truth implementation. |

### 5.2 Root Files

| Файл | Назначение |
| --- | --- |
| `README.md` | Базовая документация, но сейчас отстает: описывает Stage 14, тогда как активный runtime track уже Stage 17. |
| `package.json` | Root scripts, dependency policy, release gates. |
| `pnpm-workspace.yaml` | Workspace layout. |
| `pnpm-lock.yaml` | Locked dependency graph. |
| `compose.yaml` | Local Docker runtime, включая Postgres/Activepieces/OpenSearch/sandbox profiles. |
| `tsconfig.base.json` | Общие TypeScript настройки. |
| `eslint.config.mjs` | Root ESLint config. |
| `.env.example`, `.env.stage17.local.example` | Документированные env templates без реальных секретов. |
| `.env`, `.env.stage17.local`, `.env.test-secrets.local` | Локальные конфиги, нельзя цитировать значения. |

## 6. Applications

### 6.1 `apps/backend`

`apps/backend` - основной NestJS API. Он отвечает за доменную бизнес-логику, HTTP contracts, readiness, storage policies, Activepieces integration, AI gateway, canvas services, security controls и runtime callbacks.

Ключевые зоны:

- `src/modules/activepieces`: embed tokens, runtime sessions, flow provisioning, callbacks, catalog/pieces policy, audit writer, role mapper, JWT signer.
- `src/modules/ai-gateway`: AI chat/runtime, provider adapters, policy, workspace guards, redaction/security.
- `src/modules/canvas`: workflow canvas model, blocks, operations, validation, snapshots, publishing, security policy, testing and runtime projection.
- `src/modules/canvas-ai`: AI-assisted canvas planning, patching, diff, policy validation, telemetry.
- `src/modules/documents`, `document-generation`, `document-templates`, `document-types`, `document-validation`: document lifecycle.
- `src/modules/legal-*`: legal sources, legal search, indexing and RAG.
- `src/modules/delivery`, `approvals`, `notifications`, `runs`: process execution and operational surfaces.
- `src/modules/readiness`, `security-operations`, `secrets`, `audit`, `telemetry`: control plane and observability.
- `src/modules/database`: database service abstraction.
- `src/modules/workspaces`, `identity`, `profiles`, `authorization`: tenant/user boundaries.

Backend package commands:

- `pnpm --filter @lexframe/backend build`
- `pnpm --filter @lexframe/backend lint`
- `pnpm --filter @lexframe/backend typecheck`
- `pnpm --filter @lexframe/backend test`
- `pnpm --filter @lexframe/backend start:dev`

Основные backend dependencies: NestJS 11, Fastify, `pg`, AJV, JOSE, docxtemplater, PizZip, internal LexFrame packages.

### 6.2 `apps/web`

`apps/web` - Next.js App Router UI. Это основная пользовательская оболочка LexFrame: рабочие пространства, проекты, документы, автоматизации, builder/canvas, AI chat, recommendations, admin/security.

Ключевые слои:

- `src/app`: route tree, layouts and pages.
- `src/components`: общие и доменные компоненты, panels, shell, UI wrappers.
- `src/features`: feature-specific modules: `activepieces`, `automation-canvas`, `builder`, `canvas`.
- `src/hooks`: React Query/domain hooks and stage data access.
- `src/lib`: API helpers, browser auth, i18n, mock contract API, utility functions.
- `src/messages`: русская локализация UI.
- `src/mocks`: MSW and mock session data.
- `src/providers`: session, realtime, theme, query and app-level providers.
- `src/stores`: client-side state stores.
- `src/test`: Vitest setup.

Frontend package commands:

- `pnpm --filter @lexframe/web dev`
- `pnpm --filter @lexframe/web build`
- `pnpm --filter @lexframe/web lint`
- `pnpm --filter @lexframe/web typecheck`
- `pnpm --filter @lexframe/web test`
- `pnpm --filter @lexframe/web test:canvas:unit`
- `pnpm --filter @lexframe/web test:canvas:components`
- `pnpm --filter @lexframe/web test:canvas:contracts`

### 6.3 `apps/mining-worker`

`apps/mining-worker` - отдельный Python worker. В текущей структуре это не часть pnpm workspace package list, а самостоятельный worker boundary с `worker.py`, `requirements.txt` и `Dockerfile`.

Назначение:

- Изолировать mining/processing задачи от NestJS API.
- Запускаться как отдельный runtime artifact.
- Не принимать на себя frontend/backend shared contracts без явной интеграционной точки.

Риски:

- Нужно отдельно документировать deployment and lifecycle.
- Нужно отдельно валидировать Python dependencies и runtime health.
- Нельзя смешивать worker-local state с Supabase migrations или backend service logic.

## 7. Shared Packages

`packages` содержит переиспользуемые библиотеки, contracts, validators and Stage 17 integration tooling.

| Package | Назначение |
| --- | --- |
| `@lexframe/contracts` | Canonical DTOs, enums, JSON schemas, workflow/canvas schemas, release manifest schemas. |
| `@lexframe/api-client` | Typed HTTP client поверх backend contracts; используется web-приложением и тестами. |
| `@lexframe/config` | Public/server environment schemas на Zod. |
| `@lexframe/logger` | Shared structured logger. |
| `@lexframe/telemetry` | Event helpers and telemetry contracts. |
| `@lexframe/workflow` | Workflow schema and semantic validation. |
| `@lexframe/workflow-dsl` | Canvas block/node/edge/binding schemas, validation and compiler gates. |
| `@lexframe/workflow-compiler` | Compilation layer поверх workflow package. |
| `@lexframe/ai-gateway` | AI assets, schemas and prompts. |
| `@lexframe/activepieces-bridge` | Bridge primitives for Activepieces integration. |
| `@lexframe/activepieces-inventory` | Inventory model for Activepieces pieces. |
| `@lexframe/activepieces-catalog-sync` | CLI/package for syncing Activepieces catalog. |
| `@lexframe/activepieces-template-ingestor` | Template ingestion tooling. |
| `@lexframe/activepieces-legal-pieces` | Legal-domain Activepieces pieces and contracts. |
| `@lexframe/piece-ai-gateway` | Stage 17 AI gateway piece package. |
| `@lexframe/canvas-test-fixtures` | Canvas fixtures used by release gates and tests. |
| `@lexframe/design-system-activepieces-bridge` | Design tokens, CSS bridge, recipes and Tailwind exports for LexFrame/AP design convergence. |

Shared packages должны оставаться application-agnostic. Если код зависит от Next.js route, NestJS controller или конкретного UI screen, он должен жить в `apps/*`, а не в `packages/*`.

## 8. Backend Architecture

### 8.1 Module Groups

Backend состоит из большого набора NestJS modules. Ниже доменная группировка, полезная для ориентации и дальнейшего обслуживания.

| Зона | Модули | Ответственность |
| --- | --- | --- |
| Tenant/user boundary | `identity`, `authorization`, `workspaces`, `profiles`, `profile-imports` | Пользовательский контекст, workspace/session/profile rules, imports and access checks. |
| Documents | `documents`, `document-generation`, `document-templates`, `document-types`, `document-validation`, `clauses` | Document lifecycle, templates, generation jobs, validation, clause management. |
| Legal knowledge | `legal-sources`, `legal-search`, `legal-rag`, `legal-indexing`, `legal-modules` | Источники, индексирование, поиск, RAG-анализ, каталог юридических модулей. |
| AI | `ai-gateway` | AI requests, chat sessions, provider adapters, runtime policy, redaction/security. |
| Canvas/workflow | `canvas`, `canvas-ai`, `workflows`, `workflow-compiler`, `runs` | Canvas CRUD/validation, AI patching, workflow compilation, run state. |
| Activepieces | `activepieces`, `automation-library`, `automation-import` | Embedded builder, sessions, token flow, catalog, pieces policy, imports, runtime callbacks. |
| Operations | `delivery`, `approvals`, `notifications`, `dashboard`, `recommendations` | Operational workflows, approvals, delivery sandbox/integrations, dashboards, recommendation inbox. |
| Control plane | `readiness`, `security-operations`, `secrets`, `audit`, `telemetry`, `ops`, `compliance` | Health/readiness, secrets boundary, security posture, audit logs, telemetry and compliance. |
| Data/runtime | `database`, `runtime`, `local-owner-key-vault`, `stage15-projects`, `stage7-support` | Database abstraction, runtime helpers, local keys, compatibility/stage support. |

### 8.2 Controller Catalog

| Controller file | Назначение | Основные зависимости/риски |
| --- | --- | --- |
| `activepieces/activepieces.controller.ts` | Activepieces embed tokens, sync, run smoke, connections, callbacks, gate callbacks. | Token/JWT correctness, callback auth, runtime availability. |
| `admin-console/admin-console.controller.ts` | Admin console views/API. | Admin-only access and policy checks. |
| `ai-gateway/ai-gateway.controller.ts` | AI chat/session/request APIs. | Provider policy, redaction, data classification. |
| `ai-gateway/ai-gateway-runtime.controller.ts` | Runtime-facing AI gateway surface. | Runtime trust boundary. |
| `ai-gateway/ai-security.controller.ts` | AI security status/control endpoints. | Secret leakage and policy drift. |
| `approvals/approvals.controller.ts` | Approval inbox and workflow gates. | Human-in-the-loop correctness. |
| `audit/audit.controller.ts` | Audit read/write surfaces. | Log integrity and sensitive data redaction. |
| `authorization/authorization.controller.ts` | Authorization checks. | Workspace isolation. |
| `automation-import/automation-import.controller.ts` | Import automation templates/flows. | Schema validation and unsafe payloads. |
| `automation-library/automation-library.controller.ts` | Automation catalog/library. | Catalog drift and install state consistency. |
| `canvas/canvas.controller.ts` | Canvas model operations. | Validation, versioning, operation safety. |
| `canvas-ai/canvas-ai.controller.ts` | AI-assisted canvas changes. | Patch policy and hallucinated operations. |
| `clauses/clauses.controller.ts` | Clause catalog. | Template compatibility. |
| `compliance/compliance.controller.ts` | Compliance surfaces. | Policy evidence quality. |
| `dashboard/dashboard.controller.ts` | Dashboard summaries. | Aggregation correctness. |
| `delivery/delivery.controller.ts` | Delivery flows. | Webhook/sandbox readiness, retries. |
| `delivery/delivery-integrations.controller.ts` | Integration status and delivery readiness. | External transport config. |
| `document-generation/document-generation.controller.ts` | Document generation jobs. | Template data integrity. |
| `document-templates/document-templates.controller.ts` | Template management. | Versioning/publication state. |
| `document-types/document-types.controller.ts` | Document type catalog. | Classification contracts. |
| `document-validation/document-validation.controller.ts` | Document validation. | False positives/negatives. |
| `documents/documents.controller.ts` | Document upload/list/detail/storage flows. | Storage readiness and signed URL policy. |
| `identity/identity.controller.ts` | Identity/session context. | Authentication boundary. |
| `legal-modules/legal-modules.controller.ts` | Legal module catalog. | Module availability and compatibility. |
| `legal-rag/legal-rag.controller.ts` | RAG analysis and request summaries. | Source visibility, prompt safety, context limits. |
| `legal-search/legal-search.controller.ts` | Legal search. | Search backend readiness and ranking correctness. |
| `legal-sources/legal-sources.controller.ts` | Source management. | Visibility and indexing state. |
| `local-owner-key-vault/local-keys-status.controller.ts` | Local key vault status. | Local secret lifecycle. |
| `notifications/devices.controller.ts` | Notification devices. | Device identity and consent. |
| `notifications/notifications.controller.ts` | Notification inbox/events. | Delivery duplication and read state. |
| `ops/ops.controller.ts` | Operational diagnostics. | Internal-only exposure. |
| `profile-imports/profile-imports.controller.ts` | Profile import flows. | Input validation and data mapping. |
| `profiles/profiles.controller.ts` | User/team profiles. | Effective profile calculation. |
| `readiness/readiness.controller.ts` | Readiness endpoints. | Backward-compatible and strict profiles. |
| `recommendations/recommendations.controller.ts` | Recommendations and admin analytics. | Recommendation quality and policy. |
| `runs/runs.controller.ts` | Run detail/timeline. | Runtime event consistency. |
| `secrets/secrets.controller.ts` | Secrets status/control. | Never return secret values. |
| `security-operations/security-operations.controller.ts` | Security operations panels. | Severity and evidence correctness. |
| `stage15-projects/stage15-projects.controller.ts` | Stage 15 compatibility project APIs. | Legacy compatibility. |
| `telemetry/telemetry.controller.ts` | Telemetry ingest/query. | Consent and data minimization. |
| `workspaces/workspaces.controller.ts` | Workspace APIs. | Tenant isolation and membership rules. |

### 8.3 Backend Observations

- Backend is controller-heavy but domain folders keep ownership clear.
- Activepieces service is large and central to Stage 17; future maintenance should protect token/session/callback flows with focused tests.
- Canvas module is broad and contains many specialized services. It should be documented as a subsystem, not just a route group.
- Readiness is a first-class capability. It should stay backward-compatible for older checks and strict enough for Stage 17 gates.
- Security modules should keep returning status, metadata and diagnostics without leaking secret material.

## 9. Frontend Architecture

### 9.1 App Router Surface

Фактическая структура `apps/web/src/app` шире, чем исторический `docs/frontend/routes-and-screens.md`. Основные route families:

| Route family | Назначение |
| --- | --- |
| `/` | Root landing/redirect entry. |
| `/sign-in`, `/onboarding/workspace`, `/invite/[token]` | Auth and onboarding surfaces. |
| `/dashboard` | Readiness and orchestration overview. |
| `/library`, `/library/my`, `/library/[templateId]` | Template/library catalog. |
| `/automations`, `/automations/[id]`, `/automations/[id]/builder`, `/automations/[id]/updates` | Automation list/detail/builder/update surfaces. |
| `/app` | Stage 15/17 project shell entry. |
| `/app/projects/[projectId]` | Project home. |
| `/app/projects/[projectId]/automations/*` | Project automation list/detail/builder/canvas/advanced-builder surfaces. |
| `/app/projects/[projectId]/chats/[chatId]` | Project-scoped chat workspace. |
| `/app/runs/[runId]` and `/runs/[runId]` | Run detail/timeline. |
| `/documents`, `/documents/[id]`, `/documents/generation/[jobId]` | Document list/detail/generation job. |
| `/chat` | AI chat workspace. |
| `/research`, `/sources`, `/sources/[id]` | Legal research and source management. |
| `/recommendations`, `/workspace/recommendations` | Recommendation inbox/workspace recommendations. |
| `/approvals`, `/notifications` | Operational inbox surfaces. |
| `/modules`, `/modules/[code]` | Legal/module catalog. |
| `/settings/profile/*`, `/settings/documents/*` | Profile and document settings. |
| `/admin/*` | Admin console, access reviews, compliance, moderation, modules, recommendations. |
| `/admin/security/*` | Security console: Activepieces, AI, alerts, audit, incidents, policies, secrets, sessions. |

### 9.2 Frontend Layers

| Layer | Path | Ответственность |
| --- | --- | --- |
| Routes/layouts | `apps/web/src/app` | URL structure, layouts, page composition. |
| Shell | `apps/web/src/components/shell` | Project and workspace navigation, sidebar, project home, automation landing. |
| UI wrappers | `apps/web/src/components/ui` | Button, card, dialog, sheet, dropdown, table, tabs and other primitive wrappers. |
| Domain components | `apps/web/src/components/*` | Documents, recommendations, runs, security, readiness, templates, uploads. |
| Canvas feature | `apps/web/src/features/canvas` | Canvas components, hooks, fixtures, store, storybook registry, projection tests. |
| Automation canvas | `apps/web/src/features/automation-canvas` | Activepieces embedded builder route/wrapper, diagnostics, session hook, unavailable state. |
| Activepieces feature | `apps/web/src/features/activepieces` | Legacy/alternative embedded builder entrypoints. |
| Hooks | `apps/web/src/hooks` | API/query orchestration and domain-specific hooks. |
| Providers | `apps/web/src/providers` | App providers, session, realtime, mock session, theme. |
| Lib | `apps/web/src/lib` | API helper code, browser auth, i18n, route helpers, mock contract API. |
| Messages | `apps/web/src/messages` | Russian UI copy. |
| Mocks/tests | `apps/web/src/mocks`, `apps/web/src/test` | MSW and frontend test setup. |

### 9.3 Frontend Observations

- UI is currently Russian-first in many visible surfaces.
- Stage 17 introduced AP-like design convergence, but LexFrame retains legal-domain shell and workflows.
- The frontend uses a bridge token strategy rather than duplicating Activepieces styles ad hoc.
- Project shell and Activepieces canvas are high-risk visual surfaces because they combine routing, theme, session tokens, iframe/SDK configuration and localization overlay.

## 10. Светлая Тема И Design Convergence

### 10.1 Current Theme Contract

Светлая тема является дефолтной темой проекта на дату аудита.

Технический контракт:

- Theme type: `LexFrameTheme = "light" | "dark"`.
- Storage key: `lexframe-ui-theme`.
- Default: `light`.
- Root attributes: `data-theme="light"`, `className="light"`.
- Dark activation: `.dark` class and `[data-theme="dark"]`.
- Browser color scheme: `document.documentElement.style.colorScheme = theme`.

### 10.2 Theme Provider

Файл: `apps/web/src/providers/theme-provider.tsx`.

Ответственность:

- Создает `ThemeContext`.
- Читает persisted theme из `localStorage`.
- Нормализует любое значение кроме `"dark"` в `"light"`.
- Применяет тему к `document.documentElement`.
- Экспортирует `useTheme`, `setTheme`, `toggleTheme`.

Ключевой вывод: default fallback intentionally light. Это означает, что новые UI-поверхности должны проектироваться light-first, а dark mode должен быть поддерживаемым override, не основным визуальным контрактом.

### 10.3 Layout Bootstrap

Файл: `apps/web/src/app/layout.tsx`.

Ответственность:

- До hydration выполняет inline bootstrap script.
- Читает `lexframe-ui-theme`.
- Ставит `data-theme`, classes `light`/`dark` and `colorScheme`.
- В fallback case принудительно устанавливает light.
- HTML root начинается как `<html lang="ru" data-theme="light" className="light" suppressHydrationWarning>`.

Зачем это важно:

- Уменьшает flash of wrong theme.
- Делает light mode first paint predictable.
- Сохраняет пользовательский выбор dark mode, если он явно сохранен.

### 10.4 Global CSS And Token Bridge

Файл: `apps/web/src/app/globals.css`.

Импорты:

- `@import "tailwindcss";`
- `@import "@lexframe/design-system-activepieces-bridge/css/activepieces-theme.css";`
- `@import "@lexframe/design-system-activepieces-bridge/css/activepieces-theme.dark.css";`
- Fontsource IBM Plex Sans/Serif.
- `@xyflow/react/dist/style.css`.

Legacy variables вроде `--background`, `--panel`, `--line`, `--accent`, `--danger`, `--success` теперь мапятся на `--lf-*`. Это сохраняет совместимость старых компонентов и одновременно переводит дизайн на новую token system.

### 10.5 Design-System Activepieces Bridge

Package: `packages/design-system-activepieces-bridge`.

Публичные interfaces:

- `@lexframe/design-system-activepieces-bridge/css/activepieces-theme.css`
- `@lexframe/design-system-activepieces-bridge/css/activepieces-theme.dark.css`
- `@lexframe/design-system-activepieces-bridge/tailwind`
- `@lexframe/design-system-activepieces-bridge/recipes`
- `@lexframe/design-system-activepieces-bridge/tokens`

Светлый файл `activepieces-theme.css` содержит:

- App/card/panel/muted surfaces.
- Text primary/secondary/muted.
- Border/input/ring.
- Domain primary and AP primary accents.
- Success/warning/destructive/info.
- Radius, shadow, spacing, typography.
- Component states: hover, active, selected, disabled, skeleton, error, empty.
- Tailwind `@theme` exports for `--color-lf-*`, radius and shadows.

Темный файл `activepieces-theme.dark.css` содержит overrides для `.dark` и `[data-theme="dark"]`. Dark mode remains available, но не является default.

### 10.6 Activepieces Canvas Theme Propagation

Файлы:

- `apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx`
- `apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.tsx`

Поведение:

- Route получает `theme` через `useTheme`.
- Wrapper прокидывает тему в embedded SDK config как `embedding.styling.mode`.
- Если тема меняется после mount, route обновляет `mountedThemeRef` и запрашивает refresh session.
- Activepieces canvas surface получает тот же light/dark режим, что и LexFrame shell.

Риск: embedded SDK, iframe, localization overlay and runtime token refresh делают этот слой чувствительным к race conditions. Любое изменение темы, session hook или SDK load path должно проверяться визуально и e2e.

### 10.7 Evidence

Подтверждающие документы/артефакты:

- `docs/stage17/17.8/design-token-mapping.md`: `Status: IMPLEMENTED / LIGHT DEFAULT UPDATED`, дата 2026-05-06.
- `docs/stage17/visual-regression-report.md`: AP-like surfaces and canvas preservation surfaces.
- `stage17-app-live.png`, `stage17-project-live.png`, `stage17-automation-canvas-live.png`, `lexframe-light-theme-canvas-smoke.png`: локальные screenshots/evidence.
- `pnpm stage17:17.8:check` and `pnpm stage17:visual:regression`: validation commands for design convergence.

## 11. Data Layer And Supabase

`supabase` содержит SQL source of truth для локального Supabase-compatible профиля.

Фактическая структура:

- `supabase/README.md`
- `supabase/migrations`: 49 SQL migration files.
- `supabase/seed`: 7 seed files plus cleanup.
- `supabase/tests/pgtap`: 14 pgtap/security tests.

| Зона | Назначение | Проверка | Риск |
| --- | --- | --- | --- |
| `migrations` | Schema evolution, tables, policies, functions, release gates. | Apply migrations in sorted order; run DB readiness and pgtap checks. | Migration drift между локальным Postgres и ожидаемым Supabase behavior. |
| `seed` | Demo/local baseline data. | Apply after migrations in documented order. | Seed data can mask missing runtime configuration. |
| `tests/pgtap` | SQL-level assertions, likely RLS/security coverage. | `pnpm check:db`, `pnpm db:test:rls`. | Tests require compatible local DB state. |
| `scripts/bootstrap-local-supabase-compat.sql` | Compatibility bootstrap for local Docker Postgres. | Run before migrations in Stage 14/legacy flow when needed. | README still highlights Stage 14 instructions, while active Stage 17 scripts may be preferred. |

Data-layer guidance:

- SQL migrations are source. Runtime DB dumps are not.
- Never include real data exports or secrets in docs.
- Keep backend DTO/contracts and SQL migrations synchronized through contract checks.
- RLS/security tests should be part of release gate decisions, not optional manual notes.

## 12. Activepieces Runtime

Stage 17 centers on Activepieces integration. The repository has both LexFrame-native automation/canvas work and embedded Activepieces builder/runtime work.

### 12.1 Runtime Responsibilities

| Area | Responsibility |
| --- | --- |
| Embedded builder | Render Activepieces builder/canvas inside LexFrame project automation routes. |
| Session/token flow | Issue protected session/JWT/embed tokens and initialize sessions. |
| Runtime callbacks | Receive step/run/approval/delivery callbacks and persist operational state. |
| Catalog/pieces | Inventory, sync, build, verify and expose open-source pieces. |
| Local owner key vault | Protect local signing/encryption material for Stage 17. |
| Localization | Force/verify Russian UI and overlay visible strings where needed. |
| Debranding | Replace visible Activepieces brand surfaces while preserving license notices. |
| Security gates | Check no provider keys in frontend bundle, secret scans, callback trust boundaries. |

### 12.2 Relevant Paths

- `apps/backend/src/modules/activepieces`
- `apps/web/src/features/automation-canvas`
- `packages/activepieces-bridge`
- `packages/activepieces-inventory`
- `packages/activepieces-catalog-sync`
- `packages/activepieces-template-ingestor`
- `packages/activepieces-legal-pieces`
- `packages/piece-ai-gateway`
- `docs/stage17/*`
- `scripts/stage17/*`
- `activepieces`

### 12.3 Stage 17 Runtime Scripts

| Script | Purpose |
| --- | --- |
| `pnpm stage17:init-local-secrets` | Prepare local secret material/templates for Stage 17. |
| `pnpm stage17:compose:config` | Render/check Stage 17 compose config. |
| `pnpm stage17:up` | Start Stage 17 runtime contour. |
| `pnpm stage17:down` | Stop Stage 17 runtime contour. |
| `pnpm stage17:logs` | Inspect runtime logs. |
| `pnpm stage17:ps` | Inspect running services. |
| `pnpm stage17:activepieces:patch-runtime` | Patch local Activepieces runtime as required by LexFrame integration. |
| `pnpm stage17:provision-canvas` | Provision Activepieces canvas/session baseline. |
| `pnpm stage17:readiness` | Query Stage 17 readiness endpoint. |
| `pnpm stage17:evidence` | Collect readiness evidence. |
| `pnpm stage17:activepieces:evidence` | Collect Activepieces runtime evidence. |
| `pnpm stage17:runtime:evidence` | Collect broader runtime evidence. |

### 12.4 License And Source Boundary

Stage 17 docs explicitly track open-source pieces, debranding, localization and license notices. Important boundaries:

- Allowed source zones from Activepieces are documented in `docs/stage17/17.8/design-token-mapping.md`.
- Forbidden EE/source zones must remain excluded.
- Debranding must not remove required license notices.
- Runtime patching must be reproducible through scripts, not undocumented manual edits.

## 13. Security, Secrets And Readiness

### 13.1 Readiness

Readiness is an architectural feature, not just a health endpoint. The README notes:

- `GET /health/readiness` remains backward-compatible and returns effective readiness profile and service summary.
- `GET /health/readiness/details` exposes strict profile contract, blocked reasons and service diagnostics.
- `GET /integrations/delivery/status` reports delivery webhook/sandbox readiness.
- `POST /delivery/sandbox/test` dispatches a synthetic payload without creating a workflow run.

Stage 17 adds `pnpm stage17:readiness` and evidence collectors around `/api/readiness/stage17`.

### 13.2 Secrets

Local files present in the working copy include:

- `.env`
- `.env.example`
- `.env.stage17.local`
- `.env.stage17.local.example`
- `.env.test-secrets.local`

Audit rule: mention file names and required variable categories only. Never copy secret values, API keys, signing keys, tokens or private material.

Security scripts:

- `pnpm secret-scan`
- `pnpm security:scan-secrets`
- `pnpm security:check-no-local-secrets`
- `pnpm validate:web-bundle-secrets`
- `pnpm security:frontend-bundle`
- `pnpm security:stage17:no-provider-key`
- `pnpm stage17:security:scan-secrets`
- `pnpm stage17:security:scan-frontend-bundle`
- `pnpm stage17:security:scan-browser-evidence`

### 13.3 Security Surfaces

| Surface | Risk | Expected control |
| --- | --- | --- |
| AI provider keys | Leakage into frontend bundle or evidence. | No-provider-key checks, frontend bundle scan, secret scan. |
| Activepieces embed token | Unauthorized builder access. | JWT signing, session initialization, callback validation. |
| Local owner key vault | Local secret compromise. | Status checks and Stage 17 security reports. |
| Delivery webhook | Unauthorized payload dispatch. | Webhook token, sandbox readiness, delivery status. |
| Documents storage | Access to private documents. | Signed URLs, readiness errors when storage unavailable. |
| Audit logs | Sensitive payload retention. | Safe audit writer, redaction policy. |
| Browser evidence | Secret leakage into screenshots/logs. | Stage 17 browser evidence scan. |

## 14. Scripts, Gates And Validation

### 14.1 Root Quality Gates

| Script | Purpose | When to run |
| --- | --- | --- |
| `pnpm build` | Build all workspace packages sequentially. | Before release or major integration. |
| `pnpm typecheck` | Typecheck all workspaces. | Before merge and after contract changes. |
| `pnpm lint` | Lint all workspaces. | Before merge. |
| `pnpm test` | Run all package tests. | Before merge where feasible. |
| `pnpm check` | Full release-like root gate. | Before declaring project-wide readiness. |
| `pnpm check:backend` | Backend build/lint/typecheck/test. | Backend changes. |
| `pnpm check:frontend` | Web build/lint/typecheck/test. | Frontend/theme/UI changes. |
| `pnpm check:contracts` | Contracts, OpenAPI, JSON schemas, workflow examples, canvas fixtures, release manifest. | Contract/schema changes. |
| `pnpm check:db` | DB readiness and RLS tests. | Migration/security changes. |
| `pnpm check:ai` | AI assets validation. | AI gateway asset/prompt/schema changes. |
| `pnpm check:activepieces` | Activepieces legal pieces package and validator. | Activepieces package changes. |
| `pnpm check:security` | Security validators and secret scans. | Security-sensitive or release changes. |
| `pnpm check:e2e` | Playwright e2e. | User-facing and integration changes. |

### 14.2 Stage 16 Gates

Stage 16 scripts focus on DB bootstrap, runtime health, full runtime, backend/web runtime builds, Activepieces evidence, compose helper validation, release gate integrity, live audit, mutation proof and release gate.

Important scripts:

- `pnpm stage16:db:bootstrap`
- `pnpm stage16:db:apply-local`
- `pnpm stage16:runtime:health`
- `pnpm stage16:runtime:up-full`
- `pnpm stage16:release-gate`

### 14.3 Stage 17 Gates

Stage 17 scripts focus on Activepieces runtime, local secrets, design convergence, localization/debranding, pieces catalog, security scans, evidence and final release gate.

Important scripts:

- `pnpm stage17:17.5:check`
- `pnpm stage17:17.5:release-gate`
- `pnpm stage17:17.8:check`
- `pnpm stage17:17.8:visual`
- `pnpm stage17:visual:regression`
- `pnpm stage17:localization:check`
- `pnpm stage17:debranding:check`
- `pnpm stage17:closure:verify`
- `pnpm stage17:artifacts:verify`
- `pnpm stage17:stop-list:verify`
- `pnpm stage17:release-gate`

For light theme/design changes, minimum recommended validation is:

1. `pnpm --filter @lexframe/design-system-activepieces-bridge build`
2. `pnpm --filter @lexframe/design-system-activepieces-bridge test`
3. `pnpm --filter @lexframe/web typecheck`
4. `pnpm stage17:17.8:gate`
5. `pnpm stage17:visual:regression`

## 15. Текущее Состояние И Риски

### 15.1 Status Matrix

| Subsystem | Current status | Evidence | Risk |
| --- | --- | --- | --- |
| Backend API | Broad module coverage, active Stage 17 integration. | Controllers/modules present, backend package scripts. | Large Activepieces/canvas services need focused regression tests. |
| Frontend UI | Next.js App Router, Russian UI, Stage 17 shell and canvas routes. | Route tree, package dependencies, screenshots. | Visual and routing drift across legacy and Stage 17 routes. |
| Light theme | Implemented as default. | Theme provider, layout bootstrap, CSS bridge, Stage 17 design-token doc. | Must keep dark overrides working without making dark the implicit source of truth. |
| Design bridge | Implemented in shared package. | `packages/design-system-activepieces-bridge`, Stage 17 docs. | Token drift if AP source changes and extract/map is not rerun. |
| Activepieces runtime | Implemented local runtime contour and evidence tooling. | Stage 17 scripts/docs, backend activepieces module. | Depends on Docker runtime, patch scripts and local secrets. |
| Supabase data layer | Migrations, seed and pgtap tests present. | 49 migrations, 7 seed files, 14 pgtap tests. | README setup path may be older than Stage 17 runtime path. |
| Security gates | Many validators and scans exist. | Root and Stage 17 security scripts. | Local `.env` and browser evidence must be kept out of docs/artifacts. |
| E2E/visual tests | Playwright tests and screenshots exist. | `tests/e2e`, Stage 17 visual reports. | Full e2e requires running services and can be expensive/flaky. |
| Documentation | Rich Stage 17 docs and existing audit. | `docs/stage17`, `docs/project-audit`. | README and some frontend docs lag current route/runtime state. |

### 15.2 P0 / Blocking Before Production-Like Release

- Synchronize README with Stage 17 runtime and light-theme default, or clearly mark README Stage 14 content as historical.
- Confirm Stage 17 runtime can be started from a clean local environment using documented scripts only.
- Run security scans before sharing any evidence bundle outside the development machine.
- Confirm Activepieces embed/session/callback flow works in light theme and dark override.
- Confirm DB migrations and RLS/security tests pass against the intended release database profile.

### 15.3 P1 / Important Stabilization

- Split or further document the largest Activepieces and canvas services so future contributors can safely change them.
- Keep `docs/frontend/routes-and-screens.md` aligned with actual App Router routes.
- Add/maintain acceptance criteria for light theme first paint, theme persistence and Activepieces canvas propagation.
- Ensure Stage 17 pieces inventory/build/sync/verify reports are regenerated after catalog changes.
- Keep release gate reports close to the scripts that produce them.

### 15.4 P2 / Cleanup And Maintainability

- Move root screenshots/logs into a documented evidence folder or add a cleanup policy.
- Document which runtime artifacts are intentionally kept and which are disposable.
- Add a short maintainer guide for `apps/mining-worker`.
- Reduce duplicate historical Stage docs once current source-of-truth documents are stable.

## 16. Рекомендованный План Работ

### Iteration A: Documentation Alignment

- Update `README.md` to acknowledge Stage 17 as current runtime track.
- Link this audit from `docs/project-audit` index or README if such index is added.
- Update `docs/frontend/routes-and-screens.md` from actual `apps/web/src/app` route tree.
- Add a short "Theme contract" page under `docs/design` or `docs/frontend`.

### Iteration B: Light Theme Acceptance

- Document acceptance criteria for:
  - light first paint,
  - persisted dark opt-in,
  - no hydration theme flicker,
  - Activepieces `styling.mode`,
  - visual regression screenshots for app shell, project home and automation canvas.
- Keep `docs/stage17/17.8/design-token-mapping.md` as the canonical Stage 17 design bridge evidence.
- Ensure new components use `--lf-*` tokens or bridge recipes instead of hard-coded one-off palettes.

### Iteration C: Stage 17 Reproducibility

- Validate clean run of:
  - `pnpm stage17:init-local-secrets`
  - `pnpm stage17:compose:config`
  - `pnpm stage17:up`
  - `pnpm stage17:readiness`
  - `pnpm stage17:evidence`
  - `pnpm stage17:release-gate`
- Document required Docker resources, ports and failure modes.
- Keep patch/provision steps scripted and idempotent.

### Iteration D: Security And Runtime Hardening

- Run secret scans on docs/evidence before sharing.
- Verify frontend bundle contains no provider keys.
- Keep local owner key vault reports current.
- Validate delivery webhook token behavior and callback auth.
- Ensure audit logs are redacted where payloads may include document or AI data.

### Iteration E: Artifact Policy

- Define which screenshots/logs are release evidence and where they live.
- Move disposable logs under ignored `tmp`/runtime directories.
- Keep root clean enough that `git status` clearly shows meaningful source/doc changes.

## 17. Appendices

### Appendix A: Directory Map

```text
E:\Law_frame_main
|-- .github
|-- activepieces
|-- apps
|   |-- backend
|   |-- mining-worker
|   `-- web
|-- artifacts
|-- config
|-- docs
|   |-- architecture
|   |-- canvas
|   |-- contracts
|   |-- design
|   |-- development
|   |-- environments
|   |-- evidence
|   |-- frontend
|   |-- integrations
|   |-- operations
|   |-- product
|   |-- project-audit
|   |-- readiness
|   |-- security
|   |-- stage17
|   `-- testing
|-- infra
|-- packages
|   |-- activepieces-bridge
|   |-- activepieces-catalog-sync
|   |-- activepieces-inventory
|   |-- activepieces-legal-pieces
|   |-- activepieces-template-ingestor
|   |-- ai-gateway
|   |-- api-client
|   |-- canvas-test-fixtures
|   |-- config
|   |-- contracts
|   |-- design-system-activepieces-bridge
|   |-- logger
|   |-- piece-ai-gateway
|   |-- telemetry
|   |-- workflow
|   |-- workflow-compiler
|   `-- workflow-dsl
|-- scripts
|-- stage16-audit-evidence-20260426-000827
|-- supabase
|   |-- migrations
|   |-- seed
|   `-- tests
|-- tests
|   `-- e2e
|-- tmp
`-- tmp_docker_diag
```

### Appendix B: Backend Module Catalog

```text
activepieces
admin-console
ai-gateway
approvals
audit
authorization
automation-import
automation-library
canvas
canvas-ai
clauses
compliance
dashboard
database
delivery
document-generation
document-templates
document-types
document-validation
documents
identity
legal-indexing
legal-modules
legal-rag
legal-search
legal-sources
local-owner-key-vault
notifications
ops
profile-imports
profiles
readiness
realtime
recommendations
runs
runtime
secrets
security-operations
stage15-projects
stage7-support
telemetry
workflow-compiler
workflows
workspaces
```

### Appendix C: Frontend Route/Screen Catalog

Core historical routes:

- `/dashboard`
- `/library`
- `/automations`
- `/automations/[id]`
- `/automations/[id]/builder`
- `/documents`
- `/chat`
- `/recommendations`
- `/admin/security`
- `/sign-in`

Expanded current route families:

- `/admin/*`
- `/admin/security/*`
- `/app/projects/[projectId]/*`
- `/app/runs/[runId]`
- `/approvals`
- `/documents/*`
- `/library/*`
- `/modules/*`
- `/notifications`
- `/research`
- `/runs/[runId]`
- `/settings/documents/*`
- `/settings/profile/*`
- `/sources/*`
- `/templates/[id]/*`
- `/workspace/recommendations`
- `/invite/[token]`

### Appendix D: Package Catalog

```text
@lexframe/activepieces-bridge
@lexframe/activepieces-catalog-sync
@lexframe/activepieces-inventory
@lexframe/activepieces-legal-pieces
@lexframe/activepieces-template-ingestor
@lexframe/ai-gateway
@lexframe/api-client
@lexframe/canvas-test-fixtures
@lexframe/config
@lexframe/contracts
@lexframe/design-system-activepieces-bridge
@lexframe/logger
@lexframe/piece-ai-gateway
@lexframe/telemetry
@lexframe/workflow
@lexframe/workflow-compiler
@lexframe/workflow-dsl
```

### Appendix E: Environment Variable Catalog Without Values

Known variable categories from README/scripts/docs. Values intentionally omitted.

| Category | Examples |
| --- | --- |
| Supabase/storage | `SUPABASE_SECRET_KEY`, storage endpoint/bucket variables. |
| Activepieces | `ACTIVEPIECES_API_KEY`, `ACTIVEPIECES_SIGNING_PRIVATE_KEY`, runtime URL/SDK URL variables. |
| AI providers | `XAI_API_KEY`, `COMETAPI_API_KEY`, provider mode variables. |
| LexFrame runtime | `LEXFRAME_RUNTIME_MASTER_SECRET`, readiness profile variables. |
| Delivery | `LEXFRAME_DELIVERY_TRANSPORT`, webhook URL/token variables. |
| Stage 17 | `STAGE17_READINESS_URL` and local Stage 17 runtime configuration variables. |
| Public frontend | `NEXT_PUBLIC_*` variables required by web runtime. |

Never copy actual values from `.env`, `.env.stage17.local` or `.env.test-secrets.local` into audit docs.

### Appendix F: Glossary

| Term | Meaning |
| --- | --- |
| AP | Activepieces. |
| Canvas | Visual workflow graph with nodes/edges and validation/runtime projection. |
| Design convergence | Stage 17 effort to align LexFrame UI with Activepieces-like surfaces through tokens/recipes while preserving LexFrame domain identity. |
| Evidence | Generated logs, screenshots, readiness reports or audit artifacts used to prove runtime/gate behavior. |
| Light default | Current theme contract where light mode is first paint and fallback. |
| Local owner key vault | Stage 17 local mechanism for protecting signing/encryption material. |
| RAG | Retrieval-augmented generation for legal analysis. |
| Readiness | Health/diagnostic contract that explains whether required services and profiles are configured. |
| Release gate | Scripted quality/security/runtime check used before declaring a stage complete. |
| Runtime contour | Set of services and configuration needed to run an integrated local environment. |
| Stage 16 | Prior canvas/runtime hardening track. |
| Stage 17 | Current Activepieces runtime, localization/debranding, pieces catalog and design convergence track. |

### Appendix G: Validation Checklist

Use this checklist when updating this audit or preparing the next one.

- [ ] Confirm `git status --short`.
- [ ] Confirm latest git commit and branch.
- [ ] Confirm root `package.json` scripts.
- [ ] Confirm `pnpm-workspace.yaml` workspace layout.
- [ ] Confirm `apps/backend/src/modules` module list.
- [ ] Confirm `apps/web/src/app` route tree.
- [ ] Confirm `packages` catalog.
- [ ] Confirm Supabase migration/seed/test counts.
- [ ] Confirm Stage 17 docs and evidence paths.
- [ ] Confirm light theme default in `theme-provider.tsx`.
- [ ] Confirm layout bootstrap in `layout.tsx`.
- [ ] Confirm bridge CSS imports in `globals.css`.
- [ ] Confirm light/dark CSS bridge files.
- [ ] Confirm Activepieces canvas receives `styling.mode`.
- [ ] Run or explicitly defer relevant checks.
- [ ] Scan the audit for accidental secret values.
- [ ] Keep existing historical audit files intact.

