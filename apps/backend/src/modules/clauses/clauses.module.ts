import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { ClausesController } from './clauses.controller';
import { ClausesService } from './clauses.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [ClausesController],
  providers: [ClausesService],
  exports: [ClausesService],
})
export class ClausesModule {}
