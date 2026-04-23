import type { LexframeRequest } from '../types/lexframe-request';
import { AppHttpException } from '../errors/app-http.exception';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IdentityService } from '../../modules/identity/identity.service';

@Injectable()
export class AdminReauthGuard implements CanActivate {
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

    const token =
      request.headers['x-reauth-token'] ??
      request.headers['x-admin-reauth-token'] ??
      request.lexframe?.reauthToken ??
      null;

    if (!token) {
      throw new AppHttpException(
        'REAUTH_REQUIRED',
        403,
        'Administrative action requires reauthentication.',
      );
    }

    const valid = await this.identityService.validateReauthToken(actor, token);
    if (!valid) {
      throw new AppHttpException(
        'REAUTH_REQUIRED',
        403,
        'Administrative action requires a valid reauthentication token.',
      );
    }

    request.lexframe = {
      ...(request.lexframe ?? {}),
      reauthToken: token,
    };

    return true;
  }
}
