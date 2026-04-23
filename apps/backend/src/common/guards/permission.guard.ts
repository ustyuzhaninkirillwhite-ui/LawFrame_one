import type { PermissionCode } from '@lexframe/contracts';
import type { LexframeRequest } from '../types/lexframe-request';
import { AppHttpException } from '../errors/app-http.exception';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from '../decorators/required-permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<LexframeRequest>();
    const access = request.lexframe?.access;

    if (!access) {
      throw new AppHttpException(
        'WORKSPACE_CONTEXT_REQUIRED',
        403,
        'Workspace context is required for this operation.',
      );
    }

    const available = new Set(access.permissions);
    const missing = required.filter((permission) => !available.has(permission));

    if (missing.length > 0) {
      throw new AppHttpException(
        'PERMISSION_DENIED',
        403,
        'Required permissions are missing for this operation.',
        {
          missingPermissions: missing,
        },
      );
    }

    return true;
  }
}
