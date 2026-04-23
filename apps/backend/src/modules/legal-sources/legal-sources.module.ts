import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdentityModule } from '../identity/identity.module';
import { LegalIndexingModule } from '../legal-indexing/legal-indexing.module';
import { LegalSourcesController } from './legal-sources.controller';
import { LegalSourcesService } from './legal-sources.service';

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    AuditModule,
    DocumentsModule,
    LegalIndexingModule,
  ],
  controllers: [LegalSourcesController],
  providers: [LegalSourcesService],
  exports: [LegalSourcesService],
})
export class LegalSourcesModule {}
