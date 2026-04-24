import { Module } from '@nestjs/common';
import { AutomationImportController } from './automation-import.controller';
import { AutomationImportService } from './automation-import.service';

@Module({
  controllers: [AutomationImportController],
  providers: [AutomationImportService],
  exports: [AutomationImportService],
})
export class AutomationImportModule {}
