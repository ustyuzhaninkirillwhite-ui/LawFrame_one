import type {
  BindingValidationState,
  CanvasDataClassification,
  CanvasDataSourceCandidate,
  DataSource,
  DataSourceKind,
  LexFrameDataType,
  StepInputBinding,
  ValidationIssue,
  WorkflowDataField,
  WorkflowHandle,
  WorkflowNode,
} from '@lexframe/contracts';
import { createHash, randomUUID } from 'node:crypto';

export function normalizeDataField(
  value: unknown,
  fallback: Partial<WorkflowDataField> = {},
): WorkflowDataField | null {
  if (!isRecord(value)) {
    return null;
  }
  const key =
    stringValue(value.key) ??
    stringValue(value.code) ??
    stringValue(value.inputId) ??
    stringValue(value.outputId) ??
    fallback.key;
  if (!key) {
    return null;
  }
  const dataType = normalizeDataType(
    stringValue(value.data_type) ??
      stringValue(value.dataType) ??
      stringValue(value.type) ??
      fallback.data_type ??
      fallback.type ??
      'unknown',
  );

  return {
    key,
    label: stringValue(value.label) ?? fallback.label ?? key,
    description: stringValue(value.description) ?? fallback.description ?? null,
    data_type: dataType,
    type: dataType,
    item_schema: isRecord(value.item_schema)
      ? value.item_schema
      : isRecord(value.itemSchema)
        ? value.itemSchema
        : fallback.item_schema,
    required:
      typeof value.required === 'boolean'
        ? value.required
        : (fallback.required ?? false),
    nullable:
      typeof value.nullable === 'boolean' ? value.nullable : fallback.nullable,
    cardinality: cardinalityValue(value.cardinality) ?? fallback.cardinality,
    classification:
      normalizeClassification(
        stringValue(value.classification) ??
          stringValue(value.dataClass) ??
          String(fallback.classification ?? ''),
      ) ?? 'workspace_internal',
    source: isRecord(value.source)
      ? (value.source as unknown as WorkflowDataField['source'])
      : (stringValue(value.source) ?? fallback.source ?? null),
    options: stringArray(value.options) ?? fallback.options,
    allowed_sources:
      (stringArray(value.allowed_sources) as DataSourceKind[] | null) ??
      (stringArray(value.allowedSources) as DataSourceKind[] | null) ??
      (fallback.allowed_sources as DataSourceKind[] | undefined) ??
      (fallback.allowedSources as DataSourceKind[] | undefined),
    allowedSources:
      stringArray(value.allowedSources) ??
      stringArray(value.allowed_sources) ??
      fallback.allowedSources,
    allowed_classifications:
      (stringArray(value.allowed_classifications) as
        | readonly CanvasDataClassification[]
        | undefined) ??
      fallback.allowed_classifications ??
      [],
    default_value: Object.prototype.hasOwnProperty.call(value, 'default_value')
      ? value.default_value
      : fallback.default_value,
    default_source: isRecord(value.default_source)
      ? (value.default_source as unknown as WorkflowDataField['default_source'])
      : fallback.default_source,
    ui: isRecord(value.ui)
      ? (value.ui as unknown as WorkflowDataField['ui'])
      : fallback.ui,
    validation: isRecord(value.validation)
      ? (value.validation as unknown as WorkflowDataField['validation'])
      : fallback.validation,
    visibility:
      value.visibility === 'advanced' || value.visibility === 'admin'
        ? value.visibility
        : (fallback.visibility ?? 'basic'),
    is_template_parameter:
      typeof value.is_template_parameter === 'boolean'
        ? value.is_template_parameter
        : fallback.is_template_parameter,
    is_runtime_parameter:
      typeof value.is_runtime_parameter === 'boolean'
        ? value.is_runtime_parameter
        : fallback.is_runtime_parameter,
    preview_policy:
      previewPolicy(value.preview_policy) ?? fallback.preview_policy,
    delivery_allowed:
      typeof value.delivery_allowed === 'boolean'
        ? value.delivery_allowed
        : fallback.delivery_allowed,
    requires_approval_before_delivery:
      typeof value.requires_approval_before_delivery === 'boolean'
        ? value.requires_approval_before_delivery
        : fallback.requires_approval_before_delivery,
    advanced:
      typeof value.advanced === 'boolean' ? value.advanced : fallback.advanced,
  };
}

