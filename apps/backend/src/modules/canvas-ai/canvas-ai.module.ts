import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { CanvasModule } from '../canvas/canvas.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WorkflowCompilerModule } from '../workflow-compiler/workflow-compiler.module';
import { CanvasAiAuditService } from './canvas-ai-audit.service';
import { CanvasAiContextBuilder } from './canvas-ai-context-builder.service';
import { CanvasAiController } from './canvas-ai.controller';
import { CanvasAiOrchestrator } from './canvas-ai-orchestrator.service';
import { CanvasAiPromptBuilder } from './canvas-ai-prompt-builder.service';
import { CanvasAiRateLimitService } from './canvas-ai-rate-limit.service';
import { CanvasAiRedactionService } from './canvas-ai-redaction.service';
import { CanvasAiTelemetryService } from './canvas-ai-telemetry.service';
import { CanvasAiToolRegistry } from './canvas-ai-tool-registry.service';
import { CanvasDiffService } from './canvas-diff.service';
import { CanvasPatchApplyService } from './canvas-patch-apply.service';
import { CanvasPatchPlanner } from './canvas-patch-planner.service';
import { CanvasPatchValidator } from './canvas-patch-validator.service';
import { CanvasPolicyValidator } from './canvas-policy-validator.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    TelemetryModule,
    CanvasModule,
    AIGatewayModule,
    WorkflowCompilerModule,
  ],
  controllers: [CanvasAiController],
  providers: [
    CanvasAiAuditService,
    CanvasAiContextBuilder,
    CanvasAiOrchestrator,
    CanvasAiPromptBuilder,
    CanvasAiRateLimitService,
    CanvasAiRedactionService,
    CanvasAiTelemetryService,
    CanvasAiToolRegistry,
    CanvasDiffService,
    CanvasPatchApplyService,
    CanvasPatchPlanner,
    CanvasPatchValidator,
    CanvasPolicyValidator,
  ],
})
export class CanvasAiModule {}
