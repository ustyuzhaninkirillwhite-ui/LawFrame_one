import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TraceMiddleware } from './common/middleware/trace.middleware';
import { ActivepiecesModule } from './modules/activepieces/activepieces.module';
import { AIGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AdminConsoleModule } from './modules/admin-console/admin-console.module';
import { AuditModule } from './modules/audit/audit.module';
import { AutomationLibraryModule } from './modules/automation-library/automation-library.module';
import { CanvasModule } from './modules/canvas/canvas.module';
import { CanvasAiModule } from './modules/canvas-ai/canvas-ai.module';
import { AutomationImportModule } from './modules/automation-import/automation-import.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { DatabaseModule } from './modules/database/database.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DocumentGenerationModule } from './modules/document-generation/document-generation.module';
import { DocumentTemplatesModule } from './modules/document-templates/document-templates.module';
import { DocumentTypesModule } from './modules/document-types/document-types.module';
import { DocumentValidationModule } from './modules/document-validation/document-validation.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LegalIndexingModule } from './modules/legal-indexing/legal-indexing.module';
import { LegalModulesModule } from './modules/legal-modules/legal-modules.module';
import { LegalRagModule } from './modules/legal-rag/legal-rag.module';
import { LegalSearchModule } from './modules/legal-search/legal-search.module';
import { LegalSourcesModule } from './modules/legal-sources/legal-sources.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ClausesModule } from './modules/clauses/clauses.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OpsModule } from './modules/ops/ops.module';
import { ProfileImportsModule } from './modules/profile-imports/profile-imports.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ReadinessModule } from './modules/readiness/readiness.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RunsModule } from './modules/runs/runs.module';
import { SecretsModule } from './modules/secrets/secrets.module';
import { SecurityOperationsModule } from './modules/security-operations/security-operations.module';
import { Stage15ProjectsModule } from './modules/stage15-projects/stage15-projects.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    WorkspacesModule,
    AuthorizationModule,
    LegalModulesModule,
    AutomationLibraryModule,
    CanvasModule,
    CanvasAiModule,
    AutomationImportModule,
    WorkflowsModule,
    ActivepiecesModule,
    AIGatewayModule,
    DocumentsModule,
    ProfilesModule,
    DocumentTypesModule,
    ClausesModule,
    RealtimeModule,
    NotificationsModule,
    OpsModule,
    DashboardModule,
    TelemetryModule,
    SecretsModule,
    SecurityOperationsModule,
    Stage15ProjectsModule,
    ComplianceModule,
    AdminConsoleModule,
    DeliveryModule,
    DocumentTemplatesModule,
    DocumentValidationModule,
    ApprovalsModule,
    ProfileImportsModule,
    DocumentGenerationModule,
    LegalIndexingModule,
    LegalSourcesModule,
    LegalSearchModule,
    LegalRagModule,
    RunsModule,
    RecommendationsModule,
    AuditModule,
    ReadinessModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, TraceMiddleware).forRoutes('*');
  }
}
