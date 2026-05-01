import { Module, forwardRef } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { SafeAuditWriter } from './safe-audit-writer';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [forwardRef(() => IdentityModule)],
  controllers: [AuditController],
  providers: [AuditService, SafeAuditWriter],
  exports: [AuditService, SafeAuditWriter],
})
export class AuditModule {}
