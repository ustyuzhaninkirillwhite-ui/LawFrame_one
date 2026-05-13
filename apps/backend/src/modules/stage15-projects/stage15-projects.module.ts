import { Module } from '@nestjs/common';
import { ActivepiecesModule } from '../activepieces/activepieces.module';
import { AuditModule } from '../audit/audit.module';
import { AutomationLibraryModule } from '../automation-library/automation-library.module';
import { ChatModule } from '../chat/chat.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { Stage15ProjectsController } from './stage15-projects.controller';
import { Stage15ProjectsService } from './stage15-projects.service';
import { ProjectWebSearchService } from './project-web-search.service';

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    ChatModule,
    AuditModule,
    ActivepiecesModule,
    AutomationLibraryModule,
    DashboardModule,
  ],
  controllers: [Stage15ProjectsController],
  providers: [Stage15ProjectsService, ProjectWebSearchService],
})
export class Stage15ProjectsModule {}
