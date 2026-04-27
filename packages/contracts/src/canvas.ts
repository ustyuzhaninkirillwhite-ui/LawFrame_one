import type { PermissionCode, RoleCode } from "./permissions/permission-codes";

export const canvasNodeTypes = [
  "trigger",
  "legalAction",
  "aiAction",
  "documentInput",
  "condition",
  "loop",
  "merge",
  "approval",
  "wait",
  "delivery",
  "storage",
  "subworkflow",
  "errorHandler",
  "end",
  "note",
  "group",
] as const;

export type CanvasNodeType = (typeof canvasNodeTypes)[number];

export const canvasEdgeTypes = [
  "control",
  "data",
  "invalid",
  "error",
  "approval",
  "loop",
  "annotation",
  "control_flow",
  "data_flow",
  "approval_flow",
  "error_flow",
  "loop_flow",
  "annotation_link",
] as const;

export type CanvasEdgeType = (typeof canvasEdgeTypes)[number];

export const legacyCanvasHandleCodes = [
  "main_input",
  "main_output",
  "error_input",
  "error_output",
  "true_branch",
  "false_branch",
  "otherwise",
  "branch_1",
  "branch_2",
  "branch_3",
  "loop_items",
  "loop_item",
  "after_loop",
  "merge_a",
  "merge_b",
  "merge_c",
  "approved",
  "rejected",
  "changes_requested",
  "expired",
  "resumed",
  "cancelled",
  "sent",
  "saved",
  "retry",
  "fallback",
  "stop",
  "notify",
] as const;

export const canonicalCanvasHandleCodes = [
  "in:control",
  "out:success",
  "out:error",
  "out:true",
  "out:false",
  "out:approved",
  "out:rejected",
  "out:item",
  "out:done",
] as const;

export const canvasHandleCodes = [
  ...legacyCanvasHandleCodes,
  ...canonicalCanvasHandleCodes,
] as const;

export type LegacyCanvasHandleCode = (typeof legacyCanvasHandleCodes)[number];
export type CanonicalCanvasHandleCode =
  (typeof canonicalCanvasHandleCodes)[number];
export type CanvasDataHandleCode =
  | `data:input:${string}`
  | `data:output:${string}`;
export type CanvasHandleCode =
  | LegacyCanvasHandleCode
  | CanonicalCanvasHandleCode
  | CanvasDataHandleCode;

export type CanvasHandleKind =
  | "control_in"
  | "control_out"
  | "data_in"
  | "data_out"
  | "error_in"
  | "error_out"
  | "approval_approved_out"
  | "approval_rejected_out"
  | "condition_true_out"
  | "condition_false_out"
  | "loop_item_out"
  | "loop_done_out"
  | "merge_in"
  | "subworkflow_out";

export type CanvasDataClassification =
  | "public"
  | "workspace_internal"
  | "confidential"
  | "personal_data"
  | "legal_secret"
  | "client_material"
  | "secret"
  | "runtime_only"
  | "internal";

export type OutputPreviewPolicy =
  | "full"
  | "summary"
  | "metadata_only"
  | "redacted"
  | "hidden";

export type BindingValidationState =
  | "valid"
  | "warning"
  | "invalid"
  | "stale"
  | "policy_blocked";

export type LexFrameDataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "money"
  | "enum"
  | "object"
  | "array"
  | "json"
  | "document_ref"
  | "document_ref[]"
  | "document_version_ref"
  | "legal_source_ref"
  | "legal_source_ref[]"
  | "case_fact_set"
  | "fact_set"
  | "legal_issue_set"
  | "risk_report"
  | "validation_report"
  | "draft_document"
  | "generated_document"
  | "approval_decision"
  | "delivery_request"
  | "profile_ref"
  | "profile_snapshot"
  | "template_ref"
  | "party_ref"
  | "counterparty_ref"
  | "claim_amount"
  | "citation_set"
  | "email_attachment[]"
  | "workspace_ref"
  | "user_ref"
  | "connection_ref"
  | "secret_ref"
  | "runtime_context"
  | "run_ref"
  | "step_ref"
  | "artifact_ref"
  | (string & {});

export type DataSourceKind =
  | "workflow_input"
  | "step_output"
  | "document"
  | "profile"
  | "profile_snapshot"
  | "template"
  | "manual_value"
  | "literal"
  | "system_value"
  | "connection"
  | "secret_ref"
  | "expression"
  | "transform";

export type WorkflowCanonicalEdgeType =
  | "control_flow"
  | "data_flow"
  | "error_flow"
  | "approval_flow"
  | "loop_flow"
  | "annotation_link";

export type WorkflowPortKind =
  | "control"
  | "data"
  | "error"
  | "approval"
  | "loop";

export interface WorkflowInputPort {
  readonly id: string;
  readonly label: string;
  readonly port_kind: WorkflowPortKind;
  readonly accepted_edge_types: readonly WorkflowCanonicalEdgeType[];
  readonly accepted_data_types?: readonly LexFrameDataType[];
  readonly required?: boolean;
  readonly max_connections?: number;
}

export interface WorkflowOutputPort {
  readonly id: string;
  readonly label: string;
  readonly port_kind: WorkflowPortKind;
  readonly emitted_edge_types: readonly WorkflowCanonicalEdgeType[];
  readonly emitted_data_types?: readonly LexFrameDataType[];
  readonly max_connections?: number;
}

export interface WorkflowHandle {
  readonly code: CanvasHandleCode;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly kind?: CanvasHandleKind;
  readonly edge_types?: readonly CanvasEdgeType[];
  readonly data_type?: LexFrameDataType | null;
  readonly data_field_key?: string | null;
}

export interface InputUiSchema {
  readonly control:
    | "text"
    | "textarea"
    | "select"
    | "multi_select"
    | "document_picker"
    | "profile_picker"
    | "template_picker"
    | "data_picker"
    | "condition_builder"
    | "connection_picker"
    | "approval_route_picker";
  readonly group?: string;
  readonly order?: number;
  readonly placeholder?: string;
  readonly help_text?: string;
}

export interface InputValidationRules {
  readonly min_length?: number;
  readonly max_length?: number;
  readonly pattern?: string;
  readonly min_items?: number;
  readonly max_items?: number;
  readonly custom_validator?: string;
}

export interface InputDefaultSource {
  readonly type: DataSourceKind;
  readonly value?: unknown;
  readonly key?: string;
}

export interface WorkflowDataField {
  readonly key: string;
  readonly label: string;
  readonly description?: string | null;
  readonly data_type?: LexFrameDataType;
  readonly type?: LexFrameDataType;
  readonly item_schema?: Record<string, unknown>;
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly cardinality?: "one" | "many" | "zero_or_one";
  readonly classification?: CanvasDataClassification | string | null;
  readonly source?: WorkflowOutputSource | string | null;
  readonly options?: readonly string[];
  readonly allowed_sources?: readonly DataSourceKind[];
  readonly allowedSources?: readonly string[];
  readonly allowed_classifications?: readonly CanvasDataClassification[];
  readonly default_value?: unknown;
  readonly default_source?: InputDefaultSource;
  readonly ui?: InputUiSchema;
  readonly validation?: InputValidationRules;
  readonly visibility?: "basic" | "advanced" | "admin";
  readonly is_template_parameter?: boolean;
  readonly is_runtime_parameter?: boolean;
  readonly preview_policy?: OutputPreviewPolicy;
  readonly delivery_allowed?: boolean;
  readonly requires_approval_before_delivery?: boolean;
  readonly advanced?: boolean;
}

export type WorkflowInputDefinition = WorkflowDataField;
export type WorkflowOutputDefinition = WorkflowDataField;
export type StepInputDefinition = WorkflowDataField;
export type StepOutputDefinition = WorkflowDataField;

export interface WorkflowInputSource {
  readonly type: "workflow_input";
  readonly input_key: string;
  readonly inputKey?: string;
}

export interface StepOutputSource {
  readonly type: "step_output";
  readonly node_id: string;
  readonly output_key: string;
  readonly path?: string;
  readonly sourceNodeId?: string;
  readonly outputKey?: string;
}

export interface CanvasDocumentSource {
  readonly type: "document";
  readonly document_id: string;
  readonly document_version_id?: string;
  readonly access_mode?: "reference_only" | "runtime_scoped_token";
  readonly documentId?: string;
  readonly documentVersionId?: string;
}

export interface ProfileSource {
  readonly type: "profile" | "profile_snapshot";
  readonly profile_id?: string;
  readonly profile_snapshot_id?: string;
  readonly profileSnapshotId?: string;
}

export interface TemplateSource {
  readonly type: "template";
  readonly template_id: string;
}

export interface ManualValueSource {
  readonly type: "manual_value" | "literal";
  readonly value: unknown;
}

export interface SystemValueSource {
  readonly type: "system_value";
  readonly key: string;
}

export interface ConnectionSource {
  readonly type: "connection";
  readonly connection_id: string;
  readonly display_name?: string;
}

export interface SecretRefSource {
  readonly type: "secret_ref";
  readonly secret_ref: string;
  readonly display_name?: string;
}

export interface ExpressionSource {
  readonly type: "expression";
  readonly expression_language: "lexframe_expression_v1";
  readonly expression: string;
}

export interface TransformSource {
  readonly type: "transform";
  readonly transform_type: string;
  readonly source: DataSource;
  readonly config?: Record<string, unknown>;
}

export type DataSource =
  | WorkflowInputSource
  | StepOutputSource
  | CanvasDocumentSource
  | ProfileSource
  | TemplateSource
  | ManualValueSource
  | SystemValueSource
  | ConnectionSource
  | SecretRefSource
  | ExpressionSource
  | TransformSource;

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "exists"
  | "is_empty";

export type ConditionLiteral = {
  readonly type: "literal";
  readonly value: unknown;
};

export type ConditionValue = DataSource | ConditionLiteral;

export type ConditionExpression =
  | {
      readonly type: "comparison";
      readonly left: ConditionValue;
      readonly operator: ConditionOperator;
      readonly right?: ConditionValue;
    }
  | {
      readonly type: "and" | "or";
      readonly conditions: readonly ConditionExpression[];
    }
  | {
      readonly type: "not";
      readonly condition: ConditionExpression;
    };

export type StepInputBindingSource = DataSource;

export type SelectionStrategy =
  | { readonly mode: "single" }
  | { readonly mode: "all" }
  | { readonly mode: "first" }
  | { readonly mode: "last" }
  | { readonly mode: "by_index"; readonly index: number }
  | { readonly mode: "current_loop_item"; readonly loop_node_id: string }
  | { readonly mode: "filter"; readonly condition: Record<string, unknown> }
  | {
      readonly mode: "aggregate";
      readonly aggregate_type:
        | "join"
        | "summarize"
        | "count"
        | "merge_reports";
    };

export interface TransformDefinition {
  readonly type:
    | "none"
    | "extract_field"
    | "map_array"
    | "join_text"
    | "format_money"
    | "format_date"
    | "wrap_array"
    | "pick_one"
    | "approval_to_boolean"
    | "legal_sources_to_citation_summary"
    | "custom_transform"
    | "map"
    | "filter"
    | "format"
    | "join"
    | "pick_fields"
    | "rename_fields"
    | "filter_items"
    | "format_template"
    | "safe_expression";
  readonly config?: Record<string, unknown>;
}

export interface StepInputBinding {
  readonly id?: string;
  readonly target?: {
    readonly node_id: string;
    readonly input_key: string;
  };
  readonly targetNodeId?: string;
  readonly targetInputKey?: string;
  readonly source: StepInputBindingSource;
  readonly selection?: SelectionStrategy;
  readonly transform?: TransformDefinition;
  readonly fallback?: DataSource;
  readonly validation_state?: BindingValidationState;
  readonly created_by?: "user" | "ai_assistant" | "template" | "system";
  readonly created_at?: string;
}

export type WorkflowOutputSource = WorkflowInputSource | StepOutputSource;

export interface DataMappingRule {
  readonly id?: string;
  readonly target_input_key: string;
  readonly source: DataSource;
  readonly selection?: SelectionStrategy;
  readonly transform?: TransformDefinition;
  readonly validation_state?: BindingValidationState;
}

