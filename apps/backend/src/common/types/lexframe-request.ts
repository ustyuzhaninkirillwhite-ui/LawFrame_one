import type {
  PermissionCode,
  RoleCode,
  WorkspaceSummary,
} from '@lexframe/contracts';

export interface AuthenticatedActor {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly emailConfirmedAt: string | null;
  readonly assuranceLevel: 'aal1' | 'aal2';
  readonly accessToken: string;
  readonly sessionId: string;
}

export interface AccessContext {
  readonly activeWorkspace: WorkspaceSummary | null;
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly PermissionCode[];
}

export interface AiPolicyContext {
  readonly aiEnabled: boolean;
  readonly allowConfidential: boolean;
  readonly allowLegalSecret: boolean;
  readonly cometapiPublicEnabled: boolean;
  readonly plaintextOptIn: boolean;
  readonly sensitiveLogging: boolean;
  readonly monthlyBudgetUsd: number;
  readonly requestsPerMinuteLimit: number;
}

export interface LexframeRequestState {
  actor?: AuthenticatedActor;
  access?: AccessContext;
  aiPolicy?: AiPolicyContext;
  reauthToken?: string | null;
}

export interface LexframeRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string | undefined>;
  readonly params: Record<string, string | undefined>;
  readonly query?: Record<string, unknown>;
  readonly body?: unknown;
  requestId?: string;
  traceId?: string;
  lexframe?: LexframeRequestState;
}
