import { Module, forwardRef } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [forwardRef(() => IdentityModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
