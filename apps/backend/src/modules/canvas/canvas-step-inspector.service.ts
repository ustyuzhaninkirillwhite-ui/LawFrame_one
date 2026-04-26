import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type {
  AvailableDataSourcesDto,
  CanvasDataSourceCandidate,
  CanvasSourcesResponse,
  DataSourceKind,
  LexFrameWorkflowV2,
  StepConnectionRequirementDto,
  StepErrorPolicy,
  StepErrorPolicyMode,
  StepInputBinding,
  StepInputViewModel,
  StepInspectorDto,
  StepInspectorPermissionsDto,
  StepInspectorTab,
  StepSettingsFieldDto,
  StepSettingsFormDto,
  StepTestRequest,
  StepTestResultDto,
  ValidationIssue,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { findCanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import {
  bindingTargetInputKey,
  fieldClassification,
  fieldDataType,
} from './canvas-io-utils';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasIoService } from './canvas-io.service';
import { CanvasValidationService } from './canvas-validation.service';
import { ConnectionRequirementsService } from './connection-requirements.service';

interface CanvasOperationHistoryRow {
  readonly id: string;
  readonly actor_id: string | null;
  readonly operation_type: string;
  readonly operation_payload: Record<string, unknown>;
  readonly rejected: boolean;
  readonly rejected_reason: string | null;
  readonly created_at: string;
}

@Injectable()
export class CanvasStepInspectorService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly validationService: CanvasValidationService,
    private readonly ioService: CanvasIoService,
    private readonly connectionRequirementsService: ConnectionRequirementsService,
    private readonly auditService: AuditService,
  ) {}

  async getInspector(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
  ): Promise<StepInspectorDto> {
    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const workflow = draft.workflow;
    const node = workflow.nodes.find((item) => item.id === nodeId);

    if (!node) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas node was not found.',
      );
    }

    const validation = this.validationService.validateWorkflow(workflow);
    const nodeIssues = validation.issues.filter(
      (issue) => issue.affected_node_id === node.id,
    );
    const block = findCanvasBlockDefinition(node.block_code);
    const permissions = buildInspectorPermissions(access);
    const dataSources = await this.buildDataSources({
      actor,
      access,
      automationId,
      node,
      workflow,
    });
    const history = await this.getHistory(access, automationId, node.id);
    const connections = this.connectionRequirementsService
      .listRequirements({
        access,
        moduleCode: node.module_code ?? node.block_code,
      })
      .requirements.map<StepConnectionRequirementDto>((requirement) => ({
        ...requirement,
        can_test: permissions.can_test_step,
        owner_label: null,
        last_checked_at: null,
      }));

    return {
      node: {
        id: node.id,
        type: node.type,
        block_code: node.block_code,
        display_name: node.display_name,
        description: node.description ?? block?.shortDescription ?? null,
        module_code: node.module_code ?? block?.moduleCode ?? node.block_code,
        module_version: node.module_version ?? null,
        module_schema_hash: node.module_schema_hash ?? null,
        category: block?.category ?? null,
        icon: block?.uiSchema.icon ?? null,
        lifecycle_status: node.lifecycle?.status ?? null,
      },
      overview: {
        title: node.display_name,
        description:
          node.description ??
          block?.longDescription ??
          block?.shortDescription ??
          'Canvas step',
        module_code: node.module_code ?? block?.moduleCode ?? node.block_code,
        module_version: node.module_version ?? null,
        category_label: block?.uiSchema.paletteCategory ?? null,
        needs:
          block?.uiSchema.card.needs ?? node.inputs.map((input) => input.label),
        creates:
          block?.uiSchema.card.creates ??
          node.outputs.map((output) => output.label),
        badges: [
          ...(block?.uiSchema.card.badges ?? []),
          ...(node.policy.ai_action ? ['ai'] : []),
          ...(node.policy.external_action ? ['external'] : []),
          ...(node.policy.approval_required ? ['approval_required'] : []),
        ],
        risk_level: node.policy.risk_level ?? block?.policies.riskLevel ?? null,
        data_classification:
          node.policy.data_classification ??
          block?.policies.dataClassification ??
          null,
        uses_ai:
          Boolean(node.policy.ai_action) ||
          block?.policies.canUseAi === true ||
          node.runtime_mapping.provider === 'ai_gateway',
        external_action:
          Boolean(node.policy.external_action) ||
          block?.policies.isExternalAction === true,
        approval_required:
          Boolean(node.policy.approval_required) ||
          block?.policies.requiresApproval === true,
        runtime_provider:
          node.runtime_mapping.provider ?? block?.runtime.provider ?? null,
      },
      inputs: buildInputViewModels(node, nodeIssues, dataSources.by_input_key),
      settings_form: buildSettingsForm(node, nodeIssues, block),
      data_sources: dataSources,
      connections,
      outputs: node.outputs,
      error_policy: parseErrorPolicy(node.config.error_policy),
      policy_summary: {
        risk_level: node.policy.risk_level ?? block?.policies.riskLevel ?? null,
        data_classification:
          node.policy.data_classification ??
          block?.policies.dataClassification ??
          null,
        approval_required:
          Boolean(node.policy.approval_required) ||
          block?.policies.requiresApproval === true,
        external_action:
          Boolean(node.policy.external_action) ||
          block?.policies.isExternalAction === true,
        uses_ai:
          Boolean(node.policy.ai_action) ||
          block?.policies.canUseAi === true ||
          node.runtime_mapping.provider === 'ai_gateway',
        can_run_in_dry_run:
          node.policy.can_run_in_dry_run ??
          block?.policies.canRunInDryRun ??
          false,
        raw_output_visibility: node.policy.raw_output_visibility ?? null,
        required_permissions:
          node.policy.required_permissions ??
          block?.policies.requiredPermissions ??
          [],
        warnings: nodeIssues.filter(
          (issue) =>
            issue.severity === 'warning' || issue.severity === 'policy_block',
        ),
      },
      test_state: {
        sample_data_status: node.test_state?.sample_data_status ?? 'missing',
        last_tested_at: node.test_state?.last_tested_at ?? null,
        pinned_output_id: node.test_state?.pinned_output_id ?? null,
        supports_step_test:
          node.runtime_mapping.supports_step_test ??
          block?.runtime.supportsStepTest ??
          false,
        supports_partial_execution:
          node.runtime_mapping.supports_partial_execution ??
          block?.runtime.supportsPartialExecution ??
          false,
        supports_pinned_data:
          node.runtime_mapping.supports_pinned_data ??
          block?.runtime.supportsPinnedData ??
          false,
        disabled_reason: testDisabledReason(node, nodeIssues, permissions),
      },
      history_summary: {
        events: history.map((row) => ({
          id: row.id,
          event_type: eventTypeForOperation(row.operation_type),
          operation_type: row.operation_type,
          actor_label: row.actor_id ? 'workspace user' : null,
          created_at: row.created_at,
          summary: summarizeOperation(row),
          rejected: row.rejected,
          rejected_reason: row.rejected_reason,
        })),
        total_count: history.length,
      },
      permissions,
      validation,
      tabs: tabsForNode(node, permissions),
    };
  }

  async listDataSources(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    inputKey: string,
  ): Promise<CanvasSourcesResponse> {
    return this.ioService.listSources(
      actor,
      access,
      automationId,
      nodeId,
      inputKey,
    );
  }

  async testNode(
    actor: AuthenticatedActor,
    access: AccessContext,
    automationId: string,
    nodeId: string,
    request: StepTestRequest,
  ): Promise<StepTestResultDto> {
    const permissions = buildInspectorPermissions(access);
    if (!permissions.can_test_step) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Canvas step test permission is required.',
      );
    }

    const draft = await this.draftService.ensureDraft(
      actor,
      access,
      automationId,
    );
    const node = draft.workflow.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw new AppHttpException(
        'VALIDATION_ERROR',
        404,
        'Canvas node was not found.',
      );
    }

    const startedAt = new Date().toISOString();
    const validation = this.validationService.runtimeGateValidate(
      draft.workflow,
    );
    const issues = validation.issues.filter(
      (issue) =>
        issue.affected_node_id === node.id ||
        issue.blocks?.includes('test_step'),
    );
    const disabledReason =
      testDisabledReason(node, issues, permissions) ??
      (!validation.can_test ? 'Runtime validation blocks step testing.' : null);
    const blocked = Boolean(disabledReason);
    const testRunId = randomUUID();

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.step.test.started',
      entityType: 'installed_automation',
      entityId: automationId,
      result: blocked ? 'error' : 'success',
      metadata: {
        nodeId: node.id,
        mode: request.mode,
        sampleDataMode: request.sample_data_mode,
        testRunId,
      },
    });

    const completedAt = new Date().toISOString();
    const result: StepTestResultDto = {
      test_run_id: testRunId,
      node_id: node.id,
      status: blocked ? 'blocked' : 'passed',
      mode: request.mode,
      sample_data_mode: request.sample_data_mode,
      started_at: startedAt,
      completed_at: completedAt,
      redacted_output: blocked ? null : redactedOutputPreview(node),
      preview: blocked
        ? null
        : {
            node_id: node.id,
            output_count: node.outputs.length,
            runtime_provider:
              node.runtime_mapping.provider ?? 'internal_worker',
          },
      issues,
      disabled_reason: disabledReason,
    };

    await this.auditService.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      workspaceId: access.activeWorkspace?.id ?? null,
      action: 'canvas.step.test.completed',
      entityType: 'installed_automation',
      entityId: automationId,
      result: result.status === 'passed' ? 'success' : 'error',
      metadata: {
        nodeId: node.id,
        status: result.status,
        testRunId,
      },
    });

    return result;
  }

  private async buildDataSources(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly node: WorkflowNode;
    readonly workflow: LexFrameWorkflowV2;
  }): Promise<AvailableDataSourcesDto> {
    const entries = await Promise.all(
      input.node.inputs.map(async (field) => {
        try {
          return [
            field.key,
            await this.ioService.listSources(
              input.actor,
              input.access,
              input.automationId,
              input.node.id,
              field.key,
            ),
          ] as const;
        } catch {
          return [
            field.key,
            { compatible_sources: [], incompatible_sources: [] },
          ] as const;
        }
      }),
    );
    const byInputKey = Object.fromEntries(entries);
    const allCandidates = uniqueCandidates(
      entries.flatMap(([, sources]) => [
        ...sources.compatible_sources,
        ...sources.incompatible_sources,
      ]),
    );

    return {
      workflow_inputs: allCandidates.filter(
        (candidate) => candidate.source.type === 'workflow_input',
      ),
      previous_steps: groupStepOutputs(allCandidates, input.workflow),
      documents: allCandidates.filter(
        (candidate) => candidate.source.type === 'document',
      ),
      profiles: allCandidates.filter(
        (candidate) =>
          candidate.source.type === 'profile' ||
          candidate.source.type === 'profile_snapshot',
      ),
      templates: allCandidates.filter(
        (candidate) => candidate.source.type === 'template',
      ),
      system_values: allCandidates.filter(
        (candidate) => candidate.source.type === 'system_value',
      ),
      by_input_key: byInputKey,
    };
  }

  private async getHistory(
    access: AccessContext,
    automationId: string,
    nodeId: string,
  ): Promise<readonly CanvasOperationHistoryRow[]> {
    const workspaceId = requireWorkspaceId(access);
    const result = await this.databaseService.query<CanvasOperationHistoryRow>(
      `
        select
          id,
          actor_id,
          operation_type,
          operation_payload,
          rejected,
          rejected_reason,
          created_at
        from app.automation_canvas_operations
        where workspace_id = $1
          and installed_automation_id = $2
          and (
            operation_payload ->> 'node_id' = $3
            or operation_payload -> 'node' ->> 'id' = $3
            or operation_payload -> 'binding' -> 'target' ->> 'node_id' = $3
            or operation_payload -> 'binding' ->> 'targetNodeId' = $3
          )
        order by created_at desc
        limit 20
      `,
      [workspaceId, automationId, nodeId],
    );

    return result.rows;
  }
}

