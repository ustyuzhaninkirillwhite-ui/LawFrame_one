import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { AutomationBlueprintCanvasConverterService } from './automation-blueprint-canvas-converter.service';
import { AutomationBlueprintValidatorService } from './automation-blueprint-validator.service';
import { AutomationBuilderController } from './automation-builder.controller';
import { AutomationBuilderService } from './automation-builder.service';
import { AutomationContextAssemblerService } from './automation-context-assembler.service';
import { AutomationRuntimeDraftService } from './automation-runtime-draft.service';

@Module({
  imports: [DatabaseModule, AuditModule, AIGatewayModule],
  controllers: [AutomationBuilderController],
  providers: [
    AutomationBuilderService,
    AutomationBlueprintValidatorService,
    AutomationBlueprintCanvasConverterService,
    AutomationContextAssemblerService,
    AutomationRuntimeDraftService,
  ],
  exports: [
    AutomationBuilderService,
    AutomationBlueprintValidatorService,
    AutomationBlueprintCanvasConverterService,
    AutomationContextAssemblerService,
    AutomationRuntimeDraftService,
  ],
})
export class AutomationBuilderModule {}
