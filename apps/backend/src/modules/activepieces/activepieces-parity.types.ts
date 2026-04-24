export type ActivepiecesAdoptionMode =
  | 'native_lexframe'
  | 'activepieces_embedded'
  | 'activepieces_runtime_api'
  | 'direct_reuse_mit'
  | 'fork_adapt'
  | 'wrapper'
  | 'library_import'
  | 'blocked_license'
  | 'blocked_security'
  | 'not_found';

export type ActivepiecesSecurityPolicy =
  | 'safe_by_default'
  | 'safe_with_workspace_policy'
  | 'requires_human_approval'
  | 'requires_admin_role'
  | 'advanced_only'
  | 'blocked_by_default'
  | 'forbidden_in_production';

export interface ActivepiecesFeatureAdoption {
  readonly feature: string;
  readonly repoPaths: readonly string[];
  readonly license: 'mit' | 'ee' | 'mixed' | 'unknown';
  readonly adoptionMode: ActivepiecesAdoptionMode;
  readonly securityPolicy: ActivepiecesSecurityPolicy;
  readonly notes: readonly string[];
}

export interface ActivepiecesRuntimeProjection {
  readonly lexFrameWorkspaceId: string;
  readonly lexFrameAutomationId: string;
  readonly activepiecesProjectId: string | null;
  readonly activepiecesFlowId: string | null;
  readonly activepiecesFlowVersionId: string | null;
  readonly containsAdvancedExternalSteps: boolean;
  readonly requiredPieces: readonly string[];
  readonly requiredConnections: readonly string[];
  readonly policy: ActivepiecesSecurityPolicy;
}

export interface ActivepiecesSecretBoundaryCheck {
  readonly safe: boolean;
  readonly blockedKeys: readonly string[];
  readonly message: string;
}
