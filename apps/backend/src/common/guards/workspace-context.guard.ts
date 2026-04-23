import type { LexframeRequest } from '../types/lexframe-request';
import { AppHttpException } from '../errors/app-http.exception';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IdentityService } from '../../modules/identity/identity.service';

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(private readonly identityService: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LexframeRequest>();
    const actor = request.lexframe?.actor;

    if (!actor) {
      throw new AppHttpException(
        'AUTH_REQUIRED',
        401,
        'Authenticated actor context is required.',
      );
    }

    const preferredWorkspaceId =
      request.params.workspaceId ?? request.headers['x-workspace-id'];

    const access = await this.identityService.resolveAccessContext(
      actor,
      preferredWorkspaceId,
    );

    if (preferredWorkspaceId && !access) {
      throw new AppHttpException(
        'WORKSPACE_ACCESS_DENIED',
        403,
        'Requested workspace is not accessible.',
      );
    }

    request.lexframe = {
      ...(request.lexframe ?? {}),
      access: access ?? undefined,
    };

    return true;
  }
}
