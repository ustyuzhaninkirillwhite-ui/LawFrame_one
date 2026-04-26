import type {
  CanvasConnectionRequirement,
  CanvasConnectionRequestResponse,
  CanvasConnectionRequirementsResponse,
  ModuleRemediationAction,
} from '@lexframe/contracts';
import type {
  AccessContext,
  AuthenticatedActor,
} from '../../common/types/lexframe-request';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConnectionRequirementsService {
  listRequirements(input: {
    readonly access: AccessContext;
    readonly moduleCode?: string | null;
  }): CanvasConnectionRequirementsResponse {
    if (input.moduleCode && !requiresConnection(input.moduleCode)) {
      return { requirements: [] };
    }

    const requirements: readonly CanvasConnectionRequirement[] = [
      {
        requirement_code: 'email_delivery:connection',
        label: 'Почтовое подключение',
        module_code: 'email_delivery',
        connection_type: 'email',
        status: 'missing',
        remediation: remediation(),
      },
    ];

    return {
      requirements: requirements.filter(
        (requirement) =>
          !input.moduleCode || requirement.module_code === input.moduleCode,
      ),
    };
  }

  createRequest(input: {
    readonly actor: AuthenticatedActor;
    readonly access: AccessContext;
    readonly moduleCode?: string | null;
    readonly connectionType?: string | null;
  }): CanvasConnectionRequestResponse {
    void input;
    return {
      request_id: randomUUID(),
      status: 'created',
    };
  }
}

function requiresConnection(moduleCode: string) {
  return moduleCode === 'email_delivery' || moduleCode.includes('delivery');
}

function remediation(): readonly ModuleRemediationAction[] {
  return [
    { action: 'configure_connection', label: 'Настроить подключение' },
    { action: 'request_connection', label: 'Запросить у администратора' },
    { action: 'add_as_draft', label: 'Добавить как черновик' },
    { action: 'cancel', label: 'Отмена' },
  ];
}