export interface WorkflowNodePolicy {
  readonly approval_required?: boolean;
  readonly external_action?: boolean;
  readonly ai_action?: boolean;
  readonly data_classification?: string | null;
  readonly risk_level?: "low" | "medium" | "high" | "critical";
  readonly can_use_documents?: boolean;
  readonly can_run_in_dry_run?: boolean;
  readonly can_be_published_as_template?: boolean;
  readonly required_permissions?: readonly string[];
  readonly ai_policy?: {
    readonly uses_ai: boolean;
    readonly allowed_routes?: readonly string[];
    readonly forbidden_routes?: readonly string[];
    readonly require_redaction?: boolean;
    readonly structured_output_required?: boolean;
  };
  readonly raw_output_visibility?: OutputPreviewPolicy;
}

export interface WorkflowPolicyBlock {
  readonly external_delivery_requires_approval: boolean;
  readonly ai_sensitive_data_policy:
    | "secure_route_or_block"
    | "redact_or_secure_route"
    | "allow_configured_routes";
  readonly raw_execution_data_policy:
    | "redact_by_default"
    | "metadata_only"
    | "debug_permission_required";
  readonly pinned_data_policy: "draft_test_only";
  readonly secret_frontend_exposure: "forbidden";
  readonly custom_expression_policy:
    | "debug_permission_required"
    | "admin_permission_required"
    | "forbidden";
}

export interface WorkflowSecretsPolicy {
  readonly frontend_exposure: "forbidden";
  readonly secret_sources: readonly ("connection_ref_only" | "secret_ref_only")[];
}

export interface WorkflowDataContract {
  readonly key: string;
  readonly data_type: LexFrameDataType;
  readonly classification: CanvasDataClassification | string;
  readonly schema?: Record<string, unknown>;
}

export type WorkflowDataContracts = Record<string, WorkflowDataContract>;

export interface WorkflowNodeLayout {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly group_id?: string;
  readonly collapsed?: boolean;
}

export interface WorkflowNodeRuntimeMapping {
  readonly module_code?: string | null;
  readonly provider?: "activepieces" | "internal_worker" | "ai_gateway" | "manual" | "none";
  readonly activepieces_piece?: string | null;
  readonly activepieces_action?: string | null;
  readonly internal_route?: string | null;
  readonly can_compile?: boolean;
  readonly supports_step_test?: boolean;
  readonly supports_partial_execution?: boolean;
  readonly supports_pinned_data?: boolean;
  readonly warnings?: readonly string[];
}

export interface WorkflowNodeTestState {
  readonly last_tested_at?: string | null;
  readonly sample_data_status: "missing" | "available" | "stale" | "pinned";
  readonly pinned_output_id?: string | null;
}

export interface WorkflowNode {
  readonly id: string;
  readonly type: CanvasNodeType;
  readonly node_type?: CanvasNodeType;
  readonly block_code: string;
  readonly display_name: string;
  readonly description?: string | null;
  readonly module_ref?: {
    readonly module_code: string;
    readonly module_version: string | null;
    readonly module_schema_hash?: string | null;
    readonly status?: "draft" | "published" | "deprecated" | "retired";
  } | null;
  readonly module_code?: string | null;
  readonly module_version?: string | null;
  readonly module_status?: "draft" | "published" | "deprecated" | "retired" | null;
  readonly module_schema_hash?: string | null;
  readonly dynamic_outputs_status?: "static" | "resolved" | "stale" | "unresolved";
  readonly trigger_kind?: string | null;
  readonly handles: readonly WorkflowHandle[];
  readonly input_ports?: readonly WorkflowInputPort[];
  readonly output_ports?: readonly WorkflowOutputPort[];
  readonly inputs: readonly StepInputDefinition[];
  readonly outputs: readonly StepOutputDefinition[];
  readonly bindings: Record<string, unknown>;
  readonly input_bindings?: readonly StepInputBinding[];
  readonly config: Record<string, unknown>;
  readonly policy: WorkflowNodePolicy;
  readonly policies?: WorkflowNodePolicy;
  readonly runtime_mapping: WorkflowNodeRuntimeMapping;
  readonly test_state?: WorkflowNodeTestState;
  readonly layout: WorkflowNodeLayout;
  readonly canvas?: WorkflowNodeLayout;
  readonly lifecycle?: {
    readonly status:
      | "draft"
      | "configured"
      | "needs_input"
      | "invalid"
      | "disabled";
  };
  readonly disabled?: boolean;
}

export interface WorkflowEdge {
  readonly id: string;
  readonly type: CanvasEdgeType;
  readonly edge_type?: CanvasEdgeType;
  readonly source_node_id: string;
  readonly source_handle: CanvasHandleCode;
  readonly source_port_id?: CanvasHandleCode;
  readonly target_node_id: string;
  readonly target_handle: CanvasHandleCode;
  readonly target_port_id?: CanvasHandleCode;
  readonly label?: string | null;
  readonly condition?: string | ConditionExpression | null;
  readonly invalid_reason?: string | null;
  readonly data_mapping?: readonly Record<string, unknown>[];
  readonly data_mappings?: readonly DataMappingRule[];
  readonly validation_state?: "valid" | "warning" | "invalid";
}

export interface WorkflowMetadata {
  readonly title: string;
  readonly description?: string | null;
  readonly status: "draft" | "published" | "archived";
  readonly canvas_mode: "guided_vertical" | "guided_branching" | "advanced_free_graph";
}

export interface WorkflowVariable {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly value?: unknown;
}

export type CanvasValidationIssueSeverity =
  | "info"
  | "warning"
  | "error"
  | "policy_block";

export type CanvasValidationIssueCategory =
  | "structure"
  | "schema"
  | "type_compatibility"
  | "semantic"
  | "security"
  | "policy"
  | "runtime"
  | "ux"
  | "performance";

export type CanvasValidationBlockTarget =
  | "save"
  | "test_step"
  | "test_flow"
  | "compile"
  | "publish"
  | "run"
  | "sync";

export type CanvasValidationMode =
  | "fast"
  | "full"
  | "publish_gate"
  | "runtime_gate"
  | "operation_preview"
  | "field_level";

export interface CanvasValidationEvidence {
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly source_node_id?: string | null;
  readonly target_node_id?: string | null;
  readonly module_code?: string | null;
  readonly policy_code?: string | null;
  readonly field_path?: string | null;
}

export interface SuggestedFix {
  readonly id: string;
  readonly type:
    | "insert_node_before"
    | "bind_input"
    | "select_template"
    | "configure_connection"
    | "remove_secret"
    | "add_fallback_branch"
    | "repair_edge"
    | "set_field";
  readonly label: string;
  readonly description?: string | null;
  readonly operation_type?: CanvasOperationType | null;
  readonly operation_payload?: Record<string, unknown> | null;
  readonly sensitive?: boolean;
  readonly destructive?: boolean;
  readonly requires_confirmation?: boolean;
}

export interface ValidationIssue {
  readonly id: string;
  readonly validation_run_id?: string | null;
  readonly severity: CanvasValidationIssueSeverity;
  readonly category?: CanvasValidationIssueCategory;
  readonly scope: "workflow" | "node" | "edge" | "binding" | "runtime";
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly developer_message?: string | null;
  readonly affected_node_id?: string | null;
  readonly affected_edge_id?: string | null;
  readonly affected_binding_id?: string | null;
  readonly affected_input_key?: string | null;
  readonly field_path?: string | null;
  readonly blocks?: readonly CanvasValidationBlockTarget[];
  readonly suggested_fix?: string | null;
  readonly suggested_transform?: string | null;
  readonly suggested_fixes?: readonly SuggestedFix[];
  readonly suggested_action?: {
    readonly label: string;
    readonly operation_type: CanvasOperationType;
    readonly operation_payload: Record<string, unknown>;
  } | null;
  readonly evidence?: CanvasValidationEvidence | null;
  readonly created_at?: string;
}

export interface CanvasValidationSummary {
  readonly status: "valid" | "valid_with_warnings" | "invalid";
  readonly errors_count: number;
  readonly warnings_count: number;
  readonly policy_blocks_count: number;
  readonly issues: readonly ValidationIssue[];
  readonly summary?: {
    readonly errors: number;
    readonly warnings: number;
    readonly policy_blocks: number;
    readonly suggestions: number;
  };
  readonly capabilities?: {
    readonly can_save: boolean;
    readonly can_test: boolean;
    readonly can_compile: boolean;
    readonly can_publish: boolean;
    readonly can_run: boolean;
    readonly can_sync: boolean;
  };
  readonly can_save: boolean;
  readonly can_test: boolean;
  readonly can_publish: boolean;
  readonly can_compile: boolean;
  readonly can_run: boolean;
  readonly can_sync: boolean;
}

export interface CanvasValidationResult extends CanvasValidationSummary {
  readonly validation_run_id: string;
  readonly workflow_hash: string;
  readonly mode: CanvasValidationMode;
  readonly reason?: string | null;
  readonly scope?: "draft" | "operation" | "node" | "publish" | "runtime";
  readonly created_at: string;
  readonly cache_hit?: boolean;
}

export interface CanvasValidateRequest {
  readonly draft_id?: string | null;
  readonly draft_version_id?: string | null;
  readonly validation_level?: CanvasValidationMode;
  readonly mode?: CanvasValidationMode;
  readonly scope?: "draft" | "operation" | "node" | "publish" | "runtime";
  readonly reason?: string | null;
  readonly include_runtime_checks?: boolean;
}

export interface CanvasOperationPreviewRequest extends CanvasOperationRequest {
  readonly mode?: "operation_preview";
}

export interface CanvasOperationPreviewResponse {
  readonly draft_id?: string | null;
  readonly revision_counter?: number;
  readonly would_succeed: boolean;
  readonly validation: CanvasValidationResult;
  readonly validation_delta: {
    readonly resolved_issues: readonly ValidationIssue[];
    readonly new_issues: readonly ValidationIssue[];
  };
  readonly preview_workflow_hash: string;
}

export interface CanvasStepConfigValidationRequest {
  readonly config?: Record<string, unknown>;
  readonly input_bindings?: readonly StepInputBinding[];
  readonly mode?: "field_level";
}

export interface CanvasStepConfigValidationResponse {
  readonly node_id: string;
  readonly valid: boolean;
  readonly field_errors: readonly {
    readonly field_path: string;
    readonly code: string;
    readonly message: string;
  }[];
  readonly affected_outputs: readonly string[];
  readonly validation: CanvasValidationResult;
}

export type CanvasPresentationMode = "basic" | "advanced" | "developer";

export interface CanvasGlossaryEntry {
  readonly technical_term: string;
  readonly user_term: string;
  readonly description?: string | null;
}

export interface CanvasGlossary {
  readonly locale: string;
  readonly terms: readonly CanvasGlossaryEntry[];
  readonly forbidden_basic_terms: readonly string[];
}

export interface RiskPresentation {
  readonly level: "low" | "medium" | "high" | "critical";
  readonly label: string;
  readonly reason: string;
  readonly requires_attention: boolean;
}

export interface NoCodeDataSourcePresentation {
  readonly id: string;
  readonly type: DataSourceKind;
  readonly label: string;
  readonly type_label: string;
  readonly classification: CanvasDataClassification | string;
  readonly compatibility: "valid" | "warning" | "invalid";
  readonly reason?: string | null;
  readonly preview_summary?: string | null;
  readonly redacted: boolean;
  readonly advanced?: {
    readonly source: DataSource;
  } | null;
}

export interface NoCodeInputPresentation {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
  readonly type_label: string;
  readonly state: StepInputState | "not_configured";
  readonly current_source?: NoCodeDataSourcePresentation | null;
  readonly missing_reason?: string | null;
  readonly suggested_sources: readonly NoCodeDataSourcePresentation[];
  readonly allowed_source_types: readonly string[];
}

export interface NoCodeOutputPresentation {
  readonly key: string;
  readonly label: string;
  readonly description?: string | null;
  readonly type_label: string;
  readonly classification: CanvasDataClassification | string;
  readonly result_summary?: string | null;
}

export interface NoCodeNodeAction {
  readonly type:
    | "open_inspector"
    | "choose_data"
    | "test_step"
    | "add_approval"
    | "configure_connection"
    | "show_advanced";
  readonly label: string;
  readonly disabled: boolean;
  readonly reason?: string | null;
}

