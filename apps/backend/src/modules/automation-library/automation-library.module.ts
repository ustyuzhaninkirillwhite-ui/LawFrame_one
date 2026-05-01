import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { AutomationLibraryController } from './automation-library.controller';
import { AutomationLibraryService } from './automation-library.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [AutomationLibraryController],
  providers: [AutomationLibraryService],
  exports: [AutomationLibraryService],
})
export class AutomationLibraryModule {}
