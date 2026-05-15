# Project Chat / Documents / Sources Inventory

Scope: Block 3 covers the user workflow from project workspace to chat runtime, attachments, branches, documents, project knowledge and legal/source search. Visual components were not restyled.

## Route Map

| Route | Surface | Ready marker | Notes |
| --- | --- | --- | --- |
| `/app/projects/:projectId` | project workspace root | `project-workspace-shell` | Project title, rename, large composer, `Чаты` / `Источники` / `Автоматизации` tabs |
| `/app/projects/:projectId/chats` | project chat shell | `chat-composer-input` | Project-scoped empty/current chat workspace |
| `/app/projects/:projectId/chats/:chatId` | project chat thread | `chat-composer-input` | Sends messages, attachments, stream lifecycle and branch actions |
| `/chat` | global chat shell | `chat-composer-input` | Global scope only |
| `/chat/:chatId` | global chat thread | `chat-composer-input` | Must not redirect into project route |
| `/app/projects/:projectId/automations` | project automations | body/link rows | Project automation entry list |
| `/app/projects/:projectId/automations/:automationId/automation` | automation canvas | canvas or degraded marker | Covered by prior canvas suites; Block 3 verifies project links |
| `/documents` | documents root | body text/documents | Upload dialog and list |
| `/documents/:id` | document detail | body text/document metadata | Version/status/download contract |
| `/sources` | global sources | body text/sources | Existing source registry smoke |

## API Endpoints

Chat and branches:
- `GET /chat/threads?scope=global|project&projectId=...`
- `POST /chat/threads`
- `PATCH /chat/threads/:threadId`
- `GET /chat/threads/:threadId/messages`
- `POST /chat/threads/:threadId/messages`
- `POST /chat/threads/:threadId/messages:stream`
- `POST /chat/threads/:threadId/streams/:streamId/resume`
- `POST /chat/threads/:threadId/streams/:streamId/cancel`
- `POST /chat/threads/:threadId/branch`
- `POST /chat/threads/:threadId/messages/:messageId/regenerate`
- `POST /chat/threads/:threadId/messages/:messageId/edit`
- `POST /chat/threads/:threadId/branches/:branchId/switch`
- `GET /chat/search`

Project chat and knowledge:
- `GET /projects/:projectId/chats`
- `POST /projects/:projectId/chats`
- `GET /projects/:projectId/knowledge`
- `POST /projects/:projectId/knowledge`
- `PATCH /projects/:projectId/knowledge/:itemId`
- `DELETE /projects/:projectId/knowledge/:itemId`
- `POST /projects/:projectId/web-search`

Attachments:
- `POST /chat/attachments/upload-intents`
- `POST /chat/attachments/:attachmentId/complete`
- `DELETE /chat/attachments/:attachmentId`
- `GET /chat/attachments/:attachmentId/download`

Documents:
- `GET /documents`
- `GET /documents/:documentId`
- `GET /documents/:documentId/versions`
- `POST /documents/upload-intents`
- `POST /documents/:documentId/versions/upload-intent`
- `POST /documents/:documentId/versions/:versionId/content`
- `POST /documents/:documentId/versions/:versionId/complete`
- `POST /documents/:documentId/signed-url`
- `POST /documents/:documentId/archive`
- `POST /documents/:documentId/restore`
- `DELETE /documents/:documentId`

Legal sources/search/RAG:
- `GET /legal-sources`
- `GET /legal-sources/:sourceId`
- `POST /legal-search/query`
- `POST /legal-rag/analyze`

## Seed Data

| Seed | Purpose |
| --- | --- |
| `project_claim_001` | primary seeded project used by route, chat, knowledge and documents flows |
| `chat_project_claim_001` | seeded project chat used by prior route smoke |
| `foreign_project_001` | negative cross-project/workspace fixture used by security tests |
| demo users from `signInAsDemo` | generated per E2E run to isolate auth/session state |

## Existing Tests

| Area | Existing coverage |
| --- | --- |
| Chat backend | `chat-thread.service.spec.ts`, `chat-stream.service.spec.ts`, `chat.controller.spec.ts` coverage for persistence, stream snapshots, branch/search paths |
| Project chat live | `tests/e2e/stage19-project-chat-live.spec.ts` covers project chat API stream, knowledge row, resume/search/branch smoke |
| Documents backend | `documents.service.spec.ts` covers content upload, hash/size validation, restore, signed URL archived block |
| Documents E2E | `tests/e2e/documents-storage.spec.ts` covers stage2 upload/version/archive/restore smoke |
| ProjectHome unit | `apps/web/src/components/shell/project-home.test.tsx` covers tabs, composer, old dashboard absence |
| Chat shell unit | `LexFrameChatShell.test.tsx`, `chatStateMachine.test.ts` cover runtime state, optimistic messages and branch operations |
| Sources/search/RAG backend | newly focused service specs for legal sources/search/RAG security boundaries |

## Missing / Newly Covered Scenarios

| Scenario | Status |
| --- | --- |
| Project root rename, tabs, composer file chip/remove | Covered by `project-workspace-flow.spec.ts` |
| Project/global chat separation through API and route | Covered by `project-chat-runtime-full.spec.ts`, `global-chat-runtime-full.spec.ts` |
| Optimistic user message and assistant placeholder | Covered by chat unit and E2E helpers |
| Reload recovery/latestRun | Covered by chat E2E and backend messages assertions |
| Chat attachment real `File`, intent, upload, complete | Covered by `chat-attachments-branches.spec.ts` and backend specs |
| Empty/unsupported/unsafe/oversize attachment validation | Covered by chat unit/backend specs and E2E UI validation |
| Branch creation/switch smoke | Covered by backend spec and `chat-attachments-branches.spec.ts` |
| Document content bytes/base64/sha/complete flow | Covered by `documents-upload-download-full.spec.ts` and service specs |
| Project knowledge and backend-only web search | Covered by `project-sources-knowledge.spec.ts` and service specs |
| No direct browser provider calls/secrets/signed URL storage | Covered by `tests/e2e/utils/network-assertions.ts` |

## Risks / Gaps

| Risk | Severity | Notes |
| --- | --- | --- |
| Full live E2E depends on local Postgres/Supabase runtime | High | Prior Block 2 run failed when `127.0.0.1:54322` was unavailable; Block 3 E2E has the same dependency. |
| Provider-backed chat can return controlled failure if AI settings are unconfigured | Medium | Tests accept final assistant content or controlled failure, but require no fake success/duplicate assistant. |
| UI branch switcher visibility depends on persisted branch metadata | Medium | Backend branch API is covered; UI switcher is asserted in component tests and E2E only after branch-capable fixture exists. |
| Web search may be unconfigured locally | Medium | E2E accepts non-5xx backend controlled state and asserts no provider secret leakage. |