export interface NoCodeNodePresentation {
  readonly node_id: string;
  readonly title: string;
  readonly description: string;
  readonly plain_language_type: string;
  readonly category: string;
  readonly icon: string;
  readonly status:
    | "not_configured"
    | "configured"
    | "warning"
    | "invalid"
    | "tested"
    | "published";
  readonly risk: RiskPresentation;
  readonly inputs: readonly NoCodeInputPresentation[];
  readonly outputs: readonly NoCodeOutputPresentation[];
  readonly badges: readonly string[];
  readonly actions: readonly NoCodeNodeAction[];
  readonly approval_required: boolean;
  readonly external_action: boolean;
  readonly ai_used: boolean;
  readonly data_sensitivity: CanvasDataClassification | string;
  readonly last_test_status?: "not_tested" | "success" | "failed";
  readonly aria_label: string;
  readonly advanced?: {
    readonly module_code: string | null;
    readonly module_version: string | null;
    readonly runtime_provider: WorkflowNodeRuntimeMapping["provider"] | null;
    readonly runtime_action?: string | null;
    readonly step_id: string;
  } | null;
}

export interface NoCodeEdgePresentation {
  readonly edge_id: string;
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly label: string;
  readonly plain_language_type: string;
  readonly validation_state: "valid" | "warning" | "invalid";
  readonly advanced?: {
    readonly source_handle?: string | null;
    readonly target_handle?: string | null;
    readonly edge_type: WorkflowEdge["type"];
  } | null;
}

export interface NoCodeValidationMessage {
  readonly id: string;
  readonly severity: CanvasValidationIssueSeverity;
  readonly title: string;
  readonly plain_language_message: string;
  readonly why_it_matters: string;
  readonly how_to_fix: readonly string[];
  readonly what_happens_if_ignored?: string | null;
  readonly affected_node_id?: string | null;
  readonly affected_edge_id?: string | null;
  readonly affected_input_key?: string | null;
  readonly can_auto_fix: boolean;
  readonly auto_fix_operation?: CanvasOperation | null;
  readonly suggested_fixes: readonly SuggestedFix[];
  readonly advanced?: {
    readonly code: string;
    readonly category?: CanvasValidationIssueCategory;
    readonly developer_message?: string | null;
    readonly field_path?: string | null;
  } | null;
}

export interface NoCodeSuggestion {
  readonly id: string;
  readonly type:
    | "add_next_step"
    | "connect_data"
    | "add_approval"
    | "fix_missing_input"
    | "test_step"
    | "replace_deprecated_module";
  readonly title: string;
  readonly reason: string;
  readonly operation_preview: string;
  readonly proposed_operation?: CanvasOperation | null;
  readonly requires_confirmation: boolean;
  readonly validation_issue_id?: string | null;
}

export interface CanvasPresentationPermissions {
  readonly can_view: boolean;
  readonly can_edit: boolean;
  readonly can_publish: boolean;
  readonly can_test: boolean;
  readonly can_use_advanced: boolean;
  readonly can_use_developer: boolean;
  readonly can_view_raw_data: boolean;
}

export interface CanvasPresentationModel {
  readonly workflow_id: string;
  readonly automation_id: string;
  readonly draft_id: string;
  readonly mode: CanvasPresentationMode;
  readonly locale: string;
  readonly nodes: readonly NoCodeNodePresentation[];
  readonly edges: readonly NoCodeEdgePresentation[];
  readonly validation: readonly NoCodeValidationMessage[];
  readonly recommendations: readonly NoCodeSuggestion[];
  readonly glossary: CanvasGlossary;
  readonly permissions: CanvasPresentationPermissions;
  readonly profile_defaults?: {
    readonly profile_label?: string | null;
    readonly template_label?: string | null;
    readonly approval_route_label?: string | null;
    readonly style_label?: string | null;
  } | null;
  readonly generated_at: string;
}

export interface CanvasValidationIssueExplanation {
  readonly issue_id: string;
  readonly plain_explanation: string;
  readonly suggested_actions: readonly SuggestedFix[];
  readonly no_code?: NoCodeValidationMessage | null;
}

export interface CanvasApplySuggestedFixRequest {
  readonly suggested_fix_id: string;
  readonly confirmed_by_user?: boolean;
}

export interface CanvasApplySuggestedFixResponse extends CanvasOperationResponse {
  readonly no_code?: NoCodeValidationMessage | null;
}

export interface CanvasSuggestionApplyResponse extends CanvasOperationResponse {
  readonly suggestion: NoCodeSuggestion;
}

export interface RuntimeProjectionState {
  readonly status:
    | "not_compiled"
    | "compile_required"
    | "compile_failed"
    | "compile_preview_ready"
    | "sync_required"
    | "syncing"
    | "synced"
    | "runtime_modified"
    | "importable"
    | "import_requires_review"
    | "import_blocked_by_policy"
    | "conflict"
    | "unknown_runtime_nodes"
    | "blocked_by_policy"
    | "deprecated_piece"
    | "missing_connection"
    | "runtime_unavailable"
    | "preview";
  readonly can_compile: boolean;
  readonly can_run: boolean;
  readonly activepieces_flow_id?: string | null;
  readonly compile_preview_id?: string | null;
  readonly sync_hash?: string | null;
  readonly warnings: readonly string[];
}

export interface WorkflowLayoutState {
  readonly mode: WorkflowMetadata["canvas_mode"];
  readonly updated_at?: string | null;
}

export interface WorkflowCanvasLayoutState extends WorkflowLayoutState {
  readonly layout_version?: string;
  readonly nodes?: Record<string, WorkflowNodeLayout>;
}

export interface RequiredPiece {
  readonly package_name: string;
  readonly version?: string | null;
  readonly node_ids: readonly string[];
}

export interface RequiredConnection {
  readonly connection_id: string;
  readonly node_ids: readonly string[];
}

export interface UnsupportedNode {
  readonly node_id: string;
  readonly reason: string;
}

export interface RuntimePolicyWarning {
  readonly code: string;
  readonly message: string;
  readonly node_id?: string | null;
}

export interface ModuleRuntimeMapping {
  readonly module_code: string;
  readonly provider: WorkflowNodeRuntimeMapping["provider"];
  readonly activepieces_piece?: string | null;
  readonly activepieces_action?: string | null;
  readonly internal_route?: string | null;
}

export interface ConnectionBinding {
  readonly connection_id: string;
  readonly provider?: string | null;
}

export interface WorkspaceRuntimePolicy {
  readonly external_delivery_requires_approval: boolean;
  readonly raw_execution_data_policy: WorkflowPolicyBlock["raw_execution_data_policy"];
}

export interface RuntimeProjectionInput {
  readonly workflow: LexFrameWorkflowV2;
  readonly module_runtime_mappings: readonly ModuleRuntimeMapping[];
  readonly connection_bindings: readonly ConnectionBinding[];
  readonly workspace_policy: WorkspaceRuntimePolicy;
}

export interface RuntimeProjectionOutput {
  readonly provider: "activepieces";
  readonly activepieces_flow: unknown;
  readonly required_pieces: readonly RequiredPiece[];
  readonly required_connections: readonly RequiredConnection[];
  readonly unsupported_nodes: readonly UnsupportedNode[];
  readonly policy_warnings: readonly RuntimePolicyWarning[];
  readonly projection_hash: string;
  readonly can_compile: boolean;
}

export type CompilerTargetRuntime = "activepieces";

export type CompilerMode =
  | "preview"
  | "dry_run_compile"
  | "sync_draft_to_runtime"
  | "publish_and_sync"
  | "repair_runtime_projection";

export type CompileStatus =
  | "compiled"
  | "compiled_with_warnings"
  | "blocked_by_validation"
  | "blocked_by_policy"
  | "blocked_by_missing_connection"
  | "runtime_sync_required"
  | "runtime_synced"
  | "runtime_conflict";

export type RuntimeDriftStatus =
  | "synced"
  | "runtime_modified"
  | "importable"
  | "import_requires_review"
  | "import_blocked_by_policy"
  | "conflict"
  | "conflict_source_and_runtime_changed"
  | "unknown_runtime_nodes"
  | "approval_removed"
  | "forbidden_piece_added"
  | "direct_ai_provider_added"
  | "runtime_unavailable";

export interface CompileRequestOptions {
  readonly validate_only?: boolean;
  readonly include_advanced_report?: boolean;
  readonly allow_runtime_overwrite?: boolean;
  readonly preserve_runtime_metadata?: boolean;
  readonly publish_activepieces_flow?: boolean;
  readonly force_piece_version_refresh?: boolean;
}

export interface CompileActorSnapshot {
  readonly user_id: string;
  readonly role?: string | null;
  readonly permissions: readonly PermissionCode[];
}

export interface CompileRequest {
  readonly workspace_id?: string;
  readonly automation_id?: string;
  readonly draft_version_id?: string;
  readonly published_version_id?: string;
  readonly mode?: CompilerMode;
  readonly target_runtime?: CompilerTargetRuntime;
  readonly options?: CompileRequestOptions;
  readonly actor?: CompileActorSnapshot;
  readonly idempotency_key?: string;
}

export interface CompileIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "policy_block";
  readonly node_id?: string | null;
  readonly details?: Record<string, unknown>;
}

export interface CompileWarning {
  readonly code: string;
  readonly message: string;
  readonly node_id?: string | null;
  readonly details?: Record<string, unknown>;
}

export interface RuntimeConnectionRequirement {
  readonly requirement_id: string;
  readonly source_node_id: string;
  readonly connection_type:
    | "email_provider"
    | "telegram_bot"
    | "lexframe_internal_api"
    | "search_service"
    | "document_storage"
    | "ai_gateway"
    | "unknown";
  readonly required: boolean;
  readonly status:
    | "available"
    | "missing"
    | "forbidden"
    | "expired"
    | "requires_admin_setup";
  readonly connection_external_id?: string | null;
  readonly setup_url?: string | null;
}

export interface RuntimePieceVersionRequirement {
  readonly piece_name: string;
  readonly piece_version: string;
  readonly action_name?: string | null;
  readonly trigger_name?: string | null;
  readonly source_node_ids: readonly string[];
  readonly status: "available" | "deprecated" | "blocked" | "missing";
}

export interface RuntimeInputBinding {
  readonly prop: string;
  readonly source: unknown;
  readonly expression: string | null;
  readonly policy: {
    readonly reference_only: boolean;
    readonly redaction_required: boolean;
  };
}

export interface RuntimeOutputContract {
  readonly fields: readonly StepOutputDefinition[];
}

export interface RuntimeErrorPolicy {
  readonly on_failure:
    | "fail_workflow"
    | "go_to_error_handler"
    | "retry_then_fail"
    | "notify_and_stop";
  readonly max_attempts: number;
  readonly safe_stop: boolean;
}

export interface RuntimeIRStep {
  readonly ir_step_id: string;
  readonly source_node_id: string;
  readonly source_node_type:
    | "legal_action"
    | "ai_action"
    | "approval"
    | "delivery"
    | "condition"
    | "loop"
    | "merge"
    | "wait"
    | "error_handler"
    | "trigger"
    | "end"
    | "system";
  readonly display_name: string;
  readonly runtime_kind:
    | "piece_action"
    | "piece_trigger"
    | "router"
    | "loop"
    | "branch"
    | "waitpoint"
    | "internal_callback"
    | "note";
  readonly piece?: {
    readonly name: string;
    readonly version: string;
    readonly action_name?: string | null;
    readonly trigger_name?: string | null;
  } | null;
  readonly props: Record<string, unknown>;
  readonly input_bindings: readonly RuntimeInputBinding[];
  readonly output_contract: RuntimeOutputContract;
  readonly policy: {
    readonly data_classification: string;
    readonly external_action: boolean;
    readonly requires_approval: boolean;
    readonly allow_in_dry_run: boolean;
    readonly redaction_required: boolean;
  };
  readonly error_policy: RuntimeErrorPolicy;
}