function buildInspectorPermissions(
  access: AccessContext,
): StepInspectorPermissionsDto {
  const permissions = new Set(access.permissions);
  const canEdit = permissions.has('canvas.edit');
  const canDebug = permissions.has('canvas.debug');
  const canViewRawTestData =
    permissions.has('canvas.test.view_raw_data') || canDebug;

  return {
    can_view: permissions.has('canvas.view'),
    can_edit_display_name: canEdit,
    can_edit_config: canEdit,
    can_edit_bindings: canEdit,
    can_test_step:
      permissions.has('canvas.test.step') ||
      (canEdit && permissions.has('automation.run')),
    can_view_raw_data: canViewRawTestData,
    can_pin_data:
      permissions.has('canvas.test.pin_data') || (canEdit && canDebug),
    can_edit_error_policy: canEdit,
    can_edit_security_policy:
      canEdit &&
      (access.roles.includes('admin') ||
        access.roles.includes('security_admin')),
    can_delete_step: canEdit,
    can_open_advanced_mapping:
      permissions.has('canvas.open_advanced_builder') ||
      permissions.has('canvas.debug'),
  };
}

function buildInputViewModels(
  node: WorkflowNode,
  nodeIssues: readonly ValidationIssue[],
  dataSources: Record<string, CanvasSourcesResponse>,
): readonly StepInputViewModel[] {
  return node.inputs.map((input) => {
    const binding = (node.input_bindings ?? []).find(
      (item) => bindingTargetInputKey(item) === input.key,
    );
    const issues = nodeIssues.filter(
      (issue) =>
        issue.affected_input_key === input.key || issue.scope === 'binding',
    );
    const sources = dataSources[input.key] ?? {
      compatible_sources: [],
      incompatible_sources: [],
    };

    return {
      input,
      binding: binding ?? null,
      status: resolveInputState(input, binding, issues),
      issues,
      compatible_sources_count: sources.compatible_sources.length,
      incompatible_sources_count: sources.incompatible_sources.length,
      allowed_sources: normalizeAllowedSources(input.allowed_sources),
    };
  });
}

