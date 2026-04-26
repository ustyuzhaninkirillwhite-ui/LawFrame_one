import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WorkflowCompilerModule } from '../workflow-compiler/workflow-compiler.module';
import { CanvasController } from './canvas.controller';
import { CanvasBlockPolicyService } from './canvas-block-policy.service';
import { CanvasBlockRegistryService } from './canvas-block-registry.service';
import { CanvasBlockRuntimeMappingService } from './canvas-block-runtime-mapping.service';
import { CanvasBlockValidationService } from './canvas-block-validation.service';
import { CanvasConnectionPolicyService } from './canvas-connection-policy.service';
import { CanvasDebugRedactionService } from './canvas-debug-redaction.service';
import { CanvasDryRunPolicyService } from './canvas-dry-run-policy.service';
import { CanvasAutoBindingService } from './canvas-auto-binding.service';
import { CanvasAuditService } from './canvas-audit.service';
import { CanvasAuthorizationService } from './canvas-authorization.service';
import { CanvasDataVisibilityService } from './canvas-data-visibility.service';
import { CanvasDraftService } from './canvas-draft.service';
import { CanvasFixtureService } from './canvas-fixture.service';
import { CanvasIoService } from './canvas-io.service';
import { CanvasLockService } from './canvas-lock.service';
import { CanvasModuleAvailabilityService } from './canvas-module-availability.service';
import { CanvasModuleCatalogService } from './canvas-module-catalog.service';
import { CanvasModuleCompatibilityService } from './canvas-module-compatibility.service';
import { CanvasModuleRecommendationService } from './canvas-module-recommendation.service';
import { CanvasModuleSearchService } from './canvas-module-search.service';
import { CanvasNodeFactory } from './canvas-node-factory.service';
import { CanvasOperationService } from './canvas-operation.service';
import { CanvasPinnedDataService } from './canvas-pinned-data.service';
import { CanvasPresentationService } from './canvas-presentation.service';
import { CanvasPublishingService } from './canvas-publishing.service';
import { CanvasRuntimeProjectionService } from './canvas-runtime-projection.service';
import { CanvasSecurityPolicyService } from './canvas-security-policy.service';
import { CanvasSecurityReviewService } from './canvas-security-review.service';
import { CanvasSnapshotService } from './canvas-snapshot.service';
import { CanvasStepInspectorService } from './canvas-step-inspector.service';
import { CanvasSupportBundleService } from './canvas-support-bundle.service';
import { CanvasTestArtifactService } from './canvas-test-artifact.service';
import { CanvasTestExecutor } from './canvas-test-executor.service';
import { CanvasTestPlanner } from './canvas-test-planner.service';
import { CanvasTestRunService } from './canvas-test-run.service';
import { CanvasValidationPersistenceService } from './canvas-validation-persistence.service';
import { CanvasValidationService } from './canvas-validation.service';
import { CanvasVersionDiffService } from './canvas-version-diff.service';
import { CanvasVersioningService } from './canvas-versioning.service';
import { ConnectionRequirementsService } from './connection-requirements.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    TelemetryModule,
    RealtimeModule,
    WorkflowCompilerModule,
  ],
  controllers: [CanvasController],
  providers: [
    CanvasBlockRegistryService,
    CanvasBlockPolicyService,
    CanvasBlockRuntimeMappingService,
    CanvasBlockValidationService,
    CanvasConnectionPolicyService,
    CanvasDebugRedactionService,
    CanvasDryRunPolicyService,
    CanvasAutoBindingService,
    CanvasAuditService,
    CanvasAuthorizationService,
    CanvasDataVisibilityService,
    CanvasDraftService,
    CanvasFixtureService,
    CanvasIoService,
    CanvasLockService,
    CanvasModuleAvailabilityService,
    CanvasModuleCatalogService,
    CanvasModuleCompatibilityService,
    CanvasModuleRecommendationService,
    CanvasModuleSearchService,
    CanvasNodeFactory,
    CanvasOperationService,
    CanvasPinnedDataService,
    CanvasPresentationService,
    CanvasPublishingService,
    CanvasRuntimeProjectionService,
    CanvasSecurityPolicyService,
    CanvasSecurityReviewService,
    CanvasSnapshotService,
    CanvasStepInspectorService,
    CanvasSupportBundleService,
    CanvasTestArtifactService,
    CanvasTestExecutor,
    CanvasTestPlanner,
    CanvasTestRunService,
    CanvasValidationPersistenceService,
    CanvasValidationService,
    CanvasVersionDiffService,
    CanvasVersioningService,
    ConnectionRequirementsService,
  ],
  exports: [
    CanvasDebugRedactionService,
    CanvasAuditService,
    CanvasAuthorizationService,
    CanvasDataVisibilityService,
    CanvasDraftService,
    CanvasIoService,
    CanvasLockService,
    CanvasModuleCatalogService,
    CanvasModuleSearchService,
    CanvasOperationService,
    CanvasPresentationService,
    CanvasSecurityPolicyService,
    CanvasSecurityReviewService,
    CanvasStepInspectorService,
    CanvasTestPlanner,
    CanvasTestRunService,
    CanvasValidationPersistenceService,
    CanvasValidationService,
    CanvasVersionDiffService,
    CanvasVersioningService,
  ],
})
export class CanvasModule {}