export function normalizeBinding(
  value: unknown,
  fallbackTarget?: { readonly nodeId: string; readonly inputKey: string },
): StepInputBinding | null {
  if (!isRecord(value)) {
    return null;
  }
  const target = isRecord(value.target) ? value.target : {};
  const targetNodeId =
    stringValue(target.node_id) ??
    stringValue(value.targetNodeId) ??
    stringValue(value.target_node_id) ??
    fallbackTarget?.nodeId;
  const targetInputKey =
    stringValue(target.input_key) ??
    stringValue(value.targetInputKey) ??
    stringValue(value.target_input_key) ??
    fallbackTarget?.inputKey;
  const source = normalizeDataSource(value.source);
  if (!targetNodeId || !targetInputKey || !source) {
    return null;
  }
  const id =
    stringValue(value.id) ??
    stableBindingId(targetNodeId, targetInputKey, source);
  const validationState =
    bindingValidationState(value.validation_state) ?? 'valid';

  return {
    id,
    target: {
      node_id: targetNodeId,
      input_key: targetInputKey,
    },
    targetNodeId,
    targetInputKey,
    source,
    selection: isRecord(value.selection)
      ? (value.selection as StepInputBinding['selection'])
      : undefined,
    transform: isRecord(value.transform)
      ? (value.transform as unknown as StepInputBinding['transform'])
      : undefined,
    validation_state: validationState,
    created_by:
      value.created_by === 'ai_assistant' || value.created_by === 'system'
        ? value.created_by
        : 'user',
    created_at: stringValue(value.created_at) ?? new Date().toISOString(),
  };
}

export function normalizeDataSource(value: unknown): DataSource | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  if (value.type === 'workflow_input') {
    const inputKey =
      stringValue(value.input_key) ?? stringValue(value.inputKey);
    return inputKey ? { type: 'workflow_input', input_key: inputKey } : null;
  }

  if (value.type === 'step_output') {
    const nodeId =
      stringValue(value.node_id) ?? stringValue(value.sourceNodeId);
    const outputKey =
      stringValue(value.output_key) ?? stringValue(value.outputKey);
    return nodeId && outputKey
      ? {
          type: 'step_output',
          node_id: nodeId,
          output_key: outputKey,
          path: stringValue(value.path) ?? undefined,
        }
      : null;
  }

  if (value.type === 'document') {
    const documentId =
      stringValue(value.document_id) ?? stringValue(value.documentId);
    return documentId
      ? {
          type: 'document',
          document_id: documentId,
          document_version_id:
            stringValue(value.document_version_id) ??
            stringValue(value.documentVersionId) ??
            undefined,
          workspace_id:
            stringValue(value.workspace_id) ??
            stringValue(value.workspaceId) ??
            undefined,
          access_mode:
            value.access_mode === 'runtime_scoped_token'
              ? 'runtime_scoped_token'
              : 'reference_only',
        }
      : null;
  }

  if (value.type === 'profile' || value.type === 'profile_snapshot') {
    return {
      type: 'profile',
      profile_id:
        stringValue(value.profile_id) ??
        stringValue(value.profileSnapshotId) ??
        stringValue(value.profile_snapshot_id) ??
        undefined,
    };
  }

  if (value.type === 'template') {
    const templateId = stringValue(value.template_id);
    return templateId ? { type: 'template', template_id: templateId } : null;
  }

  if (value.type === 'literal' || value.type === 'manual_value') {
    return { type: 'manual_value', value: value.value };
  }

  if (value.type === 'system_value') {
    const key = stringValue(value.key);
    return key ? { type: 'system_value', key } : null;
  }

  if (value.type === 'connection') {
    const connectionId = stringValue(value.connection_id);
    return connectionId
      ? {
          type: 'connection',
          connection_id: connectionId,
          display_name: stringValue(value.display_name) ?? undefined,
        }
      : null;
  }

  if (value.type === 'secret_ref') {
    const secretRef = stringValue(value.secret_ref);
    return secretRef
      ? {
          type: 'secret_ref',
          secret_ref: secretRef,
          display_name: stringValue(value.display_name) ?? undefined,
        }
      : null;
  }

  if (value.type === 'expression') {
    const expression = stringValue(value.expression);
    return expression
      ? {
          type: 'expression',
          expression_language: 'lexframe_expression_v1',
          expression,
        }
      : null;
  }

  if (value.type === 'transform') {
    const source = normalizeDataSource(value.source);
    const transformType = stringValue(value.transform_type);
    return source && transformType
      ? {
          type: 'transform',
          transform_type: transformType,
          source,
          config: isRecord(value.config) ? value.config : undefined,
        }
      : null;
  }

  return null;
}

