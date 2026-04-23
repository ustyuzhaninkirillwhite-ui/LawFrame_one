import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DevicesController } from './devices.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [DatabaseModule, IdentityModule, RealtimeModule],
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
