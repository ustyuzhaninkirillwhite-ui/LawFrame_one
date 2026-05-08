import type { AiDataClass, AiRouteCode } from '@lexframe/contracts';
import type { AiPolicyContext } from '../../common/types/lexframe-request';
import { AppHttpException } from '../../common/errors/app-http.exception';
import { Injectable } from '@nestjs/common';
import { AiModelRouteRegistryService } from './ai-route-registry.service';
import { AiRouteGroupResolverService } from './ai-route-group-resolver.service';

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
    const routeGroup = AiRouteGroupResolverService.routeGroupForRoute(
      input.routeCode,
    );

    if (
      routeGroup === 'automation_ai' &&
      input.caller !== 'admin' &&
      input.caller !== 'automation_builder'
    ) {
      throw new AppHttpException(
        'AI_ROUTE_NOT_ALLOWED',
        403,
        'Automation AI routes are reserved for backend automation planning.',
      );
    }

    if (
      input.dataClass === 'C_LEGAL_SECRET' &&
      routeGroup !== 'automation_ai'
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
