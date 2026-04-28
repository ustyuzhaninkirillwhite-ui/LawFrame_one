import type {
  CanvasInsertPosition,
  CanvasModuleCard,
  CanvasModuleCatalogResponse,
  CanvasModuleCategory,
  CanvasModuleDetail,
  LexFrameWorkflowV2,
  ModuleAvailabilityStatus,
  ModuleRequirement,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import type { CanvasBlockDefinition } from '@lexframe/workflow-dsl';
import {
  canvasBlockCategoryDetails,
  findCanvasBlockDefinition,
  getCanvasBlockDefinitions,
} from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { DatabaseService } from '../database/database.service';
import { requireWorkspaceId } from './canvas-access';
import { CanvasModuleAvailabilityService } from './canvas-module-availability.service';
import { CanvasModuleCompatibilityService } from './canvas-module-compatibility.service';
import { CanvasModuleRecommendationService } from './canvas-module-recommendation.service';
import { CanvasModuleSearchService } from './canvas-module-search.service';

interface RecentRow {
  readonly module_code: string;
  readonly used_at: string;
}

interface FavoriteRow {
  readonly module_code: string;
  readonly created_at: string;
}

interface ActivepiecesActionRow {
  readonly module_code: string;
  readonly piece_name: string;
  readonly piece_version: string;
  readonly entry_type: 'action' | 'trigger';
  readonly entry_name: string;
  readonly display_name: string;
  readonly description: string;
  readonly status: 'active' | 'deprecated' | 'blocked' | 'missing';
  readonly availability_status: ModuleAvailabilityStatus;
  readonly gating_reason_code: string | null;
  readonly gating_human_reason: string | null;
  readonly required_connection_type: string | null;
  readonly risk_level: CanvasModuleCard['risk_level'];
  readonly category: string;
  readonly source_image_tag: string | null;
  readonly piece_display_name: string | null;
  readonly piece_auth_type: string | null;
  readonly piece_categories: readonly string[] | null;
}

@Injectable()
export class CanvasModuleCatalogService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly availability: CanvasModuleAvailabilityService,
    private readonly compatibility: CanvasModuleCompatibilityService,
    private readonly recommendations: CanvasModuleRecommendationService,
    private readonly search: CanvasModuleSearchService,
  ) {}

  async getCatalog(input: {
    readonly actor?: AuthenticatedActor | null;
    readonly access: AccessContext;
    readonly automationId?: string | null;
    readonly draftVersionId?: string | null;
    readonly workflow?: LexFrameWorkflowV2 | null;
    readonly contextNodeId?: string | null;
    readonly insertPosition?: CanvasInsertPosition | null;
    readonly mode?: string | null;
    readonly query?: string | null;
    readonly source?: string | null;
    readonly status?: string | null;
    readonly runtime?: string | null;
    readonly limit?: number | null;
    readonly cursor?: string | null;
  }): Promise<CanvasModuleCatalogResponse> {
    const workspaceId = requireWorkspaceId(input.access);
    const includeLexFrame = !input.source || input.source === 'lexframe';
    const includeActivepieces =
      !input.source || input.source === 'activepieces';
    const blocks = includeLexFrame
      ? getCanvasBlockDefinitions().filter(
          (block) => block.code !== 'activepieces_action',
        )
      : [];
    const lexframeCards = blocks
      .map((block) => this.toCard(block, input))
      .filter((card) => !isSecurityHidden(card, input.access));
    const activepiecesCards = includeActivepieces
      ? await this.getActivepiecesCards(input)
      : [];
    const cards = [...lexframeCards, ...activepiecesCards];
    const filteredCards = this.search.filter(cards, input.query ?? undefined);
    const categories = categoriesFor(filteredCards);
    const [recent, favorites] = await Promise.all([
      this.getRecent(input.actor, workspaceId),
      this.getFavorites(input.actor, workspaceId),
    ]);
    const recommended = this.recommendations.recommend({
      workflow: input.workflow,
      contextNodeId: input.contextNodeId,
      modules: filteredCards,
    });

    return {
      workspace_id: workspaceId,
      automation_id: input.automationId ?? null,
      draft_version_id: input.draftVersionId ?? null,
      categories,
      modules: filteredCards,
      recommended,
      recent,
      favorites,
      policy_summary: {
        hidden_count: cards.length - filteredCards.length,
        disabled_count: filteredCards.filter((card) => isDisabled(card)).length,
        missing_connections_count: filteredCards.filter(
          (card) => card.availability.status === 'missing_connection',
        ).length,
        deprecated_count: filteredCards.filter((card) =>
          ['deprecated', 'retired'].includes(card.availability.status),
        ).length,
      },
      runtime_summary: {
        activepieces_available: true,
        missing_pieces: filteredCards
          .filter((card) => card.runtime.mapping_status === 'missing')
          .map((card) => card.module_code),
        incompatible_pieces: [],
      },
      generated_at: new Date().toISOString(),
    };
  }

  getDetail(input: {
    readonly access: AccessContext;
    readonly moduleCode: string;
    readonly workflow?: LexFrameWorkflowV2 | null;
  }): Promise<CanvasModuleDetail> {
    const block = findCanvasBlockDefinition(input.moduleCode);
    if (!block) {
      return this.getActivepiecesDetail(input);
    }

    const card = this.toCard(block, {
      access: input.access,
      workflow: input.workflow,
    });

    return Promise.resolve({
      ...card,
      examples: block.uiSchema.hints,
      requirements_detail: card.requirements,
      technical_detail: input.access.permissions.includes('canvas.debug')
        ? {
            module_code: card.module_code,
            module_version: card.module_version,
            runtime_mapping: card.technical?.runtime_mapping ?? {},
            input_schema: block.inputSchema,
            output_schema: block.outputSchema,
            policy: {
              approval_required: block.policies.requiresApproval,
              external_action: block.policies.isExternalAction,
              ai_action: block.policies.canUseAi,
              data_classification: block.policies.dataClassification,
              risk_level: block.policies.riskLevel,
              can_use_documents: block.policies.canUseDocuments,
              can_run_in_dry_run: block.policies.canRunInDryRun,
              can_be_published_as_template:
                block.policies.canBePublishedAsTemplate,
              required_permissions: block.policies.requiredPermissions,
            },
          }
        : null,
    });
  }

  async getActivepiecesModuleCard(
    moduleCode: string,
  ): Promise<CanvasModuleCard | null> {
    const rows = await this.queryActivepiecesRows({
      moduleCode,
      limit: 1,
    });
    const row = rows[0];
    return row ? this.activepiecesRowToCard(row) : null;
  }

  private toCard(
    block: CanvasBlockDefinition,
    input: {
      readonly access: AccessContext;
      readonly workflow?: LexFrameWorkflowV2 | null;
      readonly contextNodeId?: string | null;
      readonly insertPosition?: CanvasInsertPosition | null;
    },
  ): CanvasModuleCard {
    const category = categoryDetails(block.category);
    const availability = this.availability.evaluate({
      block,
      access: input.access,
      hasApprovalPath: input.workflow
        ? hasApprovalBefore(input.workflow, input.contextNodeId ?? '')
        : false,
    });
    const compatibility = input.workflow
      ? this.compatibility.check({
          access: input.access,
          workflow: input.workflow,
          block,
          insert: {
            position: input.insertPosition ?? 'workflow_end',
            source_node_id: input.contextNodeId ?? null,
          },
        })
      : null;
    const nextAvailability =
      compatibility && !compatibility.allowed
        ? {
            ...availability.availability,
            status: 'incompatible_with_canvas_context' as const,
            reason_code: compatibility.reason_code,
            human_reason: compatibility.human_reason,
          }
        : availability.availability;

    return {
      module_code: block.code,
      module_version: '1.0.0',
      display_name: block.displayName,
      short_description: block.shortDescription,
      long_description: block.longDescription ?? null,
      source: 'lexframe',
      source_label: 'LexFrame',
      category_code: block.category,
      category_label: category.label,
      icon: block.uiSchema.icon,
      tags: [
        ...new Set([...block.uiSchema.card.badges, block.kind, block.category]),
      ],
      aliases: aliasesFor(block),
      input_summary: block.inputs.map((inputField) => ({
        key: inputField.key,
        label: inputField.label,
        data_type: inputField.type,
        required: inputField.required,
        classification: inputField.classification ?? null,
      })),
      output_summary: block.outputs.map((outputField) => ({
        key: outputField.key,
        label: outputField.label,
        data_type: outputField.type,
        required: outputField.required,
        classification: outputField.classification ?? null,
      })),
      risk_level: block.policies.riskLevel,
      data_classification: block.policies.dataClassification,
      flags: {
        uses_ai:
          block.policies.canUseAi || block.runtime.provider === 'ai_gateway',
        external_action: block.policies.isExternalAction,
        requires_documents: block.policies.canUseDocuments,
        requires_profile: block.inputs.some((field) =>
          field.key.toLocaleLowerCase('en-US').includes('profile'),
        ),
        requires_template: block.inputs.some((field) =>
          field.key.toLocaleLowerCase('en-US').includes('template'),
        ),
        requires_connection: block.kind === 'delivery',
        requires_approval: block.policies.requiresApproval,
        supports_dry_run: block.policies.canRunInDryRun,
        supports_batch: block.kind === 'loop',
      },
      availability: nextAvailability,
      requirements: compatibility
        ? [...availability.requirements, ...compatibility.missing_requirements]
        : availability.requirements,
      runtime: {
        provider: block.runtime.provider,
        mapping_status: block.runtime.provider ? 'available' : 'missing',
        required_pieces: block.runtime.activepiecesPiece
          ? [
              {
                piece_name: block.runtime.activepiecesPiece,
                version_range: null,
                action: block.runtime.activepiecesAction ?? null,
                connection_type: block.kind === 'delivery' ? 'email' : null,
              },
            ]
          : [],
        required_connections:
          block.kind === 'delivery'
            ? [
                {
                  type: 'email',
                  label: 'Почтовое подключение',
                  status: 'missing',
                  connection_id: null,
                },
              ]
            : [],
      },
      insertion: {
        allowed_positions: allowedPositionsFor(block),
        default_node_type: block.nodeType,
        preferred_after_module_codes: preferredAfter(block.code),
        forbidden_after_module_codes:
          block.kind === 'delivery' ? ['manual_start', 'select_documents'] : [],
      },
      technical: {
        block_code: block.code,
        runtime_mapping: {
          module_code: block.moduleCode ?? block.code,
          provider: block.runtime.provider,
          activepieces_piece: block.runtime.activepiecesPiece ?? null,
          activepieces_action: block.runtime.activepiecesAction ?? null,
          internal_route: block.runtime.internalRoute ?? null,
          can_compile: block.kind !== 'note',
          supports_step_test: block.runtime.supportsStepTest,
          supports_partial_execution: block.runtime.supportsPartialExecution,
          supports_pinned_data: block.runtime.supportsPinnedData,
          warnings: block.runtime.notes,
        },
      },
    };
  }

  private async getActivepiecesDetail(input: {
    readonly access: AccessContext;
    readonly moduleCode: string;
  }): Promise<CanvasModuleDetail> {
    const card = await this.getActivepiecesModuleCard(input.moduleCode);
    if (!card) {
      throw new AppHttpException(
        'MODULE_NOT_FOUND',
        404,
        `Canvas module was not found: ${input.moduleCode}.`,
      );
    }

    return {
      ...card,
      examples: [
        'Add the action as a draft step, then configure its workspace connection.',
        'Review blocked and advanced entries before enabling them for production runs.',
      ],
      requirements_detail: card.requirements,
      technical_detail: input.access.permissions.includes('canvas.debug')
        ? {
            module_code: card.module_code,
            module_version: card.module_version,
            runtime_mapping: card.technical?.runtime_mapping ?? {},
            input_schema: {},
            output_schema: {},
            policy: {
              approval_required: card.flags.requires_approval,
              external_action: card.flags.external_action,
              ai_action: card.flags.uses_ai,
              data_classification: card.data_classification,
              risk_level: card.risk_level,
              can_use_documents: card.flags.requires_documents,
              can_run_in_dry_run: card.flags.supports_dry_run,
              can_be_published_as_template: false,
              required_permissions: [],
            },
          }
        : null,
    };
  }

  private async getActivepiecesCards(input: {
    readonly query?: string | null;
    readonly status?: string | null;
    readonly runtime?: string | null;
    readonly limit?: number | null;
  }) {
    if (input.runtime && input.runtime !== 'activepieces') {
      return [];
    }
    const rows = await this.queryActivepiecesRows({
      query: input.query,
      status: input.status,
      limit: input.limit ?? 1500,
    });
    return rows.map((row) => this.activepiecesRowToCard(row));
  }

  private async queryActivepiecesRows(input: {
    readonly moduleCode?: string | null;
    readonly query?: string | null;
    readonly status?: string | null;
    readonly limit?: number | null;
  }): Promise<readonly ActivepiecesActionRow[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 1500, 1500));
    const query = input.query?.trim() ? `%${input.query.trim()}%` : null;
    const status = input.status?.trim() || null;
    try {
      const result = await this.databaseService.query<ActivepiecesActionRow>(
        `
          select
            ar.module_code,
            ar.piece_name,
            ar.piece_version,
            ar.entry_type,
            ar.entry_name,
            ar.display_name,
            ar.description,
            ar.status,
            ar.availability_status,
            ar.gating_reason_code,
            ar.gating_human_reason,
            ar.required_connection_type,
            ar.risk_level,
            ar.category,
            ar.source_image_tag,
            pr.display_name as piece_display_name,
            pr.auth_type as piece_auth_type,
            pr.categories as piece_categories
          from app.activepieces_action_registry ar
          left join app.activepieces_piece_registry pr
            on pr.piece_name = ar.piece_name
           and pr.piece_version = ar.piece_version
          where ($1::text is null or ar.module_code = $1)
            and (
              $2::text is null
              or ar.module_code ilike $2
              or ar.display_name ilike $2
              or ar.description ilike $2
              or ar.piece_name ilike $2
              or ar.category ilike $2
            )
            and (
              $3::text is null
              or ar.status = $3
              or ar.availability_status = $3
            )
          order by
            case ar.status when 'active' then 0 when 'blocked' then 1 when 'deprecated' then 2 else 3 end,
            case ar.availability_status when 'available' then 0 when 'available_with_warnings' then 1 when 'missing_connection' then 2 else 3 end,
            ar.category asc,
            ar.display_name asc
          limit $4
        `,
        [input.moduleCode ?? null, query, status, limit],
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  private activepiecesRowToCard(row: ActivepiecesActionRow): CanvasModuleCard {
    const categoryCode = `ap_${sanitizeCode(row.category)}`;
    const requiredConnection = row.required_connection_type
      ? [
          {
            type: row.required_connection_type,
            label: connectionLabel(row),
            status: 'missing' as const,
            connection_id: null,
          },
        ]
      : [];
    const requirements = requirementsForActivepieces(row);
    const externalAction =
      row.risk_level === 'high' ||
      row.risk_level === 'critical' ||
      row.category.includes('communication');

    return {
      module_code: row.module_code,
      module_version: row.piece_version,
      display_name: row.display_name,
      short_description: row.description,
      long_description: row.gating_human_reason ?? row.description,
      source: 'activepieces',
      source_label: 'Activepieces',
      category_code: categoryCode,
      category_label: categoryLabel(row.category),
      icon: row.entry_type === 'trigger' ? 'Play' : 'Workflow',
      tags: [
        'activepieces',
        row.entry_type,
        row.status,
        row.availability_status,
        row.category,
        row.piece_name,
      ],
      aliases: [
        row.entry_name,
        row.piece_name,
        row.piece_display_name ?? '',
        ...(row.piece_categories ?? []),
      ].filter(Boolean),
      input_summary: [
        {
          key: 'config',
          label: 'Configuration',
          data_type: 'object',
          required: row.availability_status !== 'available',
          classification: 'internal',
        },
      ],
      output_summary: [
        {
          key: 'result',
          label: 'Result',
          data_type: 'object',
          required: false,
          classification: 'internal',
        },
      ],
      risk_level: row.risk_level,
      data_classification:
        row.risk_level === 'critical' ? 'confidential' : 'internal',
      flags: {
        uses_ai:
          row.piece_name.toLocaleLowerCase('en-US').includes('ai') ||
          row.gating_reason_code ===
            'ACTIVEPIECES_AI_ROUTE_REQUIRES_LEXFRAME_GATEWAY',
        external_action: externalAction,
        requires_documents: row.category.includes('document'),
        requires_profile: false,
        requires_template: false,
        requires_connection: row.required_connection_type !== null,
        requires_approval: externalAction,
        supports_dry_run: row.status === 'active',
        supports_batch: false,
      },
      availability: {
        status: row.availability_status,
        reason_code: row.gating_reason_code,
        human_reason: row.gating_human_reason,
        remediation:
          row.availability_status === 'missing_connection'
            ? [
                {
                  action: 'configure_connection',
                  label: 'Configure connection',
                },
                {
                  action: 'add_as_draft',
                  label: 'Add as draft',
                },
              ]
            : [],
      },
      requirements,
      runtime: {
        provider: 'activepieces',
        mapping_status: row.status === 'missing' ? 'missing' : 'available',
        required_pieces: [
          {
            piece_name: row.piece_name,
            version_range: row.piece_version,
            action: row.entry_type === 'action' ? row.entry_name : null,
            connection_type: row.required_connection_type,
          },
        ],
        required_connections: requiredConnection,
      },
      insertion: {
        allowed_positions:
          row.entry_type === 'trigger'
            ? ['workflow_start']
            : ['after_node', 'before_node', 'workflow_end'],
        default_node_type:
          row.entry_type === 'trigger' ? 'trigger' : 'legalAction',
        preferred_after_module_codes: [],
        forbidden_after_module_codes: [],
      },
      technical: {
        block_code: 'activepieces_action',
        runtime_mapping: {
          module_code: row.module_code,
          provider: 'activepieces',
          activepieces_piece: row.piece_name,
          activepieces_action:
            row.entry_type === 'action' ? row.entry_name : null,
          can_compile:
            row.status === 'active' &&
            ['available', 'available_with_warnings'].includes(
              row.availability_status,
            ),
          supports_step_test:
            row.status === 'active' &&
            ['available', 'available_with_warnings'].includes(
              row.availability_status,
            ),
          supports_partial_execution: false,
          supports_pinned_data: false,
          warnings: [row.gating_human_reason ?? null].filter(
            (item): item is string => item !== null,
          ),
        },
      },
    };
  }

  private async getRecent(
    actor: AuthenticatedActor | null | undefined,
    workspaceId: string,
  ) {
    if (!actor) {
      return [];
    }
    try {
      const result = await this.databaseService.query<RecentRow>(
        `
          select module_code, used_at
          from app.canvas_module_recent
          where workspace_id = $1
            and actor_id = $2
          order by used_at desc
          limit 12
        `,
        [workspaceId, actor.id],
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  private async getFavorites(
    actor: AuthenticatedActor | null | undefined,
    workspaceId: string,
  ) {
    if (!actor) {
      return [];
    }
    try {
      const result = await this.databaseService.query<FavoriteRow>(
        `
          select module_code, created_at
          from app.canvas_module_favorites
          where workspace_id = $1
            and actor_id = $2
          order by created_at desc
          limit 24
        `,
        [workspaceId, actor.id],
      );
      return result.rows;
    } catch {
      return [];
    }
  }
}

function categoryDetails(categoryCode: string) {
  return (
    canvasBlockCategoryDetails.find(
      (item) => item.category === categoryCode,
    ) ?? {
      category: categoryCode,
      label: categoryCode,
      description: `Группа модулей Canvas: ${categoryCode}.`,
    }
  );
}

function categoriesFor(
  cards: readonly CanvasModuleCard[],
): readonly CanvasModuleCategory[] {
  const byCategory = new Map<string, CanvasModuleCategory>();
  for (const card of cards) {
    const current = byCategory.get(card.category_code);
    byCategory.set(card.category_code, {
      code: card.category_code,
      label: card.category_label,
      description: categoryDetails(card.category_code).description,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...byCategory.values()];
}

function aliasesFor(block: CanvasBlockDefinition) {
  const explicit: Record<string, readonly string[]> = {
    case_law_search: [
      'практика',
      'судебная практика',
      'решения судов',
      'правовой поиск',
    ],
    case_material_analysis: ['анализ', 'материалы дела', 'факты', 'риски'],
    pretrial_claim_draft: [
      'претензия',
      'досудебная претензия',
      'письмо должнику',
    ],
    document_template_apply: ['шаблон', 'применить шаблон', 'типовая форма'],
    document_structure_check: ['проверить документ', 'структура', 'реквизиты'],
    human_approval: ['согласовать', 'подтвердить', 'approval'],
    email_delivery: ['email', 'письмо', 'отправить клиенту', 'доставка'],
    loop_batch: ['цикл', 'по каждому документу', 'batch'],
    condition: ['если', 'условие', 'ветвление', 'риск высокий'],
  };
  return explicit[block.code] ?? block.uiSchema.hints;
}

function allowedPositionsFor(
  block: CanvasBlockDefinition,
): readonly CanvasInsertPosition[] {
  if (block.kind === 'trigger') {
    return ['workflow_start'];
  }
  if (block.kind === 'end') {
    return ['workflow_end'];
  }
  if (block.kind === 'error_handler') {
    return ['error_handler'];
  }
  if (block.kind === 'loop') {
    return ['after_node', 'before_node', 'workflow_end'];
  }
  return [
    'after_node',
    'before_node',
    'branch_true',
    'branch_false',
    'router_branch',
    'approval_after',
    'workflow_end',
  ];
}

function preferredAfter(moduleCode: string): readonly string[] {
  if (moduleCode === 'pretrial_claim_draft') {
    return ['case_material_analysis', 'case_law_search'];
  }
  if (moduleCode === 'document_structure_check') {
    return ['document_template_apply', 'pretrial_claim_draft'];
  }
  if (moduleCode === 'email_delivery') {
    return ['human_approval', 'save_to_documents'];
  }
  return [];
}

function isSecurityHidden(card: CanvasModuleCard, access: AccessContext) {
  return (
    card.technical?.runtime_mapping.internal_route?.includes('http') === true &&
    !access.permissions.includes('canvas.debug')
  );
}

function isDisabled(card: CanvasModuleCard) {
  return ![
    'available',
    'available_with_warnings',
    'missing_connection',
    'missing_template',
    'missing_profile',
  ].includes(card.availability.status);
}

function requirementsForActivepieces(
  row: ActivepiecesActionRow,
): readonly ModuleRequirement[] {
  const requirements: ModuleRequirement[] = [];

  if (row.required_connection_type) {
    requirements.push({
      kind: 'connection',
      code: `${row.module_code}:connection`,
      label: connectionLabel(row),
      required: true,
      status:
        row.availability_status === 'missing_connection'
          ? 'missing'
          : row.availability_status.startsWith('blocked')
            ? 'blocked'
            : 'warning',
      reason:
        row.gating_human_reason ??
        'Configure a workspace-scoped Activepieces connection.',
    });
  }

  if (
    row.status === 'blocked' ||
    row.availability_status.startsWith('blocked')
  ) {
    requirements.push({
      kind: 'data_policy',
      code: row.gating_reason_code ?? `${row.module_code}:policy`,
      label: 'Activepieces policy gate',
      required: true,
      status: 'blocked',
      reason:
        row.gating_human_reason ??
        'This Activepieces entry is gated before Canvas execution.',
    });
  }

  if (row.status === 'missing') {
    requirements.push({
      kind: 'runtime_piece',
      code: `${row.module_code}:runtime`,
      label: 'Activepieces source piece',
      required: true,
      status: 'blocked',
      reason:
        'This entry is missing from the current Activepieces source image.',
    });
  }

  return requirements;
}

function connectionLabel(row: ActivepiecesActionRow) {
  return `${row.piece_display_name ?? row.piece_name} connection`;
}

function categoryLabel(value: string) {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function sanitizeCode(value: string) {
  return (
    value
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'activepieces'
  );
}

function hasApprovalBefore(workflow: LexFrameWorkflowV2, targetNodeId: string) {
  if (!targetNodeId) {
    return false;
  }
  const reverseEdges = new Map<string, readonly string[]>();
  for (const edge of workflow.edges) {
    reverseEdges.set(edge.target_node_id, [
      ...(reverseEdges.get(edge.target_node_id) ?? []),
      edge.source_node_id,
    ]);
  }
  const visited = new Set<string>();
  const queue = [...(reverseEdges.get(targetNodeId) ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    const node = workflow.nodes.find((item) => item.id === nodeId);
    if (node?.type === 'approval') {
      return true;
    }
    queue.push(...(reverseEdges.get(nodeId) ?? []));
  }
  return false;
}
