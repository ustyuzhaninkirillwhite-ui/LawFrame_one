import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
