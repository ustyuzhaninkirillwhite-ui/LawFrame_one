import type {
  ActivepiecesProjectionSummary,
  CompileIssue,
  CompileReport,
  CompileStatus,
  CompilerMode,
  CompilerTargetRuntime,
  RuntimeConnectionRequirement,
  RuntimeIR,
  RuntimeIRStep,
  RuntimePieceVersionRequirement,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';

export const WORKFLOW_COMPILER_VERSION = '16.10.0';
export const TARGET_RUNTIME: CompilerTargetRuntime = 'activepieces';

export interface RequestMeta {
  readonly requestId: string | null;
  readonly traceId: string | null;
}

export interface CompileActorInput {
  readonly actor: AuthenticatedActor;
  readonly access: AccessContext;
  readonly automationId: string;
  readonly mode: CompilerMode;
  readonly includeAdvancedReport: boolean;
  readonly meta: RequestMeta;
}

export interface CanvasDraftCompilerRow {
  readonly id: string | null;
  readonly workspace_id: string;
  readonly installed_automation_id: string;
  readonly source_template_version_id: string | null;
  readonly current_version_id: string | null;
  readonly workflow: unknown;
  readonly revision_counter: number;
  readonly status: string;
}

export interface InstalledAutomationCompilerRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly source_template_version_id: string | null;
  readonly title: string;
  readonly version: string;
  readonly runtime_project_id: string | null;
  readonly runtime_flow_id: string | null;
  readonly sync_hash: string | null;
}

export interface ActivepiecesStepProjection {
  readonly name: string;
  readonly displayName: string;
  readonly type: 'PIECE' | 'PIECE_TRIGGER' | 'ROUTER' | 'LOOP' | 'NOTE';
  readonly settings: {
    readonly pieceName?: string;
    readonly pieceVersion?: string;
    readonly actionName?: string | null;
    readonly triggerName?: string | null;
    readonly input: Record<string, unknown>;
  };
  readonly valid: boolean;
  readonly metadata: Record<string, unknown>;
}

export interface ActivepiecesFlowProjection {
  readonly schemaVersion: '20';
  readonly displayName: string;
  readonly trigger: ActivepiecesStepProjection | null;
  readonly actions: readonly ActivepiecesStepProjection[];
  readonly branches: readonly unknown[];
  readonly notes: readonly unknown[];
  readonly metadata: Record<string, unknown>;
}

export interface ActivepiecesOperation {
  readonly type: string;
  readonly request: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface RuntimeStepMappingDraft {
  readonly source_node_id: string;
  readonly source_node_hash: string;
  readonly ir_step_id: string;
  readonly activepieces_step_name: string;
  readonly activepieces_step_display_name: string;
  readonly piece_name: string | null;
  readonly piece_version: string | null;
  readonly action_name: string | null;
}

export interface RuntimeBindingRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly installed_automation_id: string;
  readonly automation_version_id: string | null;
  readonly runtime_projection_id: string | null;
  readonly runtime: CompilerTargetRuntime;
  readonly external_project_id: string | null;
  readonly external_flow_id: string | null;
  readonly activepieces_flow_version_id: string | null;
  readonly status: string;
  readonly source_workflow_hash: string | null;
  readonly runtime_hash: string | null;
  readonly last_synced_hash: string | null;
  readonly last_compile_report_id: string | null;
  readonly last_synced_at: string | null;
  readonly last_checked_at: string | null;
  readonly projection: unknown;
  readonly active?: boolean;
}

export interface CompileArtifact {
  readonly report: CompileReport;
  readonly status: CompileStatus;
  readonly runtimeIr: RuntimeIR;
  readonly projection: ActivepiecesFlowProjection;
  readonly operations: readonly ActivepiecesOperation[];
  readonly projectionSummary: ActivepiecesProjectionSummary;
  readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
  readonly requiredConnections: readonly RuntimeConnectionRequirement[];
  readonly warnings: CompileReport['warnings'];
  readonly blockingIssues: readonly CompileIssue[];
  readonly sourceWorkflowHash: string;
  readonly projectionHash: string;
  readonly stepMappings: readonly RuntimeStepMappingDraft[];
}

export interface RuntimeSyncResult {
  readonly status: CompileStatus;
  readonly reportId: string;
  readonly sourceWorkflowHash: string;
  readonly runtimeHash: string | null;
  readonly projectId: string | null;
  readonly flowId: string | null;
  readonly flowVersionId: string | null;
  readonly requiredPieces: readonly RuntimePieceVersionRequirement[];
  readonly requiredConnections: readonly RuntimeConnectionRequirement[];
  readonly warnings: CompileReport['warnings'];
  readonly blockingIssues: readonly CompileIssue[];
}

export function activepiecesStepName(step: RuntimeIRStep): string {
  return step.ir_step_id;
}
