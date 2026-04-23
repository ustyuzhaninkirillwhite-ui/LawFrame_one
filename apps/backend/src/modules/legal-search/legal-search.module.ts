import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { LegalSearchController } from "./legal-search.controller";
import { LegalSearchService } from "./legal-search.service";

@Module({
  imports: [IdentityModule, DatabaseModule, AuditModule],
  controllers: [LegalSearchController],
  providers: [LegalSearchService],
  exports: [LegalSearchService],
})
export class LegalSearchModule {}
