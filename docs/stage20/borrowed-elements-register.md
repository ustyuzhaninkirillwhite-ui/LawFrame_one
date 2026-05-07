# Stage 20 Borrowed Elements Register

| Source project | Source path | Element type | Target path | Mode | Reason | Security result |
|---|---|---|---|---|---|---|
| assistant-ui | packages/react, packages/react-data-stream | UI/runtime pattern | apps/web/src/features/ai-chat, apps/web/src/features/automation-builder | existing dependency plus clean-room UI composition | Tool cards, human confirmation surfaces and stream status are rendered over LexFrame backend state. | No Assistant Cloud, hosted persistence or browser sensitive tool execution. |
| Chatbot UI | components/chat, db/chats/messages reference | UX pattern | AutomationBuilderShell, LexFrameChatShell action entrypoint | clean-room | Compact composer/sidebar/action shell patterns. | Supabase schema/provider app routes not imported. |
| AnythingLLM | workspace documents/RAG references | architecture pattern | AutomationContextAssemblerService, BlueprintContextPanel | clean-room | Workspace knowledge/document mode distinctions. | LexFrame policy owns redaction/reference/focused_rag/block modes. |
| LibreChat | agent/tool/action UX references | UX/metadata pattern | LexFrameToolCard, AutomationBuilderProgress | clean-room | Mature tool/action status ideas; local license metadata is ambiguous for direct copy. | Direct code copy blocked. |
| Activepieces | .agents/features/flows.md, mcp.md, app-connections.md | runtime contract reference | AutomationRuntimeDraftService, converter/runtime evidence tables | reference only | Draft flow/read-back/evidence concepts. | No AP backend/runtime import; no AP keys in browser. |
