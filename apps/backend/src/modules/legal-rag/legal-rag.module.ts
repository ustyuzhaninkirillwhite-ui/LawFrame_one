import { Module } from "@nestjs/common";
import { AIGatewayModule } from "../ai-gateway/ai-gateway.module";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { LegalSearchModule } from "../legal-search/legal-search.module";
import { LegalRagController } from "./legal-rag.controller";
import { LegalRagService } from "./legal-rag.service";

@Module({
  imports: [
    IdentityModule,
    DatabaseModule,
    AuditModule,
    AIGatewayModule,
    LegalSearchModule,
  ],
  controllers: [LegalRagController],
  providers: [LegalRagService],
  exports: [LegalRagService],
})
export class LegalRagModule {}
