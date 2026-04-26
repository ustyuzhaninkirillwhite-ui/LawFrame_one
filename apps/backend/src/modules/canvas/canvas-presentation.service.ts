import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type {
  CanvasDataSourceCandidate,
  CanvasModuleCard,
  CanvasPresentationModel,
  CanvasPresentationMode,
  CanvasPresentationPermissions,
  CanvasState,
  DataSource,
  DataSourceKind,
  LexFrameDataType,
  LexFrameWorkflowV2,
  NoCodeDataSourcePresentation,
  NoCodeInputPresentation,
  NoCodeNodeAction,
  NoCodeNodePresentation,
  NoCodeOutputPresentation,
  NoCodeSuggestion,
  NoCodeValidationMessage,
  RiskPresentation,
  StepInputBinding,
  ValidationIssue,
  WorkflowDataField,
  WorkflowNode,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';
import { findCanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { DatabaseService } from '../database/database.service';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasModuleCatalogService } from './canvas-module-catalog.service';

interface ModuleNoCodeLabelRow {
  readonly module_code: string;
  readonly locale: string;
  readonly title: string;
  readonly short_description: string;
  readonly long_description: string | null;
  readonly input_labels: Record<string, string> | null;
  readonly output_labels: Record<string, string> | null;
  readonly risk_explanation: string | null;
  readonly examples: unknown;
  readonly help_text: unknown;
}

interface PresentationContext {
  readonly mode: CanvasPresentationMode;
  readonly locale: string;
  readonly permissions: CanvasPresentationPermissions;
  readonly labels: ReadonlyMap<string, ModuleNoCodeLabelRow>;
}

const BASIC_FORBIDDEN_TERMS = [
  'сырые технические выражения',
  'названия модулей исполнения',
  'служебные ключи и роли',
  'внутренние коды модулей',
  'пути привязок данных',
  'черновая техническая модель',
  'ключи провайдеров',
] as const;

@Injectable()
export class CanvasPresentationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly draftService: CanvasDraftService,
    private readonly moduleCatalogService: CanvasModuleCatalogService,
  ) {}

  async getPresentation(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly requestedMode?: string | null;
    readonly locale?: string | null;
  }): Promise<CanvasPresentationModel> {
    const state = await this.draftService.getDraftResponse(
      input.actor,
      input.access,
      input.automationId,
    );
    const mode = resolveMode(input.requestedMode, input.access);
    const locale = normalizeLocale(input.locale);
    const labels = await this.loadNoCodeLabels(
      state.workflow.nodes.map((node) => node.block_code),
      locale,
    );
    const permissions = buildPresentationPermissions(input.access);
    const context: PresentationContext = {
      mode,
      locale,
      permissions,
      labels,
    };
    const catalog = await this.moduleCatalogService.getCatalog({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: state.workflow.draft_version_id,
      workflow: state.workflow,
      mode: 'suggestions',
    });

    return {
      workflow_id: state.workflow.id,
      automation_id: state.automation_id,
      draft_id: state.draft_id,
      mode,
      locale,
      nodes: state.workflow.nodes.map((node) =>
        toNodePresentation(state, node, context),
      ),
      edges: state.workflow.edges.map((edge) => ({
        edge_id: edge.id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
        label: edge.label ?? conditionLabel(edge.condition),
        plain_language_type: edgePlainType(edge.type),
        validation_state: edge.validation_state ?? 'valid',
        advanced:
          mode === 'developer'
            ? {
                source_handle: edge.source_handle,
                target_handle: edge.target_handle,
                edge_type: edge.type,
              }
            : null,
      })),
      validation: state.validation.issues.map((issue) =>
        this.toNoCodeValidationMessage(issue, state.workflow, mode),
      ),
      recommendations: buildSuggestions(
        state,
        catalog.modules,
        catalog.recommended,
        {
          includeOperations: false,
        },
      ),
      glossary: buildGlossary(locale),
      permissions,
      profile_defaults: buildProfileDefaults(state.workflow),
      generated_at: new Date().toISOString(),
    };
  }

  async getSuggestions(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly automationId: string;
    readonly contextNodeId?: string | null;
    readonly locale?: string | null;
    readonly includeOperations?: boolean;
  }): Promise<readonly NoCodeSuggestion[]> {
    const state = await this.draftService.getDraftResponse(
      input.actor,
      input.access,
      input.automationId,
    );
    const catalog = await this.moduleCatalogService.getCatalog({
      actor: input.actor,
      access: input.access,
      automationId: input.automationId,
      draftVersionId: state.workflow.draft_version_id,
      workflow: state.workflow,
      contextNodeId: input.contextNodeId,
      mode: 'suggestions',
    });

    return buildSuggestions(state, catalog.modules, catalog.recommended, {
      includeOperations: input.includeOperations === true,
    });
  }

  toNoCodeValidationMessage(
    issue: ValidationIssue,
    workflow: LexFrameWorkflowV2,
    mode: CanvasPresentationMode = 'basic',
  ): NoCodeValidationMessage {
    const node = issue.affected_node_id
      ? workflow.nodes.find((item) => item.id === issue.affected_node_id)
      : null;
    const field = issue.affected_input_key
      ? node?.inputs.find((input) => input.key === issue.affected_input_key)
      : null;
    const fallbackFixes = (issue.suggested_fixes ?? []).map((fix) => fix.label);
    const howToFix = plainFixes(issue, field?.label, node?.display_name);
    const autoFix = issue.suggested_fixes?.find(
      (fix) => fix.operation_type && fix.operation_payload,
    );

    return {
      id: issue.id,
      severity: issue.severity,
      title: plainTitle(issue, node?.display_name, field?.label),
      plain_language_message: plainMessage(
        issue,
        node?.display_name,
        field?.label,
      ),
      why_it_matters: whyItMatters(issue),
      how_to_fix: howToFix.length > 0 ? howToFix : fallbackFixes,
      what_happens_if_ignored: blockedActionsText(issue),
      affected_node_id: issue.affected_node_id ?? null,
      affected_edge_id: issue.affected_edge_id ?? null,
      affected_input_key: issue.affected_input_key ?? null,
      can_auto_fix: Boolean(autoFix),
      auto_fix_operation:
        mode !== 'basic' && autoFix?.operation_type && autoFix.operation_payload
          ? {
              client_operation_id: `no_code_fix_${issue.id}_${autoFix.id}`,
              operation_type: autoFix.operation_type,
              operation_payload: autoFix.operation_payload,
            }
          : null,
      suggested_fixes: mode === 'basic' ? [] : (issue.suggested_fixes ?? []),
      advanced:
        mode === 'basic'
          ? null
          : {
              code: issue.code,
              category: issue.category,
              developer_message: issue.developer_message ?? null,
              field_path: issue.field_path ?? null,
            },
    };
  }

  private async loadNoCodeLabels(
    moduleCodes: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, ModuleNoCodeLabelRow>> {
    const uniqueCodes = [...new Set(moduleCodes.filter(Boolean))];
    if (uniqueCodes.length === 0) {
      return new Map();
    }

    try {
      const result = await this.databaseService.query<ModuleNoCodeLabelRow>(
        `
          select
            module_code,
            locale,
            title,
            short_description,
            long_description,
            input_labels,
            output_labels,
            risk_explanation,
            examples,
            help_text
          from app.module_no_code_labels
          where module_code = any($1::text[])
            and locale = $2
        `,
        [uniqueCodes, locale],
      );
      return new Map(result.rows.map((row) => [row.module_code, row]));
    } catch {
      return new Map();
    }
  }
}

