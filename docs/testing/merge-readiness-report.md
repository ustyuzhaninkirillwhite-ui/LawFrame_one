# Part 10. Merge Readiness Report

Generated: 2026-05-15T05:01:29.295Z

## Status

Overall status: READY_FOR_PR_REVIEW.

Runtime proof status: reuse-runtime PASS from Part 9. Clean-runtime destructive reset was not run in Part 10.

Root command verified in `package.json`:

```powershell
corepack pnpm system:full-gate
```

The script expands to:

```powershell
node scripts/testing/full-system-gate.mjs --reuse-runtime --json --artifacts-dir=artifacts/system-tests/full-gate --fail-on-blocked --scope=full
```

## Worktree Summary

Branch: `main`

Commit: `bc6f48becb02369e53d2c110f3033981547e8f75`

Total dirty/untracked entries: 219.

### Include Decision Counts

| include in PR | count |
| --- | ---: |
| yes | 182 |
| review | 27 |
| no | 10 |

### Kind Counts

| kind | count |
| --- | ---: |
| test | 116 |
| code | 52 |
| script | 5 |
| temporary | 1 |
| artifact | 10 |
| doc | 35 |

### Domain Counts

| domain | count |
| --- | ---: |
| automation | 34 |
| security | 19 |
| chat | 28 |
| documents | 16 |
| search | 19 |
| settings | 29 |
| unrelated | 26 |
| shell | 17 |
| contracts | 5 |
| full-gate | 16 |
| temporary | 1 |
| artifact | 9 |

## Artifact Hygiene

Status: PASS.

- Text files scanned: 131.
- Binary local-only review files: 48.
- Unknown skipped files: 2.
- Unsafe text findings: 0.
- Redaction log status: REDACTED_LOCAL_ARTIFACTS.
- Redaction actions recorded: 7.

Generated machine-readable artifacts:

- `artifacts/system-tests/merge-readiness/worktree-classification.json`
- `artifacts/system-tests/merge-readiness/artifact-hygiene-scan.json`
- `artifacts/system-tests/merge-readiness/artifact-redaction-log.json`

## PR Scope Recommendations

- `yes`: intended Part 1-9 hardening code, scripts, tests, and docs; still review diffs before staging.
- `review`: shared files, generated evidence, or unclassified supporting files that need explicit PR-scope decision.
- `no`: local-only traces, binary screenshots/videos, temporary logs, and generated Playwright artifacts.

## Non-PR / Review Queue

| include | path | reason |
| --- | --- | --- |
| review | apps/web/next-env.d.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | apps/web/src/mocks/handlers.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| no | .codex-dev-logs/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| review | apps/web/src/components/ui/ui-primitives.test.tsx | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | apps/web/src/mocks/e2e-control.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | artifacts/system-tests/ | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| no | docs/testing/LexFrame_system_tests_chat_report_2026-05-13.docx | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| review | docs/testing/accessibility-keyboard-plan.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/clickability-matrix.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/detected-defects.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/evidence-manifest-spec.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/frontend-clickability-defects.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/frontend-clickability-inventory.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/performance-animation-budget.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/run-evidence-matrix.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | docs/testing/system-test-final-report.md | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/accessibility-keyboard-focus.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| no | tests/e2e/artifacts/playwright-part6-backend-final/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part6-backend-rerun/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part6-backend/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part6-msw-final/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part7-backend-final/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part7-backend-rerun/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part7-backend-security/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| no | tests/e2e/artifacts/playwright-part7-forced-route-rerun/ | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. |
| review | tests/e2e/fixtures/ | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/forms-network-errors-full.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/frontend-keyboard-accessibility.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/frontend-route-smoke.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/frontend-route-state-cache.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/frontend-visual-invariants.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/project-composer-context.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/project-rename-navigation-race.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/ui-performance-animations-full.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/ui-reduced-motion.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/utils/ | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |
| review | tests/e2e/visual-system-evidence.spec.ts | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. |

## Full Per-File Classification