function buildSettingsForm(
  node: WorkflowNode,
  nodeIssues: readonly ValidationIssue[],
  block: ReturnType<typeof findCanvasBlockDefinition>,
): StepSettingsFormDto {
  const schema = block?.configSchema;
  const properties = isRecord(schema?.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema?.required)
      ? schema.required.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
  );
  const schemaFields = Object.entries(properties)
    .filter(([key]) => !isSensitiveKey(key))
    .map(([key, fieldSchema]) =>
      settingFieldFromSchema({
        key,
        schema: isRecord(fieldSchema) ? fieldSchema : {},
        value: sanitizedValue(key, node.config[key]),
        required: required.has(key),
      }),
    );
  const configOnlyFields = Object.keys(node.config)
    .filter(
      (key) =>
        key !== 'error_policy' &&
        !isSensitiveKey(key) &&
        !schemaFields.some((field) => field.key === key),
    )
    .map<StepSettingsFieldDto>((key) => ({
      key,
      label: humanizeKey(key),
      control: controlForValue(node.config[key]),
      data_type: dataTypeForValue(node.config[key]),
      required: false,
      value: sanitizedValue(key, node.config[key]),
      visibility: 'advanced',
    }));

  return {
    node_id: node.id,
    module_code: node.module_code ?? block?.moduleCode ?? node.block_code,
    module_version: node.module_version ?? null,
    schema_version: node.module_schema_hash ?? 'static',
    fields: [...schemaFields, ...configOnlyFields],
    values: sanitizeConfig(node.config),
    ui_schema: block?.uiSchema ? { ...block.uiSchema } : null,
    validation_issues: nodeIssues.filter(
      (issue) => issue.scope === 'node' || issue.scope === 'runtime',
    ),
  };
}

