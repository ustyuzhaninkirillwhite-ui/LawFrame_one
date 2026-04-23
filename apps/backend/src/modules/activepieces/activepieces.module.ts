import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdentityModule } from '../identity/identity.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivepiecesController } from './activepieces.controller';
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
  ],
  controllers: [ActivepiecesController],
  providers: [ActivepiecesService],
  exports: [ActivepiecesService],
})
export class ActivepiecesModule {}
