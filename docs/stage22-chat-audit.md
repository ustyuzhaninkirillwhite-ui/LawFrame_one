# Stage 22 Chat Audit

Date: 2026-05-12
Branch: `codex/safe-cleanup-refactor`

## Current Architecture

- Frontend project chat entrypoints are `apps/web/src/app/(app)/app/projects/[projectId]/chats/page.tsx`, `apps/web/src/app/(app)/app/projects/[projectId]/chats/[chatId]/page.tsx`, and `apps/web/src/components/chat/project-chat-workspace.tsx`.
- The project workspace entrypoint is `apps/web/src/app/(app)/app/projects/[projectId]/page.tsx`, which renders `apps/web/src/components/shell/project-home.tsx` inside `AppShell`.
- The active UI implementation lives under `apps/web/src/features/ai-chat`. `LexFrameChatShell` owns message state locally, calls `createLexFrameChatApi`, and renders `LexFrameThread`, `LexFrameComposer`, `LexFrameMessage`, actions, attachment tiles, and the hidden `assistant-ui` runtime adapter.
- Frontend chat API is split between `apps/web/src/features/ai-chat/api/chatApi.ts` and `packages/api-client/src/chat-client.ts`. It already exposes list/create thread, list messages, `messages:stream`, resume, cancel, regenerate, edit, branch, search, and project knowledge.
- Backend chat entrypoints are `apps/backend/src/modules/chat/chat.controller.ts`, `chat-thread.service.ts`, `chat-stream.service.ts`, `project-knowledge.controller.ts`, and `chat-context-assembler.service.ts`.
- Stage 19 DB schema in `supabase/migrations/000051_stage19_chats_knowledge_workspace.sql` already provides `app.chat_threads`, `app.chat_messages`, `app.chat_message_parts`, `app.chat_message_attachments`, `app.chat_thread_branches`, `app.chat_stream_jobs`, and `app.chat_stream_events`.
- Existing branch data is thread-level only: `chat_thread_branches` stores a parent thread, source message, and branch thread. `chat_messages` has `parent_message_id` but no message-level `branch_id`.
- Existing stream data is snapshot-like. `ChatThreadService.streamMessage` persists the user message, waits for `AIGatewayService.streamChatCompletion`, inserts the completed assistant message, then builds a completed `ChatStreamSnapshot` with one `text_delta`. It is not true incremental streaming.
- `resumeStream` is currently a stub returning `{ status: "completed", events: [] }`; it does not load persisted `chat_stream_events`.
- Attachments exist in contracts and DB as metadata (`ChatMessageAttachmentDto`, `app.chat_message_attachments`) but there is no chat file upload lifecycle, no protected chat download route, and no composer upload UI.
- The current UI has no dedicated in-chat sidebar. Project sidebar contains chat links elsewhere, while `LexFrameChatShell` renders only a header and central thread.

## Runtime Visibility Finding

- The in-app browser URL `http://127.0.0.1:3100/...` is served by the Stage 21 Docker runtime through the reverse proxy and image `lexframe-web:stage21-local`, not by a Windows `next dev` process.
- A source-only frontend change is therefore invisible to the user until the web image is rebuilt and containers are recreated.
- Stage 22 visual acceptance must include `corepack pnpm stage21-up rebuild-web` followed by a browser/DOM check against `http://127.0.0.1:3100/app/projects/project_claim_001`.
- The project page must specifically reject the old dashboard DOM: no `section.grid.gap-5`, no `Последние материалы`, no metrics card with `Чаты/Источники/Авто`, no side cards for `Источники` or `Автоматизации`, and no quick chips such as `Проверить позицию по делу`.

## Defects And Root Causes