export interface RuntimeIR {
  readonly ir_version: "1.0";
  readonly source_workflow_version_id: string;
  readonly source_hash: string;
  readonly runtime: CompilerTargetRuntime;
  readonly trigger: RuntimeIRStep | null;
  readonly steps: readonly RuntimeIRStep[];
  readonly branches: readonly unknown[];
  readonly edges: readonly unknown[];
  readonly variables: readonly WorkflowVariable[];
  readonly connection_requirements: readonly RuntimeConnectionRequirement[];
  readonly policies: WorkflowPolicyBlock;
  readonly metadata: {
    readonly workspace_id: string;
    readonly automation_id: string;
    readonly compile_mode: CompilerMode;
    readonly generated_at: string;
    readonly compiler_version: string;
  };
}

export interface ActivepiecesProjectionPreview {
  readonly flow: unknown;
  readonly operations: readonly unknown[];
  readonly runtime_ir: RuntimeIR;
}

export interface CompileSummary {
  readonly generated_steps: number;
  readonly required_pieces: number;
  readonly required_connections: number;
  readonly approval_gates: number;
  readonly external_actions: number;
  readonly blocked_issues: number;
  readonly warnings: number;
}

export interface ActivepiecesProjectionSummary {
  readonly project_id: string | null;
  readonly flow_id?: string | null;
  readonly flow_version_id?: string | null;
  readonly sync_hash: string;
  readonly generated_steps_count: number;
  readonly required_pieces: readonly RuntimePieceVersionRequirement[];
  readonly required_connections: readonly RuntimeConnectionRequirement[];
}

export interface CompileResponse {
  readonly status: CompileStatus;
  readonly compile_report_id: string;
  readonly source_workflow_hash: string;
  readonly runtime_hash?: string | null;
  readonly summary: CompileSummary;
  readonly activepieces_projection?: ActivepiecesProjectionSummary;
  readonly validation: CanvasValidationResult;
  readonly warnings: readonly CompileWarning[];
  readonly blocking_issues: readonly CompileIssue[];
  readonly preview?: ActivepiecesProjectionPreview;
  readonly can_sync: boolean;
  readonly can_dry_run: boolean;
  readonly can_publish: boolean;
}

export interface CompileReport {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly automation_version_id?: string | null;
  readonly compiler_version: string;
  readonly target_runtime: CompilerTargetRuntime;
  readonly source_workflow_hash: string;
  readonly status: CompileStatus;
  readonly validation_result: CanvasValidationResult;
  readonly runtime_ir: RuntimeIR;
  readonly activepieces_projection: unknown;
  readonly generated_operations: readonly unknown[];
  readonly required_pieces: readonly RuntimePieceVersionRequirement[];
  readonly required_connections: readonly RuntimeConnectionRequirement[];
  readonly warnings: readonly CompileWarning[];
  readonly blocking_issues: readonly CompileIssue[];
  readonly created_by: string;
  readonly created_at: string;
}

export interface CompileReportsResponse {
  readonly reports: readonly CompileReport[];
}

export interface RuntimeBindingDto {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly automation_version_id?: string | null;
  readonly runtime_projection_id?: string | null;
  readonly runtime: CompilerTargetRuntime;
  readonly activepieces_project_id: string | null;
  readonly activepieces_flow_id: string | null;
  readonly activepieces_flow_version_id: string | null;
  readonly status: RuntimeProjectionState["status"];
  readonly active?: boolean;
  readonly source_workflow_hash: string | null;
  readonly runtime_hash: string | null;
  readonly last_synced_hash: string | null;
  readonly last_compile_report_id: string | null;
  readonly last_synced_at: string | null;
  readonly last_checked_at: string | null;
}

export interface RuntimeDriftResponse {
  readonly status: RuntimeDriftStatus;
  readonly runtime_binding: RuntimeBindingDto | null;
  readonly current_runtime_hash: string | null;
  readonly last_synced_hash: string | null;
  readonly issues: readonly CompileIssue[];
}

export interface RuntimeSyncRequest {
  readonly draft_version_id?: string | null;
  readonly compile_report_id?: string | null;
  readonly target_runtime?: CompilerTargetRuntime;
  readonly publish_after_sync?: boolean;
  readonly overwrite_runtime_changes?: boolean;
  readonly idempotency_key?: string | null;
}

export interface RuntimeSnapshotResponse {
  readonly runtime_binding: RuntimeBindingDto | null;
  readonly snapshot_hash: string | null;
  readonly snapshot: unknown;
}

export type RuntimePullSource =
  | "manual_pull"
  | "after_builder_close"
  | "before_run"
  | "scheduled_reconcile"
  | "webhook_hint";

export type RuntimeSnapshotSource =
  | "after_sync"
  | "before_sync"
  | RuntimePullSource
  | "pre_import"
  | "pre_overwrite";

export type RuntimeImportability =
  | "fully_importable"
  | "importable_with_warnings"
  | "requires_review"
  | "blocked_by_policy"
  | "unmappable";

export type WorkflowDiffSeverity =
  | "info"
  | "warning"
  | "requires_review"
  | "policy_block"
  | "conflict";

export type WorkflowDiffItemType =
  | "node_added"
  | "node_removed"
  | "node_config_changed"
  | "binding_changed"
  | "edge_added"
  | "edge_removed"
  | "branch_condition_changed"
  | "loop_changed"
  | "approval_removed"
  | "external_action_added"
  | "piece_version_changed"
  | "connection_changed"
  | "unknown_runtime_node_added"
  | "policy_violation";

export interface WorkflowDiffItem {
  readonly id: string;
  readonly type: WorkflowDiffItemType;
  readonly severity: WorkflowDiffSeverity;
  readonly node_id?: string | null;
  readonly runtime_node_id?: string | null;
  readonly title: string;
  readonly message: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly effect?: string | null;
  readonly recommended_action?: string | null;
  readonly technical_details?: Record<string, unknown> | null;
}

export interface RuntimeGraph {
  readonly source: "activepieces";
  readonly flowId: string;
  readonly flowVersionId: string | null;
  readonly displayName: string;
  readonly trigger: RuntimeGraphNode | null;
  readonly nodes: readonly RuntimeGraphNode[];
  readonly edges: readonly RuntimeGraphEdge[];
  readonly notes: readonly RuntimeGraphNote[];
  readonly metadata: {
    readonly activepiecesProjectId: string | null;
    readonly status: string | null;
    readonly operationStatus: string | null;
    readonly schemaVersion: string | null;
    readonly connectionIds: readonly string[];
    readonly publishedVersionId?: string | null;
  };
}

export interface RuntimeGraphNode {
  readonly runtimeNodeId: string;
  readonly name: string;
  readonly displayName: string;
  readonly runtimeType:
    | "PIECE_TRIGGER"
    | "PIECE_ACTION"
    | "CODE"
    | "ROUTER"
    | "BRANCH"
    | "LOOP_ON_ITEMS"
    | "NOTE"
    | "UNKNOWN";
  readonly pieceName?: string | null;
  readonly pieceVersion?: string | null;
  readonly actionName?: string | null;
  readonly triggerName?: string | null;
  readonly input: Record<string, unknown>;
  readonly authRef?: string | null;
  readonly parentRuntimeNodeId?: string | null;
  readonly branchName?: string | null;
  readonly orderIndex: number;
  readonly metadata?: Record<string, unknown>;
  readonly raw: unknown;
}

export interface RuntimeGraphEdge {
  readonly sourceRuntimeNodeId: string;
  readonly targetRuntimeNodeId: string;
  readonly edgeType:
    | "control_flow"
    | "branch_true"
    | "branch_otherwise"
    | "loop_body"
    | "error_flow";
  readonly condition?: unknown;
}

export interface RuntimeGraphNote {
  readonly id: string;
  readonly text: string;
  readonly raw?: unknown;
}

export interface RuntimeSyncStatusResponse {
  readonly automation_id: string;
  readonly runtime_binding_id: string | null;
  readonly activepieces_project_id: string | null;
  readonly activepieces_flow_id: string | null;
  readonly sync_status: RuntimeProjectionState["status"] | RuntimeDriftStatus;
  readonly last_synced_at: string | null;
  readonly last_synced_snapshot_hash: string | null;
  readonly current_runtime_snapshot_hash: string | null;
  readonly canonical_workflow_hash: string | null;
  readonly runtime_changed: boolean;
  readonly canonical_changed: boolean;
  readonly can_import: boolean;
  readonly can_overwrite_runtime: boolean;
  readonly warnings: readonly string[];
}

export interface RuntimePullRequest {
  readonly source?: RuntimePullSource;
  readonly reason?: string | null;
}

export interface RuntimePullResponse {
  readonly status: RuntimeProjectionState["status"] | RuntimeDriftStatus;
  readonly snapshot_id: string | null;
  readonly snapshot_hash: string | null;
  readonly changed_since_last_sync: boolean;
  readonly runtime_changed: boolean;
  readonly canonical_changed: boolean;
  readonly issues: readonly CompileIssue[];
}

export interface RuntimeImportPreviewRequest {
  readonly snapshot_id: string;
  readonly mode?: "safe" | "admin_review";
}

export interface RuntimeImportPreviewResponse {
  readonly status: "import_preview_ready" | "import_blocked";
  readonly importability: RuntimeImportability;
  readonly draft_candidate_id: string | null;
  readonly import_diff_id: string | null;
  readonly conflict_id: string | null;
  readonly runtime_graph: RuntimeGraph;
  readonly diff: readonly WorkflowDiffItem[];
  readonly validation: CanvasValidationSummary;
  readonly unknown_nodes: readonly RuntimeGraphNode[];
  readonly requires_review: readonly WorkflowDiffItem[];
  readonly policy_blocks: readonly WorkflowDiffItem[];
}

export interface RuntimeImportApplyRequest {
  readonly draft_candidate_id: string;
  readonly resolution?: "create_new_draft";
  readonly comment?: string | null;
}

export interface RuntimeImportApplyResponse {
  readonly status: "draft_created";
  readonly automation_id: string;
  readonly draft_version_id: string;
  readonly sync_status: RuntimeProjectionState["status"];
  readonly import_report_id: string | null;
}

export interface RuntimeImportRejectRequest {
  readonly snapshot_id?: string | null;
  readonly draft_candidate_id?: string | null;
  readonly reason?: string | null;
}

export interface RuntimeImportRejectResponse {
  readonly status: "rejected";
  readonly sync_status: RuntimeProjectionState["status"] | RuntimeDriftStatus;
  readonly next_actions: readonly string[];
}

export interface RuntimeOverwriteRequest {
  readonly version_id?: string | null;
  readonly confirm_discard_runtime_changes: boolean;
}

export interface RuntimeOverwriteResponse {
  readonly status: "runtime_overwritten";
  readonly activepieces_flow_id: string;
  readonly new_sync_hash: string;
  readonly new_snapshot_id: string | null;
}

export interface LexFrameWorkflowV2 {
  readonly schema_version: "2.0";
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id?: string | null;
  readonly automation_id: string;
  readonly draft_version_id: string;
  readonly published_version_id?: string | null;
  readonly revision_counter?: number;
  readonly metadata: WorkflowMetadata;
  readonly workflow_inputs?: readonly WorkflowInputDefinition[];
  readonly workflow_outputs?: readonly WorkflowOutputDefinition[];
  readonly inputs: readonly WorkflowInputDefinition[];
  readonly outputs: readonly WorkflowOutputDefinition[];
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly variables: readonly WorkflowVariable[];
  readonly secrets_policy?: WorkflowSecretsPolicy;
  readonly data_contracts?: WorkflowDataContracts;
  readonly policies?: WorkflowPolicyBlock;
  readonly validation_state?: CanvasValidationSummary;
  readonly validation: CanvasValidationSummary;
  readonly runtime_projection: RuntimeProjectionState;
  readonly canvas_layout?: WorkflowCanvasLayoutState;
  readonly layout: WorkflowLayoutState;
  readonly created_at: string;
  readonly updated_at: string;
}

export const canvasOperationTypes = [
  "ADD_NODE_FROM_MODULE",
  "ADD_NODE",
  "DUPLICATE_NODE",
  "UPDATE_NODE",
  "MOVE_NODE",
  "DELETE_NODE",
  "ADD_EDGE",
  "DELETE_EDGE",
  "UPDATE_EDGE",
  "UPDATE_NODE_CONFIG",
  "UPDATE_LAYOUT",
  "UPSERT_WORKFLOW_INPUT",
  "DELETE_WORKFLOW_INPUT",
  "UPSERT_WORKFLOW_OUTPUT",
  "DELETE_WORKFLOW_OUTPUT",
  "UPSERT_INPUT_BINDING",
  "DELETE_INPUT_BINDING",
  "PIN_SAMPLE_DATA",
  "UNPIN_SAMPLE_DATA",
  "UPDATE_CONDITION",
  "UPDATE_WORKFLOW_POLICY",
  "UPDATE_NODE_POLICY",
  "SNAPSHOT_RESTORE",
  "RUNTIME_IMPORT_AS_DRAFT",
] as const;

