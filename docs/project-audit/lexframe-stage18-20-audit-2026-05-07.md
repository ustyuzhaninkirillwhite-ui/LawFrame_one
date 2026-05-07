# LexFrame Stage 18-20 Post-Implementation Audit

## 1. Audit metadata
date: 2026-05-07
auditor: Codex
branch: main
commit_before_audit: b4bf2fc80c17b3cdc9a76d5fa4ea6fac3fc9f0dc
commit_after_fixes: b4bf2fc80c17b3cdc9a76d5fa4ea6fac3fc9f0dc
OS: Windows_NT 10.0.26200 x64
Node: v22.16.0
pnpm: 10.11.1
Docker: Docker version 29.3.1, build c2be9cc
runtime profile: live env not configured

## 2. Scope
Stage 18: AI Gateway governance, route registry, CometAPI/default model, security and evidence.
Stage 19: LexFrame-native project chat, assistant-ui integration boundary, project knowledge and security.
Stage 20: AI Automation Builder, AutomationIntent/Blueprint, planner route, validation, Canvas/runtime draft and approval gates.

## 3. Traceability summary
- preflight: PASS
- requirements_traceability: PASS
- reference_provenance: PASS
- contracts: PASS
- backend: PASS
- frontend: PASS
- db: PASS
- runtime: BLOCKED
- playwright_live: PASS
- security: PASS
- stage18: PASS
- stage19: PASS
- stage20: PASS
- full_check: BLOCKED

