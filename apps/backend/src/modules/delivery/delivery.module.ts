import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryIntegrationsController } from './delivery-integrations.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    ApprovalsModule,
    NotificationsModule,
    AuditModule,
    RealtimeModule,
  ],
  controllers: [DeliveryController, DeliveryIntegrationsController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