export function bindingTargetNodeId(binding: StepInputBinding) {
  return binding.target?.node_id ?? binding.targetNodeId ?? null;
}

export function bindingTargetInputKey(binding: StepInputBinding) {
  return binding.target?.input_key ?? binding.targetInputKey ?? null;
}

export function bindingId(binding: StepInputBinding) {
  return (
    binding.id ??
    stableBindingId(
      bindingTargetNodeId(binding) ?? 'unknown_node',
      bindingTargetInputKey(binding) ?? 'unknown_input',
      binding.source,
    )
  );
}

export function normalizeDataType(value: unknown): LexFrameDataType {
  const raw = typeof value === 'string' && value.length > 0 ? value : 'unknown';
  switch (raw) {
    case 'document':
      return 'document_ref';
    case 'document[]':
      return 'document_ref[]';
    case 'profile':
    case 'profile_snapshot':
      return 'profile_ref';
    case 'template':
      return 'template_ref';
    case 'facts':
      return 'case_fact_set';
    default:
      return raw as LexFrameDataType;
  }
}

export function fieldDataType(field: WorkflowDataField | undefined | null) {
  return normalizeDataType(field?.data_type ?? field?.type ?? 'unknown');
}

export function fieldClassification(
  field: WorkflowDataField | undefined | null,
) {
  return (
    normalizeClassification(String(field?.classification ?? '')) ??
    'workspace_internal'
  );
}

export function normalizeClassification(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  if (value === 'internal') {
    return 'workspace_internal';
  }
  return value as CanvasDataClassification;
}

