import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OpsModule } from '../ops/ops.module';
import { ReadinessModule } from '../readiness/readiness.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RunsModule } from '../runs/runs.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    RunsModule,
    ApprovalsModule,
    RecommendationsModule,
    NotificationsModule,
    OpsModule,
    ReadinessModule,
    RealtimeModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