export type CanvasOperationType = (typeof canvasOperationTypes)[number];

export const canvasSemanticOperationTypes = [
  "workflow.input.add",
  "workflow.input.update",
  "workflow.input.delete",
  "workflow.output.add",
  "workflow.output.update",
  "workflow.output.delete",
  "workflow.metadata.update",
  "node.add",
  "node.update_display",
  "node.update_config",
  "node.update_policy",
  "node.move",
  "node.delete",
  "node.duplicate",
  "edge.add",
  "edge.delete",
  "edge.update_condition",
  "edge.update_mapping",
  "binding.set",
  "binding.clear",
  "binding.batch_set",
  "branch.add",
  "branch.update_condition",
  "branch.delete",
  "loop.add",
  "loop.update",
  "loop.delete",
  "approval.add",
  "approval.update",
  "approval.delete",
  "error_handler.add",
  "error_handler.update",
  "error_handler.delete",
  "layout.update",
  "group.add",
  "group.update",
  "group.delete",
  "snapshot.restore",
  "runtime.import_as_draft",
] as const;

export type CanvasSemanticOperationType =
  (typeof canvasSemanticOperationTypes)[number];

export const canvasOperationRejectReasons = [
  "PERMISSION_DENIED",
  "LOCK_REQUIRED",
  "LOCK_OWNED_BY_ANOTHER_USER",
  "DRAFT_LOCKED",
  "SCHEMA_VERSION_UNSUPPORTED",
  "INVALID_NODE_TYPE",
  "INVALID_EDGE_TYPE",
  "INVALID_CONNECTION",
  "INVALID_WORKFLOW_IO",
  "INVALID_BINDING",
  "POLICY_BLOCKED",
  "WORKFLOW_HASH_MISMATCH",
  "RUNTIME_CONFLICT",
] as const;

export type CanvasOperationRejectReason =
  (typeof canvasOperationRejectReasons)[number];

export interface CanvasOperation {
  readonly client_operation_id: string;
  readonly operation_type: CanvasOperationType;
  readonly operation_payload: Record<string, unknown>;
  readonly base_workflow_hash?: string | null;
  readonly base_revision_counter?: number | null;
  readonly idempotency_key?: string | null;
}

export interface CanvasOperationEnvelope<TPayload = Record<string, unknown>> {
  readonly client_operation_id: string;
  readonly type: CanvasOperationType | CanvasSemanticOperationType;
  readonly payload: TPayload;
  readonly idempotency_key?: string | null;
}

export interface CanvasOperationRequest {
  readonly draft_id?: string | null;
  readonly expected_revision?: number | null;
  readonly base_hash?: string | null;
  readonly client_batch_id?: string | null;
  readonly operations: readonly (CanvasOperation | CanvasOperationEnvelope)[];
}

export interface CanvasOperationResponse {
  readonly accepted: boolean;
  readonly operation_id: string | null;
  readonly draft_id?: string | null;
  readonly revision?: number;
  readonly draft_hash?: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly canvas?: CanvasReadModel;
  readonly validation: CanvasValidationSummary;
  readonly rejected_reason?: CanvasOperationRejectReason | null;
  readonly new_workflow_hash: string;
  readonly revision_counter: number;
  readonly applied_operations?: readonly string[];
  readonly operation_results?: readonly CanvasOperationResult[];
}

export interface CanvasPermissions {
  readonly can_view: boolean;
  readonly can_edit: boolean;
  readonly can_publish: boolean;
  readonly can_test: boolean;
  readonly can_add_node?: boolean;
  readonly can_delete_node?: boolean;
  readonly can_add_edge?: boolean;
  readonly can_delete_edge?: boolean;
  readonly can_edit_layout?: boolean;
  readonly can_edit_node_config?: boolean;
  readonly can_edit_bindings?: boolean;
  readonly can_edit_conditions?: boolean;
  readonly can_edit_error_handlers?: boolean;
  readonly can_edit_approval_gates?: boolean;
  readonly can_edit_delivery_steps?: boolean;
  readonly can_edit_ai_steps?: boolean;
  readonly can_edit_runtime_mapping?: boolean;
  readonly can_import_runtime?: boolean;
  readonly can_compile?: boolean;
  readonly can_sync_runtime?: boolean;
  readonly can_view_compile_preview?: boolean;
  readonly can_resolve_sync_conflict?: boolean;
  readonly can_override_policy?: boolean;
  readonly can_security_review?: boolean;
  readonly can_read_audit?: boolean;
  readonly can_export_audit?: boolean;
  readonly can_view_connections?: boolean;
  readonly can_request_connection?: boolean;
  readonly can_manage_connections?: boolean;
  readonly can_restore_version?: boolean;
  readonly can_view_versions?: boolean;
  readonly can_compare_versions?: boolean;
  readonly can_download_version_json?: boolean;
  readonly can_create_checkpoint?: boolean;
  readonly can_validate_publish?: boolean;
  readonly can_restore_version_as_draft?: boolean;
  readonly can_rollback_version?: boolean;
  readonly can_rollback_runtime?: boolean;
  readonly can_emergency_disable?: boolean;
  readonly can_view_runtime_projection?: boolean;
  readonly can_manage_locks?: boolean;
  readonly can_view_validation?: boolean;
  readonly can_view_raw_dsl?: boolean;
  readonly can_open_advanced_builder: boolean;
  readonly can_debug: boolean;
  readonly can_use_ai_assistant?: boolean;
  readonly can_ai_explain?: boolean;
  readonly can_ai_propose_patch?: boolean;
  readonly can_ai_apply_patch?: boolean;
  readonly can_ai_configure_step?: boolean;
  readonly can_ai_fix_validation?: boolean;
  readonly can_ai_debug_test?: boolean;
  readonly can_ai_view_raw_context?: boolean;
  readonly can_ai_use_sensitive_context?: boolean;
  readonly can_ai_admin_diagnostics?: boolean;
}

export type CanvasRiskLevel = "low" | "medium" | "high" | "critical";

export type CanvasDataVisibilityMode =
  | "metadata_only"
  | "redacted"
  | "structured_safe"
  | "raw";

export type CanvasAccessDecisionReasonCode =
  | "ALLOWED"
  | "AUTHENTICATION_REQUIRED"
  | "WORKSPACE_REQUIRED"
  | "WORKSPACE_ACCESS_DENIED"
  | "OBJECT_WORKSPACE_MISMATCH"
  | "PERMISSION_DENIED"
  | "DRAFT_LOCKED"
  | "DRAFT_IMMUTABLE"
  | "PUBLISHED_VERSION_IMMUTABLE"
  | "POLICY_BLOCKED"
  | "POLICY_OVERRIDE_REQUIRED"
  | "REAUTH_REQUIRED"
  | "RUNTIME_NOT_READY"
  | "AI_ROUTE_RESTRICTED"
  | "RAW_DATA_RESTRICTED"
  | "CONNECTION_RESTRICTED"
  | "UNKNOWN_OPERATION";

export type CanvasRequiredAction =
  | "none"
  | "reauth"
  | "request_policy_override"
  | "security_review"
  | "acquire_lock"
  | "resolve_runtime_conflict"
  | "request_connection"
  | "open_runtime_import_review";

export type CanvasSecurityResourceType =
  | "automation"
  | "draft"
  | "version"
  | "node"
  | "edge"
  | "binding"
  | "condition"
  | "test_run"
  | "runtime"
  | "connection"
  | "ai_session"
  | "audit_event"
  | "policy";

export interface CanvasAccessDecision {
  readonly allowed: boolean;
  readonly reason_code: CanvasAccessDecisionReasonCode;
  readonly message?: string | null;
  readonly required_permissions: readonly PermissionCode[];
  readonly matched_permissions?: readonly PermissionCode[];
  readonly missing_permissions?: readonly PermissionCode[];
  readonly risk_level: CanvasRiskLevel;
  readonly redaction_mode: CanvasDataVisibilityMode;
  readonly required_action: CanvasRequiredAction;
  readonly policy_codes: readonly string[];
  readonly audit_event: string;
  readonly resource: CanvasSecurityResourceType;
  readonly action: string;
}

