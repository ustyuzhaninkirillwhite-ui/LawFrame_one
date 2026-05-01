import type { ErrorCode } from '@lexframe/contracts';
import type { SecretString } from './secret-string';

export type LocalOwnerKeyPurpose =
  | 'ai_gateway'
  | 'workflow_planning'
  | 'activepieces_custom_piece';

export type LocalOwnerKeyProvider =
  | 'xai'
  | 'openai_compatible'
  | 'cometapi'
  | 'local';

export type LocalOwnerKeyStatus =
  | 'ready'
  | 'degraded'
  | 'missing'
  | 'invalid'
  | 'disabled';

export type LocalOwnerKeySource = 'env_override' | 'default_path';

export interface LocalOwnerKeysFile {
  readonly schema_version: '1.0';
  readonly default_route: string;
  readonly keys: readonly LocalOwnerKey[];
}

export interface LocalOwnerKey {
  readonly id: string;
  readonly provider: LocalOwnerKeyProvider;
  readonly base_url?: string;
  readonly model: string;
  readonly api_key: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly purposes: readonly LocalOwnerKeyPurpose[];
  readonly max_monthly_budget?: number | null;
  readonly notes?: string;
}

export interface LocalKeyRuntimeRecord {
  readonly keyId: string;
  readonly provider: LocalOwnerKeyProvider;
  readonly baseUrl?: string;
  readonly model: string;
  readonly apiKey: SecretString;
  readonly enabled: boolean;
  readonly priority: number;
  readonly purposes: ReadonlySet<LocalOwnerKeyPurpose>;
  readonly maxMonthlyBudget?: number | null;
  readonly fingerprint: string;
  readonly defaultRoute: boolean;
}

export interface KeyResolverResult {
  readonly key_id: string;
  readonly provider: LocalOwnerKeyProvider;
  readonly model: string;
  readonly base_url?: string;
  readonly api_key: SecretString;
  readonly fingerprint: string;
  readonly purpose: LocalOwnerKeyPurpose;
  readonly route: string;
}

export interface ResolveLocalKeyInput {
  readonly purpose: LocalOwnerKeyPurpose;
  readonly provider?: LocalOwnerKeyProvider;
  readonly routeId?: string;
  readonly workspaceId?: string;
  readonly traceId: string;
}

export interface SafeLocalKeyRoute {
  readonly key_id: string;
  readonly provider: LocalOwnerKeyProvider;
  readonly model: string;
  readonly purposes: readonly LocalOwnerKeyPurpose[];
  readonly priority: number;
  readonly fingerprint: string;
  readonly enabled: boolean;
  readonly default_route: boolean;
}

export interface SafeLocalKeysStatus {
  readonly status: LocalOwnerKeyStatus;
  readonly disabled: boolean;
  readonly source: LocalOwnerKeySource | null;
  readonly file: {
    readonly exists: boolean;
    readonly readable: boolean;
    readonly acl_ok: boolean;
    readonly path_hint: string | null;
    readonly last_loaded_at?: string;
  };
  readonly schema: {
    readonly valid: boolean;
    readonly schema_version: string | null;
    readonly errors: readonly {
      readonly code: ErrorCode;
      readonly path: string;
    }[];
  };
  readonly keys: {
    readonly total: number;
    readonly enabled: number;
    readonly disabled: number;
    readonly routes: readonly SafeLocalKeyRoute[];
  };
  readonly warnings: readonly {
    readonly code: ErrorCode;
    readonly path: string;
  }[];
}

export interface PathResolutionResult {
  readonly disabled: boolean;
  readonly source: LocalOwnerKeySource | null;
  readonly configuredPath: string | null;
  readonly canonicalPath: string | null;
  readonly pathHint: string | null;
  readonly error?: {
    readonly code: ErrorCode;
    readonly path: string;
  };
}

export interface AclInspectionResult {
  readonly ok: boolean;
  readonly warnings: readonly {
    readonly code: ErrorCode;
    readonly path: string;
  }[];
}