## 4. Commands executed
| Command | Result | Log path | Duration |
|---|---|---|---|
| preflight | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-30-55-046Z-preflight.log | 243ms |
| preflight | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-31-16-582Z-preflight.log | 113ms |
| preflight | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-31-47-034Z-preflight.log | 1605ms |
| discovery-rg-probe | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-32-04-109Z-discovery-rg-probe.log | 489ms |
| discovery-stage18-20 | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-32-26-317Z-discovery-stage18-20.log | 2709ms |
| discovery-scripts-inventory | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-32-38-811Z-discovery-scripts-inventory.log | 54ms |
| reference-provenance-local-repos | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-32-55-317Z-reference-provenance-local-repos.log | 3431ms |
| static-architecture-security-scan | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-33-11-659Z-static-architecture-security-scan.log | 25989ms |
| static-architecture-security-scan | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-34-05-039Z-static-architecture-security-scan.log | 6555ms |
| stage18-release-gate | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-34-20-408Z-stage18-release-gate.log | 2ms |
| stage18-release-gate | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-34-51-695Z-stage18-release-gate.log | 93123ms |
| stage19-release-gate | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-36-32-143Z-stage19-release-gate.log | 57333ms |
| stage20-release-gate | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-37-35-560Z-stage20-release-gate.log | 2326ms |
| stage20-direct-provider-call-scan | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-38-18-215Z-stage20-direct-provider-call-scan.log | 687ms |
| stage20-release-gate | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-38-24-641Z-stage20-release-gate.log | 83428ms |
| contracts-and-packages | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-40-10-568Z-contracts-and-packages.log | 33822ms |
| backend-audit-tests | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-40-52-786Z-backend-audit-tests.log | 75962ms |
| backend-lint-autofix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-42-34-045Z-backend-lint-autofix.log | 23326ms |
| backend-lint-after-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-43-49-079Z-backend-lint-after-fix.log | 19836ms |
| backend-audit-tests | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-44-18-498Z-backend-audit-tests.log | 141310ms |
| frontend-audit-tests | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-46-50-662Z-frontend-audit-tests.log | 140877ms |
| frontend-lint-after-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-51-20-876Z-frontend-lint-after-fix.log | 15814ms |
| frontend-audit-tests | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-51-44-433Z-frontend-audit-tests.log | 301213ms |
| db-audit-tests | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-56-58-026Z-db-audit-tests.log | 1455ms |
| stage17-runtime-script-inventory | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-57-07-072Z-stage17-runtime-script-inventory.log | 52ms |
| stage17-compose-config | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T04-57-19-133Z-stage17-compose-config.log | 795ms |
| stage17-up | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T04-57-24-749Z-stage17-up.log | 231562ms |
| stage17-bootstrap-logs-after-up-failure | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-01-30-803Z-stage17-bootstrap-logs-after-up-failure.log | 88ms |
| db-audit-tests-after-migration-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-03-07-212Z-db-audit-tests-after-migration-fix.log | 1669ms |
| stage17-up-after-migration-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-03-15-441Z-stage17-up-after-migration-fix.log | 123876ms |
| stage17-backend-logs-after-up-failure | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-05-35-361Z-stage17-backend-logs-after-up-failure.log | 66ms |
| backend-affected-after-module-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-06-23-323Z-backend-affected-after-module-fix.log | 117112ms |
| stage17-up-after-module-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-08-27-826Z-stage17-up-after-module-fix.log | 123031ms |
| stage17-readiness | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-10-42-981Z-stage17-readiness.log | 836ms |
| stage17-ps | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-10-42-981Z-stage17-ps.log | 984ms |
| stage17-runtime-evidence | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-10-42-981Z-stage17-runtime-evidence.log | 1818ms |
| stage17-provision-canvas | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-11-14-127Z-stage17-provision-canvas.log | 931ms |
| stage17-runtime-evidence-after-provision | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-11-20-457Z-stage17-runtime-evidence-after-provision.log | 1779ms |
| stage19-release-gate-after-runtime-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-11-32-919Z-stage19-release-gate-after-runtime-fixes.log | 71768ms |
| stage18-release-gate-after-runtime-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-11-32-891Z-stage18-release-gate-after-runtime-fixes.log | 78559ms |
| stage20-release-gate-after-runtime-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-11-32-919Z-stage20-release-gate-after-runtime-fixes.log | 123864ms |
| playwright-install | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-13-46-127Z-playwright-install.log | 20349ms |
| e2e-check | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-14-14-360Z-e2e-check.log | 423946ms |
| playwright-stage18-20-live | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-22-08-518Z-playwright-stage18-20-live.log | 922ms |
| playwright-stage18-20-live | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-22-25-111Z-playwright-stage18-20-live.log | 31903ms |
| db-audit-tests-after-ai-permission-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-25-17-047Z-db-audit-tests-after-ai-permission-fix.log | 1490ms |
| backend-affected-after-stage20-fk-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-25-17-026Z-backend-affected-after-stage20-fk-fix.log | 89902ms |
| stage17-up-after-stage20-fk-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-26-54-808Z-stage17-up-after-stage20-fk-fix.log | 123315ms |
| stage17-runtime-evidence-after-stage20-fk-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-29-07-194Z-stage17-runtime-evidence-after-stage20-fk-fix.log | 2776ms |
| db-ai-role-permission-readback | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-29-17-060Z-db-ai-role-permission-readback.log | 133ms |
| playwright-stage18-20-live-after-fixes | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-29-26-005Z-playwright-stage18-20-live-after-fixes.log | 26279ms |
| backend-affected-after-stage20-policy-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-33-22-197Z-backend-affected-after-stage20-policy-fix.log | 78647ms |
| backend-affected-after-stage20-policy-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-35-07-300Z-backend-affected-after-stage20-policy-fix.log | 57200ms |
| stage17-up-after-stage20-policy-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-36-12-435Z-stage17-up-after-stage20-policy-fix.log | 140894ms |
| playwright-stage18-20-live-after-policy-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-38-43-058Z-playwright-stage18-20-live-after-policy-fix.log | 22168ms |
| stage17-runtime-evidence-after-policy-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-39-13-125Z-stage17-runtime-evidence-after-policy-fix.log | 2736ms |
| stage19-release-gate-after-final-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-39-26-620Z-stage19-release-gate-after-final-fixes.log | 85682ms |
| stage18-release-gate-after-final-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-39-26-620Z-stage18-release-gate-after-final-fixes.log | 91904ms |
| stage20-release-gate-after-final-fixes | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-39-26-623Z-stage20-release-gate-after-final-fixes.log | 140928ms |
| security-scans | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-41-55-606Z-security-scans.log | 49257ms |
| stage17-down-before-full-e2e | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-44-04-131Z-stage17-down-before-full-e2e.log | 5617ms |
| stage16-runtime-up-full-for-e2e | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-44-16-924Z-stage16-runtime-up-full-for-e2e.log | 37438ms |
| stop-stale-next-port-3000 | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T05-45-34-645Z-stop-stale-next-port-3000.log | 414ms |
| stage16-runtime-up-full-after-port-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-45-41-849Z-stage16-runtime-up-full-after-port-fix.log | 14388ms |
| stage16-runtime-up-full-after-bootstrap-settled | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-46-17-849Z-stage16-runtime-up-full-after-bootstrap-settled.log | 591686ms |
| e2e-check-after-stage16-up | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T05-56-37-365Z-e2e-check-after-stage16-up.log | 283944ms |
| final-regression-non-e2e | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-01-49-419Z-final-regression-non-e2e.log | 223573ms |
| e2e-typecheck-after-config-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-06-10-452Z-e2e-typecheck-after-config-fix.log | 2244ms |
| final-regression-non-e2e-after-config-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-06-25-183Z-final-regression-non-e2e-after-config-fix.log | 228886ms |
| e2e-lint-typecheck-after-fixture-lint-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-11-03-840Z-e2e-lint-typecheck-after-fixture-lint-fix.log | 6843ms |
| final-regression-non-e2e-after-fixture-lint-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-11-20-883Z-final-regression-non-e2e-after-fixture-lint-fix.log | 236464ms |
| api-client-lint-after-chat-import-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-17-20-881Z-api-client-lint-after-chat-import-fix.log | 3770ms |
| final-regression-non-e2e-after-chat-import-fix | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-19-54-437Z-final-regression-non-e2e-after-chat-import-fix.log | 551310ms |
| final-regression-tail-gates-after-e2e-stop | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-29-37-180Z-final-regression-tail-gates-after-e2e-stop.log | 365162ms |
| activepieces-gate-after-ai-piece-endpoint-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-38-39-498Z-activepieces-gate-after-ai-piece-endpoint-fix.log | 17536ms |
| final-regression-tail-gates-after-ai-piece-endpoint-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-39-07-383Z-final-regression-tail-gates-after-ai-piece-endpoint-fix.log | 349337ms |
| stage18-release-gate-after-ai-piece-endpoint-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-45-08-229Z-stage18-release-gate-after-ai-piece-endpoint-fix.log | 46407ms |
| generate-audit-reports-after-fix-gates | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-46-09-416Z-generate-audit-reports-after-fix-gates.log | 971ms |
| docs-artifacts-secret-scan-after-report-script | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-47-28-533Z-docs-artifacts-secret-scan-after-report-script.log | 800ms |
| docs-artifacts-secret-scan-after-signed-url-redaction | FAIL | artifacts/stage18-20/audit/command-logs/2026-05-07T06-48-48-133Z-docs-artifacts-secret-scan-after-signed-url-redaction.log | 256ms |
| docs-artifacts-secret-scan-after-logger-redaction-fix | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-49-41-406Z-docs-artifacts-secret-scan-after-logger-redaction-fix.log | 252ms |
| generate-audit-reports-final | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-49-56-730Z-generate-audit-reports-final.log | 814ms |
| docs-artifacts-secret-scan-final | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-50-05-761Z-docs-artifacts-secret-scan-final.log | 246ms |
| generate-audit-reports-with-fix-register | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-51-56-834Z-generate-audit-reports-with-fix-register.log | 815ms |
| docs-artifacts-secret-scan-after-fix-register-report | PASS | artifacts/stage18-20/audit/command-logs/2026-05-07T06-52-09-737Z-docs-artifacts-secret-scan-after-fix-register-report.log | 3682ms |

## 5. Static audit findings
Static scans are recorded in command logs and stage artifacts. Any failed scan keeps the related gate BLOCKED.

## 6. Reference/provenance audit
assistant-ui, Chatbot UI, AnythingLLM and LibreChat were checked as local reference repositories. See `docs/stage18-20/reference-provenance-stage18-20.md`.

## 7. Playwright live audit
Targeted Stage 18-20 Playwright specs were added and their artifacts are configured under `artifacts/stage18-20/audit/playwright`.

## 8. Stage 18 result
status: PASS

## 9. Stage 19 result
status: PASS

## 10. Stage 20 result
status: PASS

## 11. Security result
status: PASS

## 12. Defects fixed
10 Stage 18-20 audit defects were fixed in this pass. 2 blocker records remain open. See audit-fixes.md.

## 13. Remaining blockers
- P1: Live AI/AP/MCP provider environment was not configured; acceptance requires live runtime proof.
- P0: Full regression/e2e gate is not passing.

## 14. Final decision
REJECT