export interface CanvasSecurityPolicy {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id?: string | null;
  readonly code: string;
  readonly title: string;
  readonly description?: string | null;
  readonly severity: CanvasRiskLevel;
  readonly enforcement: "warn" | "block" | "review_required";
  readonly enabled: boolean;
  readonly allow_override: boolean;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface CanvasPolicyViolation {
  readonly id: string;
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly draft_version_id?: string | null;
  readonly policy_code: string;
  readonly severity: CanvasRiskLevel;
  readonly resource_type: CanvasSecurityResourceType;
  readonly resource_id?: string | null;
  readonly status: "open" | "overridden" | "resolved" | "blocked";
  readonly decision: CanvasAccessDecision;
  readonly created_at: string;
  readonly resolved_at?: string | null;
}

export interface CanvasPolicyOverrideRequest {
  readonly violation_id?: string | null;
  readonly policy_code: string;
  readonly reason: string;
  readonly requested_action: string;
  readonly expires_at?: string | null;
}

export interface CanvasPolicyOverrideDecisionRequest {
  readonly override_request_id: string;
  readonly reason: string;
}

export interface CanvasAuditEventSummary {
  readonly id: string;
  readonly occurred_at: string;
  readonly action: string;
  readonly category: string | null;
  readonly result: "success" | "denied" | "error";
  readonly reason_code: string | null;
  readonly actor_user_id: string | null;
  readonly entity_id: string | null;
  readonly data_class: string | null;
  readonly request_id: string | null;
  readonly trace_id: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface CanvasSecurityContext {
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly actor_id: string;
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly PermissionCode[];
  readonly capabilities: CanvasPermissions;
  readonly default_visibility: CanvasDataVisibilityMode;
  readonly session_assurance: "aal1" | "aal2";
  readonly policies: readonly CanvasSecurityPolicy[];
  readonly decisions: Record<string, CanvasAccessDecision>;
}

export interface CanvasSecurityCheckRequest {
  readonly action: string;
  readonly resource?: CanvasSecurityResourceType;
  readonly resource_id?: string | null;
  readonly operation_type?: CanvasOperation["operation_type"];
  readonly payload?: Record<string, unknown>;
  readonly draft_version_id?: string | null;
  readonly node_id?: string | null;
  readonly edge_id?: string | null;
}

export interface CanvasAuditListResponse {
  readonly events: readonly CanvasAuditEventSummary[];
}

export interface CanvasAuditExportResponse {
  readonly format: "json" | "jsonl";
  readonly item_count: number;
  readonly content: string;
}

export interface CanvasAuditHashChainStatusResponse {
  readonly workspace_id: string;
  readonly automation_id: string;
  readonly status: "verified" | "not_available" | "mismatch";
  readonly latest_event_id?: string | null;
  readonly latest_hash?: string | null;
}

export interface CanvasLockState {
  readonly status: "unlocked" | "locked_by_me" | "locked_by_other" | "expired";
  readonly locked: boolean;
  readonly locked_by_current_user: boolean;
  readonly lock_id?: string | null;
  readonly lock_type?: string | null;
  readonly locked_by_user_id?: string | null;
  readonly locked_by_user_email?: string | null;
  readonly expires_at?: string | null;
}

export interface CanvasFeatureFlags {
  readonly canvas_v2: boolean;
  readonly canvas_ai_assistant: boolean;
  readonly canvas_advanced_graph: boolean;
  readonly canvas_reverse_sync: boolean;
}

export interface CanvasReadNode {
  readonly id: string;
  readonly type: WorkflowNode["type"];
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
  readonly data: {
    readonly title: string;
    readonly subtitle?: string | null;
    readonly badges: readonly string[];
    readonly validation_state: "valid" | "warning" | "invalid";
    readonly missing_inputs_count: number;
  };
}

export interface CanvasReadEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly source_handle?: string | null;
  readonly target_handle?: string | null;
  readonly type: WorkflowEdge["type"];
  readonly label?: string | null;
  readonly validation_state: "valid" | "warning" | "invalid";
}

export interface CanvasReadModel {
  readonly nodes: readonly CanvasReadNode[];
  readonly edges: readonly CanvasReadEdge[];
  readonly viewport: {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  };
}

export interface CanvasState {
  readonly automation_id: string;
  readonly draft_id: string;
  readonly schema_version: "2.0";
  readonly status: CanvasDraftStatus;
  readonly revision: number;
  readonly draft_hash: string;
  readonly workflow: LexFrameWorkflowV2;
  readonly canvas: CanvasReadModel;
  readonly runtime_projection: RuntimeProjectionState;
  readonly permissions: CanvasPermissions;
  readonly lock: CanvasLockState;
  readonly feature_flags: CanvasFeatureFlags;
  readonly validation: CanvasValidationSummary;
  readonly workflow_hash: string;
  readonly revision_counter: number;
}

export type CanvasDraftResponse = CanvasState;

export type CanvasDraftStatus =
  | "editing"
  | "validating"
  | "valid"
  | "invalid"
  | "ready_to_publish"
  | "published_to_version"
  | "conflict"
  | "archived"
  | "draft"
  | "published"
  | "restored"
  | "runtime_synced"
  | "runtime_modified";

export interface CanvasDraftRequest {
  readonly source?:
    | "empty"
    | "from_published_version"
    | "from_template"
    | "from_runtime_import";
  readonly source_version_id?: string | null;
  readonly idempotency_key?: string | null;
}

export interface CanvasDraftOpenResponse {
  readonly draft_id: string;
  readonly revision: number;
  readonly draft_hash: string;
  readonly status: CanvasDraftStatus;
}

export interface CanvasSnapshot {
  readonly id: string;
  readonly draft_id: string;
  readonly revision: number;
  readonly snapshot_hash: string;
  readonly reason: string;
  readonly note?: string | null;
  readonly checkpoint_name?: string | null;
  readonly checkpoint_description?: string | null;
  readonly checkpoint_kind?: "manual" | "auto" | "system" | "publish" | null;
  readonly retention_until?: string | null;
  readonly is_named?: boolean;
  readonly created_at: string;
}

export interface CanvasSnapshotRequest {
  readonly draft_id?: string | null;
  readonly reason?: string | null;
  readonly note?: string | null;
  readonly checkpoint_name?: string | null;
  readonly checkpoint_description?: string | null;
  readonly checkpoint_kind?: "manual" | "auto" | "system" | "publish" | null;
  readonly is_named?: boolean;
}

export interface CanvasSnapshotResponse {
  readonly snapshot: CanvasSnapshot;
  readonly state: CanvasState;
}

export type CanvasCheckpointRequest = CanvasSnapshotRequest;
export type CanvasCheckpointResponse = CanvasSnapshotResponse;

export interface CanvasPublishRequest {
  readonly draft_id?: string | null;
  readonly expected_revision?: number | null;
  readonly change_note?: string | null;
  readonly compile_preview_required?: boolean;
  readonly version_name?: string | null;
  readonly version_description?: string | null;
  readonly sync_runtime?: boolean;
  readonly idempotency_key?: string | null;
  readonly typed_confirmation?: string | null;
}

export interface CanvasPublishResponse {
  readonly version_id: string;
  readonly version_no: number;
  readonly version_hash: string;
  readonly status: CanvasVersionStatus;
  readonly compile_preview_id?: string | null;
  readonly runtime_projection_id?: string | null;
  readonly active_version_id?: string | null;
  readonly publish_report?: CanvasPublishReport | null;
  readonly runtime_sync_status: RuntimeProjectionState["status"];
}

export interface CanvasRestoreVersionResponse {
  readonly draft_id: string;
  readonly revision: number;
  readonly draft_hash: string;
  readonly state: CanvasState;
}

export interface CanvasApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly affected_nodes?: readonly string[];
  readonly affected_edges?: readonly string[];
  readonly trace_id: string;
}

export interface CanvasDraftResponseLegacy {
  readonly workflow_hash: string;
  readonly revision_counter: number;
  readonly permissions: CanvasPermissions;
  readonly lock: CanvasLockState;
  readonly feature_flags: CanvasFeatureFlags;
  readonly validation: CanvasValidationSummary;
}

export type CanvasVersionStatus =
  | "draft"
  | "published"
  | "restored"
  | "runtime_synced"
  | "runtime_modified"
  | "superseded"
  | "archived";

export type CanvasVersionEntryType =
  | "draft"
  | "published_version"
  | "named_checkpoint"
  | "auto_checkpoint"
  | "rollback_event";

