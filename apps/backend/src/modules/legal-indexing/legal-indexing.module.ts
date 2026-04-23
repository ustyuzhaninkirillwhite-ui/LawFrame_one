import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { DocumentsModule } from "../documents/documents.module";
import { LegalIndexingService } from "./legal-indexing.service";

@Module({
  imports: [DatabaseModule, AuditModule, DocumentsModule],
  providers: [LegalIndexingService],
  exports: [LegalIndexingService],
})
export class LegalIndexingModule {}