function toNodePresentation(
  state: CanvasState,
  node: WorkflowNode,
  context: PresentationContext,
): NoCodeNodePresentation {
  const block = findCanvasBlockDefinition(node.block_code);
  const label = context.labels.get(node.block_code);
  const issues = state.validation.issues.filter(
    (issue) => issue.affected_node_id === node.id,
  );
  const title = label?.title ?? node.display_name;
  const description =
    label?.short_description ??
    node.description ??
    block?.shortDescription ??
    'Шаг юридического сценария.';

  return {
    node_id: node.id,
    title,
    description,
    plain_language_type: plainNodeType(node.type),
    category: block?.uiSchema.paletteCategory ?? block?.category ?? node.type,
    icon: block?.uiSchema.icon ?? node.type,
    status: nodeStatus(node, issues, state.workflow.metadata.status),
    risk: riskPresentation(
      node.policy.risk_level ?? block?.policies.riskLevel ?? 'medium',
      label?.risk_explanation ?? null,
    ),
    inputs: node.inputs.map((input) =>
      toInputPresentation(input, node, state.workflow, issues, label, context),
    ),
    outputs: node.outputs.map((output) => toOutputPresentation(output, label)),
    badges: nodeBadges(node, issues),
    actions: nodeActions(node, issues, context.permissions),
    approval_required: Boolean(node.policy.approval_required),
    external_action: Boolean(node.policy.external_action),
    ai_used:
      Boolean(node.policy.ai_action) ||
      node.runtime_mapping.provider === 'ai_gateway',
    data_sensitivity:
      node.policy.data_classification ??
      block?.policies.dataClassification ??
      'workspace_internal',
    last_test_status: lastTestStatus(node),
    aria_label: [
      `Шаг: ${title}.`,
      `Статус: ${statusLabel(nodeStatus(node, issues, state.workflow.metadata.status))}.`,
      node.policy.approval_required ? 'Требуется согласование.' : null,
      issues.length > 0 ? `Есть замечания: ${issues.length}.` : null,
    ]
      .filter(Boolean)
      .join(' '),
    advanced:
      context.mode === 'developer'
        ? {
            module_code: node.module_code ?? node.block_code,
            module_version: node.module_version ?? null,
            runtime_provider: node.runtime_mapping.provider ?? null,
            runtime_action:
              node.runtime_mapping.activepieces_action ??
              node.runtime_mapping.internal_route ??
              null,
            step_id: node.id,
          }
        : null,
  };
}