export interface CanvasVersionSummary {
  readonly id: string;
  readonly status: CanvasVersionStatus;
  readonly title: string;
  readonly workflow_hash: string;
  readonly revision_counter: number;
  readonly validation_status: CanvasValidationSummary["status"];
  readonly is_current: boolean;
  readonly is_active?: boolean;
  readonly entry_type?: CanvasVersionEntryType;
  readonly version_no?: number | null;
  readonly runtime_projection_id?: string | null;
  readonly runtime_sync_status?: RuntimeProjectionState["status"] | null;
  readonly published_at?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CanvasVersionsResponse {
  readonly current_draft_version_id: string | null;
  readonly active_version_id?: string | null;
  readonly disabled?: boolean;
  readonly versions: readonly CanvasVersionSummary[];
  readonly next_cursor?: string | null;
}

export interface CanvasPublishBlocker {
  readonly code: string;
  readonly title: string;
  readonly message: string;
  readonly category:
    | "validation"
    | "runtime"
    | "policy"
    | "connection"
    | "revision"
    | "security";
  readonly severity: "warning" | "blocker";
  readonly affected_node_id?: string | null;
}

export interface CanvasPublishReport {
  readonly draft_id: string;
  readonly draft_hash: string;
  readonly expected_revision: number;
  readonly validation: CanvasValidationSummary;
  readonly blockers: readonly CanvasPublishBlocker[];
  readonly warnings: readonly CanvasPublishBlocker[];
  readonly graph_summary: {
    readonly nodes: number;
    readonly edges: number;
    readonly approval_nodes: number;
    readonly external_actions: number;
    readonly ai_actions: number;
  };
  readonly required_connections: RuntimeProjectionOutput["required_connections"];
  readonly required_pieces: RuntimeProjectionOutput["required_pieces"];
  readonly runtime_diff: readonly WorkflowDiffItem[];
  readonly projection_hash: string | null;
  readonly can_publish: boolean;
  readonly generated_at: string;
}

export interface CanvasPublishValidateResponse {
  readonly automation_id: string;
  readonly report: CanvasPublishReport;
  readonly runtime_projection: RuntimeProjectionOutput | null;
}

export interface CanvasVersionStateResponse {
  readonly automation_id: string;
  readonly active_draft: {
    readonly draft_id: string | null;
    readonly revision: number | null;
    readonly workflow_hash: string | null;
    readonly status: CanvasDraftStatus | null;
  };
  readonly active_published_version: CanvasVersionSummary | null;
  readonly runtime_binding: RuntimeBindingDto | null;
  readonly disabled_state: {
    readonly disabled: boolean;
    readonly reason: string | null;
    readonly disabled_at: string | null;
    readonly disabled_by: string | null;
  };
  readonly latest_checkpoint: CanvasSnapshot | null;
  readonly runtime_conflict: {
    readonly has_conflict: boolean;
    readonly conflict_id?: string | null;
    readonly status?: string | null;
  };
  readonly permissions: CanvasPermissions;
}

export interface CanvasVersionCompareResponse {
  readonly automation_id: string;
  readonly from_version_id: string;
  readonly to_version_id: string;
  readonly human_summary: readonly string[];
  readonly technical_patch: {
    readonly graph: readonly WorkflowDiffItem[];
    readonly config: readonly WorkflowDiffItem[];
    readonly bindings: readonly WorkflowDiffItem[];
    readonly legal_policy: readonly WorkflowDiffItem[];
    readonly runtime: readonly WorkflowDiffItem[];
    readonly ux: readonly WorkflowDiffItem[];
  };
  readonly summary: {
    readonly added_nodes: number;
    readonly removed_nodes: number;
    readonly changed_nodes: number;
    readonly changed_bindings: number;
    readonly policy_changes: number;
    readonly runtime_changes: number;
  };
}

export type CanvasRollbackType =
  | "restore_as_draft"
  | "publish_previous_version"
  | "runtime_binding_rollback"
  | "emergency_disable";

export interface CanvasRollbackImpactResponse {
  readonly automation_id: string;
  readonly rollback_type: CanvasRollbackType;
  readonly target_version_id?: string | null;
  readonly current_active_version_id: string | null;
  readonly impact_report: {
    readonly running_runs: number;
    readonly queued_runs: number;
    readonly waiting_approval_runs: number;
    readonly waiting_delivery_approval_runs: number;
    readonly policy: string;
    readonly warnings: readonly string[];
  };
  readonly diff?: CanvasVersionCompareResponse | null;
  readonly can_rollback: boolean;
  readonly blockers: readonly CanvasPublishBlocker[];
}

export interface CanvasRollbackRequest {
  readonly rollback_type: CanvasRollbackType;
  readonly target_version_id?: string | null;
  readonly reason: string;
  readonly confirm_impact: boolean;
  readonly expected_active_version_id?: string | null;
  readonly idempotency_key: string;
  readonly impact_policy?: "cancel_queued" | "keep_queued" | "switch_queued";
}

export interface CanvasRollbackResponse {
  readonly rollback_id: string;
  readonly automation_id: string;
  readonly rollback_type: CanvasRollbackType;
  readonly from_version_id: string | null;
  readonly to_version_id: string | null;
  readonly active_version_id: string | null;
  readonly runtime_binding: RuntimeBindingDto | null;
  readonly disabled_state: CanvasVersionStateResponse["disabled_state"];
  readonly impact_report: CanvasRollbackImpactResponse["impact_report"];
}

export interface CanvasRuntimeProjectionVersion {
  readonly id: string;
  readonly automation_id: string;
  readonly automation_version_id: string;
  readonly provider: CompilerTargetRuntime;
  readonly projection_hash: string;
  readonly projection: RuntimeProjectionOutput | null;
  readonly compile_report: unknown;
  readonly required_pieces: RuntimeProjectionOutput["required_pieces"];
  readonly required_connections: RuntimeProjectionOutput["required_connections"];
  readonly pinned_piece_versions: readonly RequiredRuntimePiece[];
  readonly created_at: string;
}

export interface CanvasVersionExportResponse {
  readonly automation_id: string;
  readonly version_id: string;
  readonly exported_at: string;
  readonly redacted: true;
  readonly workflow: LexFrameWorkflowV2;
  readonly workflow_hash: string;
  readonly runtime_projection?: CanvasRuntimeProjectionVersion | null;
  readonly audit_metadata: Record<string, unknown>;
}

export const moduleAvailabilityStatuses = [
  "available",
  "available_with_warnings",
  "missing_required_input",
  "missing_connection",
  "missing_profile",
  "missing_template",
  "blocked_by_role",
  "blocked_by_plan",
  "blocked_by_data_policy",
  "blocked_by_runtime",
  "deprecated",
  "retired",
  "incompatible_with_canvas_context",
] as const;

export type ModuleAvailabilityStatus =
  (typeof moduleAvailabilityStatuses)[number];

export const canvasInsertPositions = [
  "workflow_start",
  "after_node",
  "before_node",
  "branch_true",
  "branch_false",
  "router_branch",
  "loop_body",
  "approval_after",
  "error_handler",
  "workflow_end",
] as const;

export type CanvasInsertPosition = (typeof canvasInsertPositions)[number];

export type ModuleRequirementKind =
  | "workflow_input"
  | "step_output"
  | "profile"
  | "template"
  | "connection"
  | "approval"
  | "runtime_piece"
  | "permission"
  | "plan"
  | "data_policy";

export interface ModuleRequirement {
  readonly kind: ModuleRequirementKind;
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly status: "satisfied" | "missing" | "warning" | "blocked";
  readonly reason?: string | null;
}

export interface ModuleRemediationAction {
  readonly action:
    | "configure_connection"
    | "request_connection"
    | "add_approval"
    | "choose_template"
    | "choose_profile"
    | "add_as_draft"
    | "cancel";
  readonly label: string;
}

export interface CanvasModuleCategory {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly count: number;
}

export interface CanvasModuleIoSummary {
  readonly key: string;
  readonly label: string;
  readonly data_type: LexFrameDataType | string;
  readonly required?: boolean;
  readonly classification?: CanvasDataClassification | string | null;
}

export interface RequiredRuntimePiece {
  readonly piece_name: string;
  readonly version_range?: string | null;
  readonly action?: string | null;
  readonly connection_type?: string | null;
}

export interface RequiredRuntimeConnection {
  readonly type: string;
  readonly label: string;
  readonly status: "configured" | "missing" | "blocked";
  readonly connection_id?: string | null;
}

export interface CanvasModuleCard {
  readonly module_code: string;
  readonly module_version: string | null;
  readonly display_name: string;
  readonly short_description: string;
  readonly long_description?: string | null;
  readonly source?: "lexframe" | "activepieces" | "external";
  readonly source_label?: string | null;
  readonly category_code: string;
  readonly category_label: string;
  readonly icon: string;
  readonly tags: readonly string[];
  readonly aliases: readonly string[];
  readonly input_summary: readonly CanvasModuleIoSummary[];
  readonly output_summary: readonly CanvasModuleIoSummary[];
  readonly risk_level: "low" | "medium" | "high" | "critical";
  readonly data_classification: CanvasDataClassification | string;
  readonly flags: {
    readonly uses_ai: boolean;
    readonly external_action: boolean;
    readonly requires_documents: boolean;
    readonly requires_profile: boolean;
    readonly requires_template: boolean;
    readonly requires_connection: boolean;
    readonly requires_approval: boolean;
    readonly supports_dry_run: boolean;
    readonly supports_batch: boolean;
  };
  readonly availability: {
    readonly status: ModuleAvailabilityStatus;
    readonly reason_code?: string | null;
    readonly human_reason?: string | null;
    readonly remediation?: readonly ModuleRemediationAction[];
  };
  readonly requirements: readonly ModuleRequirement[];
  readonly runtime: {
    readonly provider:
      | "activepieces"
      | "internal_worker"
      | "ai_gateway"
      | "manual"
      | "none";
    readonly mapping_status:
      | "available"
      | "missing"
      | "version_incompatible"
      | "not_required";
    readonly required_pieces: readonly RequiredRuntimePiece[];
    readonly required_connections: readonly RequiredRuntimeConnection[];
  };
  readonly insertion: {
    readonly allowed_positions: readonly CanvasInsertPosition[];
    readonly default_node_type: CanvasNodeType;
    readonly preferred_after_module_codes: readonly string[];
    readonly forbidden_after_module_codes: readonly string[];
  };
  readonly technical?: {
    readonly block_code: string;
    readonly runtime_mapping: WorkflowNodeRuntimeMapping;
  } | null;
}

export interface RecommendedModule {
  readonly module_code: string;
  readonly reason: string;
  readonly score: number;
  readonly source: "rules" | "team_preset" | "recent" | "favorite" | "ai_validated";
}

export interface RecentModule {
  readonly module_code: string;
  readonly used_at: string;
}

export interface FavoriteModule {
  readonly module_code: string;
  readonly created_at: string;
}

export interface CanvasModuleCatalogResponse {
  readonly workspace_id: string;
  readonly automation_id: string | null;
  readonly draft_version_id: string | null;
  readonly categories: readonly CanvasModuleCategory[];
  readonly modules: readonly CanvasModuleCard[];
  readonly recommended: readonly RecommendedModule[];
  readonly recent: readonly RecentModule[];
  readonly favorites: readonly FavoriteModule[];
  readonly policy_summary: {
    readonly hidden_count: number;
    readonly disabled_count: number;
    readonly missing_connections_count: number;
    readonly deprecated_count: number;
  };
  readonly runtime_summary: {
    readonly activepieces_available: boolean;
    readonly missing_pieces: readonly string[];
    readonly incompatible_pieces: readonly string[];
  };
  readonly generated_at: string;
}

export interface CanvasModuleDetail extends CanvasModuleCard {
  readonly examples: readonly string[];
  readonly requirements_detail: readonly ModuleRequirement[];
  readonly technical_detail?: {
    readonly module_code: string;
    readonly module_version: string | null;
    readonly runtime_mapping: WorkflowNodeRuntimeMapping;
    readonly input_schema?: Record<string, unknown>;
    readonly output_schema?: Record<string, unknown>;
    readonly policy: WorkflowNodePolicy;
  } | null;
}

export interface CanvasCompatibilityCheckRequest {
  readonly automation_id?: string | null;
  readonly draft_version_id?: string | null;
  readonly insert: {
    readonly position: CanvasInsertPosition;
    readonly source_node_id?: string | null;
    readonly target_node_id?: string | null;
    readonly source_handle?: CanvasHandleCode | null;
    readonly target_handle?: CanvasHandleCode | null;
  };
}

export interface CanvasCompatibilityCheckResponse {
  readonly allowed: boolean;
  readonly reason_code?: string | null;
  readonly human_reason?: string | null;
  readonly warnings: readonly ValidationIssue[];
  readonly missing_requirements: readonly ModuleRequirement[];
}

export interface CanvasConnectionRequirement {
  readonly requirement_code: string;
  readonly label: string;
  readonly module_code?: string | null;
  readonly connection_type: string;
  readonly status: "configured" | "missing" | "blocked";
  readonly remediation: readonly ModuleRemediationAction[];
}

export interface CanvasConnectionRequirementsResponse {
  readonly requirements: readonly CanvasConnectionRequirement[];
}

export interface CanvasConnectionRequestResponse {
  readonly request_id: string;
  readonly status: "created";
}

export interface CanvasOperationResult {
  readonly operation_type: CanvasOperationType;
  readonly module_code?: string | null;
  readonly added_node_id?: string | null;
  readonly created_edges?: readonly WorkflowEdge[];
  readonly created_bindings?: readonly StepInputBinding[];
  readonly binding_suggestions?: readonly StepInputBinding[];
  readonly missing_requirements?: readonly ModuleRequirement[];
  readonly warnings?: readonly ValidationIssue[];
  readonly undo_operations?: readonly CanvasOperation[];
}

export interface CanvasModuleSummary {
  readonly code: string;
  readonly label: string;
  readonly category:
    | "trigger"
    | "legal"
    | "ai"
    | "control"
    | "data"
    | "loop"
    | "merge"
    | "approval"
    | "wait"
    | "delivery"
    | "storage"
    | "subworkflow"
    | "error"
    | "note"
    | "output";
  readonly description: string;
  readonly node_type: CanvasNodeType;
  readonly icon: string;
  readonly disabled: boolean;
  readonly disabled_reason: string | null;
}

export interface CanvasIoNode {
  readonly node_id: string;
  readonly inputs: readonly StepInputDefinition[];
  readonly outputs: readonly StepOutputDefinition[];
  readonly bindings: readonly StepInputBinding[];
}

export interface CanvasIoValidation {
  readonly missing_required_inputs: readonly string[];
  readonly invalid_bindings: readonly string[];
  readonly unused_outputs: readonly string[];
}

export interface CanvasIoResponse {
  readonly workflow_inputs: readonly WorkflowInputDefinition[];
  readonly workflow_outputs: readonly WorkflowOutputDefinition[];
  readonly nodes: readonly CanvasIoNode[];
  readonly validation: CanvasIoValidation;
}

export interface CanvasDataSourceCandidate {
  readonly type: DataSourceKind;
  readonly source: DataSource;
  readonly label: string;
  readonly data_type: LexFrameDataType;
  readonly classification: CanvasDataClassification | string;
  readonly compatibility: "valid" | "warning" | "invalid";
  readonly reason?: string | null;
  readonly suggested_transform?: string | null;
  readonly preview?: Record<string, unknown> | null;
}

export interface CanvasSourcesResponse {
  readonly compatible_sources: readonly CanvasDataSourceCandidate[];
  readonly incompatible_sources: readonly CanvasDataSourceCandidate[];
}

export interface CanvasBindingValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: CanvasValidationIssueSeverity;
  readonly suggested_transform?: string | null;
}

export interface CanvasBindingValidationResponse {
  readonly status: BindingValidationState;
  readonly issues: readonly CanvasBindingValidationIssue[];
}

export interface CanvasSampleOutputResponse {
  readonly node_id: string;
  readonly output_key: string;
  readonly data_type: LexFrameDataType;
  readonly classification: CanvasDataClassification | string;
  readonly preview_payload: Record<string, unknown> | null;
  readonly redacted_payload: Record<string, unknown> | null;
  readonly source: "mock" | "test_run" | "pinned" | "manual" | "missing";
}

export interface CanvasPinnedDataResponse {
  readonly pinned: boolean;
  readonly pinned_sample_data_id?: string | null;
}

export type StepInspectorTab =
  | "overview"
  | "inputs"
  | "settings"
  | "data"
  | "connections"
  | "test"
  | "errors"
  | "outputs"
  | "policies"
  | "history"
  | "debug";

export type StepInputState =
  | "missing_required"
  | "configured"
  | "configured_but_invalid"
  | "configured_but_stale"
  | "auto_mapped"
  | "manual_value"
  | "requires_permission"
  | "requires_connection"
  | "blocked_by_policy";

export interface StepNodeSummaryDto {
  readonly id: string;
  readonly type: CanvasNodeType;
  readonly block_code: string;
  readonly display_name: string;
  readonly description?: string | null;
  readonly module_code?: string | null;
  readonly module_version?: string | null;
  readonly module_schema_hash?: string | null;
  readonly category?: string | null;
  readonly icon?: string | null;
  readonly lifecycle_status?: string | null;
}

export interface StepOverviewDto {
  readonly title: string;
  readonly description: string;
  readonly module_code?: string | null;
  readonly module_version?: string | null;
  readonly category_label?: string | null;
  readonly needs: readonly string[];
  readonly creates: readonly string[];
  readonly badges: readonly string[];
  readonly risk_level: WorkflowNodePolicy["risk_level"] | null;
  readonly data_classification: string | null;
  readonly uses_ai: boolean;
  readonly external_action: boolean;
  readonly approval_required: boolean;
  readonly runtime_provider: WorkflowNodeRuntimeMapping["provider"] | null;
}

export interface StepInputViewModel {
  readonly input: StepInputDefinition;
  readonly binding?: StepInputBinding | null;
  readonly status: StepInputState;
  readonly issues: readonly ValidationIssue[];
  readonly compatible_sources_count: number;
  readonly incompatible_sources_count: number;
  readonly allowed_sources: readonly DataSourceKind[];
}

export interface StepSettingsFieldDto {
  readonly key: string;
  readonly label: string;
  readonly control:
    | "text"
    | "textarea"
    | "number"
    | "checkbox"
    | "select"
    | "multi_select"
    | "json"
    | "readonly";
  readonly data_type: LexFrameDataType | string;
  readonly required: boolean;
  readonly value?: unknown;
  readonly default_value?: unknown;
  readonly options?: readonly string[];
  readonly placeholder?: string | null;
  readonly help_text?: string | null;
  readonly visibility?: "basic" | "advanced" | "admin";
  readonly readonly?: boolean;
}

export interface StepSettingsFormDto {
  readonly node_id: string;
  readonly module_code: string | null;
  readonly module_version: string | null;
  readonly schema_version: string;
  readonly fields: readonly StepSettingsFieldDto[];
  readonly values: Record<string, unknown>;
  readonly ui_schema?: Record<string, unknown> | null;
  readonly validation_issues: readonly ValidationIssue[];
}

export interface StepDataSourcesByInputDto {
  readonly [inputKey: string]: CanvasSourcesResponse;
}

