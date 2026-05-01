import type {
  ActivepiecesSessionMode,
  ActivepiecesSessionRole,
  ActivepiecesSessionReadyWireResponse,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';

export interface ActivepiecesSessionRequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
  readonly idempotencyKey?: string | null;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
}

export interface ActivepiecesInstalledAutomationForSession {
  readonly id: string;
  readonly workspace_id: string;
  readonly template_id: string;
  readonly source_template_version_id: string;
  readonly title: string;
  readonly version: string;
  readonly workflow_state:
    | 'draft'
    | 'published'
    | 'compiled'
    | 'execution_ready';
  readonly builder_state: 'unavailable' | 'mock' | 'ready';
  readonly sync_state:
    | 'not_requested'
    | 'pending'
    | 'synced'
    | 'failed'
    | 'disabled';
  readonly compatibility_status:
    | 'compatible'
    | 'runtime_sync_pending'
    | 'missing_requirements'
    | 'policy_blocked';
  readonly available: boolean;
  readonly workflow: Record<string, unknown> | null;
  readonly active_canvas_version_id: string | null;
  readonly production_disabled_at: string | null;
  readonly production_disabled_reason: string | null;
  readonly runtime_project_id: string | null;
  readonly runtime_flow_id: string | null;
  readonly sync_hash: string | null;
}

export interface ActivepiecesWorkspaceSecurityForSession {
  readonly workspaceId: string;
  readonly incidentLockActive: boolean;
  readonly tokenTtlSeconds: number;
  readonly piecesFilterType: string;
  readonly piecesTags: readonly string[];
}

export interface ActivepiecesMappedSessionRole {
  readonly role: Exclude<ActivepiecesSessionRole, 'ADMIN'>;
  readonly permissions: ActivepiecesSessionReadyWireResponse['permissions'];
  readonly downgradeReason: string | null;
}

export interface ActivepiecesPiecesPolicy {
  readonly piecesFilterType: 'ALLOWED';
  readonly piecesTags: readonly string[];
  readonly denylistedPieces: readonly string[];
  readonly policyHash: string;
}

export interface ActivepiecesProjectBindingForSession {
  readonly id: string;
  readonly externalProjectId: string;
  readonly activepiecesProjectId: string | null;
}

export interface ActivepiecesUserBindingForSession {
  readonly id: string;
  readonly externalUserId: string;
  readonly activepiecesUserId: string | null;
  readonly activepiecesRole: ActivepiecesSessionRole;
}

export interface ActivepiecesFlowBindingForSession {
  readonly automationId: string;
  readonly activepiecesProjectId: string | null;
  readonly activepiecesFlowId: string | null;
  readonly activepiecesFlowVersionId: string | null;
  readonly syncStatus:
    | 'synced'
    | 'runtime_modified'
    | 'pending_sync'
    | 'unknown';
  readonly syncHash: string | null;
}

export interface ActivepiecesJwtIssueInput {
  readonly actor: AuthenticatedActor;
  readonly access: AccessContext;
  readonly externalUserId: string;
  readonly externalProjectId: string;
  readonly projectDisplayName: string;
  readonly role: ActivepiecesMappedSessionRole['role'];
  readonly piecesPolicy: ActivepiecesPiecesPolicy;
  readonly issuedAtSeconds: number;
  readonly expiresAtSeconds: number;
  readonly jti: string;
}

export interface ActivepiecesSessionCacheEntry {
  readonly requestHash: string;
  readonly response: ActivepiecesSessionReadyWireResponse;
  readonly expiresAtMs: number;
}

export interface ActivepiecesModeDecision {
  readonly mode: ActivepiecesSessionMode;
  readonly instanceUrl: string;
  readonly prefix: string;
}