function toInputPresentation(
  input: WorkflowDataField,
  node: WorkflowNode,
  workflow: LexFrameWorkflowV2,
  issues: readonly ValidationIssue[],
  label: ModuleNoCodeLabelRow | undefined,
  context: PresentationContext,
): NoCodeInputPresentation {
  const binding = node.input_bindings?.find(
    (item) =>
      item.target?.input_key === input.key || item.targetInputKey === input.key,
  );
  const inputIssues = issues.filter(
    (issue) => issue.affected_input_key === input.key,
  );
  const suggestedSources = findSuggestedSources(input, node, workflow);

  return {
    key: input.key,
    label: label?.input_labels?.[input.key] ?? input.label,
    description:
      input.description ??
      (input.required === true
        ? 'Обязательные данные, без которых шаг не сможет работать.'
        : 'Дополнительные данные для настройки шага.'),
    required: input.required === true,
    type_label: dataTypeLabel(input.data_type ?? input.type),
    state: inputState(input, binding, inputIssues),
    current_source: binding
      ? sourceToPresentation(binding.source, workflow, context.mode)
      : null,
    missing_reason:
      input.required === true && !binding
        ? 'Выберите источник данных для этого поля.'
        : null,
    suggested_sources: suggestedSources.map((source) =>
      candidateToPresentation(source, context.mode),
    ),
    allowed_source_types: input.allowed_sources ?? [],
  };
}

function toOutputPresentation(
  output: WorkflowDataField,
  label: ModuleNoCodeLabelRow | undefined,
): NoCodeOutputPresentation {
  return {
    key: output.key,
    label: label?.output_labels?.[output.key] ?? output.label,
    description: output.description ?? null,
    type_label: dataTypeLabel(output.data_type ?? output.type),
    classification: output.classification ?? 'workspace_internal',
    result_summary: `${label?.output_labels?.[output.key] ?? output.label}`,
  };
}