function settingFieldFromSchema(input: {
  readonly key: string;
  readonly schema: Record<string, unknown>;
  readonly value: unknown;
  readonly required: boolean;
}): StepSettingsFieldDto {
  const enumValues = Array.isArray(input.schema.enum)
    ? input.schema.enum.filter(
        (item): item is string => typeof item === 'string',
      )
    : typeof input.schema.const === 'string'
      ? [input.schema.const]
      : undefined;
  const type =
    typeof input.schema.type === 'string' ? input.schema.type : 'string';

  return {
    key: input.key,
    label: humanizeKey(input.key),
    control: enumValues ? 'select' : controlForSchemaType(type),
    data_type: type,
    required: input.required,
    value: input.value,
    default_value: input.schema.default,
    options: enumValues,
    help_text:
      typeof input.schema.description === 'string'
        ? input.schema.description
        : null,
    visibility: 'basic',
    readonly: typeof input.schema.const !== 'undefined',
  };
}

function resolveInputState(
  input: WorkflowDataField,
  binding: StepInputBinding | undefined,
  issues: readonly ValidationIssue[],
): StepInputViewModel['status'] {
  if (issues.some((issue) => issue.severity === 'policy_block')) {
    return 'blocked_by_policy';
  }
  if (issues.some((issue) => issue.code.includes('permission'))) {
    return 'requires_permission';
  }
  if (issues.some((issue) => issue.code.includes('connection'))) {
    return 'requires_connection';
  }
  if (issues.some((issue) => issue.code.includes('stale'))) {
    return 'configured_but_stale';
  }
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'configured_but_invalid';
  }
  if (!binding && input.required) {
    return 'missing_required';
  }
  if (!binding) {
    return 'configured';
  }
  if (
    binding.source.type === 'manual_value' ||
    binding.source.type === 'literal'
  ) {
    return 'manual_value';
  }
  if (binding.created_by === 'template' || binding.created_by === 'system') {
    return 'auto_mapped';
  }
  return 'configured';
}

