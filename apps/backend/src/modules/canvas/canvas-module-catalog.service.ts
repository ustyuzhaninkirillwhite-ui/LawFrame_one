import type {
  CanvasInsertPosition,
  CanvasModuleCard,
  CanvasModuleCatalogResponse,
  CanvasModuleCategory,
  CanvasModuleDetail,
  LexFrameWorkflowV2,
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
  }): Promise<CanvasModuleCatalogResponse> {
    const workspaceId = requireWorkspaceId(input.access);
    const blocks = getCanvasBlockDefinitions();
    const cards = blocks
      .map((block) => this.toCard(block, input))
      .filter((card) => !isSecurityHidden(card, input.access));
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
  }): CanvasModuleDetail {
    const block = findCanvasBlockDefinition(input.moduleCode);
    if (!block) {
      throw new AppHttpException(
        'MODULE_NOT_FOUND',
        404,
        `Canvas module was not found: ${input.moduleCode}.`,
      );
    }

    const card = this.toCard(block, {
      access: input.access,
      workflow: input.workflow,
    });

    return {
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
    };
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
