# Stage 20 Reference Projects Analysis

| Project | Path | Git | License evidence | Reviewed files/folders | Applied conclusion |
|---|---|---|---|---|---|
| assistant-ui | E:\assistant-ui-main | not_git_repo_local_archive | LICENSE; package=not_declared; expected=MIT | packages/react<br>packages/react-data-stream<br>examples with tool UI/actions | UI/runtime rendering patterns only; no cloud persistence/tools. |
| Chatbot UI | E:\chatbot-ui-main | not_git_repo_local_archive | LICENSE; package=not_declared; expected=MIT | components/chat<br>sidebar/composer<br>Supabase/provider routes as anti-pattern | Clean-room lightweight composer/thread UX only. |
| AnythingLLM | E:\anything-llm-master | not_git_repo_local_archive | LICENSE; package=MIT; expected=MIT | workspace documents<br>RAG/workspace settings<br>skills warnings | Clean-room workspace knowledge/context mode ideas only. |
| LibreChat | E:\LibreChat-main | not_git_repo_local_archive | LICENSE; package=ISC; expected=MIT/ISC local discrepancy | agent/tool UX<br>conversation/message metadata<br>branch/search patterns | Clean-room tool/action UX only; direct copy blocked. |
| Activepieces | E:\activepieces-main | not_git_repo_local_archive | LICENSE; package=not_declared; expected=MIT runtime reference; EE excluded | .agents/features/flows.md<br>.agents/features/mcp.md<br>.agents/features/app-connections.md<br>.agents/features/audit-logs.md | Runtime reference only; AP remains projection/execution contour. |

LibreChat direct copy is blocked because local package metadata is not a single unambiguous MIT signal.