export function compatibility(
  sourceType: LexFrameDataType,
  targetType: LexFrameDataType,
): {
  readonly status: 'valid' | 'warning' | 'invalid';
  readonly reason: string | null;
  readonly suggested_transform: string | null;
} {
  const source = normalizeDataType(sourceType);
  const target = normalizeDataType(targetType);
  if (typeof targetType === 'string' && targetType.includes('|')) {
    const optionResults = targetType
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => compatibility(source, part as LexFrameDataType));
    const valid = optionResults.find((result) => result.status === 'valid');
    if (valid) {
      return valid;
    }
    const warning = optionResults.find((result) => result.status === 'warning');
    if (warning) {
      return warning;
    }
  }
  if (source === target || target === 'json' || target === 'unknown') {
    return {
      status: 'valid' as const,
      reason: null,
      suggested_transform: null,
    };
  }
  if (source === 'document_draft' && target === 'document_ref') {
    return {
      status: 'valid' as const,
      reason: null,
      suggested_transform: null,
    };
  }
  if (source === 'secret_ref' && target === 'string') {
    return {
      status: 'invalid' as const,
      reason: 'Secret references cannot be exposed as visible strings.',
      suggested_transform: null,
    };
  }
  if (source === 'document_ref' && target === 'document_ref[]') {
    return {
      status: 'warning' as const,
      reason: 'Single document can be wrapped into an array.',
      suggested_transform: 'wrap_array',
    };
  }
  if (source === 'document_ref[]' && target === 'document_ref') {
    return {
      status: 'invalid' as const,
      reason: 'Select one document or add a selection strategy.',
      suggested_transform: 'pick_one',
    };
  }
  if (source === 'money' && target === 'string') {
    return {
      status: 'warning' as const,
      reason: 'Money values need explicit formatting.',
      suggested_transform: 'format_money',
    };
  }
  if (source === 'number' && target === 'money') {
    return {
      status: 'warning' as const,
      reason: 'Currency must be specified.',
      suggested_transform: 'format_money',
    };
  }
  if (source === 'legal_source_ref[]' && target === 'citation_set') {
    return {
      status: 'warning' as const,
      reason: 'Legal sources should be transformed into citations.',
      suggested_transform: 'legal_sources_to_citation_summary',
    };
  }
  if (
    (source === 'case_fact_set' || source === 'fact_set') &&
    target === 'string'
  ) {
    return {
      status: 'warning' as const,
      reason: 'Fact sets need a summary or extract transform.',
      suggested_transform: 'extract_field',
    };
  }
  if (
    (source === 'generated_document' ||
      source === 'draft_document' ||
      source === 'document_ref') &&
    target === 'email_attachment[]'
  ) {
    return {
      status: 'valid' as const,
      reason: null,
      suggested_transform: null,
    };
  }
  return {
    status: 'invalid' as const,
    reason: `Source ${source} is not compatible with target ${target}.`,
    suggested_transform: null,
  };
}

export function sourceLabel(
  source: DataSource,
  nodesById: Map<string, WorkflowNode>,
  workflowInputs: readonly WorkflowDataField[],
) {
  if (source.type === 'workflow_input') {
    const field = workflowInputs.find((item) => item.key === source.input_key);
    return `Workflow input / ${field?.label ?? source.input_key}`;
  }
  if (source.type === 'step_output') {
    const node = nodesById.get(source.node_id);
    const output = node?.outputs.find((item) => item.key === source.output_key);
    return `${node?.display_name ?? source.node_id} / ${output?.label ?? source.output_key}`;
  }
  if (source.type === 'document') {
    return `Document / ${source.document_id}`;
  }
  if (source.type === 'profile' || source.type === 'profile_snapshot') {
    return 'Legal profile';
  }
  if (source.type === 'template') {
    return `Template / ${source.template_id}`;
  }
  if (source.type === 'secret_ref') {
    return source.display_name ?? 'Secret reference';
  }
  if (source.type === 'connection') {
    return source.display_name ?? 'Connection';
  }
  if (source.type === 'system_value') {
    return `System / ${source.key}`;
  }
  if (source.type === 'expression') {
    return 'Advanced expression';
  }
  if (source.type === 'transform') {
    return `Transform / ${source.transform_type}`;
  }
  return 'Manual value';
}

export function dataSourceType(
  source: DataSource,
  workflowInputs: readonly WorkflowDataField[],
  nodesById: Map<string, WorkflowNode>,
) {
  if (source.type === 'workflow_input') {
    return fieldDataType(
      workflowInputs.find((field) => field.key === source.input_key),
    );
  }
  if (source.type === 'step_output') {
    return fieldDataType(
      nodesById
        .get(source.node_id)
        ?.outputs.find((field) => field.key === source.output_key),
    );
  }
  if (source.type === 'document') {
    return 'document_ref';
  }
  if (source.type === 'profile' || source.type === 'profile_snapshot') {
    return 'profile_ref';
  }
  if (source.type === 'template') {
    return 'template_ref';
  }
  if (source.type === 'connection') {
    return 'connection_ref';
  }
  if (source.type === 'secret_ref') {
    return 'secret_ref';
  }
  return 'string';
}