function buildSuggestions(
  state: CanvasState,
  modules: readonly CanvasModuleCard[],
  recommended: readonly {
    readonly module_code: string;
    readonly reason: string;
  }[],
  options: { readonly includeOperations: boolean },
): readonly NoCodeSuggestion[] {
  const moduleByCode = new Map(
    modules.map((module) => [module.module_code, module]),
  );
  const suggestions: NoCodeSuggestion[] = [];

  for (const issue of state.validation.issues) {
    const fix = issue.suggested_fixes?.[0];
    if (fix) {
      suggestions.push({
        id: `validation:${issue.id}:${fix.id}`,
        type: issue.code.includes('APPROVAL')
          ? 'add_approval'
          : issue.code.includes('REQUIRED_INPUT')
            ? 'fix_missing_input'
            : 'connect_data',
        title: plainTitle(issue),
        reason: plainMessage(issue),
        operation_preview: fix.label,
        proposed_operation:
          options.includeOperations &&
          fix.operation_type &&
          fix.operation_payload
            ? {
                client_operation_id: `suggestion_${issue.id}_${fix.id}`,
                operation_type: fix.operation_type,
                operation_payload: fix.operation_payload,
              }
            : null,
        requires_confirmation: Boolean(
          fix.requires_confirmation || fix.sensitive || fix.destructive,
        ),
        validation_issue_id: issue.id,
      });
    }
  }

  for (const item of recommended.slice(0, 4)) {
    const module = moduleByCode.get(item.module_code);
    if (!module || module.availability.status.startsWith('blocked')) {
      continue;
    }
    suggestions.push({
      id: opaqueSuggestionId('add_next_step', module.module_code),
      type: 'add_next_step',
      title: `Добавить шаг «${module.display_name}»`,
      reason: item.reason,
      operation_preview: `Добавит юридический шаг «${module.display_name}» в конец сценария.`,
      proposed_operation: options.includeOperations
        ? {
            client_operation_id: `suggestion_add_${module.module_code}`,
            operation_type: 'ADD_NODE_FROM_MODULE',
            operation_payload: {
              module_code: module.module_code,
              module_version: module.module_version ?? undefined,
              insert: { position: 'workflow_end' },
              initial_config: {},
              auto_bind_inputs: true,
              create_default_error_policy: true,
              source: 'no_code_suggestion',
            },
          }
        : null,
      requires_confirmation: false,
      validation_issue_id: null,
    });
  }

  return suggestions.slice(0, 8);
}

function buildPresentationPermissions(
  access: AccessContext,
): CanvasPresentationPermissions {
  return {
    can_view: access.permissions.includes('canvas.view'),
    can_edit: access.permissions.includes('canvas.edit'),
    can_publish: access.permissions.includes('canvas.publish'),
    can_test:
      access.permissions.includes('canvas.test.step') ||
      access.permissions.includes('canvas.test.validate'),
    can_use_advanced:
      access.permissions.includes('canvas.view_validation') ||
      access.permissions.includes('canvas.debug'),
    can_use_developer:
      access.permissions.includes('canvas.debug') ||
      access.permissions.includes('canvas.view_raw_dsl'),
    can_view_raw_data:
      access.permissions.includes('canvas.test.view_raw_data') ||
      access.permissions.includes('canvas.debug'),
  };
}

function opaqueSuggestionId(prefix: string, seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `${prefix}:${hash.toString(36)}`;
}

function resolveMode(
  requestedMode: string | null | undefined,
  access: AccessContext,
): CanvasPresentationMode {
  const permissions = buildPresentationPermissions(access);
  if (requestedMode === 'developer' && permissions.can_use_developer) {
    return 'developer';
  }
  if (
    (requestedMode === 'advanced' || requestedMode === 'developer') &&
    permissions.can_use_advanced
  ) {
    return 'advanced';
  }
  return 'basic';
}

function normalizeLocale(locale: string | null | undefined) {
  return locale === 'en-US' ? 'en-US' : 'ru-RU';
}

function buildGlossary(locale: string) {
  const terms: ReadonlyArray<readonly [string, string, string]> = [
    ['Node', 'Шаг', 'Действие или контрольная точка сценария.'],
    ['Edge', 'Связь / переход', 'Порядок выполнения между шагами.'],
    ['Trigger', 'Когда запускать', 'Условие запуска сценария.'],
    ['Input', 'Что нужно шагу', 'Данные, без которых шаг не сможет работать.'],
    ['Output', 'Что создаёт шаг', 'Результат, доступный следующим шагам.'],
    ['Binding', 'Источник данных', 'Связь поля шага с данными сценария.'],
    ['Condition', 'Условие', 'Правило выбора ветки сценария.'],
    ['Loop', 'Повторить для каждого', 'Пакетная обработка списка.'],
    ['Dry-run', 'Проверочный запуск', 'Проверка без внешних отправок.'],
    [
      'Publish',
      'Опубликовать версию',
      'Сделать сценарий доступным для запуска.',
    ],
  ];

  return {
    locale,
    terms: terms.map(([technical_term, user_term, description]) => ({
      technical_term,
      user_term,
      description,
      requires_attention: false,
    })),
    forbidden_basic_terms: BASIC_FORBIDDEN_TERMS,
  };
}

