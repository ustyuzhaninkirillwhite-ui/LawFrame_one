import type { PermissionCode } from '@lexframe/contracts';
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'required_permissions';
export const RequiredPermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
