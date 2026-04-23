import { Module } from '@nestjs/common';
import { RateLimitService } from '../../common/services/rate-limit.service';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { IdentityModule } from '../identity/identity.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [AuthorizationModule, IdentityModule, AuditModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, RateLimitService],
})
export class WorkspacesModule {}