function plainNodeType(type: WorkflowNode['type']) {
  const labels: Record<WorkflowNode['type'], string> = {
    trigger: 'Когда запускать',
    legalAction: 'Юридическое действие',
    aiAction: 'AI-действие',
    documentInput: 'Документы и данные',
    condition: 'Условие',
    loop: 'Повторить для каждого',
    merge: 'Объединить ветки',
    approval: 'Согласование',
    wait: 'Ожидание',
    delivery: 'Доставка результата',
    storage: 'Сохранение',
    subworkflow: 'Готовая процедура',
    errorHandler: 'Что делать при ошибке',
    end: 'Результат сценария',
    note: 'Заметка',
    group: 'Группа шагов',
  };
  return labels[type] ?? 'Шаг сценария';
}

function riskPresentation(
  risk: RiskPresentation['level'],
  customReason: string | null,
): RiskPresentation {
  const labels: Record<RiskPresentation['level'], string> = {
    low: 'Низкий риск',
    medium: 'Средний риск',
    high: 'Высокий риск',
    critical: 'Критический риск',
  };
  const defaultReasons: Record<RiskPresentation['level'], string> = {
    low: 'Шаг не выполняет опасных внешних действий.',
    medium:
      'Шаг влияет на качество результата и требует внимательной настройки.',
    high: 'Шаг работает с юридически значимыми данными или результатами.',
    critical:
      'Шаг может привести к внешней отправке или существенному юридическому риску.',
  };
  return {
    level: risk,
    label: labels[risk],
    reason: customReason ?? defaultReasons[risk],
    requires_attention: risk === 'high' || risk === 'critical',
  };
}

function nodeStatus(
  node: WorkflowNode,
  issues: readonly ValidationIssue[],
  workflowStatus: string,
): NoCodeNodePresentation['status'] {
  if (workflowStatus === 'published') {
    return 'published';
  }
  if (
    issues.some(
      (issue) =>
        issue.severity === 'error' || issue.severity === 'policy_block',
    )
  ) {
    return 'invalid';
  }
  if (issues.length > 0) {
    return 'warning';
  }
  if (node.test_state?.last_tested_at) {
    return 'tested';
  }
  if (
    node.inputs.some((input) => input.required === true) &&
    (node.input_bindings?.length ?? 0) === 0
  ) {
    return 'not_configured';
  }
  return 'configured';
}

function statusLabel(status: NoCodeNodePresentation['status']) {
  const labels: Record<NoCodeNodePresentation['status'], string> = {
    not_configured: 'нужно настроить',
    configured: 'настроен',
    warning: 'есть предупреждения',
    invalid: 'есть ошибки',
    tested: 'проверен',
    published: 'опубликован',
  };
  return labels[status];
}

function inputState(
  input: WorkflowDataField,
  binding: StepInputBinding | undefined,
  issues: readonly ValidationIssue[],
): NoCodeInputPresentation['state'] {
  if (issues.some((issue) => issue.severity === 'policy_block')) {
    return 'blocked_by_policy';
  }
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'configured_but_invalid';
  }
  if (!binding && input.required === true) {
    return 'missing_required';
  }
  if (
    binding?.source.type === 'literal' ||
    binding?.source.type === 'manual_value'
  ) {
    return 'manual_value';
  }
  return binding ? 'configured' : 'not_configured';
}

function sourceToPresentation(
  source: DataSource,
  workflow: LexFrameWorkflowV2,
  mode: CanvasPresentationMode,
): NoCodeDataSourcePresentation {
  return {
    id: sourceId(source),
    type: source.type as DataSourceKind,
    label: sourceLabel(source, workflow),
    type_label: dataTypeLabel('object'),
    classification: 'workspace_internal',
    compatibility: 'valid',
    reason: null,
    preview_summary:
      source.type === 'literal' || source.type === 'manual_value'
        ? 'Указано вручную'
        : null,
    redacted: source.type === 'secret_ref',
    advanced: mode === 'basic' ? null : { source },
  };
}

