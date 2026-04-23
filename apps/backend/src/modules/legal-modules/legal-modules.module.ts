import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { LegalModulesController } from './legal-modules.controller';
import { LegalModulesService } from './legal-modules.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [LegalModulesController],
  providers: [LegalModulesService],
  exports: [LegalModulesService],
})
export class LegalModulesModule {}
