import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { LocalOwnerKeyVaultModule } from '../local-owner-key-vault/local-owner-key-vault.module';
import { SecretsModule } from '../secrets/secrets.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [
    IdentityModule,
    WorkflowsModule,
    AIGatewayModule,
    AuditModule,
    LocalOwnerKeyVaultModule,
    SecretsModule,
  ],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