function candidateToPresentation(
  candidate: CanvasDataSourceCandidate,
  mode: CanvasPresentationMode,
): NoCodeDataSourcePresentation {
  return {
    id: sourceId(candidate.source),
    type: candidate.type,
    label: candidate.label,
    type_label: dataTypeLabel(candidate.data_type),
    classification: candidate.classification,
    compatibility: candidate.compatibility,
    reason: candidate.reason ?? null,
    preview_summary: previewSummary(candidate.preview),
    redacted: isSensitive(candidate.classification),
    advanced: mode === 'basic' ? null : { source: candidate.source },
  };
}

function findSuggestedSources(
  input: WorkflowDataField,
  node: WorkflowNode,
  workflow: LexFrameWorkflowV2,
): readonly CanvasDataSourceCandidate[] {
  const previousNodes = workflow.nodes.filter(
    (candidate) =>
      candidate.id !== node.id &&
      candidate.layout.y <= node.layout.y &&
      candidate.outputs.length > 0,
  );
  const candidates: CanvasDataSourceCandidate[] = [];
  for (const previous of previousNodes) {
    for (const output of previous.outputs) {
      if (
        input.data_type === output.data_type ||
        input.type === output.type ||
        input.key
          .toLocaleLowerCase('en-US')
          .includes(output.key.toLocaleLowerCase('en-US'))
      ) {
        candidates.push({
          type: 'step_output',
          source: {
            type: 'step_output',
            node_id: previous.id,
            output_key: output.key,
          },
          label: `${previous.display_name} / ${output.label}`,
          data_type: (output.data_type ??
            output.type ??
            'object') as LexFrameDataType,
          classification: output.classification ?? 'workspace_internal',
          compatibility: 'valid',
          reason: 'Подходит по типу данных.',
          preview: null,
        });
      }
    }
  }
  return candidates.slice(0, 5);
}

function sourceId(source: DataSource): string {
  switch (source.type) {
    case 'workflow_input':
      return `workflow_input:${source.input_key}`;
    case 'step_output':
      return `step_output:${source.node_id}:${source.output_key}`;
    case 'document':
      return `document:${source.document_id}`;
    case 'profile':
    case 'profile_snapshot':
      return `profile:${source.profile_id ?? source.profile_snapshot_id ?? 'current'}`;
    case 'template':
      return `template:${source.template_id}`;
    case 'connection':
      return `connection:${source.connection_id}`;
    case 'secret_ref':
      return `secret:${source.display_name ?? 'server_side'}`;
    case 'system_value':
      return `system:${source.key}`;
    case 'transform':
      return `transform:${source.transform_type}:${sourceId(source.source)}`;
    case 'expression':
      return 'expression:hidden';
    case 'literal':
    case 'manual_value':
      return 'manual_value';
    default:
      return 'source';
  }
}

function sourceLabel(source: DataSource, workflow: LexFrameWorkflowV2): string {
  switch (source.type) {
    case 'workflow_input':
      return (
        workflow.inputs.find((input) => input.key === source.input_key)
          ?.label ?? 'Вход сценария'
      );
    case 'step_output': {
      const node = workflow.nodes.find((item) => item.id === source.node_id);
      const output = node?.outputs.find(
        (item) => item.key === source.output_key,
      );
      return `${node?.display_name ?? 'Предыдущий шаг'} / ${output?.label ?? 'Результат'}`;
    }
    case 'document':
      return 'Документ workspace';
    case 'profile':
    case 'profile_snapshot':
      return 'Профиль юридической работы';
    case 'template':
      return 'Шаблон документа';
    case 'connection':
      return source.display_name ?? 'Подключение workspace';
    case 'secret_ref':
      return source.display_name ?? 'Секрет хранится на сервере';
    case 'system_value':
      return 'Системное значение';
    case 'transform':
      return `Преобразование: ${sourceLabel(source.source, workflow)}`;
    case 'expression':
      return 'Техническое выражение';
    case 'literal':
    case 'manual_value':
      return 'Указано вручную';
    default:
      return 'Источник данных';
  }
}

