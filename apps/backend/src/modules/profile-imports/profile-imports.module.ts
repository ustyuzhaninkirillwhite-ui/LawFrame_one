import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { ProfileImportsController } from './profile-imports.controller';
import { ProfileImportsService } from './profile-imports.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule],
  controllers: [ProfileImportsController],
  providers: [ProfileImportsService],
})
export class ProfileImportsModule {}
