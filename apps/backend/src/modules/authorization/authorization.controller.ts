import { RequiredPermissions } from '../../common/decorators/required-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';

@Controller('rbac')
@UseGuards(AuthGuard, WorkspaceContextGuard, PermissionGuard)
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get('roles')
  @RequiredPermissions('workspace.security.read')
  listRoles() {
    return this.authorizationService.listRoles();
  }

  @Get('permissions')
  @RequiredPermissions('workspace.security.read')
  listPermissions() {
    return this.authorizationService.listPermissions();
  }
}