export interface AvailableDataSourcesDto {
  readonly workflow_inputs: readonly CanvasDataSourceCandidate[];
  readonly previous_steps: readonly {
    readonly node_id: string;
    readonly display_name: string;
    readonly outputs: readonly CanvasDataSourceCandidate[];
  }[];
  readonly documents: readonly CanvasDataSourceCandidate[];
  readonly profiles: readonly CanvasDataSourceCandidate[];
  readonly templates: readonly CanvasDataSourceCandidate[];
  readonly system_values: readonly CanvasDataSourceCandidate[];
  readonly by_input_key: StepDataSourcesByInputDto;
}

export interface StepConnectionRequirementDto
  extends CanvasConnectionRequirement {
  readonly owner_label?: string | null;
  readonly last_checked_at?: string | null;
  readonly can_test: boolean;
}

export type StepErrorPolicyMode =
  | "fail_workflow"
  | "go_to_error_branch"
  | "retry_then_fail"
  | "create_manual_task"
  | "skip_if_optional";

export interface StepErrorPolicy {
  readonly mode: StepErrorPolicyMode;
  readonly retry_count?: number | null;
  readonly retry_delay_seconds?: number | null;
  readonly error_branch_node_id?: string | null;
  readonly notify_role?: string | null;
  readonly create_manual_task?: boolean;
}

export interface StepPolicySummaryDto {
  readonly risk_level: WorkflowNodePolicy["risk_level"] | null;
  readonly data_classification: string | null;
  readonly approval_required: boolean;
  readonly external_action: boolean;
  readonly uses_ai: boolean;
  readonly can_run_in_dry_run: boolean;
  readonly raw_output_visibility?: OutputPreviewPolicy | null;
  readonly required_permissions: readonly string[];
  readonly warnings: readonly ValidationIssue[];
}

export interface StepTestStateDto {
  readonly sample_data_status: WorkflowNodeTestState["sample_data_status"];
  readonly last_tested_at?: string | null;
  readonly pinned_output_id?: string | null;
  readonly supports_step_test: boolean;
  readonly supports_partial_execution: boolean;
  readonly supports_pinned_data: boolean;
  readonly disabled_reason?: string | null;
}

export interface StepHistoryEventDto {
  readonly id: string;
  readonly event_type: string;
  readonly operation_type?: CanvasOperationType | string | null;
  readonly actor_label?: string | null;
  readonly created_at: string;
  readonly summary: string;
  readonly rejected?: boolean;
  readonly rejected_reason?: CanvasOperationRejectReason | string | null;
}

export interface StepHistorySummaryDto {
  readonly events: readonly StepHistoryEventDto[];
  readonly total_count: number;
}

export interface StepInspectorPermissionsDto {
  readonly can_view: boolean;
  readonly can_edit_display_name: boolean;
  readonly can_edit_config: boolean;
  readonly can_edit_bindings: boolean;
  readonly can_test_step: boolean;
  readonly can_view_raw_data: boolean;
  readonly can_pin_data: boolean;
  readonly can_edit_error_policy: boolean;
  readonly can_edit_security_policy: boolean;
  readonly can_delete_step: boolean;
  readonly can_open_advanced_mapping: boolean;
}

export interface StepInspectorDto {
  readonly node: StepNodeSummaryDto;
  readonly overview: StepOverviewDto;
  readonly inputs: readonly StepInputViewModel[];
  readonly settings_form: StepSettingsFormDto;
  readonly data_sources: AvailableDataSourcesDto;
  readonly connections: readonly StepConnectionRequirementDto[];
  readonly outputs: readonly StepOutputDefinition[];
  readonly error_policy: StepErrorPolicy;
  readonly policy_summary: StepPolicySummaryDto;
  readonly test_state: StepTestStateDto;
  readonly history_summary: StepHistorySummaryDto;
  readonly permissions: StepInspectorPermissionsDto;
  readonly validation: CanvasValidationSummary;
  readonly tabs: readonly StepInspectorTab[];
}

export interface StepTestRequest {
  readonly mode: "selected_step" | "up_to_step" | "branch";
  readonly sample_data_mode: "auto" | "mock" | "pinned" | "manual";
  readonly trigger_test_data?: Record<string, unknown>;
  readonly client_operation_id: string;
}

export type CanvasTestMode =
  | "validation_only"
  | "test_selected_step"
  | "test_until_selected_step"
  | "test_branch"
  | "test_loop_sample"
  | "test_subworkflow_contract"
  | "dry_run_full"
  | "replay_from_previous_run";

export type CanvasTestRunStatus =
  | "created"
  | "validating"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked_by_policy"
  | "expired";

export type CanvasTestInputMode =
  | "use_current_bindings"
  | "manual_fixture"
  | "schema_generated"
  | "pinned_upstream"
  | "previous_test_run";

export type CanvasAiTestMode =
  | "mock"
  | "gateway_test_route"
  | "real_policy_checked";

export interface CanvasTestRunPolicy {
  readonly allow_real_reads: boolean;
  readonly allow_real_writes: false;
  readonly allow_external_calls: false;
  readonly allow_ai_calls: boolean;
  readonly ai_mode: CanvasAiTestMode;
  readonly max_loop_items: number;
  readonly timeout_seconds: number;
}

export interface CanvasTestRunRedaction {
  readonly raw_input_visible: boolean;
  readonly raw_output_visible: boolean;
  readonly store_raw_payload: boolean;
}

export interface CanvasTestRunRequest {
  readonly draft_version_id: string;
  readonly mode: CanvasTestMode;
  readonly target_node_id?: string | null;
  readonly target_branch_id?: string | null;
  readonly input_mode: CanvasTestInputMode;
  readonly fixture_id?: string | null;
  readonly previous_test_run_id?: string | null;
  readonly policy: CanvasTestRunPolicy;
  readonly redaction: CanvasTestRunRedaction;
}

export type CanvasTestRunStepStatus =
  | "not_started"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "simulated"
  | "blocked_by_policy"
  | "redacted";

export interface CanvasSuggestedFix {
  readonly type: string;
  readonly message: string;
  readonly tab?: StepInspectorTab | string;
  readonly operation_preview?: Record<string, unknown>;
}

export interface CanvasDebugError {
  readonly code: string;
  readonly severity: "info" | "warning" | "error" | "policy_block";
  readonly node_id?: string | null;
  readonly edge_id?: string | null;
  readonly title: string;
  readonly user_message: string;
  readonly technical_message?: string | null;
  readonly cause: {
    readonly type:
      | "missing_input"
      | "invalid_binding"
      | "permission"
      | "policy"
      | "runtime"
      | "ai"
      | "external_service";
    readonly details: Record<string, unknown>;
  };
  readonly suggested_fixes: readonly CanvasSuggestedFix[];
  readonly can_auto_fix: boolean;
}

export interface CanvasTestRunStepSummary {
  readonly node_id: string;
  readonly display_name: string;
  readonly module_code: string | null;
  readonly status: CanvasTestRunStepStatus;
  readonly input_summary?: Record<string, unknown> | null;
  readonly output_summary?: Record<string, unknown> | null;
  readonly error?: CanvasDebugError | null;
  readonly timing?: {
    readonly started_at: string;
    readonly finished_at?: string | null;
    readonly duration_ms?: number | null;
  };
}

export interface CanvasTestWarning {
  readonly code: string;
  readonly message: string;
  readonly node_id?: string | null;
  readonly severity?: CanvasValidationIssueSeverity;
}

export interface CanvasTestRunSummary {
  readonly total_steps: number;
  readonly succeeded_steps: number;
  readonly failed_steps: number;
  readonly simulated_steps: number;
  readonly blocked_steps: number;
  readonly redacted_steps: number;
}

export interface CanvasTestRunResponse {
  readonly test_run_id: string;
  readonly status: CanvasTestRunStatus;
  readonly mode: CanvasTestMode;
  readonly trace_id: string;
  readonly summary: CanvasTestRunSummary;
  readonly validation: CanvasValidationSummary;
  readonly steps: readonly CanvasTestRunStepSummary[];
  readonly warnings: readonly CanvasTestWarning[];
  readonly available_actions: {
    readonly retry: boolean;
    readonly pin_outputs: boolean;
    readonly open_debug: boolean;
    readonly create_fixture_from_output: boolean;
    readonly run_dry_run: boolean;
  };
}

export interface CanvasTestArtifactSummary {
  readonly id: string;
  readonly node_id: string;
  readonly blob_type: "input" | "output" | "log" | "artifact_preview";
  readonly classification: CanvasDataClassification | string;
  readonly redacted_payload: Record<string, unknown> | null;
  readonly retention_until: string;
  readonly created_at: string;
}

export interface CanvasTestSupportBundle {
  readonly test_run_id: string;
  readonly trace_id: string;
  readonly draft_version_hash: string | null;
  readonly validation: CanvasValidationSummary;
  readonly step_statuses: readonly CanvasTestRunStepSummary[];
  readonly safe_error_codes: readonly string[];
  readonly redacted_summaries: readonly Record<string, unknown>[];
  readonly runtime_projection_status: string | null;
  readonly diagnostics: {
    readonly browser: Record<string, unknown>;
    readonly backend: Record<string, unknown>;
  };
}

export interface StepTestResultDto {
  readonly test_run_id: string;
  readonly node_id: string;
  readonly status: "passed" | "failed" | "blocked" | "skipped";
  readonly mode: StepTestRequest["mode"];
  readonly sample_data_mode: StepTestRequest["sample_data_mode"];
  readonly started_at: string;
  readonly completed_at: string;
  readonly redacted_output: Record<string, unknown> | null;
  readonly preview: Record<string, unknown> | null;
  readonly issues: readonly ValidationIssue[];
  readonly disabled_reason?: string | null;
}

export const canvasPermissions: readonly PermissionCode[] = [
  "canvas.view",
  "canvas.edit",
  "canvas.publish",
  "canvas.restore_version",
  "canvas.manage_locks",
  "canvas.view_validation",
  "canvas.view_raw_dsl",
  "canvas.import_runtime",
  "canvas.add_node",
  "canvas.delete_node",
  "canvas.add_edge",
  "canvas.delete_edge",
  "canvas.edit_layout",
  "canvas.edit_node_config",
  "canvas.edit_bindings",
  "canvas.edit_conditions",
  "canvas.edit_error_handlers",
  "canvas.edit_approval_gates",
  "canvas.edit_delivery_steps",
  "canvas.edit_ai_steps",
  "canvas.edit_runtime_mapping",
  "canvas.compile",
  "canvas.sync_runtime",
  "canvas.view_compile_preview",
  "canvas.resolve_sync_conflict",
  "canvas.policy_override",
  "canvas.security_review",
  "canvas.audit_read",
  "canvas.audit_export",
  "canvas.connection_view",
  "canvas.connection_request",
  "canvas.connection_manage",
  "canvas.version.view",
  "canvas.version.compare",
  "canvas.version.download_json",
  "canvas.checkpoint.create",
  "canvas.publish.validate",
  "canvas.version.restore_as_draft",
  "canvas.version.rollback",
  "canvas.runtime.rollback",
  "canvas.version.emergency_disable",
  "canvas.version.view_runtime_projection",
  "canvas.runtime.view",
  "canvas.runtime.pull",
  "canvas.runtime.import_preview",
  "canvas.runtime.import_apply",
  "canvas.runtime.reject_import",
  "canvas.runtime.overwrite",
  "canvas.runtime.resolve_conflict",
  "canvas.runtime.view_technical_diff",
  "canvas.runtime.import_unknown_step",
  "canvas.runtime.import_code_step",
  "canvas.test.validate",
  "canvas.test.step",
  "canvas.test.branch",
  "canvas.test.loop",
  "canvas.test.dry_run",
  "canvas.test.cancel",
  "canvas.test.view_history",
  "canvas.test.view_redacted",
  "canvas.test.view_raw_data",
  "canvas.test.pin_data",
  "canvas.test.create_fixture",
  "canvas.test.edit_fixture",
  "canvas.test.use_real_ai",
  "canvas.test.use_real_documents",
  "canvas.debug",
  "canvas.open_advanced_builder",
  "canvas.ai.use",
  "canvas.ai.explain",
  "canvas.ai.propose_patch",
  "canvas.ai.apply_patch",
  "canvas.ai.configure_step",
  "canvas.ai.fix_validation",
  "canvas.ai.debug_test",
  "canvas.ai.view_raw_context",
  "canvas.ai.use_sensitive_context",
  "canvas.ai.admin_diagnostics",
];
