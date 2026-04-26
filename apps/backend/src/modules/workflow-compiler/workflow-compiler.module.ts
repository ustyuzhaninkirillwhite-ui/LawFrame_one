import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { CanvasValidationService } from '../canvas/canvas-validation.service';
import { ActivepiecesOperationsBuilder } from './activepieces-operations-builder.service';
import { ActivepiecesProjectionBuilder } from './activepieces-projection-builder.service';
import { ActivepiecesFlowParser } from './activepieces-flow-parser.service';
import { ActivepiecesReverseMapperService } from './activepieces-reverse-mapper.service';
import { ActivepiecesRuntimeClient } from './activepieces-runtime-client.service';
import { ActivepiecesSyncService } from './activepieces-sync.service';
import { CompileReportService } from './compile-report.service';
import { ConnectionRequirementResolver } from './connection-requirement-resolver.service';
import { RuntimeBindingService } from './runtime-binding.service';
import { RuntimeDiffService } from './runtime-diff.service';
import { RuntimeIRBuilder } from './runtime-ir-builder.service';
import { RuntimeSnapshotService } from './runtime-snapshot.service';
import { WorkflowCompilerService } from './workflow-compiler.service';
import { WorkflowGraphValidator } from './workflow-graph-validator.service';
import { WorkflowNormalizerService } from './workflow-normalizer.service';
import { WorkflowPolicyValidator } from './workflow-policy-validator.service';
import { WorkflowSemanticDiffService } from './workflow-semantic-diff.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [
    CanvasValidationService,
    WorkflowCompilerService,
    WorkflowNormalizerService,
    WorkflowGraphValidator,
    WorkflowPolicyValidator,
    RuntimeIRBuilder,
    ActivepiecesProjectionBuilder,
    ActivepiecesOperationsBuilder,
    ActivepiecesRuntimeClient,
    ActivepiecesSyncService,
    RuntimeBindingService,
    RuntimeSnapshotService,
    RuntimeDiffService,
    CompileReportService,
    ConnectionRequirementResolver,
    ActivepiecesFlowParser,
    ActivepiecesReverseMapperService,
    WorkflowSemanticDiffService,
  ],
  exports: [WorkflowCompilerService],
})
export class WorkflowCompilerModule {}
