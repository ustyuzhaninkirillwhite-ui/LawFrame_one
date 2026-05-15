# Detected Defects And Gaps

Date: 2026-05-13

## Fixed During Block 1

| ID | Severity | Area | Finding | Resolution |
| --- | --- | --- | --- | --- |
| B1-001 | Medium | Package tests | New package runtime tests initially used `node:test` and `node:assert/strict`, but package TS configs did not include Node type declarations. | Replaced with small self-contained test/assert helpers and package-local `node dist/*.test.js` scripts. |
| B1-002 | Medium | Backend Jest | New `RunPreflightService` spec imported `ActivepiecesService`, which pulled ESM-only `jose` into Jest. | Added a local Jest mock for the Activepieces service dependency in the run preflight spec. |
| B1-003 | Low | AI Gateway test assumption | Test assumed prompt versions were stage-prefixed, while actual package constants use values like `workflow_planning_v1`. | Updated the test to assert stable version shape and provider-route isolation instead. |
| B1-004 | Low | Contract invariant script | Script checked `hasSecret` directly on `AiProviderConnectionDto`; actual DTO delegates secret metadata to `AiSecretStatusDto`. | Updated the invariant to validate the nested `secret: AiSecretStatusDto` contract. |

## Fixed During Block 3

| ID | Severity | Area | Finding | Resolution |
| --- | --- | --- | --- | --- |
| B3-001 | Medium | Documents backend | Document upload intent accepted zero-size files and did not validate filename/MIME extension consistency before storage metadata creation. | Added backend metadata validation for empty files, unsafe filenames, path traversal and disguised extensions using existing `VALIDATION_ERROR` taxonomy. |
| B3-002 | Low | API client SSE test | The SSE fixture did not terminate the final `done` frame with a blank-line delimiter, so the client correctly returned `CHAT_STREAM_INCOMPLETE`. | Fixed the fixture to match the controller protocol. |
| B3-003 | Low | Web unit tests | New ProjectHome assertions used mojibake-only accessible names while the DOM returned normalized Russian names. | Switched assertions to stable role/regex matchers without changing the component. |

## Fixed During Block 4

| ID | Severity | Area | Finding | Resolution |
| --- | --- | --- | --- | --- |
| B4-001 | High | Canvas security validation | `normalizeDataSource` stripped `workspace_id` from document bindings, making the existing cross-workspace document-reference policy check unreachable after normalization. | Preserved optional `workspace_id` / `workspaceId` on `CanvasDocumentSource` and added a regression test for `WF_POLICY_004_CROSS_WORKSPACE_REFERENCE`. |
| B4-002 | Low | Web unit tests | New route test left a previous render mounted, producing duplicate mock controls in later assertions. | Added per-test cleanup to the route spec. |

## Remaining Gaps

| ID | Severity | Area | Gap |
| --- | --- | --- | --- |
| B1-G001 | High | Legal backend | `legal-sources`, `legal-search`, `legal-rag`, `legal-indexing` still need direct service specs for source ownership, citations and cross-workspace denial. |
| B1-G002 | High | Document generation | `document-generation`, `document-templates`, `document-validation` still need direct specs beyond current upload/document storage coverage. |
| B1-G003 | High | Automation library/approvals | `automation-library` and `approvals` have no direct specs; delivery and builder tests cover only adjacent behavior. |
| B1-G004 | Medium | Settings controller | `settings.controller.spec.ts` is still missing; service and guard tests cover the core behavior. |
| B1-G005 | Medium | Runs command lifecycle | `run-command.service.spec.ts` is still missing for idempotency, cancel, retry and audit event assertions. |
| B1-G006 | Medium | Live DB/RLS | Static DB readiness and pgTAP scripts exist, but this pass does not prove a fresh live Supabase instance was available. |

## Remaining Block 3 Gaps

| ID | Severity | Area | Gap |
| --- | --- | --- | --- |
| B3-G001 | High | Integrated E2E runtime | `corepack pnpm test:block3:e2e` cannot start with the default Playwright config because `prepare-stage14-search-index.mjs` reports `OpenSearch did not become ready: fetch failed`. |
| B3-G002 | High | Integrated DB runtime | With `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1`, all six Block 3 E2E specs reach the browser but fail at sign-in because backend `/auth/bootstrap` cannot connect to Postgres at `127.0.0.1:54322`. |
| B3-G003 | Medium | Branch switcher UI | Backend branch creation/switch and web unit behavior are covered, but a fully visible E2E branch switcher assertion remains blocked until the integrated DB/runtime is available. |

## Remaining Block 4 Gaps

| ID | Severity | Area | Gap |
| --- | --- | --- | --- |
| B4-G001 | High | Integrated E2E search bootstrap | `corepack pnpm test:block4:e2e` cannot start the Playwright webServer with default config because `prepare-stage14-search-index.mjs` reports `OpenSearch did not become ready: fetch failed`. |
| B4-G002 | High | Integrated DB runtime | With `LEXFRAME_E2E_SKIP_SEARCH_INDEX=1`, Block 4 E2E reaches the browser but sign-in stays on `/sign-in` because backend `/auth/bootstrap` cannot connect to Postgres at `127.0.0.1:54322`. |
| B4-G003 | Medium | Live Activepieces iframe/cache metrics | The new E2E specs cover route/session/cache behavior, but full iframe ready/reload assertions need a live DB plus Activepieces runtime to execute end to end. |

## Remaining Block 5 Gaps

| ID | Severity | Area | Gap |
| --- | --- | --- | --- |
| B5-G001 | High | Performance/security E2E runtime | Block 5 Playwright specs share the same integrated runtime dependency as Blocks 3-4; default run is blocked when OpenSearch is unavailable. |
| B5-G002 | High | Browser auth bootstrap | With search-index skipped, Block 5 specs are expected to block at sign-in until Postgres/Supabase runtime is available at `127.0.0.1:54322`. |
| B5-G003 | Medium | Measured performance baselines | Placeholder Block 5 metric/security artifacts exist for manifest shape; real budgets require live E2E execution to replace pending records with measured data. |
