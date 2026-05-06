# Stage 18 Reference Projects Analysis

Generated: 2026-05-06T18:53:46.600Z

| Project | Path | Git | License | Reviewed areas | Stage 18 conclusion |
|---|---|---|---|---|---|
| assistant-ui | E:\assistant-ui-main | not_available/not_available | LICENSE; package=n/a | apps/docs/content/docs/runtimes/concepts/architecture.mdx<br>apps/docs/content/docs/runtimes/concepts/adapters.mdx<br>apps/docs/content/docs/(reference)/api-reference/hooks/runtimes.mdx | Use ExternalStoreRuntime/data-stream ownership concept for Stage 19-ready stream events; no Stage 18 dependency. |
| Chatbot UI | E:\chatbot-ui-main | not_available/not_available | LICENSE; package=n/a | app/api/chat/custom/route.ts<br>lib/server/server-chat-helpers.ts<br>.env.local.example | Provider route handlers demonstrate a pattern LexFrame must avoid: user/profile provider keys and model selectors stay out of MVP user flow. |
| AnythingLLM | E:\anything-llm-master | not_available/not_available | LICENSE; package=MIT | server/models/systemSettings.js<br>server/models/workspace.js<br>server/endpoints/api/workspace/index.js | System/workspace/agent provider separation maps cleanly to LexFrame route policy, hidden from ordinary lawyers. |
| LibreChat | E:\LibreChat-main | not_available/not_available | LICENSE; package=ISC | librechat.example.yaml<br>api/server/controllers/agents/request.js<br>api/app/clients/tools/util/handleTools.js | Custom endpoint/model spec, fail-fast config, MCP/tool ACL and resumable stream ideas are useful clean-room references; direct import blocked. |

## Block Reference Checks

| Block | References checked | Clean-room decision |
|---|---|---|
| Provider/route registry | LibreChat custom endpoints/model specs<br>AnythingLLM System/Workspace/Agent LLM settings<br>Chatbot UI provider route handlers<br>assistant-ui runtime architecture docs | Backend-owned route registry with no user model selector. |
| Streaming foundation | assistant-ui ExternalStoreRuntime/data-stream docs<br>LibreChat resumable agent request/callback flow<br>Chatbot UI streaming route handlers | LexFrame SSE event protocol with route snapshots and evidence events. |
| Activepieces piece | AnythingLLM agent/tool separation<br>LibreChat MCP/tool ACL handling<br>assistant-ui tool UI assumptions | Piece calls LexFrame runtime endpoint only; no provider client props. |
