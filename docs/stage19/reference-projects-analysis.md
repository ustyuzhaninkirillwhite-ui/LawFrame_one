# Stage 19 Reference Projects Analysis

| Project | Path | Git | License | Reviewed areas | Applied conclusion |
|---|---|---|---|---|---|
| assistant-ui | E:\assistant-ui-main | not_git_repo_local_archive | LICENSE; package=not_declared; expected=MIT | ExternalStoreRuntime<br>primitives<br>attachments<br>data stream<br>tool UI | direct dependency for UI/runtime primitives only |
| Chatbot UI | E:\chatbot-ui-main | not_git_repo_local_archive | LICENSE; package=not_declared; expected=MIT | chat shell<br>sidebar<br>composer<br>Supabase schema reference | clean-room lightweight shell UX |
| AnythingLLM | E:\anything-llm-master | not_git_repo_local_archive | LICENSE; package=MIT; expected=MIT | workspace documents<br>parsed files<br>RAG settings<br>chat logs | clean-room project knowledge and attachment mode patterns |
| LibreChat | E:\LibreChat-main | not_git_repo_local_archive | LICENSE; package=ISC; expected=MIT/ISC discrepancy | conversation schema<br>message schema<br>forking<br>search<br>stream jobs | clean-room only; direct copy blocked |

LibreChat is clean-room only because local package metadata says ISC while LICENSE says MIT.
