import type {
  CanvasModuleCard,
  ModuleAvailabilityStatus,
  ModuleRemediationAction,
  ModuleRequirement,
} from '@lexframe/contracts';
import type { AccessContext } from '../../common/types/lexframe-request';
import type { CanvasBlockDefinition } from '@lexframe/workflow-dsl';
import { Injectable } from '@nestjs/common';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';

@Injectable()
export class CanvasModuleAvailabilityService {
  constructor(private readonly registry: CanvasBlockRegistryService) {}

  evaluate(input: {
    readonly block: CanvasBlockDefinition;
    readonly access: AccessContext;
    readonly hasApprovalPath?: boolean;
  }): Pick<CanvasModuleCard, 'availability' | 'requirements'> {
    const policy = this.registry.evaluatePolicy(input.block, input.access, {
      hasApprovalPath: input.hasApprovalPath,
    });
    const requirements = this.requirementsFor(
      input.block,
      input.hasApprovalPath,
    );
    const blockingRequirement = requirements.find(
      (requirement) => requirement.status === 'blocked',
    );
    const missingConnection = requirements.find(
      (requirement) =>
        requirement.kind === 'connection' && requirement.status === 'missing',
    );
    const missingTemplate = requirements.find(
      (requirement) =>
        requirement.kind === 'template' && requirement.status === 'missing',
    );
    const missingProfile = requirements.find(
      (requirement) =>
        requirement.kind === 'profile' && requirement.status === 'missing',
    );

    if (policy.status === 'blocked') {
      const first = policy.blocks[0];
      return {
        requirements,
        availability: {
          status: statusFromPolicyCode(first?.code),
          reason_code: first?.code ?? 'POLICY_BLOCKED',
          human_reason: first?.message ?? 'Модуль заблокирован политикой.',
          remediation: [],
        },
      };
    }

    if (blockingRequirement) {
      return {
        requirements,
        availability: {
          status: 'blocked_by_runtime',
          reason_code: blockingRequirement.code,
          human_reason: blockingRequirement.reason ?? blockingRequirement.label,
          remediation: [],
        },
      };
    }

    if (input.block.disabledReason || !input.block.enabled) {
      return {
        requirements,
        availability: {
          status: 'blocked_by_runtime',
          reason_code: 'BLOCK_UNSUPPORTED',
          human_reason:
            input.block.disabledReason ?? 'Модуль пока недоступен в Canvas.',
          remediation: [],
        },
      };
    }

    if (missingConnection) {
      return {
        requirements,
        availability: {
          status: 'missing_connection',
          reason_code: missingConnection.code,
          human_reason: missingConnection.reason ?? missingConnection.label,
          remediation: connectionRemediation(),
        },
      };
    }

    if (missingTemplate) {
      return {
        requirements,
        availability: {
          status: 'missing_template',
          reason_code: missingTemplate.code,
          human_reason: missingTemplate.reason ?? missingTemplate.label,
          remediation: [{ action: 'choose_template', label: 'Выбрать шаблон' }],
        },
      };
    }

    if (missingProfile) {
      return {
        requirements,
        availability: {
          status: 'missing_profile',
          reason_code: missingProfile.code,
          human_reason: missingProfile.reason ?? missingProfile.label,
          remediation: [{ action: 'choose_profile', label: 'Выбрать профиль' }],
        },
      };
    }

    if (policy.warnings.length > 0) {
      const first = policy.warnings[0];
      return {
        requirements,
        availability: {
          status: 'available_with_warnings',
          reason_code: first?.code ?? 'POLICY_WARNING',
          human_reason:
            first?.message ?? 'Модуль требует дополнительной проверки.',
          remediation: input.block.policies.requiresApproval
            ? [{ action: 'add_approval', label: 'Добавить согласование' }]
            : [],
        },
      };
    }

    return {
      requirements,
      availability: {
        status: 'available',
        reason_code: null,
        human_reason: null,
        remediation: [],
      },
    };
  }

  private requirementsFor(
    block: CanvasBlockDefinition,
    hasApprovalPath?: boolean,
  ): readonly ModuleRequirement[] {
    const requirements: ModuleRequirement[] = [];

    for (const input of block.inputs) {
      const key = input.key.toLocaleLowerCase('en-US');
      const label = input.label;
      if (key.includes('template')) {
        requirements.push({
          kind: 'template',
          code: `${block.code}:template`,
          label,
          required: input.required,
          status: input.required ? 'missing' : 'warning',
          reason: input.required ? 'Нужно выбрать шаблон.' : null,
        });
      } else if (key.includes('profile')) {
        requirements.push({
          kind: 'profile',
          code: `${block.code}:profile`,
          label,
          required: input.required,
          status: input.required ? 'missing' : 'warning',
          reason: input.required ? 'Нужно выбрать профиль работы.' : null,
        });
      } else if (input.required) {
        requirements.push({
          kind: 'step_output',
          code: `${block.code}:input:${input.key}`,
          label,
          required: true,
          status: 'warning',
          reason: 'Источник данных будет проверен после добавления блока.',
        });
      }
    }

    if (block.policies.isExternalAction || block.kind === 'delivery') {
      requirements.push({
        kind: 'connection',
        code: `${block.code}:connection`,
        label: 'Подключение канала доставки',
        required: true,
        status: 'missing',
        reason: 'Подключение нужно настроить до запуска или публикации.',
      });
    }

    if (block.policies.requiresApproval) {
      requirements.push({
        kind: 'approval',
        code: `${block.code}:approval`,
        label: 'Согласование',
        required: true,
        status: hasApprovalPath ? 'satisfied' : 'warning',
        reason: hasApprovalPath
          ? null
          : 'Перед выполнением нужен approval gate.',
      });
    }

    if (!block.runtime.provider) {
      requirements.push({
        kind: 'runtime_piece',
        code: `${block.code}:runtime`,
        label: 'Runtime mapping',
        required: true,
        status: 'blocked',
        reason: 'У модуля нет runtime mapping.',
      });
    }

    return requirements;
  }
}

function statusFromPolicyCode(
  code: string | undefined,
): ModuleAvailabilityStatus {
  if (code === 'ROLE_NOT_ALLOWED') {
    return 'blocked_by_role';
  }
  if (code === 'AI_ROUTE_FORBIDDEN_FOR_CLIENT_MATERIAL') {
    return 'blocked_by_data_policy';
  }
  if (code === 'BLOCK_UNSUPPORTED') {
    return 'blocked_by_runtime';
  }
  return 'blocked_by_runtime';
}

function connectionRemediation(): readonly ModuleRemediationAction[] {
  return [
    { action: 'configure_connection', label: 'Настроить подключение' },
    { action: 'request_connection', label: 'Запросить у администратора' },
    { action: 'add_as_draft', label: 'Добавить как черновик' },
    { action: 'cancel', label: 'Отмена' },
  ];
}
