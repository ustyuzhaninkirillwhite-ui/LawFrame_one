import { Module } from '@nestjs/common';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { IdentityModule } from '../identity/identity.module';
import { AiSecretService } from './ai-secret.service';
import { AiSettingsService } from './ai-settings.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [DatabaseModule, AuditModule, IdentityModule, AIGatewayModule],
  controllers: [SettingsController],
  providers: [SettingsService, AiSettingsService, AiSecretService],
  exports: [SettingsService, AiSettingsService, AiSecretService],
})
export class SettingsModule {}
