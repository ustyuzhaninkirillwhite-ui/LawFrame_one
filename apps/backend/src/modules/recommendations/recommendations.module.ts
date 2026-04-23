import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import {
  RecommendationAdminController,
  RecommendationsController,
} from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [
    IdentityModule,
    NotificationsModule,
    AuditModule,
    AIGatewayModule,
    TelemetryModule,
  ],
  controllers: [RecommendationsController, RecommendationAdminController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
