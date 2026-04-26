import type {
  CanvasOperation,
  CanvasOperationResponse,
  CanvasValidationResult,
  CanvasValidationSummary,
  LexFrameWorkflowV2,
  ValidationIssue,
  WorkflowEdge,
  WorkflowNode,
} from './canvas';

export const canvasAiModes = [
  'explain',
  'edit',
  'fix_validation',
  'configure_step',
  'test_plan',
  'debug_test',
] as const;

export type CanvasAiMode = (typeof canvasAiModes)[number];

export type CanvasAiPatchStatus =
  | 'needs_clarification'
  | 'validation_failed'
  | 'policy_blocked'
  | 'ready_for_review'
  | 'applied'
  | 'rejected'
  | 'expired';

export interface CanvasAiClientContext {
  readonly selected_node_id?: string | null;
  readonly selected_edge_id?: string | null;
  readonly selected_validation_issue_id?: string | null;
  readonly inspector_tab?: string | null;
  readonly canvas_viewport?: {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  } | null;
}

export interface CanvasAiMessageRequest {
  readonly session_id?: string | null;
  readonly mode: CanvasAiMode;
  readonly message: string;
  readonly draft_version_id?: string | null;
  readonly base_workflow_hash?: string | null;
  readonly selected_node_id?: string | null;
  readonly selected_edge_id?: string | null;
  readonly selected_validation_issue_id?: string | null;
  readonly client_context?: CanvasAiClientContext | null;
  readonly include_sensitive_context?: boolean;
  readonly idempotency_key?: string | null;
}

export interface CanvasAiExplanationResponse {
  readonly status: 'explanation';
  readonly session_id: string;
  readonly message_id: string;
  readonly summary: string;
  readonly node_references: readonly {
    readonly node_id: string;
    readonly label: string;
    readonly reason: string;
  }[];
  readonly validation_summary: CanvasValidationSummary;
  readonly risks: readonly string[];
  readonly redactions: readonly string[];
}

export interface CanvasAiDiffNodeSummary {
  readonly node_id?: string | null;
  readonly module_code?: string | null;
  readonly display_name?: string | null;
  readonly operation_type: CanvasOperation['operation_type'];
}

export interface CanvasAiDiffEdgeSummary {
  readonly edge_id?: string | null;
  readonly source_node_id?: string | null;
  readonly target_node_id?: string | null;
  readonly operation_type: CanvasOperation['operation_type'];
}

export interface CanvasAiDiffSummary {
  readonly added_nodes: readonly CanvasAiDiffNodeSummary[];
  readonly removed_nodes: readonly CanvasAiDiffNodeSummary[];
  readonly changed_nodes: readonly CanvasAiDiffNodeSummary[];
  readonly added_edges: readonly CanvasAiDiffEdgeSummary[];
  readonly removed_edges: readonly CanvasAiDiffEdgeSummary[];
  readonly changed_edges: readonly CanvasAiDiffEdgeSummary[];
  readonly binding_changes: readonly {
    readonly node_id?: string | null;
    readonly input_key?: string | null;
    readonly operation_type: CanvasOperation['operation_type'];
  }[];
  readonly approval_gates: readonly string[];
  readonly policy_blocks: readonly string[];
}

export interface CanvasAiPolicyResult {
  readonly allowed: boolean;
  readonly codes: readonly string[];
  readonly messages: readonly string[];
  readonly requires_human_confirmation: boolean;
  readonly sensitive_context_used: boolean;
}

export interface CanvasAiPatchProposal {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id: string;
  readonly session_id: string;
  readonly title: string;
  readonly user_request: string;
  readonly assistant_summary: string;
  readonly operations: readonly CanvasOperation[];
  readonly base_workflow_hash: string;
  readonly proposed_workflow_hash: string | null;
  readonly status: CanvasAiPatchStatus;
  readonly validation: CanvasValidationResult | CanvasValidationSummary;
  readonly policy: CanvasAiPolicyResult;
  readonly diff: CanvasAiDiffSummary;
  readonly can_apply: boolean;
  readonly expires_at: string;
  readonly created_at: string;
  readonly applied_at?: string | null;
  readonly rejected_at?: string | null;
}

export interface CanvasAiPatchProposalResponse {
  readonly status: 'patch_proposal';
  readonly session_id: string;
  readonly message_id: string;
  readonly proposal: CanvasAiPatchProposal;
}

