import { createLogger } from '@lexframe/logger';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LiveEventsService } from './live-events.service';

@Injectable()
export class LiveEventPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly logger = createLogger('realtime.publisher');

  constructor(private readonly liveEventsService: LiveEventsService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger.warn('Live event publish tick failed.', {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      });
    }, 4_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const events = await this.liveEventsService.claimPending(25);

      for (const event of events) {
        try {
          const response = await fetch(
            this.liveEventsService.getBroadcastUrl(),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.liveEventsService.getRealtimeApiKey()}`,
                apikey: this.liveEventsService.getRealtimeApiKey(),
              },
              body: JSON.stringify({
                topic: event.topic,
                event: event.event_type,
                payload: this.liveEventsService.buildBroadcastPayload(event),
                private: true,
              }),
            },
          );

          if (!response.ok) {
            throw new Error(
              `Realtime broadcast failed with ${response.status}`,
            );
          }

          await this.liveEventsService.markPublished(event.id);
        } catch (error) {
          await this.liveEventsService.markFailed(event.id, error);
        }
      }
    } catch (error) {
      this.logger.warn('Unable to claim live events for publishing.', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    } finally {
      this.running = false;
    }
  }
}
