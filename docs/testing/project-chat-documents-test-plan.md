# Project Chat / Documents Test Plan

Date: 2026-05-13

## Goal

Block 3 validates the central product workflow:

```text
Project -> chat -> message -> assistant response -> attachments -> branches -> sources -> automations -> documents -> project knowledge
```

The block does not change visual design. Tests use selectors, existing roles and API assertions.

## Commands

Primary command:

```bash
corepack pnpm test:block3
```

Focused commands:

```bash
corepack pnpm test:block3:backend
corepack pnpm test:block3:web-unit
corepack pnpm test:block3:e2e
corepack pnpm --filter @lexframe/api-client test
corepack pnpm --filter @lexframe/e2e typecheck
```

## Coverage Strategy

| Layer | Purpose |
| --- | --- |
| Backend unit | Deterministic lifecycle, upload validation, knowledge/source ACL, audit-safe metadata |
| API client/package | Endpoint shape, SSE parsing, LexFrame-only browser contracts |
| Web unit/component | ProjectHome, LexFrameChatShell, state machine, attachment tile behavior without visual edits |
| Playwright E2E | Real route navigation, browser File attachments, chat scope separation, document bytes/hash/complete, network security |
| Docs/artifacts | Scenario matrix and environment limitations |

## New Block 3 Tests

| File | Coverage |
| --- | --- |
| `tests/e2e/project-workspace-flow.spec.ts` | project root, rename, tabs, composer file chip/remove, no old dashboard |
| `tests/e2e/project-chat-runtime-full.spec.ts` | project chat optimistic send, placeholder, final/failure, latestRun/resume, recovery |
| `tests/e2e/global-chat-runtime-full.spec.ts` | global chat route and API separation from project chats |
| `tests/e2e/chat-attachments-branches.spec.ts` | real File attachment, upload intent/complete, negative validation, branch API |
| `tests/e2e/documents-upload-download-full.spec.ts` | document upload intent, base64 bytes, sha256, complete, detail, signed URL, negative metadata |
| `tests/e2e/project-sources-knowledge.spec.ts` | project knowledge rows, backend web-search route, cross-project block |
| `tests/e2e/utils/chat.ts` | chat flow helpers |
| `tests/e2e/utils/documents.ts` | document UI helpers |
| `tests/e2e/utils/project-workspace.ts` | project route/tab helpers |
| `tests/e2e/utils/network-assertions.ts` | no direct provider/secret/JWT/signed URL browser leakage |

## Acceptance Mapping

| Acceptance item | Verification |
| --- | --- |
| Project root workspace flow covered | `project-workspace-flow.spec.ts`, `project-home.test.tsx` |
| Old dashboard regressions covered | `assertNoOldProjectDashboard`, ProjectHome unit tests |
| Project/global chat separation covered | project/global chat E2E + chat service search tests |
| Chat send lifecycle covered | LexFrameChatShell unit, state machine unit, project chat E2E |
| Optimistic send and placeholder covered | LexFrameChatShell unit + E2E helper assertions |
| Reload recovery covered | `reloadAndAssertRecovery`, latestRun/resume API assertion |
| Cancel/retry/regenerate/branching covered | LexFrameChatShell unit, chat service specs, branch E2E API |
| Attachments use real browser File | `chat-attachments-branches.spec.ts` |
| Content bytes/hash/complete flow covered | documents service spec + documents E2E |
| Documents upload/download covered | `documents-upload-download-full.spec.ts` |
| Sources/project knowledge covered | `project-sources-knowledge.spec.ts` |
| No direct browser provider calls | `installNetworkSecurityAssertions` in every Block 3 E2E spec |
| No secret/signed URL leaks | network/storage assertions and signed URL DOM guard |
| No visual changes | Only test files, helpers, docs and backend validation/security logic changed |

## Known Environment Assumption

Full E2E requires the local integrated runtime started by Playwright, including Postgres/Supabase on `127.0.0.1:54322`. If that runtime is unavailable, E2E failures must be documented as environment defects, not treated as product success.