export interface CanvasAiClarificationResponse {
  readonly status: 'needs_clarification';
  readonly session_id: string;
  readonly message_id: string;
  readonly questions: readonly {
    readonly id: string;
    readonly label: string;
    readonly help_text?: string | null;
    readonly required: boolean;
    readonly kind: 'text' | 'node' | 'module' | 'document' | 'approval_route';
  }[];
}

export interface CanvasAiPolicyBlockedResponse {
  readonly status: 'policy_blocked';
  readonly session_id: string;
  readonly message_id: string;
  readonly codes: readonly string[];
  readonly message: string;
  readonly redactions: readonly string[];
  readonly proposal?: CanvasAiPatchProposal | null;
}

export interface CanvasAiTestPlanResponse {
  readonly status: 'test_plan';
  readonly session_id: string;
  readonly message_id: string;
  readonly plan: {
    readonly sample_inputs: readonly {
      readonly key: string;
      readonly description: string;
      readonly classification: string;
    }[];
    readonly pinned_data: readonly {
      readonly node_id: string;
      readonly output_key?: string | null;
      readonly reason: string;
    }[];
    readonly dry_run_order: readonly string[];
    readonly first_step_recommendation?: string | null;
    readonly production_safe: boolean;
  };
  readonly redactions: readonly string[];
}

export interface CanvasAiDebugResponse {
  readonly status: 'debug_explanation';
  readonly session_id: string;
  readonly message_id: string;
  readonly summary: string;
  readonly suspected_causes: readonly string[];
  readonly next_actions: readonly string[];
  readonly redacted: boolean;
}

export interface CanvasAiErrorResponse {
  readonly status: 'error';
  readonly session_id?: string | null;
  readonly message_id?: string | null;
  readonly error_code: string;
  readonly message: string;
}

export type CanvasAiMessageResponse =
  | CanvasAiExplanationResponse
  | CanvasAiPatchProposalResponse
  | CanvasAiClarificationResponse
  | CanvasAiPolicyBlockedResponse
  | CanvasAiTestPlanResponse
  | CanvasAiDebugResponse
  | CanvasAiErrorResponse;

export interface CanvasAiStructuredOutput {
  readonly response_type:
    | 'explanation'
    | 'patch_proposal'
    | 'needs_clarification'
    | 'policy_blocked'
    | 'test_plan'
    | 'debug_explanation';
  readonly title?: string | null;
  readonly assistant_summary: string;
  readonly operations?: readonly CanvasOperation[];
  readonly clarification_questions?: CanvasAiClarificationResponse['questions'];
  readonly policy_codes?: readonly string[];
  readonly policy_messages?: readonly string[];
  readonly test_plan?: CanvasAiTestPlanResponse['plan'];
  readonly debug_summary?: string | null;
  readonly suspected_causes?: readonly string[];
  readonly next_actions?: readonly string[];
}

export interface CanvasAiPatchApplyRequest {
  readonly patch_id: string;
  readonly base_workflow_hash: string;
  readonly user_confirmation: boolean;
  readonly idempotency_key?: string | null;
}

export interface CanvasAiPatchApplyResponse {
  readonly status: 'applied';
  readonly patch_id: string;
  readonly session_id: string;
  readonly draft_version_id: string;
  readonly workflow_hash: string;
  readonly revision_counter: number;
  readonly operation_response: CanvasOperationResponse;
}

export interface CanvasAiPatchRejectRequest {
  readonly reason?: string | null;
}

export interface CanvasAiPatchRejectResponse {
  readonly status: 'rejected';
  readonly patch_id: string;
  readonly session_id: string;
  readonly rejected_at: string;
}

export interface CanvasAiSessionSummary {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id: string | null;
  readonly mode: CanvasAiMode;
  readonly status: 'active' | 'closed';
  readonly title: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CanvasAiContextSummary {
  readonly workflow: Pick<
    LexFrameWorkflowV2,
    'id' | 'schema_version' | 'metadata' | 'runtime_projection'
  >;
  readonly nodes: readonly Pick<
    WorkflowNode,
    'id' | 'type' | 'display_name' | 'module_code' | 'policy'
  >[];
  readonly edges: readonly Pick<
    WorkflowEdge,
    'id' | 'source_node_id' | 'target_node_id' | 'type'
  >[];
  readonly validation_issues: readonly Pick<
    ValidationIssue,
    'id' | 'severity' | 'code' | 'title' | 'affected_node_id'
  >[];
  readonly redactions: readonly string[];
}
