import type { LexframeRequest } from '../types/lexframe-request';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../../modules/identity/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LexframeRequest>();
    const actor = await this.authService.authenticateFromHeader(
      request.headers.authorization,
    );

    request.lexframe = {
      ...(request.lexframe ?? {}),
      actor,
    };

    return true;
  }
}
