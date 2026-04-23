import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesService } from './document-types.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [DocumentTypesController],
  providers: [DocumentTypesService],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
