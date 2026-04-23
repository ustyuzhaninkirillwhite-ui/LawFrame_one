import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LiveEventPublisherService } from './live-event-publisher.service';
import { LiveEventsService } from './live-events.service';

@Module({
  imports: [DatabaseModule],
  providers: [LiveEventsService, LiveEventPublisherService],
  exports: [LiveEventsService],
})
export class RealtimeModule {}
