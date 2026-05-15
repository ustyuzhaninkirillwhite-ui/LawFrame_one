# Chat Runtime Scenario Matrix

| Scenario | Layer | Test File | Status | Notes |
| --- | --- | --- | --- | --- |
| Create project chat | Backend/E2E | `chat-thread.service.spec.ts`, `project-chat-runtime-full.spec.ts` | Covered | Uses `/projects/:projectId/chats` |
| Create global chat | Web/E2E | `LexFrameChatShell.test.tsx`, `global-chat-runtime-full.spec.ts` | Covered | Uses `/chat/threads` and `/chat/:id` |
| Optimistic append | Web unit/E2E | `LexFrameChatShell.test.tsx`, `project-chat-runtime-full.spec.ts` | Covered | User message appears before provider completion |
| Assistant placeholder | Web unit/E2E | `LexFrameChatShell.test.tsx`, `project-chat-runtime-full.spec.ts` | Covered | Placeholder/status is visible while running |
| Stream completed | Backend/Web/E2E | `chat-stream.service.spec.ts`, `LexFrameChatShell.test.tsx` | Covered | E2E accepts completed or controlled failure depending on provider readiness |
| Stream controlled failure | Backend/Web/E2E | `chat-stream.service.spec.ts`, `LexFrameChatShell.test.tsx`, E2E helpers | Covered | No fake success and no raw provider error expected |
| Cancel run | Backend/Web | `chat-stream.service.spec.ts`, `LexFrameChatShell.test.tsx` | Covered | E2E invokes cancel when active control is present |
| Resume latest run | Backend/E2E | `chat-thread.service.spec.ts`, `project-chat-runtime-full.spec.ts` | Covered | `latestRun.streamId` resumes with non-5xx |
| Regenerate | Backend/Web | `chat-thread.service.spec.ts`, `LexFrameChatShell.test.tsx` | Covered | Preserves previous assistant history |
| Edit branch | Backend | `chat-thread.service.spec.ts` | Covered | Branch API preserves old history |
| Branch creation/switch | Backend/E2E | `chat-thread.service.spec.ts`, `chat-attachments-branches.spec.ts` | Covered | E2E asserts branch thread and optional switch |
| Search project scope | Backend | `chat-thread.service.spec.ts` | Covered | Project/global separation asserted |
| Project/global route separation | E2E | `global-chat-runtime-full.spec.ts` | Covered | Global chat absent from project thread API |
| No duplicate assistant | Web/E2E | `LexFrameChatShell.test.tsx`, Block 3 helpers | Covered | Non-empty assistant text uniqueness guard |
| No prompt/audit leakage | Backend/E2E | backend service specs, network assertions | Covered | Browser and audit-safe metadata checks |
