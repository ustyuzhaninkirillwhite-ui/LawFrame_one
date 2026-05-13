# Stage 22 Chat Implementation Report

## Scope

Implemented Stage 22 chat runtime/UI changes and the project workspace recovery required for `/app/projects/:projectId`. Automations, Activepieces and AI Gateway internals were not changed; project automation links only route to the existing editor.

## Runtime Visibility Fix

- Confirmed that `http://127.0.0.1:3100` is served by the Docker runtime image `lexframe-web:stage21-local` through the Stage 17/21 reverse proxy.
- Rebuilt and recreated the Docker web runtime with `corepack pnpm stage21-up rebuild-web` after frontend changes.
- Browser DOM verification was performed against `http://127.0.0.1:3100/app/projects/project_claim_001`, not only against local unit tests.

## Project Workspace

- Removed the old three-column project dashboard from `/app/projects/:projectId`.
- `AppShell` now renders project workspace and project chat routes as immersive routes without the legacy rounded panel shell or global floating composer.
- Project page now has one central workspace: project title, large composer, and bottom tabs `Чаты`, `Источники`, `Автоматизации`.
- `Чаты` shows only current-project chat history newest first.
- `Источники` shows project knowledge/source rows.
- `Автоматизации` shows current-project automations with links to `/app/projects/:projectId/automations/:automationId/automation`.
- Composer plus menu contains `Добавить фото`, `Фото или файлы`, `Поиск по сети`, `Автоматизации`; file/automation chips are shown before sending.

## Backend

- Added SSE-compatible `messages:stream` handling while preserving the JSON fallback route.
- Persisted stream lifecycle now writes an initial run job/events before the provider call, updates assistant placeholder status, appends final/error events and supports `resume` from stored events.
- `listMessages` now returns `latestRun` for recoverable reload state.
- Added private chat attachment endpoints:
  - `POST /chat/attachments/upload-intents`
  - `POST /chat/attachments/:id/complete`
  - `DELETE /chat/attachments/:id`
  - `GET /chat/attachments/:id/download`
- Added backend validation for unsafe filenames, empty files, unsupported MIME/extension, size limit and duplicates.
- Added message-level branch creation for edit/regenerate and branch switch route while keeping legacy `/branch` behavior.

## Frontend

- Added chat reducer/state machine for `idle`, `uploading`, `sending`, `queued`, `thinking`, `streaming`, `completed`, `failed`, `cancelled`, `recovering`.
- Send flow now appends the user message and assistant placeholder immediately with `clientMessageId` reconciliation.
- Stream events update the existing assistant message instead of creating duplicates.
- Added AbortController-backed cancel.
- Added `ChatSidebar`, `ChatThreadList`, `BranchSwitcher` and rebuilt composer attachments with file picker, drag/drop, paste, validation, chips and remove.
- Project chat now uses SSE client when available and keeps JSON-compatible fallback in API surface.
- Split global/simple chat history from project chat history:
  - `/chat` and `/chat/:chatId` use global threads with `project_id is null`.
  - `/app/projects/:projectId` hides chat history from the left sidebar; project history is shown only in the page tab `Чаты`.
  - `/app/projects/:projectId/chats/*` shows only chats from the current project in the left sidebar.
- Added inline rename for project titles in the project page header and project sidebar.
- Added inline rename for chat titles in the chat sidebar.
- Removed the visible project composer mode text `Глубокое`.
- Fixed project/chat shell sizing so the app uses a bounded `h-screen` layout and the old bottom whitespace/body-scroll issue is removed.
- Made settings dialog navigation compact and reduced the oversized tab-card feel.
- Kept Activepieces canvas session tokens cached while navigating inside automation/project routes, so returning to an automation route does not force a full reload unless the user leaves the automation route family.

## DB

- Added forward-only migration `000056_stage22_chat_runtime.sql`.
- Added `chat-attachments-private` storage bucket metadata.
- Added `app.chat_branches`, message `client_message_id`/`branch_id`/`run_id`, stream recovery columns and `app.chat_attachments`.
- Added indexes for thread/message/branch/run/attachment lookup and RLS policies for new chat tables.
- No old migrations or existing tables were destructively edited.

## Contracts And API Client