- Sent messages can visually appear late or vanish because `LexFrameChatShell` waits for `streamMessage` and then reloads persisted messages. There is no immediate optimistic user append.
- Earlier project workspace changes appeared missing because the Docker-served web image was stale. The correct recovery path is rebuild/recreate the web image, then verify the live page in the browser.
- The assistant pending state is a generic `isRunning` block, not a message placeholder. It is not reconciled with the eventual server message and can disappear during route switches/reloads.
- Race protection is partial. `messageLoadRequestId` prevents stale initial loads, but there is no reducer-level state machine for double send, cancel during request, reload recovery, or quick thread switching.
- Reload during an active or failed run cannot recover accurately because the backend does not expose latest run status with `listMessages`, and `resumeStream` ignores persisted stream events.
- Streaming is not incremental in the browser. The backend returns a complete JSON snapshot after the provider finishes, so users see no token/progress deltas.
- Attachments are only references to existing knowledge/document-like resources. There is no chat-native private file upload, validation, progress, or protected download.
- Branching is incomplete for message alternatives. Thread-level branches can be created, but there is no active branch persisted on messages, no `1 / N` alternative metadata, and regenerate/edit do not create/select message-level variants.
- The composer and message list lack drag/drop, paste attachments, upload errors, stable scroll-to-bottom behavior, and reduced-motion-aware transitions.
- Security checks are mostly inherited from `AuthGuard`, `WorkspaceContextGuard`, `PermissionGuard`, and `getThreadRow(workspaceId, threadId)`, but attachment-specific ownership checks do not exist yet.

## Files To Change

- Contracts: `packages/contracts/src/chat.ts`, `packages/api-client/src/chat-client.ts`, `packages/api-client/src/index.ts`.
- DB: add forward-only Stage 22 migration after `000055_stage21_ai_max_output_tokens.sql`.
- Backend: `apps/backend/src/modules/chat/chat.controller.ts`, `chat-thread.service.ts`, `chat-stream.service.ts`, new chat attachment helper/service if the service split keeps `chat-thread.service.ts` manageable.
- Frontend: `apps/web/src/features/ai-chat` components, API adapter, domain reducer/state machine, tests.
- Tests: backend chat specs, frontend `LexFrameChatShell`/reducer specs, and chat-focused Playwright specs under `tests/e2e`.

## Change Plan

- Add additive contracts for client ids, run status, branch metadata, and chat attachment upload/download responses.
- Add DB migration for message `branch_id`, active branch persistence, run status metadata, chat private attachments, and indexes.
- Implement backend run recovery: persisted stream events are the source of truth; `resumeStream` reads them; `listMessages` returns latest run summary.
- Implement SSE mode for `messages:stream` while preserving JSON fallback for existing callers.
- Implement private chat attachment upload intent/complete/delete/download routes with backend ownership validation.
- Replace local ad hoc UI state with reducer + TanStack Query cache updates and optimistic reconciliation.
- Rebuild the chat UI in LexFrame light style with sidebar, message list, composer, attachments, run status, branch switcher, loading/error/empty states, and reduced-motion CSS.
- Replace `/app/projects/:projectId` with a single central workspace: title, large composer, and bottom tabs `Чаты`, `Источники`, `Автоматизации`; remove the three-column dashboard entirely.
- Add tests before each behavior block and keep changes chat-scoped.

## Risks

- True token streaming is limited by the existing `AIGatewayService.streamChatCompletion` API returning a complete text response. Stage 22 can expose SSE events to the browser immediately for run start/status and then emit the provider text as one or more deltas without changing AI Gateway internals.
- Storage upload depends on the local Supabase storage compatibility layer. If direct object upload is unavailable in a runtime profile, the frontend must surface a retryable upload failure and backend tests should mock storage verification.
- Message-level branching can be additive, but existing thread-level branch routes must remain compatible.
- Large UI replacement can regress project shell integration; keep routes and project sidebar integration unchanged.

## Test Strategy

- Unit tests for chat reducer/state machine, optimistic append/reconcile/rollback, attachment validation, branch metadata.
- Backend tests for JSON fallback, SSE response shape, persisted resume events, cancel/fail recovery, attachment auth and validation, branch creation/switch persistence.
- Frontend tests for instant user message, assistant placeholder, stream events, reload/recovery, attachment lifecycle, branch switcher, scroll button, reduced-motion classes.
- E2E smoke for create/send/reload, attachment add/remove/send/download, branch/regenerate/switch.
- Security scans: `validate:web-bundle-secrets`, `secret-scan`; no provider calls from frontend.