function parseErrorPolicy(value: unknown): StepErrorPolicy {
  if (!isRecord(value)) {
    return { mode: 'fail_workflow' };
  }
  const mode = parseErrorPolicyMode(value.mode);
  return {
    mode,
    retry_count:
      typeof value.retry_count === 'number'
        ? value.retry_count
        : typeof value.retryCount === 'number'
          ? value.retryCount
          : null,
    retry_delay_seconds:
      typeof value.retry_delay_seconds === 'number'
        ? value.retry_delay_seconds
        : typeof value.retryDelaySeconds === 'number'
          ? value.retryDelaySeconds
          : null,
    error_branch_node_id:
      typeof value.error_branch_node_id === 'string'
        ? value.error_branch_node_id
        : null,
    notify_role:
      typeof value.notify_role === 'string' ? value.notify_role : null,
    create_manual_task:
      typeof value.create_manual_task === 'boolean'
        ? value.create_manual_task
        : undefined,
  };
}

function parseErrorPolicyMode(value: unknown): StepErrorPolicyMode {
  switch (value) {
    case 'go_to_error_branch':
    case 'retry_then_fail':
    case 'create_manual_task':
    case 'skip_if_optional':
      return value;
    default:
      return 'fail_workflow';
  }
}

function testDisabledReason(
  node: WorkflowNode,
  issues: readonly ValidationIssue[],
  permissions: StepInspectorPermissionsDto,
) {
  if (!permissions.can_test_step) {
    return 'User cannot test this step.';
  }
  if (node.runtime_mapping.supports_step_test === false) {
    return 'Runtime mapping does not support step testing.';
  }
  const blocker = issues.find(
    (issue) => issue.severity === 'error' || issue.severity === 'policy_block',
  );
  return blocker?.message ?? null;
}

