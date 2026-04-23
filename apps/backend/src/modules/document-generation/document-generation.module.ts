import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { ClausesModule } from '../clauses/clauses.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { DocumentTypesModule } from '../document-types/document-types.module';
import { DocumentValidationModule } from '../document-validation/document-validation.module';
import { IdentityModule } from '../identity/identity.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { DocumentGenerationController } from './document-generation.controller';
import { DocumentGenerationService } from './document-generation.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    ProfilesModule,
    DocumentTemplatesModule,
    DocumentTypesModule,
    ClausesModule,
    DocumentValidationModule,
    ApprovalsModule,
  ],
  controllers: [DocumentGenerationController],
  providers: [DocumentGenerationService],
  exports: [DocumentGenerationService],
})
export class DocumentGenerationModule {}
