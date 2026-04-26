import type {
  CanvasModuleCard,
  LexFrameWorkflowV2,
  RecommendedModule,
} from '@lexframe/contracts';
import { Injectable } from '@nestjs/common';

const recommendationRules: Record<string, readonly string[]> = {
  manual_start: [
    'select_documents',
    'select_profile',
    'case_material_analysis',
  ],
  select_documents: ['case_material_analysis', 'case_law_search'],
  select_profile: ['case_law_search', 'case_material_analysis'],
  case_material_analysis: [
    'pretrial_claim_draft',
    'case_law_search',
    'document_structure_check',
    'human_approval',
  ],
  case_law_search: [
    'case_material_analysis',
    'pretrial_claim_draft',
    'save_to_documents',
  ],
  pretrial_claim_draft: [
    'document_template_apply',
    'document_structure_check',
    'human_approval',
    'save_to_documents',
  ],
  document_template_apply: [
    'document_structure_check',
    'human_approval',
    'save_to_documents',
    'email_delivery',
  ],
  document_structure_check: ['human_approval', 'save_to_documents'],
  human_approval: ['save_to_documents', 'email_delivery'],
  save_to_documents: ['email_delivery', 'end_success'],
};

@Injectable()
export class CanvasModuleRecommendationService {
  recommend(input: {
    readonly workflow?: LexFrameWorkflowV2 | null;
    readonly contextNodeId?: string | null;
    readonly modules: readonly CanvasModuleCard[];
  }): readonly RecommendedModule[] {
    const contextNode = input.contextNodeId
      ? input.workflow?.nodes.find((node) => node.id === input.contextNodeId)
      : input.workflow?.nodes.at(-1);
    const contextCode =
      contextNode?.block_code ??
      contextNode?.module_code ??
      contextNode?.trigger_kind ??
      null;
    const preferred = contextCode
      ? (recommendationRules[contextCode] ?? [])
      : [];
    const moduleByCode = new Map(
      input.modules.map((module) => [module.module_code, module]),
    );

    const recommendations: RecommendedModule[] = [];
    preferred.forEach((moduleCode, index) => {
      const module = moduleByCode.get(moduleCode);
      if (!module || isBlocked(module)) {
        return;
      }
      recommendations.push({
        module_code: moduleCode,
        reason: 'Подходит как следующий юридический шаг.',
        score: 1 - index * 0.08,
        source: 'rules',
      });
    });

    if (recommendations.length > 0) {
      return recommendations;
    }

    return input.modules
      .filter((module) => !isBlocked(module))
      .slice(0, 4)
      .map((module, index) => ({
        module_code: module.module_code,
        reason: 'Часто используется в Canvas.',
        score: 0.7 - index * 0.05,
        source: 'rules',
      }));
  }
}

function isBlocked(module: CanvasModuleCard) {
  return [
    'blocked_by_role',
    'blocked_by_plan',
    'blocked_by_data_policy',
    'blocked_by_runtime',
    'deprecated',
    'retired',
    'incompatible_with_canvas_context',
  ].includes(module.availability.status);
}
