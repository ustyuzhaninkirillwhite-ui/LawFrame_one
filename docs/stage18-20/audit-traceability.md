# Stage 18-20 Audit Traceability

Generated: 2026-05-07T06:53:02.181Z
Final decision: REJECT

| Stage | Requirement ID | Requirement source file / section | Expected behavior | Backend paths | Frontend paths | Contracts / schemas | DB migrations / seeds | Runtime dependency | Test command | Playwright scenario | Manual/live check | Evidence path | Status | Fix file/commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18 | S18-AI-GW | docs/stage18/* | AI Gateway route registry, default_chat, CometAPI/deepseek-v4-flash, route valves, usage/audit, no direct provider calls | apps/backend/src/modules/ai-gateway | apps/web/src/components/ai | @lexframe/contracts ai.ts | AI tables/policies from Stage 18 migrations | AI Gateway provider registry | stage18:release-gate | stage18-ai-gateway-live.spec.ts | readiness/stage18 + AI request/security scan | artifacts/stage18-20/audit | PASS | audit run |
| 19 | S19-CHAT | docs/stage19/* | LexFrame-native project chat, assistant-ui UI layer only, project knowledge, attachments, stream/resume/actions, no direct provider calls | apps/backend/src/modules/chat | apps/web/src/features/ai-chat | @lexframe/contracts chat.ts | chat/project knowledge migrations | AI Gateway default_chat | stage19:release-gate | stage19-project-chat-live.spec.ts | project chat UI/API/live persistence | artifacts/stage18-20/audit | PASS | audit run |
| 20 | S20-BUILDER | docs/stage20/* | AutomationIntent/Blueprint, automation_planner_high only for planning, validation, clarification, Canvas/runtime draft controls, approval gates | apps/backend/src/modules/automation-builder | apps/web/src/features/automation-builder | @lexframe/contracts automation-builder.ts | automation builder migrations | AI Gateway + Canvas/AP boundary | stage20:release-gate | stage20-ai-automation-builder-live.spec.ts | builder UI/API/live negative cases | artifacts/stage18-20/audit | PASS | audit run |
