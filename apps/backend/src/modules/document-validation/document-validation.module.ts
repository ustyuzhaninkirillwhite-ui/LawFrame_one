import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClausesModule } from '../clauses/clauses.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentTemplatesModule } from '../document-templates/document-templates.module';
import { DocumentTypesModule } from '../document-types/document-types.module';
import { IdentityModule } from '../identity/identity.module';
import { DocumentValidationController } from './document-validation.controller';
import { DocumentValidationService } from './document-validation.service';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    IdentityModule,
    ClausesModule,
    DocumentTemplatesModule,
    DocumentTypesModule,
  ],
  controllers: [DocumentValidationController],
  providers: [DocumentValidationService],
  exports: [DocumentValidationService],
})
export class DocumentValidationModule {}
