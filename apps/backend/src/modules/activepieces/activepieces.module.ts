import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdentityModule } from '../identity/identity.module';
import { LocalOwnerKeyVaultModule } from '../local-owner-key-vault/local-owner-key-vault.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RuntimeModule } from '../runtime/runtime.module';
import { SecretsModule } from '../secrets/secrets.module';
import { WorkflowCompilerModule } from '../workflow-compiler/workflow-compiler.module';
import { ActivepiecesController } from './activepieces.controller';
import { ActivepiecesAuditWriter } from './activepieces-audit-writer';
import { ActivepiecesCanvasReadinessService } from './activepieces-canvas-readiness.service';
import { ActivepiecesCanvasProvisioningService } from './activepieces-canvas-provisioning.service';
import { ActivepiecesFlowProvisioningService } from './activepieces-flow-provisioning.service';
import { ActivepiecesIdentityBridge } from './activepieces-identity-bridge';
import { ActivepiecesJwtSigner } from './activepieces-jwt-signer';
import { ActivepiecesPiecesPolicyService } from './activepieces-pieces-policy.service';
import { ActivepiecesPostgresPoolService } from './activepieces-postgres-pool.service';
import { ActivepiecesRoleMapper } from './activepieces-role-mapper';
import { ActivepiecesSessionService } from './activepieces-session.service';
import { ActivepiecesService } from './activepieces.service';

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    AuditModule,
    DocumentsModule,
    ApprovalsModule,
    DeliveryModule,
    RealtimeModule,
    RuntimeModule,
    SecretsModule,
    WorkflowCompilerModule,
    LocalOwnerKeyVaultModule,
  ],
  controllers: [ActivepiecesController],
  providers: [
    ActivepiecesService,
    ActivepiecesCanvasProvisioningService,
    ActivepiecesCanvasReadinessService,
    ActivepiecesSessionService,
    ActivepiecesRoleMapper,
    ActivepiecesPiecesPolicyService,
    ActivepiecesPostgresPoolService,
    ActivepiecesIdentityBridge,
    ActivepiecesFlowProvisioningService,
    ActivepiecesJwtSigner,
    ActivepiecesAuditWriter,
  ],
  exports: [
    ActivepiecesService,
    ActivepiecesCanvasProvisioningService,
    ActivepiecesCanvasReadinessService,
    ActivepiecesSessionService,
    ActivepiecesPostgresPoolService,
  ],
})
export class ActivepiecesModule {}
