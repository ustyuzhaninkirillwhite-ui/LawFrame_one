import type { AiDataClass, AiRouteCode } from '@lexframe/contracts';
import type { AiPolicyContext } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { AiModelRouteRegistryService } from './ai-route-registry.service';

@Injectable()
export class AiRouteResolverService {
  constructor(private readonly routeRegistry: AiModelRouteRegistryService) {}

  resolve(input: {
    readonly routeCode: AiRouteCode;
    readonly dataClass: AiDataClass;
    readonly policy: AiPolicyContext;
    readonly caller:
      | 'chat'
      | 'agent'
      | 'rag'
      | 'canvas'
      | 'activepieces'
      | 'automation_builder'
      | 'admin';
  }) {
    if (
      input.routeCode === 'automation_planner_high' &&
      input.caller !== 'admin' &&
      input.caller !== 'automation_builder'
    ) {
      throw new AppHttpException(
        'AI_ROUTE_NOT_ALLOWED',
        403,
        'automation_planner_high is reserved for Stage 20 automation planning.',
      );
    }

    if (
      input.dataClass === 'C_LEGAL_SECRET' &&
      input.routeCode !== 'automation_planner_high'
    ) {
      throw new AppHttpException(
        'AI_POLICY_BLOCKED',
        403,
        'Legal secret material is blocked from the default external AI routes.',
      );
    }

    const route = this.routeRegistry.getRoute(input.routeCode);
    if (!route.enabled) {
      throw new AppHttpException(
        'AI_ROUTE_NOT_ALLOWED',
        403,
        'Selected AI route is disabled.',
      );
    }

    return route;
  }
}
