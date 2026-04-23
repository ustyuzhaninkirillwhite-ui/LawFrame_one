import { Module } from '@nestjs/common';
import { ActivepiecesModule } from '../activepieces/activepieces.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RunsController } from './runs.controller';
import { RunCommandService } from './run-command.service';
import { RunErrorClassifierService } from './run-error-classifier.service';
import { RunPreflightService } from './run-preflight.service';
import { RunSnapshotService } from './run-snapshot.service';
import { RunTransitionService } from './run-transition.service';
import { RunsService } from './runs.service';

@Module({
  imports: [
    IdentityModule,
    DocumentsModule,
    DatabaseModule,
    ActivepiecesModule,
    AuditModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [RunsController],
  providers: [
    RunsService,
    RunErrorClassifierService,
    RunTransitionService,
    RunPreflightService,
    RunSnapshotService,
    RunCommandService,
  ],
  exports: [RunTransitionService, RunSnapshotService],
})
export class RunsModule {}
