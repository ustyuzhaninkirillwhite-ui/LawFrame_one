import type {
  ChatMessageDto,
  ChatStreamSnapshot,
  ChatThreadSummary,
  ProjectKnowledgeItem,
} from "@lexframe/contracts";

export type LexFrameChatThread = ChatThreadSummary;
export type LexFrameChatMessage = ChatMessageDto;
export type LexFrameChatStream = ChatStreamSnapshot;
export type LexFrameProjectKnowledgeItem = ProjectKnowledgeItem;

export interface LexFrameChatDegradedState {
  readonly code:
    | "permission_denied"
    | "project_not_found"
    | "workspace_access_denied"
    | "ai_gateway_unavailable"
    | "default_route_not_configured"
    | "stream_protocol_unavailable"
    | "project_knowledge_unavailable"
    | "document_access_blocked"
    | "thread_archived"
    | "thread_deleted"
    | "legal_secret_policy_blocked";
  readonly message: string;
}