function dataTypeLabel(type: string | undefined) {
  const labels: Record<string, string> = {
    string: 'Текст',
    text: 'Текст',
    number: 'Число',
    boolean: 'Да/нет',
    object: 'Структурированные данные',
    array: 'Список',
    document: 'Документ',
    'document[]': 'Список документов',
    profile: 'Профиль',
    template: 'Шаблон',
    date: 'Дата',
    enum: 'Выбор из списка',
  };
  return labels[String(type ?? 'object')] ?? String(type ?? 'Данные');
}

function nodeBadges(node: WorkflowNode, issues: readonly ValidationIssue[]) {
  const badges: string[] = [];
  if (node.policy.ai_action) {
    badges.push('AI');
  }
  if (node.policy.external_action) {
    badges.push('Внешняя отправка');
  }
  if (node.policy.approval_required) {
    badges.push('Нужно согласование');
  }
  if (node.policy.can_use_documents) {
    badges.push('Документы');
  }
  if (
    node.policy.risk_level === 'high' ||
    node.policy.risk_level === 'critical'
  ) {
    badges.push(riskPresentation(node.policy.risk_level, null).label);
  }
  if (issues.some((issue) => issue.severity === 'policy_block')) {
    badges.push('Блокирует публикацию');
  } else if (issues.length > 0) {
    badges.push('Есть замечания');
  }
  if (node.test_state?.last_tested_at) {
    badges.push('Тест пройден');
  }
  return badges;
}

function nodeActions(
  node: WorkflowNode,
  issues: readonly ValidationIssue[],
  permissions: CanvasPresentationPermissions,
): readonly NoCodeNodeAction[] {
  const actions: NoCodeNodeAction[] = [
    {
      type: 'open_inspector',
      label: 'Открыть настройки',
      disabled: false,
    },
    {
      type: 'choose_data',
      label: 'Выбрать данные',
      disabled: !permissions.can_edit,
      reason: permissions.can_edit ? null : 'У вас нет права изменять Canvas.',
    },
    {
      type: 'test_step',
      label: 'Проверить шаг',
      disabled: !permissions.can_test,
      reason: permissions.can_test
        ? null
        : 'Проверка шага недоступна вашей роли.',
    },
    {
      type: 'add_approval',
      label: 'Добавить согласование',
      disabled: !permissions.can_edit || !node.policy.external_action,
      reason: node.policy.external_action
        ? null
        : 'Согласование требуется только для рискованных или внешних действий.',
    },
    {
      type: 'show_advanced',
      label: 'Показать технические детали',
      disabled: !permissions.can_use_advanced,
      reason: permissions.can_use_advanced
        ? null
        : 'Технические детали доступны только администратору.',
    },
  ];
  return actions.filter(
    (action) =>
      action.type !== 'add_approval' ||
      node.policy.external_action ||
      issues.some((issue) => issue.code.includes('APPROVAL')),
  );
}

function lastTestStatus(
  node: WorkflowNode,
): NoCodeNodePresentation['last_test_status'] {
  if (node.test_state?.last_tested_at) {
    return 'success';
  }
  return 'not_tested';
}

function conditionLabel(condition: unknown) {
  return condition ? 'Если условие выполнено' : 'Дальше';
}

function edgePlainType(type: string) {
  const labels: Record<string, string> = {
    control_flow: 'Переход к следующему шагу',
    data_flow: 'Передача данных',
    error_flow: 'Что делать при ошибке',
    approval_flow: 'Результат согласования',
    loop_flow: 'Повторение',
    annotation_link: 'Пояснение',
  };
  return labels[type] ?? 'Связь шагов';
}

function plainTitle(
  issue: ValidationIssue,
  nodeLabel?: string | null,
  fieldLabel?: string | null,
) {
  if (issue.code.includes('REQUIRED_INPUT')) {
    return `Не выбраны данные для поля «${fieldLabel ?? 'обязательное поле'}»`;
  }
  if (issue.code.includes('EXTERNAL_ACTION_REQUIRES_APPROVAL')) {
    return `Перед внешней отправкой нужно согласование`;
  }
  if (issue.code.includes('SECRET')) {
    return 'Секрет нельзя хранить в настройках шага';
  }
  if (issue.code.includes('TYPE')) {
    return `Источник данных не подходит для шага${nodeLabel ? ` «${nodeLabel}»` : ''}`;
  }
  return issue.title;
}