function tabsForNode(
  node: WorkflowNode,
  permissions: StepInspectorPermissionsDto,
): readonly StepInspectorTab[] {
  const tabs: StepInspectorTab[] = [
    'overview',
    'inputs',
    'settings',
    'data',
    'test',
    'errors',
    'outputs',
  ];
  if (permissions.can_view_raw_data) {
    tabs.push('debug');
  }
  if (node.type === 'note' || node.type === 'group') {
    return permissions.can_view_raw_data
      ? ['overview', 'settings', 'errors', 'outputs', 'debug']
      : ['overview', 'settings', 'errors', 'outputs'];
  }
  return tabs;
}

function groupStepOutputs(
  candidates: readonly CanvasDataSourceCandidate[],
  workflow: LexFrameWorkflowV2,
) {
  const groups = new Map<string, CanvasDataSourceCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.source.type !== 'step_output') {
      continue;
    }
    const nodeId = candidate.source.node_id;
    groups.set(nodeId, [...(groups.get(nodeId) ?? []), candidate]);
  }
  return [...groups.entries()].map(([nodeId, outputs]) => {
    const node = workflow.nodes.find((item) => item.id === nodeId);
    return {
      node_id: nodeId,
      display_name: node?.display_name ?? nodeId,
      outputs,
    };
  });
}

function uniqueCandidates(candidates: readonly CanvasDataSourceCandidate[]) {
  const seen = new Set<string>();
  const result: CanvasDataSourceCandidate[] = [];
  for (const candidate of candidates) {
    const key = JSON.stringify(candidate.source);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(candidate);
    }
  }
  return result;
}

function normalizeAllowedSources(
  value: readonly DataSourceKind[] | undefined,
): readonly DataSourceKind[] {
  return value ?? [];
}

function redactedOutputPreview(node: WorkflowNode) {
  return Object.fromEntries(
    node.outputs.map((output) => [
      output.key,
      {
        label: output.label,
        data_type: fieldDataType(output),
        classification: fieldClassification(output),
        preview_policy: output.preview_policy ?? 'summary',
      },
    ]),
  );
}

function sanitizeConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([key]) => key !== 'error_policy' && !isSensitiveKey(key))
      .map(([key, value]) => [key, sanitizedValue(key, value)]),
  );
}

function sanitizedValue(key: string, value: unknown) {
  return isSensitiveKey(key) ? null : value;
}

function isSensitiveKey(key: string) {
  return /secret|token|api[_-]?key|password|private[_-]?key|signed[_-]?url|prompt|email[_-]?body/i.test(
    key,
  );
}

function controlForSchemaType(type: string): StepSettingsFieldDto['control'] {
  switch (type) {
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'checkbox';
    case 'array':
      return 'multi_select';
    case 'object':
      return 'json';
    default:
      return 'text';
  }
}

function controlForValue(value: unknown): StepSettingsFieldDto['control'] {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'checkbox';
  }
  if (Array.isArray(value) || isRecord(value)) {
    return 'json';
  }
  return 'text';
}

function dataTypeForValue(value: unknown) {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null || value === undefined) {
    return 'string';
  }
  return typeof value;
}

function humanizeKey(key: string) {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('en-US'));
}

function summarizeOperation(row: CanvasOperationHistoryRow) {
  if (row.rejected) {
    return `${row.operation_type} rejected`;
  }
  return `${row.operation_type} applied`;
}

function eventTypeForOperation(operationType: string) {
  if (operationType.includes('BINDING')) {
    return 'step.input.binding.changed';
  }
  if (operationType === 'UPDATE_NODE_CONFIG') {
    return 'step.config.updated';
  }
  if (operationType === 'UPDATE_NODE') {
    return 'step.updated';
  }
  if (operationType === 'DELETE_NODE') {
    return 'step.deleted';
  }
  return 'step.changed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