| path | status | domain | include in PR | reason | risk | requires test | artifact/doc/code |
| --- | --- | --- | --- | --- | --- | --- | --- |
| apps/backend/src/modules/activepieces/activepieces-jwt-signer.spec.ts | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/backend/src/modules/activepieces/activepieces.controller.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/backend/src/modules/activepieces/activepieces.service.spec.ts | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/backend/src/modules/activepieces/activepieces.service.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/backend/src/modules/audit/audit.service.ts | modified | security | yes | Intentional security hardening code change. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | code |
| apps/backend/src/modules/automation-builder/automation-builder.service.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/backend/src/modules/canvas/canvas-io-utils.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/backend/src/modules/canvas/canvas-validation.service.spec.ts | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/backend/src/modules/chat/chat-thread.service.spec.ts | modified | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/backend/src/modules/chat/chat-thread.service.ts | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/backend/src/modules/chat/chat.controller.ts | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/backend/src/modules/documents/documents.service.spec.ts | modified | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| apps/backend/src/modules/documents/documents.service.ts | modified | documents | yes | Intentional documents hardening code change. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | code |
| apps/backend/src/modules/legal-search/legal-search.service.ts | modified | search | yes | Intentional search hardening code change. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | code |
| apps/backend/src/modules/settings/ai-base-url-ssrf.guard.spec.ts | modified | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| apps/backend/src/modules/settings/ai-base-url-ssrf.guard.ts | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/backend/src/modules/settings/settings-redactor.spec.ts | modified | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| apps/backend/src/modules/settings/settings-redactor.ts | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/backend/src/modules/stage15-projects/project-web-search.service.spec.ts | modified | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| apps/backend/src/modules/stage15-projects/project-web-search.service.ts | modified | search | yes | Intentional search hardening code change. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | code |
| apps/web/next-env.d.ts | modified | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Generated file; verify whether Next version changed it intentionally. | yes | code |
| apps/web/src/app/(auth)/onboarding/workspace/page.tsx | modified | security | yes | Intentional security hardening code change. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | code |
| apps/web/src/app/(auth)/sign-in/page.tsx | modified | security | yes | Intentional security hardening code change. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | code |
| apps/web/src/components/app-shell.test.tsx | modified | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| apps/web/src/components/app-shell.tsx | modified | shell | yes | Intentional shell hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/components/legal/legal-research-workspace.tsx | modified | search | yes | Intentional search hardening code change. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | code |
| apps/web/src/components/preview-panel.test.tsx | modified | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| apps/web/src/components/preview-panel.tsx | modified | documents | yes | Intentional documents hardening code change. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | code |
| apps/web/src/components/shell/project-home.test.tsx | modified | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| apps/web/src/components/shell/project-home.tsx | modified | shell | yes | Intentional shell hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/components/shell/project-sidebar.test.tsx | modified | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| apps/web/src/components/shell/project-sidebar.tsx | modified | shell | yes | Intentional shell hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/components/ui/dialog.tsx | modified | shell | yes | Intentional shell hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/components/ui/tabs.tsx | modified | shell | yes | Intentional shell hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/features/ai-chat/components/LexFrameChatShell.test.tsx | modified | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/web/src/features/ai-chat/components/LexFrameChatShell.tsx | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/web/src/features/ai-chat/components/LexFrameComposer.tsx | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/web/src/features/ai-chat/components/LexFrameThread.tsx | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/web/src/features/ai-chat/domain/chatStateMachine.test.ts | modified | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/web/src/features/ai-chat/domain/chatStateMachine.ts | modified | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/web/src/features/automation-canvas/activepieces-canvas-route.test.tsx | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/web/src/features/automation-canvas/activepieces-canvas-route.tsx | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/web/src/features/automation-canvas/activepieces-canvas-wrapper.test.tsx | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/web/src/features/automation-canvas/use-activepieces-session.test.tsx | modified | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/web/src/features/automation-canvas/use-activepieces-session.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| apps/web/src/features/settings/components/ai-connection-test-button.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/ai-key-write-only-field.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/ai-provider-connection-form.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/ai-route-group-card.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/ai-settings-panel.test.tsx | modified | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| apps/web/src/features/settings/components/ai-settings-panel.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/organization-settings-panel.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/profile-settings-panel.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/settings-button.test.tsx | modified | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| apps/web/src/features/settings/components/settings-button.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/settings-dialog.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/settings-save-bar.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/features/settings/components/settings-shell.tsx | modified | settings | yes | Intentional settings hardening code change. | Secret-handling change; requires browser/storage/network redaction proof. | yes | code |
| apps/web/src/hooks/use-stage0-data.ts | modified | search | yes | Intentional search hardening code change. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | code |
| apps/web/src/mocks/handlers.ts | modified | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/mocks/stage15-handlers.ts | modified | search | yes | Intentional search hardening code change. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | code |
| apps/web/src/providers/session-provider.tsx | modified | security | yes | Intentional security hardening code change. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | code |
| package.json | modified | contracts | yes | Intentional contracts hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| packages/ai-gateway/package.json | modified | contracts | yes | Intentional contracts hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| packages/api-client/package.json | modified | contracts | yes | Intentional contracts hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| packages/contracts/package.json | modified | contracts | yes | Intentional contracts hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| packages/contracts/src/canvas.ts | modified | automation | yes | Intentional automation hardening code change. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | code |
| packages/contracts/src/errors/error-codes.ts | modified | contracts | yes | Intentional contracts hardening code change. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| scripts/stage16-build-backend-runtime.mjs | modified | full-gate | yes | Intentional runtime/gate/verification script. | Release gate script/test change; requires fresh system:full-gate run. | yes | script |
| scripts/stage16-db-apply-local.mjs | modified | full-gate | yes | Intentional runtime/gate/verification script. | Release gate script/test change; requires fresh system:full-gate run. | yes | script |
| tests/e2e/documents-storage.spec.ts | modified | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/helpers/api.ts | modified | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/helpers/auth.ts | modified | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/playwright.config.ts | modified | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/stage2-storage-integrated.spec.ts | modified | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| .codex-dev-logs/ | untracked | temporary | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | temporary |
| apps/backend/src/modules/activepieces/activepieces-audit-writer.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/backend/src/modules/audit/audit-redaction.ts | untracked | security | yes | Intentional security hardening code change. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | code |
| apps/backend/src/modules/audit/audit.service.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| apps/backend/src/modules/authorization/authorization.service.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| apps/backend/src/modules/automation-builder/automation-builder.service.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/backend/src/modules/chat/chat-sse-headers.ts | untracked | chat | yes | Intentional chat hardening code change. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | code |
| apps/backend/src/modules/chat/chat.controller.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/backend/src/modules/legal-rag/legal-rag.service.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| apps/backend/src/modules/legal-search/legal-search.service.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| apps/backend/src/modules/legal-sources/legal-sources.service.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| apps/backend/src/modules/runs/run-preflight.service.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| apps/web/src/components/ui/ui-primitives.test.tsx | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| apps/web/src/features/ai-chat/components/LexFrameAttachmentTile.test.tsx | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/web/src/features/ai-chat/components/LexFrameComposer.test.tsx | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| apps/web/src/features/settings/components/settings-shell.test.tsx | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| apps/web/src/mocks/e2e-control.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | code |
| apps/web/src/providers/session-provider.test.tsx | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| artifacts/system-tests/ | untracked | artifact | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Artifact policy review required before PR. | no | artifact |
| docs/testing/LexFrame_system_tests_chat_report_2026-05-13.docx | untracked | chat | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| docs/testing/accessibility-keyboard-plan.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/activepieces-session-security-checklist.md | untracked | automation | yes | Intentional hardening-cycle documentation. | Runtime/session bridge change; requires AP/backend-backed coverage. | no | doc |
| docs/testing/automation-activepieces-runtime-inventory.md | untracked | automation | yes | Intentional hardening-cycle documentation. | Runtime/session bridge change; requires AP/backend-backed coverage. | no | doc |
| docs/testing/automation-activepieces-runtime-test-plan.md | untracked | automation | yes | Intentional hardening-cycle documentation. | Runtime/session bridge change; requires AP/backend-backed coverage. | no | doc |
| docs/testing/automation-canvas-security-matrix.md | untracked | automation | yes | Intentional hardening-cycle documentation. | Runtime/session bridge change; requires AP/backend-backed coverage. | no | doc |
| docs/testing/backend-contract-db-security-inventory.md | untracked | security | yes | Intentional hardening-cycle documentation. | Security boundary change; requires targeted auth/RBAC/audit tests. | no | doc |
| docs/testing/backend-contract-db-security-test-plan.md | untracked | security | yes | Intentional hardening-cycle documentation. | Security boundary change; requires targeted auth/RBAC/audit tests. | no | doc |
| docs/testing/browser-security-scan-plan.md | untracked | security | yes | Intentional hardening-cycle documentation. | Security boundary change; requires targeted auth/RBAC/audit tests. | no | doc |
| docs/testing/chat-runtime-scenario-matrix.md | untracked | chat | yes | Intentional hardening-cycle documentation. | Streaming/state change; requires reload/retry/secret isolation proof. | no | doc |
| docs/testing/clean-runtime-rc-plan.md | untracked | full-gate | yes | Intentional hardening-cycle documentation. | Release gate script/test change; requires fresh system:full-gate run. | no | doc |
| docs/testing/clickability-matrix.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/coverage-matrix.md | untracked | search | yes | Intentional hardening-cycle documentation. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | no | doc |
| docs/testing/detected-defects.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/documents-upload-test-matrix.md | untracked | documents | yes | Intentional hardening-cycle documentation. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | no | doc |
| docs/testing/evidence-manifest-spec.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/frontend-clickability-defects.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/frontend-clickability-inventory.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/merge-readiness-report.md | untracked | full-gate | yes | Intentional hardening-cycle documentation. | Release gate script/test change; requires fresh system:full-gate run. | no | doc |
| docs/testing/part2-project-workspace-bug-hunt.md | untracked | shell | yes | Intentional hardening-cycle documentation. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/part3-chat-runtime-bug-hunt.md | untracked | chat | yes | Intentional hardening-cycle documentation. | Streaming/state change; requires reload/retry/secret isolation proof. | no | doc |
| docs/testing/part4-automation-runtime-bug-hunt.md | untracked | automation | yes | Intentional hardening-cycle documentation. | Runtime/session bridge change; requires AP/backend-backed coverage. | no | doc |
| docs/testing/part5-documents-storage-bug-hunt.md | untracked | documents | yes | Intentional hardening-cycle documentation. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | no | doc |
| docs/testing/part6-settings-security-bug-hunt.md | untracked | settings | yes | Intentional hardening-cycle documentation. | Secret-handling change; requires browser/storage/network redaction proof. | no | doc |
| docs/testing/part7-security-rbac-audit-bug-hunt.md | untracked | security | yes | Intentional hardening-cycle documentation. | Security boundary change; requires targeted auth/RBAC/audit tests. | no | doc |
| docs/testing/part8-search-rag-sources-bug-hunt.md | untracked | search | yes | Intentional hardening-cycle documentation. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | no | doc |
| docs/testing/part9-full-system-gate.md | untracked | full-gate | yes | Intentional hardening-cycle documentation. | Release gate script/test change; requires fresh system:full-gate run. | no | doc |
| docs/testing/performance-animation-budget.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/performance-animation-security-inventory.md | untracked | security | yes | Intentional hardening-cycle documentation. | Security boundary change; requires targeted auth/RBAC/audit tests. | no | doc |
| docs/testing/project-chat-documents-inventory.md | untracked | documents | yes | Intentional hardening-cycle documentation. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | no | doc |
| docs/testing/project-chat-documents-test-plan.md | untracked | documents | yes | Intentional hardening-cycle documentation. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | no | doc |
| docs/testing/project-knowledge-sources-test-matrix.md | untracked | search | yes | Intentional hardening-cycle documentation. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | no | doc |
| docs/testing/run-evidence-matrix.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| docs/testing/system-hardening-cycle-summary.md | untracked | full-gate | yes | Intentional hardening-cycle documentation. | Release gate script/test change; requires fresh system:full-gate run. | no | doc |
| docs/testing/system-release-gate.md | untracked | full-gate | yes | Intentional hardening-cycle documentation. | Release gate script/test change; requires fresh system:full-gate run. | no | doc |
| docs/testing/system-test-final-report.md | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | no | doc |
| packages/ai-gateway/src/route-assets.test.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| packages/api-client/src/chat-client.test.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| packages/api-client/src/settings-client.test.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| packages/contracts/src/security-invariants.test.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| scripts/stage16-e2e-preflight.mjs | untracked | full-gate | yes | Intentional runtime/gate/verification script. | Release gate script/test change; requires fresh system:full-gate run. | yes | script |
| scripts/stage16-e2e-preflight.test.mjs | untracked | full-gate | yes | Intentional runtime/gate/verification script. | Release gate script/test change; requires fresh system:full-gate run. | yes | script |
| scripts/testing/ | untracked | full-gate | yes | Intentional runtime/gate/verification script. | Release gate script/test change; requires fresh system:full-gate run. | yes | script |
| tests/e2e/accessibility-keyboard-focus.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/artifacts/playwright-part6-backend-final/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part6-backend-rerun/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part6-backend/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part6-msw-final/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part7-backend-final/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part7-backend-rerun/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part7-backend-security/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/artifacts/playwright-part7-forced-route-rerun/ | untracked | artifact | no | Generated/local-only artifact or temporary runtime file; keep out of PR unless explicitly attached outside git. | Commit noise, stale binary artifacts, or local-only evidence if staged. | no | artifact |
| tests/e2e/automation-activepieces-canvas-full.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-activepieces-session-security.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-ai-builder-runtime.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-browser-security-isolation.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-canvas-validation-security.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-cross-scope-access.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-dry-run-idempotency.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-route-cache-cleanup.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-route-family-cache-live.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-runtime-dry-run-full.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-runtime-evidence-live.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-runtime-readiness-live.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/automation-session-refresh-expiry.spec.ts | untracked | automation | yes | Intentional regression or release-gate test coverage. | Runtime/session bridge change; requires AP/backend-backed coverage. | yes | test |
| tests/e2e/browser-security-isolation-full.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| tests/e2e/chat-attachments-branches.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-attachments-failure-lifecycle.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-branch-persistence-live.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-browser-security-isolation.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-live-reload-recovery.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-multitab-consistency.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-runtime-resilience.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/chat-stream-race-conditions.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/documents-cross-scope-access.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/documents-download-security.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/documents-msw-upload-lifecycle.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/documents-upload-download-full.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/documents-upload-failure-lifecycle.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/fixtures/ | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/forms-network-errors-full.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-keyboard-accessibility.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-multitab-shell-state.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-route-smoke.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-route-state-cache.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-runtime-preflight.spec.ts | untracked | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/frontend-settings-shell-state.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/frontend-shell-clickability.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-shell-navigation-state.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-sidebar-route-cache.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/frontend-sidebar-settings.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/frontend-visual-invariants.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/global-chat-runtime-full.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/helpers/runtime-preflight.ts | untracked | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/project-chat-runtime-full.spec.ts | untracked | chat | yes | Intentional regression or release-gate test coverage. | Streaming/state change; requires reload/retry/secret isolation proof. | yes | test |
| tests/e2e/project-composer-context.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/project-rename-navigation-race.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/project-sources-knowledge.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/project-web-search-sources.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/project-workspace-api-resilience.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/project-workspace-composer-context.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/project-workspace-flow.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/project-workspace-tabs-state.spec.ts | untracked | shell | yes | Intentional regression or release-gate test coverage. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/search-browser-security-isolation.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/search-cross-workspace-scope.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/search-navigation-cache-race.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/search-rag-citations-security.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/search-readiness-degraded-state.spec.ts | untracked | search | yes | Intentional regression or release-gate test coverage. | Source/RAG scoping change; requires search readiness and no cross-workspace leakage proof. | yes | test |
| tests/e2e/security-admin-route-guard.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| tests/e2e/security-audit-redaction-live.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| tests/e2e/security-browser-storage-network-full.spec.ts | untracked | documents | yes | Intentional regression or release-gate test coverage. | Storage lifecycle change; requires upload/download and no signed URL leak proof. | yes | test |
| tests/e2e/security-cross-workspace-data-leakage.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| tests/e2e/security-forced-route-access.spec.ts | untracked | security | yes | Intentional regression or release-gate test coverage. | Security boundary change; requires targeted auth/RBAC/audit tests. | yes | test |
| tests/e2e/settings-ai-route-preferences-live.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-browser-security-isolation.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-multitab-consistency.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-network-failure-resilience.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-profile-organization-live.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-secret-write-only-security.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/settings-ssrf-guard-live.spec.ts | untracked | settings | yes | Intentional regression or release-gate test coverage. | Secret-handling change; requires browser/storage/network redaction proof. | yes | test |
| tests/e2e/system-release-gate-smoke.spec.ts | untracked | full-gate | yes | Intentional regression or release-gate test coverage. | Release gate script/test change; requires fresh system:full-gate run. | yes | test |
| tests/e2e/ui-performance-animations-full.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/ui-reduced-motion.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/utils/ | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
| tests/e2e/visual-system-evidence.spec.ts | untracked | unrelated | review | Needs human PR-scope review before staging; may be generated evidence, package metadata, or cross-domain shared code. | Standard regression risk; covered by full gate or targeted part gates. | yes | test |