function plainMessage(
  issue: ValidationIssue,
  nodeLabel?: string | null,
  fieldLabel?: string | null,
) {
  if (issue.code.includes('REQUIRED_INPUT')) {
    return `Шаг «${nodeLabel ?? 'сценария'}» не знает, какие данные использовать для поля «${fieldLabel ?? 'обязательное поле'}».`;
  }
  if (issue.code.includes('EXTERNAL_ACTION_REQUIRES_APPROVAL')) {
    return 'Сценарий собирается выполнить внешнее действие, но перед ним нет шага согласования.';
  }
  if (issue.code.includes('SECRET')) {
    return 'В настройках найдено значение, похожее на секрет. Такие данные должны храниться только на сервере.';
  }
  if (issue.code.includes('TYPE')) {
    return 'Выбранный источник данных не совпадает с тем, что ожидает этот шаг.';
  }
  return issue.message;
}

function whyItMatters(issue: ValidationIssue) {
  if (issue.code.includes('REQUIRED_INPUT')) {
    return 'Без обязательных данных шаг не сможет подготовить юридически корректный результат.';
  }
  if (issue.code.includes('EXTERNAL_ACTION_REQUIRES_APPROVAL')) {
    return 'Внешняя отправка может создать юридические и репутационные риски.';
  }
  if (issue.code.includes('SECRET')) {
    return 'Раскрытие ключей или токенов может дать доступ к данным workspace и запуску сценариев.';
  }
  if (issue.code.includes('TYPE')) {
    return 'Несовместимые данные приводят к ошибкам запуска или неправильным документам.';
  }
  return 'Это замечание влияет на возможность безопасно проверить, опубликовать или запустить сценарий.';
}

function plainFixes(
  issue: ValidationIssue,
  fieldLabel?: string | null,
  nodeLabel?: string | null,
) {
  if (issue.code.includes('REQUIRED_INPUT')) {
    return [
      `Выберите источник данных для поля «${fieldLabel ?? 'обязательное поле'}».`,
    ];
  }
  if (issue.code.includes('EXTERNAL_ACTION_REQUIRES_APPROVAL')) {
    return ['Добавьте шаг «Согласовать отправку» перед внешним действием.'];
  }
  if (issue.code.includes('SECRET')) {
    return [
      `Удалите секрет из настроек шага${nodeLabel ? ` «${nodeLabel}»` : ''} и выберите серверное подключение.`,
    ];
  }
  if (issue.code.includes('TYPE')) {
    return [
      'Выберите другой источник данных или добавьте допустимое преобразование.',
    ];
  }
  return issue.suggested_fix ? [issue.suggested_fix] : [];
}

function blockedActionsText(issue: ValidationIssue) {
  if (!issue.blocks?.length) {
    return null;
  }
  const labels: Record<string, string> = {
    save: 'сохранение',
    test_step: 'проверку шага',
    test_flow: 'проверку сценария',
    compile: 'подготовку к запуску',
    publish: 'публикацию',
    run: 'запуск',
    sync: 'синхронизацию исполнения',
  };
  return `Пока проблема не исправлена, система может заблокировать: ${issue.blocks.map((item) => labels[item] ?? item).join(', ')}.`;
}

function previewSummary(preview: Record<string, unknown> | null | undefined) {
  if (!preview) {
    return null;
  }
  const keys = Object.keys(preview);
  return keys.length > 0
    ? `Пример содержит поля: ${keys.slice(0, 4).join(', ')}`
    : null;
}

function isSensitive(classification: string) {
  return [
    'confidential',
    'personal_data',
    'legal_secret',
    'client_material',
  ].includes(classification);
}

function buildProfileDefaults(workflow: LexFrameWorkflowV2) {
  const profileInput = workflow.inputs.find(
    (input) => input.key === 'profile_id' || input.type === 'profile',
  );
  if (!profileInput) {
    return null;
  }
  return {
    profile_label: profileInput.label,
    template_label: null,
    approval_route_label: null,
    style_label: null,
  };
}
