import { Module } from '@nestjs/common';
import { ActivepiecesModule } from '../activepieces/activepieces.module';
import { AutomationLibraryModule } from '../automation-library/automation-library.module';
import { ChatModule } from '../chat/chat.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { Stage15ProjectsController } from './stage15-projects.controller';
import { Stage15ProjectsService } from './stage15-projects.service';

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    ChatModule,
    ActivepiecesModule,
    AutomationLibraryModule,
    DashboardModule,
  ],
  controllers: [Stage15ProjectsController],
  providers: [Stage15ProjectsService],
})
export class Stage15ProjectsModule {}