export function dataSourceClassification(
  source: DataSource,
  workflowInputs: readonly WorkflowDataField[],
  nodesById: Map<string, WorkflowNode>,
) {
  if (source.type === 'workflow_input') {
    return fieldClassification(
      workflowInputs.find((field) => field.key === source.input_key),
    );
  }
  if (source.type === 'step_output') {
    return fieldClassification(
      nodesById
        .get(source.node_id)
        ?.outputs.find((field) => field.key === source.output_key),
    );
  }
  if (source.type === 'secret_ref') {
    return 'secret';
  }
  return 'workspace_internal';
}

export function makeCandidate(input: {
  readonly source: DataSource;
  readonly target: WorkflowDataField;
  readonly nodesById: Map<string, WorkflowNode>;
  readonly workflowInputs: readonly WorkflowDataField[];
}): CanvasDataSourceCandidate {
  const dataType = dataSourceType(
    input.source,
    input.workflowInputs,
    input.nodesById,
  );
  const result = compatibility(dataType, fieldDataType(input.target));
  return {
    type: input.source.type,
    source: input.source,
    label: sourceLabel(input.source, input.nodesById, input.workflowInputs),
    data_type: dataType,
    classification: dataSourceClassification(
      input.source,
      input.workflowInputs,
      input.nodesById,
    ),
    compatibility: result.status,
    reason: result.reason,
    suggested_transform: result.suggested_transform,
    preview: safePreviewForSource(input.source),
  };
}

export function safePreviewForSource(source: DataSource) {
  if (source.type === 'secret_ref') {
    return { display_name: source.display_name ?? 'Secret reference' };
  }
  if (source.type === 'document') {
    return {
      document_id: source.document_id,
      document_version_id: source.document_version_id ?? null,
      access_mode: source.access_mode ?? 'reference_only',
    };
  }
  if (source.type === 'expression') {
    return { expression_language: source.expression_language };
  }
  return null;
}

export function handlesWithDataPorts(
  handles: readonly WorkflowHandle[],
  inputs: readonly WorkflowDataField[],
  outputs: readonly WorkflowDataField[],
) {
  const existing = new Set(handles.map((handle) => handle.code));
  const dataInputHandles = inputs
    .map(
      (field): WorkflowHandle => ({
        code: `data:input:${field.key}`,
        label: field.label,
        direction: 'input',
        kind: 'data_in',
        edge_types: ['data_flow'],
        data_type: fieldDataType(field),
        data_field_key: field.key,
      }),
    )
    .filter((handle) => !existing.has(handle.code));
  const dataOutputHandles = outputs
    .map(
      (field): WorkflowHandle => ({
        code: `data:output:${field.key}`,
        label: field.label,
        direction: 'output',
        kind: 'data_out',
        edge_types: ['data_flow'],
        data_type: fieldDataType(field),
        data_field_key: field.key,
      }),
    )
    .filter((handle) => !existing.has(handle.code));
  return [...handles, ...dataInputHandles, ...dataOutputHandles];
}

export function issueId(
  scope: ValidationIssue['scope'],
  code: string,
  id: string,
) {
  return `${scope}:${code}:${id}`;
}

export function stableBindingId(
  targetNodeId: string,
  targetInputKey: string,
  source: DataSource,
) {
  const hash = createHash('sha1')
    .update(JSON.stringify({ targetNodeId, targetInputKey, source }))
    .digest('hex')
    .slice(0, 12);
  return `bind_${hash}`;
}

export function newBindingId() {
  return `bind_${randomUUID()}`;
}

export function bindingValidationState(
  value: unknown,
): BindingValidationState | null {
  return value === 'valid' ||
    value === 'warning' ||
    value === 'invalid' ||
    value === 'stale' ||
    value === 'policy_blocked'
    ? value
    : null;
}

function cardinalityValue(value: unknown) {
  return value === 'one' || value === 'many' || value === 'zero_or_one'
    ? value
    : null;
}

function previewPolicy(value: unknown) {
  return value === 'full' ||
    value === 'summary' ||
    value === 'metadata_only' ||
    value === 'redacted' ||
    value === 'hidden'
    ? value
    : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