- Extended chat DTOs additively with optional `clientMessageId`, `branchId`, `branchInfo`, `run`, attachment metadata and upload/download contracts.
- Added API client support for SSE stream events, attachment lifecycle and branch switch.
- Exported request header resolution for the SSE client path.

## Tests And Validation

- `corepack pnpm --filter @lexframe/contracts typecheck` - passed
- `corepack pnpm --filter @lexframe/contracts lint` - passed
- `corepack pnpm --filter @lexframe/backend typecheck` - passed
- `corepack pnpm --filter @lexframe/backend lint` - passed
- `corepack pnpm --filter @lexframe/backend test -- chat-thread stage15-projects` - passed, 3 suites / 15 tests
- `corepack pnpm --filter @lexframe/backend test -- chat project-knowledge web-search` - passed, 5 suites / 12 tests
- `corepack pnpm --filter @lexframe/web typecheck` - passed
- `corepack pnpm --filter @lexframe/web lint` - passed
- `corepack pnpm --filter @lexframe/web test -- project-sidebar project-home LexFrameChatShell` - passed, Vitest selected 31 files / 108 tests
- `corepack pnpm --filter @lexframe/web test -- app-shell project-home LexFrameChatShell` - passed, Vitest selected 31 files / 104 tests
- `corepack pnpm --filter @lexframe/web test -- project-home` - passed, Vitest selected 31 files / 104 tests after the final row-overflow fix
- `corepack pnpm --filter @lexframe/web build` - passed, compiled successfully
- `corepack pnpm check:db` - passed
- `corepack pnpm validate:web-bundle-secrets` - passed
- `corepack pnpm secret-scan` - passed
- `corepack pnpm stage21-up rebuild-web` - passed; `lexframe-stage17-lexframe-web-1` was recreated and reported healthy
- Browser DOM gate for `/app/projects/project_claim_001` - passed:
  - `data-testid="project-workspace-shell"` present
  - `section.grid.gap-5` absent
  - `Последние материалы` absent
  - `Глубокое` absent
  - old side cards `Нет источников./Добавить источник`, `Сценарий автоматизации Stage 17`, `Прикрепить автоматизацию` absent
  - quick chips `Проверить позицию по делу`, `Подготовить претензию`, `Найти судебную практику` absent
  - tabs `Чаты`, `Источники`, `Автоматизации` present
  - composer placeholder present as `Новый чат в ...`
- Browser DOM gate for `/app/projects/project_claim_001/chats` - passed:
  - left sidebar contains the only project chat history block
  - no extra `main aside`/middle chat-history panel is rendered
  - `document.body.scrollHeight === window.innerHeight`, so the old bottom whitespace is gone
- Browser DOM gate for `/app/projects/project_claim_001/chats/0fdf30a9-d1a1-49e3-808a-9758180374c8` - passed for sidebar/composer/file input presence and no provider-secret strings in DOM
- Browser DOM gate for `/chat` - passed:
  - no project chat links leaked into the global sidebar
  - root `/chat` no longer redirects into a project chat route
- `git diff --check` - passed

## Acceptance Checklist

- Sent user message appears immediately: implemented and covered by `LexFrameChatShell` tests.
- Assistant pending/streaming state is visible: implemented with placeholder and run status.
- Reload recovery does not silently reset active runs: backend returns `latestRun` and `resume` persisted events.
- Attachments can be added, validated, removed, uploaded and downloaded through backend-controlled routes.
- Branches are additive and preserve old history: edit/regenerate create new branch ids; switch persists active branch.
- Sidebar is present with active chat/search/new chat states.
- Project workspace no longer shows the old three-column dashboard in the Docker-served runtime.
- Frontend has no direct provider calls; AI still goes through backend chat/AI Gateway.
- Provider keys remain backend-only; web bundle secret scan passed.

## Remaining Risks

- True token-by-token provider streaming still depends on the existing AI Gateway returning deltas; current backend persists and emits lifecycle/SSE events around the gateway result without changing provider internals.
- Full Playwright interaction scenarios for live send/reload-during-run, real Supabase storage upload/download, and branch switch persistence were not executed in this pass; they need a seeded runtime with live provider/storage credentials or deterministic mocks.
