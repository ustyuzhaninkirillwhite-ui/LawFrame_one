import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AutomationImportController } from './automation-import.controller';
import { AutomationImportService } from './automation-import.service';

@Module({
  imports: [IdentityModule],
  controllers: [AutomationImportController],
  providers: [AutomationImportService],
  exports: [AutomationImportService],
})
export class AutomationImportModule {}
