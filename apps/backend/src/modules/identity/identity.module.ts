import { Module, forwardRef } from '@nestjs/common';
import { AdminReauthGuard } from '../../common/guards/admin-reauth.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthService } from './auth.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => AuditModule),
  ],
  controllers: [IdentityController],
  providers: [AuthService, IdentityService, AdminReauthGuard],
  exports: [AuthService, IdentityService, AdminReauthGuard],
})
export class IdentityModule {}
