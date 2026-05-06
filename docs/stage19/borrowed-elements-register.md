# Stage 19 Borrowed Elements Register

| Source | Source path | Type | Target | Mode | Reason | Security result |
|---|---|---|---|---|---|---|
| assistant-ui | packages/react, packages/react-data-stream | dependency | apps/web/src/features/ai-chat | direct_dependency | ExternalStoreRuntime and primitives render LexFrame-owned chat state. | No Assistant Cloud import or hosted persistence usage in LexFrame code. |
| AnythingLLM | server/models/workspace.js, workspaceParsedFiles.js, documents.js | architecture_pattern | chat_context_items, project_knowledge_items | clean_room | Thread attachment vs project/workspace knowledge distinction. | LexFrame backend policy owns all classification and context decisions. |
| LibreChat | conversation/message/fork/search stream references | architecture_pattern | chat_thread_branches, chat_search_index, chat_stream_jobs | clean_room | Fork/search/resume concepts only. | Direct code import blocked by local license metadata discrepancy. |
| Chatbot UI | components/chat/chat-ui.tsx, db/chats.ts, db/messages.ts | ux_pattern | LexFrameChatShell | clean_room | Lightweight sidebar/composer shell pattern. | Supabase schema/provider routes were not imported. |
