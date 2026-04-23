import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { SecurityOperationsController } from './security-operations.controller';
import { SecurityOperationsService } from './security-operations.service';

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [SecurityOperationsController],
  providers: [SecurityOperationsService],
  exports: [SecurityOperationsService],
})
export class SecurityOperationsModule {}
